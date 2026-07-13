/* Foundation contract guards for the /mobile + /mobile-admin surfaces.
 *
 * This is a static-source check (no rendering) that protects the one remaining
 * contract the parallel build relied on which the build itself still cannot
 * catch — a deleted route only 404s at navigation time: route inventory, below,
 * checks every bottom-tab + login route file exists.
 *
 * icon-registry completeness(原①)已退役(T12/K6-3)：Icon.svelte 的 `name` prop
 * 收窄為 `IconName`(見 $lib/icon-registry)後，未註冊的 icon 名稱在編譯期就會被
 * `npm run check` 擋下——型別系統本身即是這條契約的實作，不再需要這裡的執行期
 * 原始碼掃描重複把關，也沒有空窗(check 覆蓋全倉，是比原掃描更嚴格的超集)。
 *
 * overlay-map completeness(原②)已退役(T12/K6-4)：createOverlay 收斂為
 * PushId/SheetId 雙泛型(見 $lib/components/mobile/overlay)，兩個 OverlayHost 的
 * PUSH/SHEETS 表改 `Record<union, Comp>` 後，漏鍵/多餘鍵在編譯期雙向擋下——是
 * 原掃描的嚴格超集，且多驗到一條原掃描從未覆蓋的保障：呼叫端 push()/sheet()
 * 傳入的 id 也必須屬於該 surface 的註冊集合(原掃描只查「計畫中的 id 有沒有
 * 出現在 OverlayHost」，反過來「呼叫端有沒有傳出界」完全沒查)。 */

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

const SURFACE_DIRS = ['src/lib/mobile', 'src/lib/mobile-admin', 'src/lib/components/mobile', 'src/routes/mobile', 'src/routes/mobile-admin'].map(r);
const surfaceFiles = SURFACE_DIRS.flatMap(walk).filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.fixture.svelte'));

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
