import { describe, it, expect } from 'vitest';
import type { Conversation } from '$lib/coach/data';
import { filterConversations, pickSelection, applyCreatedConversation } from './conversations-filter';

/* Pure filter/selection derivation for coach/messages（ported from +page.svelte's
 * reactive chain, §see conversations-filter.ts header）. Exercised against a small
 * hand-built fixture set covering the tab/badge/urgent/kind boundaries the source
 * predicates branch on. */
const BASE: Conversation[] = [
	{ id: 'c1', name: '王媽媽', initial: '王', color: '#0066CC', kind: '家長', time: '09:42', badge: 2, preview: '小明明天可以調課嗎', urgent: true, sla: '30 分內需回覆', slaTone: 'warning' },
	{ id: 'c2', name: '陳爸爸', initial: '陳', color: '#EC4899', kind: '家長', time: '昨天', badge: 0, preview: '謝謝老師這學期的指導', sla: '已回覆', slaTone: 'success' },
	{ id: 'c3', name: '林同學', initial: '林', color: '#10B981', kind: '學員', time: '08:55', preview: '教練我這週想請假', sla: '2 小時內回覆', slaTone: 'muted' },
	{ id: 'c4', name: '競技選手班 群組', initial: '群', color: '#8B5CF6', kind: '群組', time: '09:20', badge: 5, preview: '場地確定了嗎', urgent: true, sla: '今日內回覆', slaTone: 'muted' }
];

describe('filterConversations — tab', () => {
	it("tab='全部'（或省略）不依 tab 排除，回傳全數", () => {
		expect(filterConversations(BASE, { tab: '全部' })).toHaveLength(BASE.length);
		expect(filterConversations(BASE)).toHaveLength(BASE.length);
	});

	it("tab='緊急' 只留 urgent===true", () => {
		const out = filterConversations(BASE, { tab: '緊急' });
		expect(out.map((c) => c.id)).toEqual(['c1', 'c4']);
		expect(out.every((c) => c.urgent)).toBe(true);
	});

	it("tab='家長' 只留 kind==='家長'", () => {
		const out = filterConversations(BASE, { tab: '家長' });
		expect(out.map((c) => c.id)).toEqual(['c1', 'c2']);
		expect(out.every((c) => c.kind === '家長')).toBe(true);
	});
});

describe('filterConversations — badge falsy 判定釘（未讀 tab，0/undefined 邊界）', () => {
	it("badge===0 在 tab='未讀' 下被排除（0 是 falsy，不是「有未讀」）", () => {
		const out = filterConversations([BASE[1]], { tab: '未讀' }); // c2: badge 0
		expect(out).toHaveLength(0);
	});

	it("badge===undefined 在 tab='未讀' 下被排除（同 falsy 邊界，未讀計數欄位缺席）", () => {
		const out = filterConversations([BASE[2]], { tab: '未讀' }); // c3: badge omitted
		expect(out).toHaveLength(0);
	});

	it("badge>0 在 tab='未讀' 下保留（正控制組，驗證上兩則邊界不是誤殺全部）", () => {
		const out = filterConversations(BASE, { tab: '未讀' });
		expect(out.map((c) => c.id)).toEqual(['c1', 'c4']);
	});
});

describe('filterConversations — 搜尋（trim + lowercase 正規化收進模組）', () => {
	it('query 命中 name（不分大小寫）', () => {
		const out = filterConversations(BASE, { query: '王媽媽' });
		expect(out.map((c) => c.id)).toEqual(['c1']);
	});

	it('query 命中 preview（不分大小寫）', () => {
		const out = filterConversations(BASE, { query: '調課' });
		expect(out.map((c) => c.id)).toEqual(['c1']);
	});

	it('query 未命中任何欄位 → 空陣列', () => {
		expect(filterConversations(BASE, { query: '___no-such-conversation___' })).toHaveLength(0);
	});

	it('query 前後空白會被 trim、大小寫不敏感', () => {
		const out = filterConversations(BASE, { query: '  陳爸爸  ' });
		expect(out.map((c) => c.id)).toEqual(['c2']);
	});

	it('name+preview 跨界串接釘：query 恰好橫跨兩欄邊界仍會命中（現頁 `c.name + c.preview` 無分隔符直接串接的現行語意，逐字保留，非本次修正範圍）', () => {
		// name 尾字 + preview 首字拼出 query，但個別欄位皆不含 query。
		const boundary: Conversation = {
			id: 'b1', name: '陳', initial: '陳', color: '#000', kind: '學員', time: '',
			preview: '好，收到', sla: '', slaTone: 'muted'
		};
		expect(boundary.name.toLowerCase().includes('陳好')).toBe(false);
		expect(boundary.preview.toLowerCase().includes('陳好')).toBe(false);
		const out = filterConversations([boundary], { query: '陳好' });
		expect(out).toHaveLength(1); // 串接後 "陳好，收到" 含 "陳好"，故命中
	});
});

describe('pickSelection', () => {
	it('sel 仍在清單中 → 原樣回傳', () => {
		expect(pickSelection(BASE, 'c2')).toBe('c2');
	});

	it('sel 不在清單中（陳舊 id）→ 回退清單首項', () => {
		expect(pickSelection(BASE, '___stale___')).toBe(BASE[0].id);
	});

	it('sel 為 null 且清單非空 → 回退清單首項', () => {
		expect(pickSelection(BASE, null)).toBe(BASE[0].id);
	});

	it('清單為空 → guard 不作用，原樣回傳 sel（含 null）', () => {
		expect(pickSelection([], 'c1')).toBe('c1');
		expect(pickSelection([], null)).toBeNull();
	});
});

describe('applyCreatedConversation', () => {
	const NEW: Conversation = {
		id: 'c9', name: '王小明', initial: '王', color: '#0066CC', kind: '會員',
		time: '', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted'
	};

	it('全新 id → 插頂（新陣列）+ 四欄重置（convos/sel/tab/search）', () => {
		const out = applyCreatedConversation(BASE, NEW);
		expect(out.convos).not.toBe(BASE);
		expect(out.convos[0]).toBe(NEW);
		expect(out.convos).toHaveLength(BASE.length + 1);
		expect(out.sel).toBe('c9');
		expect(out.tab).toBe('全部');
		expect(out.search).toBe('');
	});

	it('既有 id → convos 回原陣列同一引用（不複製、不插入）+ sel 指向它', () => {
		const existing: Conversation = { ...NEW, id: 'c2' }; // get-or-create 回應對到既有列 c2
		const out = applyCreatedConversation(BASE, existing);
		expect(out.convos).toBe(BASE); // 同一引用，不是新陣列
		expect(out.convos).toHaveLength(BASE.length); // 未插入
		expect(out.sel).toBe('c2');
	});

	it('不 mutate 輸入（全新分支走 spread，原陣列內容/長度不變）', () => {
		const before = BASE.map((c) => c.id);
		applyCreatedConversation(BASE, NEW);
		expect(BASE.map((c) => c.id)).toEqual(before);
	});

	it('重置不變量在既有 id 分支同樣成立（tab=\'全部\'、search=\'\'，不只在插入分支才重置）', () => {
		const existing: Conversation = { ...NEW, id: 'c1' };
		const out = applyCreatedConversation(BASE, existing);
		expect(out.tab).toBe('全部');
		expect(out.search).toBe('');
	});
});
