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
	// 同行／其後的真違規 import 一併吞掉（靜默假陰性）。模板的 quasi 文字視為不透明
	// 跨度（specifier 本身的引號屬於 import 語法，match 起點在跨度外，不受影響）；
	// ${...} interpolation 是可執行程式碼，照常掃描（codex R4）。
	const stripCommentsPreserveStrings = (src: string): { code: string; stringSpans: [number, number][] } => {
		// codex R3b′：CRLF 先正規化成 LF——否則合法的「\ + CRLF」字串行接續會被
		// escape 分支吃掉 \+CR 後、裸 LF 觸發單行封頂誤斷成幻影（真字串內文的
		// import 字樣反而現形＝誤報）。「\ + LF」接續由既有 escape 分支自然吸收；
		// 跨度與比對都在正規化後的輸出上，內部一致。
		// codex R4：孤立 \r 同樣是行終結（ECMA LineTerminator）——一併正規化，否則
		// // 註解吞過 \r、幻影跨度跨過 \r，其後的真違規 import 被靜默放行。
		src = src.replace(/\r\n?/g, '\n');
		let code = '';
		const stringSpans: [number, number][] = [];
		// codex R4b：模板堆疊機。前一版 interpolation 用裸大括號配對，interpolation
		// 字串裡的 { 會抬高深度使配對「晚收束」——模板閉合反引號被當內文吞掉，模板
		// 之後的頂層真違規 import 一路被掩蓋到下一個反引號（靜默漏報，R4 引入的回歸）。
		// 堆疊機讓 interpolation 內文沿用與頂層完全相同的字串／註解／巢狀模板規則。
		// frame＝一層開著的模板：spanStart ≥ 0 表 quasi 模式（目前 quasi 跨度起點），
		// spanStart = -1 表 interpolation 模式（braceDepth 追蹤配對中的大括號）。
		const frames: { spanStart: number; braceDepth: number }[] = [];
		let i = 0;
		while (i < src.length) {
			const frame = frames[frames.length - 1];
			const ch = src[i];
			if (frame !== undefined && frame.spanStart >= 0) {
				// quasi 模式：不透明文字，只認閉合反引號、${、escape
				if (ch === '`') {
					code += ch;
					i++;
					stringSpans.push([frame.spanStart, code.length]);
					frames.pop();
				} else if (ch === '$' && src[i + 1] === '{') {
					// ${...} interpolation 是可執行程式碼——quasi 跨度到此收束，回到
					// code 模式照常掃描（codex R4；R4b 改堆疊機）
					stringSpans.push([frame.spanStart, code.length]);
					frame.spanStart = -1;
					frame.braceDepth = 0;
					code += '${';
					i += 2;
				} else if (ch === '\\') {
					code += ch + (src[i + 1] ?? '');
					i += 2;
				} else {
					code += ch;
					i++;
				}
				continue;
			}
			// code 模式（頂層或 interpolation 內文，規則完全相同）
			if (ch === '/' && src[i + 1] === '/') {
				// codex R4：U+2028/2029 也終結行註解（ECMA LineTerminator；\r 已正規化）——
				// 但不進下方單行封頂：ES2019 起兩者在字串字面值內合法，封頂認它們會誤殺真字串
				while (i < src.length && src[i] !== '\n' && src[i] !== '\u2028' && src[i] !== '\u2029') i++;
			} else if (ch === '/' && src[i + 1] === '*') {
				i += 2;
				while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
				i += 2;
			} else if (ch === '`') {
				frames.push({ spanStart: code.length, braceDepth: 0 });
				code += ch;
				i++;
			} else if (ch === "'" || ch === '"') {
				const start = code.length;
				code += ch;
				i++;
				let closed = false;
				while (i < src.length) {
					if (src[i] === ch) {
						closed = true;
						break;
					}
					// 引號字串單行封頂：JS 的 '/" 字串不能跨原始換行——掃到換行即為幻影
					// 開頭（regex 字面值內的引號、.svelte markup 的撇號），中止且不記跨度，
					// 讓後續行照常掃描（模板走上面的堆疊機分支，合法跨行）。
					if (src[i] === '\n') break;
					if (src[i] === '\\') {
						code += src[i] + (src[i + 1] ?? '');
						i += 2;
					} else {
						code += src[i];
						i++;
					}
				}
				if (closed) {
					code += src[i];
					i++;
					stringSpans.push([start, code.length]);
				}
				// 未閉合（跨行／至檔尾）＝非真字串：不記跨度。已知殘餘（均屬蓄意混淆而非
				// 意外漂移，對 tripwire 不成比例）：①同行內「含引號的 regex 字面值＋違規
				// import」（需完整 regex 語彙分析；跨行形已由單行封頂涵蓋）；②specifier 以
				// unicode escape 拼寫路徑字元（需完整反跳脫器）。
			} else if (frame !== undefined && ch === '{') {
				frame.braceDepth++;
				code += ch;
				i++;
			} else if (frame !== undefined && ch === '}') {
				if (frame.braceDepth === 0) {
					// interpolation 收束——回到 quasi 模式，跨度自 } 之後起算
					code += ch;
					i++;
					frame.spanStart = code.length;
				} else {
					frame.braceDepth--;
					code += ch;
					i++;
				}
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
			// codex R4：分類用煮熟值——「\ + 行終結」的行接續在執行期黏合為零字元，
			// specifier 原始拼寫先去接續再判 member reach（unicode escape 拼寫屬蓄意
			// 混淆，見殘餘註記）
			.map((m) => m[1].replace(/\\[\n\u2028\u2029]/g, ''));
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
			"const a = '/*'; import('$lib/member/stores'); const b = '*/';",
			// R3 走查：regex 字面值裡的引號不得開出跨行幻影字串跨度、吞掉下一行的違規 import（引號字串單行封頂）
			"const re = /['\"]/;\nimport { x } from '$lib/member/stores';",
			// codex R3b′：雙引號版幻影同樣要被封頂（殺「只封單引號」突變體）
			'const re = /["]/;\nimport { x } from "$lib/member/stores";',
			// codex R4：孤立 \r 也是 JS 行終結——註解與幻影跨度都必須止於它，否則其後的真違規被吞
			"// note\rimport('$lib/member/stores');",
			'const re = /["]/;\rimport { x } from "$lib/member/stores";',
			// codex R4：U+2028/2029 亦終結 // 註解——註解後的真違規 import 照常執行，不得被吞
			"// note\u2028import('$lib/member/stores');",
			// codex R4：specifier 內的「\ + 換行」行接續在執行期黏合為零字元——分類須用煮熟值
			"const m = import('$lib/mem\\\r\nber/stores');",
			// codex R4：模板 ${...} interpolation 是可執行程式碼——其內的 import() 不得被 quasi 跨度掩蓋
			'const t = `x${import("$lib/member/stores")}y`;',
			// codex R4b：interpolation 字串裡的 { 不得使配對晚收束——否則模板閉合反引號被吞，
			// 模板「之後」的頂層真違規一路被掩蓋到下一個反引號
			"function f() {\n\tconst t = `${'{'}`;\n}\nimport('$lib/member/stores');\nconst u = `x`;",
			// codex R4b：U+2029 終結註解與 U+2028 同款（殺「只擋 U+2028」突變體）
			"// note\u2029import('$lib/member/stores');",
			// codex R4b：specifier 內「\ + U+2028」行接續同樣要煮熟（殺「只煮 \n」突變體）
			"const m = import('$lib/mem\\\u2028ber/stores');",
			// codex R4b：第二個 interpolation 也要照常掃描（殺「只開放第一個」突變體）
			'const t = `a${1}b${import("$lib/member/stores")}c`;'
		];
		const NEGATIVE = [
			"import { x } from '$lib/membership/stores';",
			"import { x } from './member-card/util';",
			"// import { x } from '$lib/member/stores';",
			'const s = "$lib/member/stores";',
			// codex R3：字串裡的 import(...) 字樣不是 import；相對形須「解析後」落在 src/lib/member 才算（殺路徑段天真比對）
			'const snippet = \'import("$lib/member/stores")\';',
			"import { x } from './member/util';",
			// codex R3b′：真字串邊界的三種合法形——跳脫引號、跨行模板、\ + CRLF 行接續——內文的 import 字樣都不得誤中
			"const s = 'don\\'t import(\"$lib/member/stores\")';",
			'const t = `\nimport("$lib/member/stores")\n`;',
			"const s = 'x\\\r\nimport(\"$lib/member/stores\")';",
			// codex R4：U+2028 自 ES2019 起在字串字面值內合法——封頂不得認它為換行（字串內文照常受跨度保護）
			"const s = 'a\u2028import(\"$lib/member/stores\")';",
			// codex R4：quasi 文字仍不透明——模板帶 interpolation 時不得整段解除保護
			'const t = `import("$lib/member/stores") ${1}`;',
			// codex R4b：interpolation 收束後的「後綴 quasi」也要恢復不透明（殺「開放後不復歸」突變體）
			'const t = `x${1} import("$lib/member/stores") y`;',
			// codex R4b：interpolation 內的字串是字串——其內文的 import 字樣不得誤中（堆疊機在
			// interpolation 內沿用與頂層相同的字串跨度規則）
			"const t = `${ 'import(\"$lib/member/stores\")' }`;"
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
