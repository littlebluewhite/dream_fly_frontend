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
import { resolve, dirname } from 'node:path';

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

	// codex R1+R2+R3：掃描器要求——涵蓋靜態 from / side-effect import / 動態 import()
	// （含 /* @vite-ignore */ 註解形與簡單模板字串）與相對路徑逃逸；不誤中註解、
	// 一般字串（含字串內的 //、/* 記號與 import(...) 字樣，兩向皆不得誤判）、
	// $lib/membership、本地 ./member* 路徑。做法：字串感知剝註解並記錄字串跨度，
	// 再抽 import 位置的 specifier（match 起點落在字串跨度內者丟棄），$lib 形以
	// 路徑段精確比對、相對形解析回絕對路徑後檢查是否落在 src/lib/member 之下。
	// 掃描器本身由下面的 fixture 自證 it 把關（掃描器退化成空集合時自證 it 先紅，
	// 兩條契約 it 不會靜默假綠）。
	// codex R3：剝註解必須字串感知——正規式版把字串裡的 // 或 /* 當註解起點，會把
	// 同行／其後的真違規 import 一併吞掉（靜默假陰性）。模板字面值視為不透明跨度
	// 即可（specifier 本身的引號屬於 import 語法，match 起點在跨度外，不受影響）。
	const stripCommentsPreserveStrings = (src: string): { code: string; stringSpans: [number, number][] } => {
		let code = '';
		const stringSpans: [number, number][] = [];
		let i = 0;
		while (i < src.length) {
			const ch = src[i];
			if (ch === '/' && src[i + 1] === '/') {
				while (i < src.length && src[i] !== '\n') i++;
			} else if (ch === '/' && src[i + 1] === '*') {
				i += 2;
				while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
				i += 2;
			} else if (ch === "'" || ch === '"' || ch === '`') {
				const start = code.length;
				code += ch;
				i++;
				while (i < src.length && src[i] !== ch) {
					if (src[i] === '\\') {
						code += src[i] + (src[i + 1] ?? '');
						i += 2;
					} else {
						code += src[i];
						i++;
					}
				}
				code += src[i] ?? ''; // 收尾引號（未終結字串則至檔尾）
				i++;
				stringSpans.push([start, code.length]);
			} else {
				code += ch;
				i++;
			}
		}
		return { code, stringSpans };
	};
	const importSpecifiers = (src: string): string[] => {
		const { code, stringSpans } = stripCommentsPreserveStrings(src);
		return [...code.matchAll(/\b(?:from|import)\s*\(?\s*['"`]([^'"`]+)['"`]/g)]
			.filter((m) => {
				const at = m.index ?? 0;
				return !stringSpans.some(([s, e]) => at >= s && at < e);
			})
			.map((m) => m[1]);
	};
	const MEMBER_DIR = r('src/lib/member');
	const isMemberReach = (file: string, spec: string): boolean => {
		if (spec === '$lib/member' || spec.startsWith('$lib/member/')) return true;
		if (!spec.startsWith('.')) return false;
		const resolved = resolve(dirname(file), spec);
		return resolved === MEMBER_DIR || resolved.startsWith(MEMBER_DIR + '/');
	};

	it('掃描器自證：違規形全數命中、近似形不誤中（含字串感知兩向）', () => {
		const fakeFile = r('src/lib/mobile/overlays/Fake.svelte');
		const POSITIVE = [
			"import { x } from '$lib/member/stores';",
			"import '$lib/member/stores';",
			"const m = await import('$lib/member/stores');",
			"const m = await import(/* @vite-ignore */ '$lib/member/stores');",
			'const m = await import(`$lib/member/${name}`);',
			"export { x } from '../../member/stores';",
			// codex R3：字串內的 // 與 /* 不是註解——剝註解若吞掉字串，同行／夾在中間的違規 import 會被靜默放行
			"const u = 'https://a.b'; const m = import('$lib/member/stores');",
			"const a = '/*'; import('$lib/member/stores'); const b = '*/';"
		];
		const NEGATIVE = [
			"import { x } from '$lib/membership/stores';",
			"import { x } from './member-card/util';",
			"// import { x } from '$lib/member/stores';",
			'const s = "$lib/member/stores";',
			// codex R3：字串裡的 import(...) 字樣不是 import；相對形須「解析後」落在 src/lib/member 才算（殺路徑段天真比對）
			'const snippet = \'import("$lib/member/stores")\';',
			"import { x } from './member/util';"
		];
		for (const src of POSITIVE)
			expect(importSpecifiers(src).some((s) => isMemberReach(fakeFile, s)), `應命中：${src}`).toBe(true);
		for (const src of NEGATIVE)
			expect(importSpecifiers(src).some((s) => isMemberReach(fakeFile, s)), `不應命中：${src}`).toBe(false);
	});

	it('src/lib/mobile + src/routes/mobile 中，seam 四檔之外零 $lib/member import（含動態/side-effect/相對形）', () => {
		const offenders = surfaceFiles
			.filter((f) => MOBILE_DIRS.some((d) => f.startsWith(d)))
			.filter((f) => !MOBILE_SEAM_FILES.includes(f))
			.filter((f) => importSpecifiers(readFileSync(f, 'utf8')).some((s) => isMemberReach(f, s)))
			.map((f) => f.replace(ROOT + '/', ''));
		expect(offenders, `經 $lib/mobile 接縫取用，勿直取 $lib/member：${offenders.join(', ')}`).toEqual([]);
	});

	// codex R1：identity pin 驗「同參照」驗不出「繞道 barrel 之下的深模組」——若
	// stores.ts 改從 $lib/member/leave 直接 re-export，參照仍同、但 sheet/overlay
	// 測試的 vi.mock('$lib/member/stores') 會不再攔截。源路徑白名單補上這一角。
	it('mobile/stores.ts 的 $lib/member 源路徑僅限白名單四模組（stores/checkout/leave-form/cancel-leave）', () => {
		const ALLOWED = ['$lib/member/stores', '$lib/member/checkout', '$lib/member/leave-form', '$lib/member/cancel-leave'];
		const storesFile = r('src/lib/mobile/stores.ts');
		const offenders = importSpecifiers(readFileSync(storesFile, 'utf8'))
			.filter((s) => isMemberReach(storesFile, s))
			.filter((s) => !ALLOWED.includes(s));
		expect(offenders, `mobile/stores.ts 出現白名單外的 member 源路徑：${offenders.join(', ')}`).toEqual([]);
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
