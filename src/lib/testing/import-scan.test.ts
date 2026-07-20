/* 匯入掃描器（Import Scan）自證 fixture ＋ dogfood 契約。
 *
 * 39 個自證 fixture 自 src/lib/mobile/foundation-contracts.test.ts 逐字搬入（六輪 codex
 * 硬化的違規／近似形殺手集，機制與 provenance 見 import-scan.ts 檔頭）；以
 * makeReachPredicate('$lib/member', …) 綁定，fixture 字面零改動。dogfood 契約用模組自己
 * 的 walk ＋ makeReachPredicate 掃 production 原始碼（src/lib ＋ src/routes），斷言測試支援
 * 模組 $lib/testing 不洩入 production bundle（node:fs 天然屏障之外的執行期防線）。 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { walk, importSpecifiers, makeReachPredicate } from './import-scan';

const ROOT = process.cwd();
const r = (p: string) => resolve(ROOT, p);
const MEMBER_DIR = r('src/lib/member');
const isMemberReach = makeReachPredicate('$lib/member', MEMBER_DIR);

describe('匯入掃描器（Import Scan）', () => {
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
			'const t = `a${1}b${import("$lib/member/stores")}c`;',
			// codex R4c：interpolation 內裸大括號（物件字面值）要正確配對——殺「每個 } 都
			// 復歸 quasi」突變體（該突變體會把同段其後的 import 當 quasi 掩蓋）
			'const t = `${ fn({a: 1}) + import("$lib/member/stores") }`;',
			// codex R4c：巢狀模板 pop 後外層 frame 必須還在——殺「單一可變 frame」突變體
			// （該突變體在內層模板閉合時清空 frame，外層閉合反引號反開幻影模板，掩蓋其後頂層 import）
			'const t = `${ `x` }`;\nimport("$lib/member/stores");\nconst u = `y`;',
			// codex R4c：幻影反引號（regex 內）開的模板到 EOF 未閉合——quasi 跨度不得提前
			// 生效（跨度掛起於 frame、閉合才沖入），否則字串裡的 ${ 提交跨度、真 import 被濾
			"const re = /`/; import { x } from '$lib/member/stores'; const s = 'x${y}';",
			// codex R4c：specifier 內「\ + U+2029」行接續同樣要煮熟（殺「只煮 \n 與 U+2028」突變體）
			"const m = import('$lib/mem\\\u2029ber/stores');",
			// codex R4d：pending 屬於各自的 frame——內層真模板閉合只沖入「自己的」跨度，
			// 不得把外層未閉合幻影的掛起跨度一併沖入（否則幻影 quasi 吞過的真 import
			// 被跨度掩蓋；殺「pending 全 frame 共用」突變體）
			"const re = /`/; import { x } from '$lib/member/stores'; const s = 'a${ `t` }';"
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
			"const t = `${ 'import(\"$lib/member/stores\")' }`;",
			// codex R4c：\${ 是跳脫的字面文字、非 interpolation——其後的 import 字樣仍屬 quasi 不透明
			'const t = `a\\${import("$lib/member/stores")}b`;',
			// codex R4d：外層幻影未閉合不連坐「已閉合的內層模板」——內層 quasi 的 import
			// 字樣仍受自己已沖入的跨度保護（殺「外層未閉合即丟棄內層跨度」突變體）
			"const re = /`/; const s = 'a${ `import(\"$lib/member/stores\")` }';"
		];
		for (const src of POSITIVE)
			expect(importSpecifiers(src).some((s) => isMemberReach(fakeFile, s)), `應命中：${src}`).toBe(true);
		for (const src of NEGATIVE)
			expect(importSpecifiers(src).some((s) => isMemberReach(fakeFile, s)), `不應命中：${src}`).toBe(false);
	});

	it('dogfood 契約：production 原始碼（src/lib ＋ src/routes）零 import $lib/testing', () => {
		const reachesTesting = makeReachPredicate('$lib/testing', r('src/lib/testing'));
		const productionFiles = ['src/lib', 'src/routes']
			.map(r)
			.flatMap(walk)
			.filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.fixture.svelte'));
		// F3 tripwire：walk() 死亡（→ []）時 offenders 對空集合 vacuous pass——先釘掃描
		// 檔數下限。此釘殺 `walk → []` 突變（鬆釘防機器死亡，非精確計數；現況約 370 檔）。
		expect(productionFiles.length).toBeGreaterThan(100);
		const offenders = productionFiles
			.filter((f) => importSpecifiers(readFileSync(f, 'utf8')).some((s) => reachesTesting(f, s)))
			.map((f) => f.replace(ROOT + '/', ''));
		expect(offenders, `production 不得 import 測試支援模組 $lib/testing：${offenders.join(', ')}`).toEqual([]);
	});
});
