/* Dream Fly — 教練對話列表(R20 候選 02):登入教練本人的對話摘要(GET /conversations/me)
 * 唯一的 owner——列表本身、未讀對話數,以及作用在列表上的三種變更(已讀/送出/新對話)都住這裡。
 *
 * 建在 createSessionGate 上(同 member/notifications、member/leave):列表是教練本人的資料,
 * 換帳號/登出即重置回開機態、旗標翻回 false,在飛的舊回應由 epoch 核對作廢(ADR 0023 C6——
 * 第二位教練不得看到前一位的列表)。誠實開機:開機值 = reset 值 = `[]`。映射沿用 coach/api.ts 的
 * getConversations()(內含 mapConversation),本檔不另寫一份。
 *
 * 新鮮度:
 *   - 第一次進頁只抓 1 次——hydrateConversations(暖機)與頁面 load-gate 的 load(進場包)共用同一
 *     顆閘門與同一支在飛 GET,已水合即短路。
 *   - 桌面訊息中心與工作台再次進頁時,畫面先顯示已有的列表,背景再真抓一次
 *     (refreshConversationsIfHydrated)。
 *   - 手機版每個帳號抓一次(layout 暖機)。
 *
 * 三個 mutator 收 messages-controller 交出的 promise(已讀 = selectThread() 的 badgeCleared、
 * 送出 = send()、新對話 = confirmCompose()),呼叫端在 await 之前就交進來——`write()` 在呼叫
 * 當下記住身分,promise 落地前換了帳號即 stale,不碰新身分的列表(呼叫端不必再手寫身分核對)。
 * controller 因此完全不必知道列表。三者都走非樂觀 write():結果成功才寫回(commit),失敗
 * (ack 為 false、sendFailed、createFailed/alreadyCreating)在 send 內拋出,列表不動、也不宣告
 * mutation。toast 與頁面的 tab/搜尋/選取留頁面——本模組只管列表。 */
import { writable, derived, get, type Readable } from 'svelte/store';
import { createSessionGate } from '$lib/session-gate';
import { getConversations } from '$lib/coach/api';
import type { Conversation } from '$lib/coach/data';
import type { SendOutcome, ConfirmComposeOutcome } from '$lib/coach/messages-controller';

const list = writable<Conversation[]>([]);
/** 唯讀投影:寫入一律經下方閘門(水合)與 mutator(write())。 */
export const conversations: Readable<Conversation[]> = { subscribe: list.subscribe };
/** 有未讀的對話數(badge > 0 的對話個數),不是未讀則數加總。 */
export const unreadConversationCount: Readable<number> = derived(list, ($l) => $l.filter((c) => (c.badge ?? 0) > 0).length);

const gate = createSessionGate<Conversation[]>({
	fetch: async () => (await getConversations()).conversations,
	apply: (l) => list.set(l),
	reset: () => list.set([]) // boot 態(開機值 = reset 值 = [])
});
/** 暖機入口(layout 的暖機清單以身分為 key 呼叫,見 $lib/store-warm);已水合即短路。 */
export const hydrateConversations = gate.hydrate;
/** 頁面的 load-gate 進場包(閘門的資料來源,抓取帶 epoch 核對),頁面
 *  `createLoadGate({ ...conversationsPageEntry })` 使用。 */
export const conversationsPageEntry = gate.pageEntry();

/** 已水合才背景重抓:頁面再次進場時,load 被守衛短路、畫面先顯示已有的列表,這支再真抓一次
 *  (gate.refresh:世代穩定重抓,在飛期間的 mutation 不會被舊快照蓋掉;後出發者贏由閘門的出發序帳
 *  負責——例如離開工作台時那支還在飛、再次進頁又出發一支,先出發的較晚落地也不蓋回較新的快照)。
 *  未水合時什麼都不做——第一次進頁由 load/暖機抓那 1 次,這裡不多抓。重抓失敗原樣拋出,呼叫端
 *  決定要不要吞。 */
export async function refreshConversationsIfHydrated(): Promise<void> {
	if (!get(gate.hydrated)) return;
	await gate.refresh();
}

/** 已讀:ack 是 selectThread() 的 badgeCleared(PATCH /conversations/{id}/read 是否成功)。
 *  為 true 才把該對話的未讀歸 0;false(markRead 失敗)維持未讀。 */
export async function markConversationRead(id: string, ack: Promise<boolean>): Promise<void> {
	await gate.write({
		send: async () => {
			if (!(await ack)) throw new Error('markRead 未獲後端確認');
		},
		commit: () => list.update((l) => l.map((c) => (c.id === id ? { ...c, badge: 0 } : c)))
	});
}

/** 送出:sending 是 ctrl.send(text)。messageSent 只更新 id 那一筆——preview 取送出的訊息文字
 *  (沒有文字則保留原預覽)、time 取訊息時間;sendFailed 不動。id 由呼叫端在送出當下捕捉
 *  (送出期間使用者可能已切到別的對話,但訊息確實送到了 id 那一個)。回傳同一個 outcome——
 *  resolve 時列表已更新,呼叫端據它決定 toast/還原輸入框。 */
export async function recordSent(id: string, sending: Promise<SendOutcome>): Promise<SendOutcome> {
	await gate.write({
		send: async () => {
			const o = await sending;
			if (o.kind !== 'messageSent') throw new Error('訊息未送出');
			return o.msg;
		},
		commit: (msg) => list.update((l) => l.map((c) => (c.id === id ? { ...c, preview: msg.text ?? c.preview, time: msg.time } : c)))
	});
	return sending;
}

/** 新對話:creating 是 ctrl.confirmCompose()。conversationCreated 的 id 不在列表 → 插到最前面;
 *  已在列表(POST /conversations 是 get-or-create,命中既有對話)→ 列表不變——既有列的未讀與
 *  預覽是真資料,建立回應的映射只有「尚無訊息、未讀 0」(見 coach/api.ts createConversation)。
 *  其餘 outcome 不動。回傳同一個 outcome——resolve 時新對話已在列表,呼叫端可直接選取它。 */
export async function recordCreated(creating: Promise<ConfirmComposeOutcome>): Promise<ConfirmComposeOutcome> {
	await gate.write({
		send: async () => {
			const o = await creating;
			if (o.kind !== 'conversationCreated') throw new Error('對話未建立');
			return o.conversation;
		},
		commit: (created) => list.update((l) => (l.some((c) => c.id === created.id) ? l : [created, ...l]))
	});
	return creating;
}
