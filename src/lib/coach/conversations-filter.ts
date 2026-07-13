/* Dream Fly — 教練端 · 訊息中心 conversations 過濾與選取 derivation（Round 3 K3）。
 *
 * Pure, framework-free port of coach/messages/+page.svelte 三塊耦合的反應式邏輯：
 * ①filterConversations —— tab × 搜尋的清單過濾鏈（原 `$: list`，含 query 正規化，
 * 原獨立的 `$: q = $search.trim().toLowerCase()` 收進本函式）；②pickSelection ——
 * 選取回退 guard（原 `$: if (list.length && !list.some(...)) sel = list[0].id`）；
 * ③applyCreatedConversation —— confirmCompose 的 get-or-create 插入指令物件，把
 * 「插入後重置 tab/search 免 guard 搶選取」的不變量升為可斷言的介面事實。Kept
 * here, unit-testable without rendering, and imported by the messages page. */

import type { Conversation } from '$lib/coach/data';

export interface ConversationsFilter {
	/** Selected filter tab. 刻意用 string 非 union——頁面 tabs.k 推導為 string，
	 *  union 會逼出 as const 鏈，零收益。'全部'（或省略）= 不依 tab 排除。 */
	tab?: string;
	/** Topbar search term; matched against name + preview, case-insensitive. */
	query?: string;
}

/**
 * Filter the conversation rows. Order mirrors the source: tab → search term.
 * query 比對邏輯逐字沿用 `(c.name + c.preview)` 直接串接（不加分隔符）——與
 * orders-filter/classes-filter 的既有慣例一致，兩欄邊界可能產生跨欄位巧合命中，
 * 這是現行語意，不在本次收斂範圍內「修正」。Returns a new array; the input is
 * never mutated.
 */
export function filterConversations(convos: Conversation[], opts: ConversationsFilter = {}): Conversation[] {
	const { tab = '全部', query = '' } = opts;
	const q = query.trim().toLowerCase();

	return convos.filter((c) => {
		if (tab === '緊急' && !c.urgent) return false;
		if (tab === '未讀' && !c.badge) return false;
		if (tab === '家長' && c.kind !== '家長') return false;
		if (q && !(c.name + c.preview).toLowerCase().includes(q)) return false;
		return true;
	});
}

/**
 * 選取回退 guard：`sel` 不在 `list` 中時回退清單首項。逐字複刻原頁面 `$: if
 * (list.length && !list.some((c) => c.id === sel)) sel = list[0].id;`——list
 * 空時 guard 不作用，原樣回傳 sel（現行語意，保留）。
 */
export function pickSelection(list: Conversation[], sel: string | null): string | null {
	if (list.length && !list.some((c) => c.id === sel)) return list[0].id;
	return sel;
}

/**
 * confirmCompose 的 get-or-create 插入指令物件。既有 id → 回原陣列同一引用（不
 * 複製，保留既有列的 badge/preview，不被 create 回應的貧乏映射覆蓋）；全新 id →
 * 插頂（新陣列）。tab/search 一律重置為 '全部'/''（免 guard 搶選取），sel 一律
 * 指向 created.id。不 mutate 輸入。
 */
export function applyCreatedConversation(
	convos: Conversation[],
	created: Conversation
): { convos: Conversation[]; sel: string; tab: '全部'; search: '' } {
	const exists = convos.some((c) => c.id === created.id);
	return {
		convos: exists ? convos : [created, ...convos],
		sel: created.id,
		tab: '全部',
		search: ''
	};
}
