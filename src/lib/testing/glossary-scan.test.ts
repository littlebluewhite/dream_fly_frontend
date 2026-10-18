/* Dream Fly — GLOSSARY 文件掃描。
 *
 * GLOSSARY 是詞彙表：每條只有一兩句「它是什麼」與 `_Avoid_`，技術用語再點名 owner module；規則住在
 * owner module 的檔頭。本檔逐條掃 GLOSSARY.md，擋住實作細節長回來：原始碼檔案路徑或副檔名、行號、commit
 * hash、輪次編號(R-n)、定義段落超過 200 字元、超過 2 個 code span、缺 `_Avoid_`、`_Avoid_` 之後還有文字、
 * `**` 開頭卻不是 `**詞**:` 的行。ADR 編號可以引用。
 * owner module 以 `$lib` 之下、不帶副檔名的名字點名(例如 `hydration-gate`、`coach/api`)。
 * 沒有豁免清單：寫不下就拆詞，或把內容搬回檔頭。
 *
 * 照匯入掃描器的慣例，先用一份該過、一份該紅的樣本自證，再掃真檔，並釘住條目數下限，
 * 解析壞掉或掃到零條時不會假綠。 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_DEFINITION_CHARS = 200;
const MAX_CODE_SPANS = 2;

type Entry = { term: string; wellFormed: boolean; definition: string; text: string; hasAvoid: boolean; afterAvoid: boolean };

/** 條目從 `**` 開頭那行開始，到下一條或下一個標題為止；定義段落是詞那行之後、`_Avoid_` 之前的文字。
 *  `**` 開頭卻不是 `**詞**:`(例如全形冒號)也自成一條、標成格式錯，它的文字不會併進上一條。 */
function parseEntries(markdown: string): Entry[] {
	const entries: Entry[] = [];
	let current: { term: string; wellFormed: boolean; lines: string[] } | null = null;
	const close = () => {
		if (current === null) return;
		const avoidAt = current.lines.findIndex((line) => line.startsWith('_Avoid_'));
		const definitionLines = avoidAt === -1 ? current.lines : current.lines.slice(0, avoidAt);
		entries.push({
			term: current.term,
			wellFormed: current.wellFormed,
			definition: definitionLines.map((line) => line.trim()).join(''),
			text: [`**${current.term}**:`, ...current.lines].join('\n'),
			hasAvoid: avoidAt !== -1,
			afterAvoid: avoidAt !== -1 && avoidAt < current.lines.length - 1
		});
		current = null;
	};
	for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
		if (line.startsWith('**')) {
			close();
			const head = /^\*\*(.+?)\*\*(:?)\s*(.*)$/.exec(line);
			current =
				head === null
					? { term: line, wellFormed: false, lines: [] }
					: { term: head[1], wellFormed: head[2] === ':', lines: head[3] === '' ? [] : [head[3]] };
		} else if (line.startsWith('#')) {
			close();
		} else if (current !== null && line.trim() !== '') {
			current.lines.push(line);
		}
	}
	close();
	return entries;
}

const RULES: { rule: string; test: (e: Entry) => boolean }[] = [
	{ rule: '詞那行不是 **詞**:', test: (e) => !e.wellFormed },
	{ rule: '原始碼檔案路徑', test: (e) => /(?:^|[^\w$./-])(?:src|\$lib|docs|scripts|static|\.\.?)\/[\w$.-]/m.test(e.text) },
	{ rule: '副檔名', test: (e) => /\.(?:ts|tsx|js|mjs|cjs|svelte|rs|json|md|css|html|sh)\b/.test(e.text) },
	{ rule: '行號', test: (e) => /:\d+\b|#L\d+|\bL\d+\b|第\s*\d+\s*行|\b[Ll]ines?\s+\d+/.test(e.text) },
	{ rule: 'commit hash', test: (e) => /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/.test(e.text) },
	{ rule: '輪次編號', test: (e) => /\bR-?\d+/.test(e.text) },
	{ rule: `定義超過 ${MAX_DEFINITION_CHARS} 字元`, test: (e) => [...e.definition].length > MAX_DEFINITION_CHARS },
	{ rule: `超過 ${MAX_CODE_SPANS} 個 code span`, test: (e) => (e.text.match(/`[^`\n]+`/g) ?? []).length > MAX_CODE_SPANS },
	{ rule: '缺 _Avoid_', test: (e) => !e.hasAvoid },
	{ rule: '_Avoid_ 之後還有文字', test: (e) => e.afterAvoid }
];

const problemsOf = (entries: Entry[]): string[] =>
	entries.flatMap((e) => RULES.filter(({ test }) => test(e)).map(({ rule }) => `${e.term}：${rule}`));

const HOW_TO_FIX =
	'修法：先比對 owner module 的檔頭，GLOSSARY 獨有的規則(不變量、protocol 步驟、選用條件)搬進檔頭，' +
	'純歷史(輪次、commit、曾經、已刪除的名字)直接刪；條目只留一兩句「它是什麼」、_Avoid_ 與 owner module 名' +
	'(`$lib` 之下、不帶副檔名，例如 `hydration-gate`)，ADR 寫成 ADR-0024。寫不進 200 字元就拆詞。沒有豁免。';

describe('GLOSSARY 文件掃描', () => {
	it('掃描器自證：該過的樣本零問題，該紅的樣本每條都抓到', () => {
		const PASSING = [
			'## Language',
			'### 一節',
			'**甲 (Alpha)**:',
			'甲是乙的一種，單一 owner 是 `coach/api`(見 ADR-0024、ADR 0031 §5)。',
			'_Avoid_: 丙, `丁`',
			'',
			'**長 (Long)**:',
			'字'.repeat(MAX_DEFINITION_CHARS),
			'_Avoid_: 短'
		].join('\n');
		const passing = parseEntries(PASSING);
		expect(passing.map((e) => e.term)).toEqual(['甲 (Alpha)', '長 (Long)']);
		expect(problemsOf(passing)).toEqual([]);

		// [詞, 定義, _Avoid_ 行, 該抓到的規則]
		const FAILING: [string, string, string, string][] = [
			['路徑', '住在 src/lib/foo 裡。', '_Avoid_: 別的詞', '原始碼檔案路徑'],
			['lib 路徑', '住在 `$lib/foo` 裡。', '_Avoid_: 別的詞', '原始碼檔案路徑'],
			['ADR 路徑', '見 docs/adr/0006。', '_Avoid_: 別的詞', '原始碼檔案路徑'],
			['副檔名', '住在 `foo.ts` 裡。', '_Avoid_: 別的詞', '副檔名'],
			['行號', '見 foo:12 那一段。', '_Avoid_: 別的詞', '行號'],
			['雜湊', '由 aaabc12 修好。', '_Avoid_: 別的詞', 'commit hash'],
			['輪次', '曾在 R17 改過。', '_Avoid_: 別的詞', '輪次編號'],
			['太長', '字'.repeat(MAX_DEFINITION_CHARS + 1), '_Avoid_: 別的詞', `定義超過 ${MAX_DEFINITION_CHARS} 字元`],
			// _Avoid_ 行裡的 code span 也算
			['程式碼', '`a`、`b` 兩者。', '_Avoid_: `c`', `超過 ${MAX_CODE_SPANS} 個 code span`]
		];
		const failingMarkdown = [
			'## Language',
			...FAILING.flatMap(([term, definition, avoid]) => [`**${term}**:`, definition, avoid]),
			// 定義寫在詞那一行也照樣算字數
			`**行內**: ${'字'.repeat(MAX_DEFINITION_CHARS + 1)}`,
			'_Avoid_: 別的詞',
			// _Avoid_ 之後的文字不算進定義，所以一行都不准有
			'**後綴**:',
			'短定義。',
			'_Avoid_: 別的詞',
			'塞在 _Avoid_ 之後的一段。',
			// 不是 `**詞**:` 的 `**` 開頭行(全形冒號)自成一條、標格式錯，不會併進上一條而躲過檢查
			'**全形**：短定義。',
			'_Avoid_: 別的詞',
			// 標題結束上一條：缺 _Avoid_ 的條目恰好 200 字元，下一行的標題不算進它的定義
			'**沒有避免**:',
			'字'.repeat(MAX_DEFINITION_CHARS),
			'### 下一節'
		].join('\n');
		const failing = parseEntries(failingMarkdown);
		expect(failing).toHaveLength(FAILING.length + 4);
		expect(problemsOf(failing)).toEqual([
			...FAILING.map(([term, , , rule]) => `${term}：${rule}`),
			`行內：定義超過 ${MAX_DEFINITION_CHARS} 字元`,
			'後綴：_Avoid_ 之後還有文字',
			'全形：詞那行不是 **詞**:',
			'沒有避免：缺 _Avoid_'
		]);
	});

	it('GLOSSARY.md 每條都只是詞彙：定義一兩句、有 _Avoid_、不帶實作細節', () => {
		const entries = parseEntries(readFileSync(resolve(process.cwd(), 'GLOSSARY.md'), 'utf8'));
		// 解析壞掉(整份併成一條或零條)時不能對空集合假綠：鬆釘下限，不是精確計數。
		expect(entries.length).toBeGreaterThan(25);
		const problems = problemsOf(entries);
		expect(problems, `GLOSSARY 有 ${problems.length} 處超標：\n${problems.join('\n')}\n${HOW_TO_FIX}`).toEqual([]);
	});
});
