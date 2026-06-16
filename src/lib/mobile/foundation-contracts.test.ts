/* Foundation contract guards for the /mobile + /mobile-admin surfaces.
 *
 * These are static-source checks (no rendering) that protect the three contracts
 * the parallel build relied on — and that the build itself CANNOT catch, because
 * a missing Lucide name renders nothing silently, an unregistered overlay id is a
 * runtime no-op, and a deleted route only 404s at navigation time:
 *   1. icon-registry completeness — every `<Icon name="…">` / data `icon:` used by
 *      the two surfaces resolves in the shared Icon.svelte registry.
 *   2. overlay-map completeness — every planned push/sheet id is registered in the
 *      surface's OverlayHost.
 *   3. route inventory — every bottom-tab + login route file exists. */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const r = (p: string) => resolve(ROOT, p);

function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = resolve(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const SURFACE_DIRS = ['src/lib/mobile', 'src/lib/mobile-admin', 'src/routes/mobile', 'src/routes/mobile-admin'].map(r);
const surfaceFiles = SURFACE_DIRS.flatMap(walk).filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith('.test.ts'));

describe('icon-registry completeness', () => {
	it('every icon used by the mobile + mobile-admin surfaces is registered in Icon.svelte', () => {
		const iconSrc = readFileSync(r('src/lib/components/ui/Icon.svelte'), 'utf8');
		const registered = new Set([...iconSrc.matchAll(/'([a-z0-9-]+)'\s*:/g)].map((m) => m[1]));

		const used = new Map<string, string>(); // name -> first file that uses it
		for (const file of surfaceFiles) {
			const text = readFileSync(file, 'utf8');
			const names: string[] = [];
			for (const m of text.matchAll(/<Icon\b[^>]*?\bname=(?:"([a-z0-9-]+)"|'([a-z0-9-]+)')/g)) names.push((m[1] ?? m[2])!);
			for (const m of text.matchAll(/\bicon:\s*(?:"([a-z0-9-]+)"|'([a-z0-9-]+)')/g)) names.push((m[1] ?? m[2])!);
			for (const n of names) if (!used.has(n)) used.set(n, file.replace(ROOT + '/', ''));
		}

		const missing = [...used].filter(([name]) => !registered.has(name)).map(([name, file]) => `${name} (${file})`);
		expect(missing, `unregistered icons → silent blank render:\n${missing.join('\n')}`).toEqual([]);
	});
});

describe('overlay-map completeness', () => {
	const cases: Array<[string, string, string[]]> = [
		[
			'mobile',
			'src/lib/mobile/OverlayHost.svelte',
			['courseDetail', 'schedule', 'report', 'points', 'orders', 'settings', 'trial', 'course', 'cart', 'leave', 'makeup', 'contact', 'editProfile']
		],
		[
			'mobile-admin',
			'src/lib/mobile-admin/OverlayHost.svelte',
			['coaches', 'venues', 'tickets', 'reports', 'settings', 'messageThread', 'member', 'class', 'order', 'memberForm', 'classForm', 'coachForm', 'notif', 'role', 'studentSkills']
		]
	];
	for (const [surface, file, ids] of cases) {
		it(`${surface} OverlayHost registers every planned push/sheet id`, () => {
			const src = readFileSync(r(file), 'utf8');
			const missing = ids.filter((id) => !new RegExp(`\\b${id}\\s*:`).test(src));
			expect(missing, `overlay ids missing from ${file}: ${missing.join(', ')}`).toEqual([]);
		});
	}
});

describe('route inventory', () => {
	const routes = [
		'src/routes/mobile/+layout.svelte',
		'src/routes/mobile/+page.svelte',
		'src/routes/mobile/courses/+page.svelte',
		'src/routes/mobile/mine/+page.svelte',
		'src/routes/mobile/notifications/+page.svelte',
		'src/routes/mobile/account/+page.svelte',
		'src/routes/mobile/login/+page@.svelte',
		'src/routes/mobile-admin/+layout.svelte',
		'src/routes/mobile-admin/+page.svelte',
		'src/routes/mobile-admin/login/+page@.svelte',
		'src/routes/mobile-admin/admin/+page.svelte',
		'src/routes/mobile-admin/admin/members/+page.svelte',
		'src/routes/mobile-admin/admin/classes/+page.svelte',
		'src/routes/mobile-admin/admin/orders/+page.svelte',
		'src/routes/mobile-admin/admin/more/+page.svelte',
		'src/routes/mobile-admin/coach/+page.svelte',
		'src/routes/mobile-admin/coach/attendance/+page.svelte',
		'src/routes/mobile-admin/coach/students/+page.svelte',
		'src/routes/mobile-admin/coach/messages/+page.svelte',
		'src/routes/mobile-admin/coach/csettings/+page.svelte'
	];
	it('every bottom-tab + login route file exists', () => {
		const missing = routes.filter((p) => !existsSync(r(p)));
		expect(missing, `missing route files: ${missing.join(', ')}`).toEqual([]);
	});
});

describe('css safety (codex P2/P3 regressions)', () => {
	const svelteFiles = surfaceFiles.filter((f) => f.endsWith('.svelte'));

	it('no .m-bottom-inset element overrides its safe-area bottom with a `padding:` shorthand', () => {
		const re = /class="[^"]*\bm-bottom-inset\b[^"]*"\s*style="([^"]*)"/gs;
		const offenders: string[] = [];
		for (const file of svelteFiles) {
			for (const m of readFileSync(file, 'utf8').matchAll(re)) {
				if (/\bpadding:\s/.test(m[1])) offenders.push(file.replace(ROOT + '/', ''));
			}
		}
		expect(offenders, `padding shorthand kills env(safe-area-inset-bottom) on: ${offenders.join(', ')}`).toEqual([]);
	});

	it('never suffixes a CSS var() with raw hex alpha (var(--x)1A is dropped by browsers)', () => {
		// Only the literal form is unambiguous: `{c.color}1A` is VALID when color is
		// an 8-digit-completing hex (e.g. #0066CC1A), so we cannot flag `}1A`; but a
		// literal `var(--x)1A` is always invalid. (The account-menu bug was a var.)
		const offenders: string[] = [];
		for (const file of svelteFiles) {
			if (/var\(--[a-z0-9-]+\)[0-9a-f]{1,2}\b/i.test(readFileSync(file, 'utf8'))) {
				offenders.push(file.replace(ROOT + '/', ''));
			}
		}
		expect(offenders, `invalid literal var()+hex-alpha in: ${offenders.join(', ')}`).toEqual([]);
	});
});
