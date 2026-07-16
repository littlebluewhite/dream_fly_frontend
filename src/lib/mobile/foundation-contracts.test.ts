/* Foundation contract guards for the /mobile + /mobile-admin surfaces.
 *
 * This is a static-source check (no rendering) that protects the two remaining
 * contracts the parallel build relied on that the build itself still cannot
 * catch: route inventory, below (a deleted route only 404s at navigation time),
 * and css safety, below (two regression regexes `npm run check` doesn't cover).
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

describe('mobile 接縫收編不變量（卡 3：production source 零 $lib/member 直取）', () => {
	// mobile surface 的 production source（.test.ts/.fixture.svelte 已由 surfaceFiles
	// 的既有 walker 排除）只允許 api/stores/data/auth 四個 seam 檔 import $lib/member
	// ——其餘元件/頁面一律經 $lib/mobile/* 接縫取用。測試檔的直取（mobile/api.test.ts
	// 與四個 sheet/overlay 測試的 vi.mock '$lib/member/stores' 等）是佈線證明手段，
	// 明文豁免、不在本掃描範圍。掃 `from '$lib/member` 的 import/export-from 子句，
	// 註解裡的路徑提及不會誤中。
	const MOBILE_SEAM_FILES = ['src/lib/mobile/api.ts', 'src/lib/mobile/stores.ts', 'src/lib/mobile/data.ts', 'src/lib/mobile/auth.ts'].map(r);
	const MOBILE_DIRS = ['src/lib/mobile', 'src/routes/mobile'].map((d) => r(d) + '/'); // 尾斜線：排除 mobile-admin

	it('src/lib/mobile + src/routes/mobile 中，seam 四檔之外零 $lib/member import', () => {
		const offenders = surfaceFiles
			.filter((f) => MOBILE_DIRS.some((d) => f.startsWith(d)))
			.filter((f) => !MOBILE_SEAM_FILES.includes(f))
			.filter((f) => /from\s+['"]\$lib\/member/.test(readFileSync(f, 'utf8')))
			.map((f) => f.replace(ROOT + '/', ''));
		expect(offenders, `經 $lib/mobile 接縫取用，勿直取 $lib/member：${offenders.join(', ')}`).toEqual([]);
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
