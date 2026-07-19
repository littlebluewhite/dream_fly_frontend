/* 匯入掃描器（Import Scan）— 靜態原始碼匯入掃描的 test-support 模組。
 *
 * Provenance：自 src/lib/mobile/foundation-contracts.test.ts 的 seam describe 內原地升格
 * （walk / stripCommentsPreserveStrings / importSpecifiers / isMemberReach 與 39 個自證
 * fixture）；isMemberReach 泛化為 makeReachPredicate（alias 與 targetDir 為資料組態、非
 * 行為旗標）。原碼經六輪 codex 硬化，指標 6430629…4f5417a：R1 補四種 import 形＋源路徑
 * 白名單、R2 對抗審、R3a 字串感知剝註解、R3b 引號字串單行封頂、R3b′ CRLF 正規化、R4 行
 * 終結對齊 ECMA＋specifier 煮熟值＋interpolation 掃描、R4b 模板堆疊機、R4c quasi 跨度掛起
 * 制、R4d 混合生命週期補殺。一檔拆三檔（不用 git mv、同 commit 增刪對開、搬移行逐字位元
 * 不動），git blame -w -C 可考古。39 個自證 fixture 現居同目錄 import-scan.test.ts。 */

// codex R1+R2+R3：掃描器要求——涵蓋靜態 from / side-effect import / 動態 import()
// （含 /* @vite-ignore */ 註解形與簡單模板字串）與相對路徑逃逸；不誤中註解、
// 一般字串（含字串內的 //、/* 記號與 import(...) 字樣，兩向皆不得誤判）、
// $lib/membership、本地 ./member* 路徑。做法：字串感知剝註解並記錄字串跨度，
// 再抽 import 位置的 specifier（match 起點落在字串跨度內者丟棄），$lib 形以
// 路徑段精確比對、相對形解析回絕對路徑後檢查是否落在目標目錄之下。掃描器本身由
// import-scan.test.ts 的 39 個自證 fixture 把關（退化成空集合時自證 it 先紅，
// 消費端契約 it 不會靜默假綠）。
// codex R3：剝註解必須字串感知——正規式版把字串裡的 // 或 /* 當註解起點，會把
// 同行／其後的真違規 import 一併吞掉（靜默假陰性）。模板的 quasi 文字視為不透明
// 跨度（specifier 本身的引號屬於 import 語法，match 起點在跨度外，不受影響）；
// ${...} interpolation 是可執行程式碼，照常掃描（codex R4）。

import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = resolve(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

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
	// codex R4c：quasi 跨度掛起於 frame（pending），閉合反引號 pop 時才沖入
	// stringSpans——與引號字串「未閉合不記跨度」同紀律。否則幻影反引號（regex
	// 內）開的模板到 EOF 未閉合時，字串裡的 ${ 已提交跨度、其前被消費的真
	// import 遭靜默濾除（前版未閉合不記跨度、該形抓得到＝回歸窗）。
	const frames: { spanStart: number; braceDepth: number; pending: [number, number][] }[] = [];
	let i = 0;
	while (i < src.length) {
		const frame = frames[frames.length - 1];
		const ch = src[i];
		if (frame !== undefined && frame.spanStart >= 0) {
			// quasi 模式：不透明文字，只認閉合反引號、${、escape
			if (ch === '`') {
				code += ch;
				i++;
				frame.pending.push([frame.spanStart, code.length]);
				stringSpans.push(...frame.pending);
				frames.pop();
			} else if (ch === '$' && src[i + 1] === '{') {
				// ${...} interpolation 是可執行程式碼——quasi 跨度到此收束，回到
				// code 模式照常掃描（codex R4；R4b 改堆疊機）
				frame.pending.push([frame.spanStart, code.length]);
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
			frames.push({ spanStart: code.length, braceDepth: 0, pending: [] });
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
			// 意外漂移，對 tripwire 不成比例）：①regex 字面值需完整語彙分析——引號形
			// 同行殘餘（跨 \n 已由單行封頂涵蓋；U+2028/2029 刻意不觸發封頂，跨此二
			// 分隔符的引號配對仍可掩蓋）；反引號形開幻影模板（模板合法跨行、無封頂
			// 可用），未閉合到 EOF 由 pending 丟棄兜底（丟棄使幻影 quasi 吞過的真字串
			// ／註解內文現形＝誤報向），若後方恰有真反引號配對閉合，其間內容仍被當
			// quasi 掩蓋；②specifier 以 unicode escape 拼寫路徑字元（需完整反跳脫器）。
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
export const importSpecifiers = (src: string): string[] => {
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

/** 產生「某 import specifier 是否 reach 到 alias／目標目錄」的判定式。alias 與 targetDir
 *  是資料組態（非行為旗標）：alias 形以前綴精確比對，相對形解析回絕對路徑後檢查是否落在
 *  targetDir 之下。 */
export function makeReachPredicate(alias: string, targetDir: string): (file: string, spec: string) => boolean {
	return (file: string, spec: string): boolean => {
		if (spec === alias || spec.startsWith(alias + '/')) return true;
		if (!spec.startsWith('.')) return false;
		const resolved = resolve(dirname(file), spec);
		return resolved === targetDir || resolved.startsWith(targetDir + '/');
	};
}
