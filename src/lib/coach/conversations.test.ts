/* Dream Fly — coach/conversations.ts(教練對話列表)接線單測:GET /conversations/me 水合與
 * 換帳號重抓、未讀對話數、頁面進場包、已水合才背景重抓,以及三個 mutator(已讀/送出/新對話)
 * 的套用規則與換身分作廢。閘門協定本身(guard 短路、在飛作廢、mutation 勝出、和解重抓、
 * 尾流等待)的釘子住 hydration-gate.test.ts / session-gate.test.ts,本檔只釘本模組的採用面。
 * 已讀那幾條移植自 mobile-admin/stores.test.ts 的 markMessageRead 區塊(舊 store 退役時連同
 * 舊測試一併刪除)。
 *
 * 只替換 $lib/api/client 的 api():列表一律經 HTTP 水合(conversations 是唯讀 store,沒有
 * set 可鋪夾具),coach/api.ts 的 getConversations/mapConversation 照跑真的。mutator 收的是
 * messages-controller 交出的 promise——這裡直接造 SendOutcome/ConfirmComposeOutcome,
 * 用 deferred 控制它何時落地。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { apiCalls } from '$lib/testing/admin-routes';
import { resetSessionStores } from '$lib/testing/session-reset';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_USER } from '$lib/testing/coach-routes';
import { conversationSummary } from '$lib/testing/wire-fixtures';
import { createLoadGate } from '$lib/load-gate';
import type { Conversation } from './data';
import type { ConfirmComposeOutcome, SendOutcome } from './messages-controller';
import {
	conversations,
	unreadConversationCount,
	hydrateConversations,
	conversationsPageEntry,
	refreshConversationsIfHydrated,
	markConversationRead,
	recordSent,
	recordCreated
} from './conversations';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** 一位教練的三筆對話摘要:c1 未讀 2 則、c2 已讀、c3 未讀 1 則。 */
const LIST = [
	conversationSummary({ id: 'c1', peer_name: '王媽媽', last_message_body: '明天可以調課嗎', last_message_at: '2026-07-04T09:42:00Z', unread_count: 2 }),
	conversationSummary({ id: 'c2', peer_name: '陳爸爸', last_message_body: '謝謝老師', last_message_at: '2026-07-03T18:00:00Z', unread_count: 0 }),
	conversationSummary({ id: 'c3', peer_name: '林同學', last_message_body: '這週想請假', last_message_at: '2026-07-02T08:30:00Z', unread_count: 1 })
];

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(overrides, { 'GET /conversations/me': LIST }));
const gets = () => apiCalls('GET /conversations/me').length;
const row = (id: string) => get(conversations).find((c) => c.id === id);
const ids = () => get(conversations).map((c) => c.id);
const flush = () => new Promise((r) => setTimeout(r, 0));

/** 手動控時序的 deferred promise(同 mobile-admin/stores.test.ts 的寫法,不用 fake timers)。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

const COACH_A = { ...COACH_USER, id: 'u-coach-a', email: 'a@dreamfly.test', name: '教練甲' };
const COACH_B = { ...COACH_USER, id: 'u-coach-b', email: 'b@dreamfly.test', name: '教練乙' };

/** messages-controller 的 outcome 夾具。 */
const sent = (text: string | undefined, time = '2026-07-05 10:00'): SendOutcome => ({ kind: 'messageSent', msg: { who: 'me', text, time } });
const NEW_CONVERSATION: Conversation = { id: 'c9', name: '王小明', initial: '王', color: '#0066CC', time: '', badge: 0, preview: '尚無訊息' };
const created = (conversation: Conversation): ConfirmComposeOutcome => ({ kind: 'conversationCreated', conversation });

beforeEach(async () => {
	vi.mocked(api).mockReset();
	await resetSessionStores(); // 登入→登出走一圈讓閘門回開機態(列表 []、未水合),不跨 it 洩漏
	route();
});

describe('水合 — GET /conversations/me', () => {
	// 誠實開機:開機值 = reset 值 = `[]`。重新載入模組才照得到「開機」那一刻。
	it('模組開機時 conversations 為 [],unreadConversationCount 為 0', async () => {
		vi.resetModules();
		const fresh = await import('./conversations');
		expect(get(fresh.conversations)).toEqual([]);
		expect(get(fresh.unreadConversationCount)).toBe(0);
	});

	it('經 coach/api 的 mapConversation 映射寫入;同一帳號只抓一次,換帳號即清空並重抓', async () => {
		await loginAs(COACH_A);
		route();
		await hydrateConversations();
		await hydrateConversations();

		expect(gets()).toBe(1);
		expect(get(conversations).map(({ id, name, badge, preview, time }) => ({ id, name, badge, preview, time }))).toEqual([
			{ id: 'c1', name: '王媽媽', badge: 2, preview: '明天可以調課嗎', time: '2026-07-04 09:42' },
			{ id: 'c2', name: '陳爸爸', badge: 0, preview: '謝謝老師', time: '2026-07-03 18:00' },
			{ id: 'c3', name: '林同學', badge: 1, preview: '這週想請假', time: '2026-07-02 08:30' }
		]);

		await loginAs(COACH_B); // 換帳號:閘門重置,A 的列表不得留給 B
		expect(get(conversations)).toEqual([]);
		route({ 'GET /conversations/me': [conversationSummary({ id: 'b1', peer_name: '李同學' })] });
		await hydrateConversations();

		expect(gets()).toBe(1); // loginAs 清過呼叫紀錄:B 自己恰一次
		expect(ids()).toEqual(['b1']);
	});

	it('unreadConversationCount 是「有未讀的對話數」,不是未讀則數加總', async () => {
		await hydrateConversations();
		expect(get(unreadConversationCount)).toBe(2); // c1(2 則)+ c3(1 則)= 2 個對話,不是 3
	});

	it('頁面進場包與 hydrateConversations 同一顆閘門:暖機在飛時頁面進場只抓 1 次,水合後再進頁不抓', async () => {
		const warming = hydrateConversations(); // layout 暖機在飛
		const page = createLoadGate({ ...conversationsPageEntry });
		await page.load();
		await warming;
		expect(gets()).toBe(1);
		expect(ids()).toEqual(['c1', 'c2', 'c3']);

		const again = createLoadGate({ ...conversationsPageEntry });
		await again.load();
		expect(gets()).toBe(1); // 守衛短路
		expect(get(again)).toBe('ready');
		page.destroy();
		again.destroy();
	});
});

describe('refreshConversationsIfHydrated(已水合才背景重抓)', () => {
	it('未水合 → 不打 GET;暖機在飛時呼叫也不多抓(首次進頁只抓 1 次)', async () => {
		await refreshConversationsIfHydrated();
		expect(gets()).toBe(0);

		const warming = hydrateConversations();
		await refreshConversationsIfHydrated();
		await warming;
		expect(gets()).toBe(1);
	});

	it('已水合 → 背景真抓一次:重抓在飛時仍是既有列表,落地後換成新快照', async () => {
		await hydrateConversations();
		const d = deferred<unknown>();
		route({ 'GET /conversations/me': () => d.promise });

		const refreshing = refreshConversationsIfHydrated();
		expect(gets()).toBe(2);
		expect(ids()).toEqual(['c1', 'c2', 'c3']); // 先顯示已有的列表

		d.resolve([conversationSummary({ id: 'c4', peer_name: '張同學' }), ...LIST]);
		await refreshing;
		expect(ids()).toEqual(['c4', 'c1', 'c2', 'c3']);
	});
});

describe('markConversationRead(id, ack)', () => {
	beforeEach(async () => {
		await hydrateConversations(); // 已水合前提(未水合的寫入會另排和解重抓)
	});

	it('ack 為 true → 該對話未讀歸 0,未讀對話數少 1', async () => {
		await markConversationRead('c1', Promise.resolve(true));

		expect(row('c1')?.badge).toBe(0);
		expect(row('c3')?.badge).toBe(1);
		expect(get(unreadConversationCount)).toBe(1);
	});

	it('ack 為 false(PATCH 失敗)→ 維持未讀', async () => {
		await markConversationRead('c1', Promise.resolve(false));

		expect(row('c1')?.badge).toBe(2);
		expect(get(unreadConversationCount)).toBe(2);
	});

	it('已讀的對話再讀一次 → 未讀對話數不變', async () => {
		await markConversationRead('c2', Promise.resolve(true));

		expect(row('c2')?.badge).toBe(0);
		expect(get(unreadConversationCount)).toBe(2);
	});
});

describe('recordSent(id, sending)', () => {
	beforeEach(async () => {
		await hydrateConversations();
	});

	it('messageSent → 只更新該筆的 preview 與 time;回傳同一個 outcome,回傳時列表已更新', async () => {
		const others = get(conversations).filter((c) => c.id !== 'c2');
		const outcome = sent('好的,明天見');

		const returned = await recordSent('c2', Promise.resolve(outcome));

		expect(returned).toBe(outcome);
		expect(row('c2')).toMatchObject({ preview: '好的,明天見', time: '2026-07-05 10:00', badge: 0, name: '陳爸爸' });
		expect(get(conversations).filter((c) => c.id !== 'c2')).toEqual(others);
	});

	it('msg 沒有 text → preview 保留原值,time 照樣更新', async () => {
		await recordSent('c2', Promise.resolve(sent(undefined)));

		expect(row('c2')).toMatchObject({ preview: '謝謝老師', time: '2026-07-05 10:00' });
	});

	it('sendFailed → 列表不變,outcome 原樣回傳', async () => {
		const before = get(conversations);
		const failed: SendOutcome = { kind: 'sendFailed', error: new Error('422'), text: '好的' };

		expect(await recordSent('c2', Promise.resolve(failed))).toBe(failed);
		expect(get(conversations)).toEqual(before);
	});
});

describe('recordCreated(creating)', () => {
	beforeEach(async () => {
		await hydrateConversations();
	});

	it('新 id → 插到最前面;回傳同一個 outcome,回傳時列表已更新', async () => {
		const outcome = created(NEW_CONVERSATION);

		expect(await recordCreated(Promise.resolve(outcome))).toBe(outcome);
		expect(ids()).toEqual(['c9', 'c1', 'c2', 'c3']);
		expect(row('c9')).toEqual(NEW_CONVERSATION);
	});

	it('id 已在列表(get-or-create 命中既有對話)→ 列表不變,既有列的未讀與預覽不被建立回應蓋掉', async () => {
		const before = get(conversations);

		await recordCreated(Promise.resolve(created({ ...NEW_CONVERSATION, id: 'c1' })));

		expect(get(conversations)).toEqual(before);
		expect(row('c1')).toMatchObject({ badge: 2, preview: '明天可以調課嗎' });
	});

	it('createFailed / alreadyCreating → 列表不變', async () => {
		const before = get(conversations);

		await recordCreated(Promise.resolve({ kind: 'createFailed', error: new Error('422') }));
		await recordCreated(Promise.resolve({ kind: 'alreadyCreating' }));

		expect(get(conversations)).toEqual(before);
	});
});

describe('水合在飛時發生變更', () => {
	// 接線釘:markConversationRead 繞過 gate.write() 的話,在飛水合的舊快照會把已讀蓋回未讀。
	it('hydrateConversations() 在飛期間已讀 → 舊快照不蓋回未讀,且有一次和解重抓', async () => {
		const stale = deferred<unknown>();
		const snapshots = [stale.promise, LIST.map((c) => (c.id === 'c1' ? { ...c, unread_count: 0 } : c))];
		route({ 'GET /conversations/me': () => snapshots.shift() });

		const hydrating = hydrateConversations();
		await markConversationRead('c1', Promise.resolve(true));
		stale.resolve(LIST); // 舊快照:c1 仍未讀
		await hydrating;
		await flush(); // 和解重抓收束

		expect(row('c1')?.badge).toBe(0);
		expect(gets()).toBe(2);
	});
});

describe('換身分作廢:mutator 在飛時從 A 換成 B → B 的列表不被碰', () => {
	/** A 水合 → 呼叫 mutator(controller 的 promise 在飛)→ 換成 B 並水合 B 的列表(與 A 同 id、
	 *  c1 未讀,當金絲雀)→ A 的 promise 落地成功 → B 的列表必須原封不動。 */
	async function expectBUntouched<T>(start: (pending: Promise<T>) => Promise<unknown>, outcome: T) {
		await loginAs(COACH_A);
		route();
		await hydrateConversations();
		const pending = deferred<T>();

		const mutating = start(pending.promise); // A 的 mutator 在飛
		await loginAs(COACH_B);
		route();
		await hydrateConversations();
		const before = get(conversations);
		pending.resolve(outcome);
		await mutating;
		await flush();

		expect(get(conversations)).toEqual(before);
		expect(row('c1')).toMatchObject({ badge: 2, preview: '明天可以調課嗎' });
	}

	it('已讀:ack 落地前換身分 → 不清 B 的未讀', async () => {
		await expectBUntouched((ack) => markConversationRead('c1', ack), true);
	});

	it('送出:送出結果落地前換身分 → 不改 B 的預覽與時間', async () => {
		await expectBUntouched((sending) => recordSent('c1', sending), sent('A 的回覆'));
	});

	it('新對話:建立結果落地前換身分 → 不插進 B 的列表', async () => {
		await expectBUntouched((creating) => recordCreated(creating), created(NEW_CONVERSATION));
		expect(ids()).toEqual(['c1', 'c2', 'c3']);
	});
});
