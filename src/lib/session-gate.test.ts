/* Dream Fly — session-gate 三門工廠家族單測(架構深化 R7 C1)。
 *
 * 泛型 session 協定的**單源**測試:F1 登出重置 / P1′ 在飛作廢 / P1″ A→B 直換 /
 * mutate 在飛丟棄 / 訪客·restored 開機觸發次數 / F2 序列化可重試和解鏈家族 /
 * refresher 無條件套用 + 靜默丟棄 / onSessionReset。六個 domain store 各自只留薄
 * adapter 釘(證明本 store 已註冊 + endpoint/writeBack 接對),不再逐檔手抄整套協定
 * 鏡射(原 checkout-api/leave-requests-api 兩檔的深層鏡射家族已移入本檔)。
 *
 * 手法:合成 writable + 注入 fetch/request deferred;identity 用**真 authStore**
 * .login/logout 驅動(沿 fakeRouter/AUTH_RES/createDeferred 慣用式)。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { createSessionGate, createSessionRefresher, onSessionReset } from './session-gate';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

type Item = { id: string };

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

/** 和解重抓(mutate 尾隨的 fire-and-forget refresh)——macrotask 跳一拍,讓其 fetch →
 *  apply 鏈完整收束後再斷言。 */
function settleReconcile() {
	return new Promise<void>((r) => setTimeout(r, 0));
}

/** authStore.login() 走真實 applySession(setTokens + 登入態),登出/換帳號邊沿才有得測。 */
const AUTH_RES = {
	access_token: 'at-f1',
	refresh_token: 'rt-f1',
	user: {
		id: 'u-f1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false,
		avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member']
	}
};

/** A→B 直換釘用:identity(user.id)相異的第二個帳號。 */
const AUTH_RES_B = {
	access_token: 'at-f1b',
	refresh_token: 'rt-f1b',
	user: { ...AUTH_RES.user, id: 'u-f2', email: 'b@dreamfly.test', name: '乙' }
};

beforeEach(async () => {
	localStorage.clear();
	vi.mocked(api).mockReset();
	vi.mocked(api).mockResolvedValue(undefined); // logout 的 best-effort revoke .catch 安全
	// 每個 it 從登出態起跑:之後新建的 factory,其立即回呼身分 null == baseline,不誤觸 onChange。
	await authStore.logout();
});

describe('createSessionGate — session 家族', () => {
	it('F1:登出 → reset 觸發 + hydrated 翻 false(SPA 登出無整頁重載,旗標不得跨帳號存活)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const reset = vi.fn();
		const store = writable<Item[]>([{ id: 'seed' }]);
		const gate = createSessionGate<Item[]>({
			fetch: async () => [],
			apply: (d) => store.set(d),
			reset: () => { reset(); store.set([]); }
		});

		await authStore.login('a@dreamfly.test', 'pw'); // null → u-f1
		gate.hydrated.set(true); // 模擬已水合
		reset.mockClear(); // 只數登出那次

		await authStore.logout();

		expect(reset).toHaveBeenCalledTimes(1);
		expect(get(gate.hydrated)).toBe(false);
		expect(get(store)).toEqual([]);
	});

	it('P1′:hydrate in-flight 期間登出 → 姍姍來遲的回應整包作廢(fetch throw、不 apply、不 commit)', async () => {
		const d = createDeferred<Item[]>();
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => d.promise, apply: (data) => store.set(data), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const p = gate.hydrate(); // A 的 fetch 掛起中
		await authStore.logout(); // 在飛期間登出 → epoch+1

		d.resolve([{ id: 'a-item' }]);
		await expect(p).rejects.toThrow(); // 過期 fetch 作廢

		expect(get(store)).toEqual([]); // A 的資料沒有復活
		expect(get(gate.hydrated)).toBe(false);
	});

	it('P1″:A 已水合後 B 直接登入(無登出)→ identity 變更即 reset,B hydrate 真抓 B 的清單', async () => {
		let logins = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'GET /list': () => (++gets === 1 ? [{ id: 'a' }] : [{ id: 'b' }])
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		await gate.hydrate();
		expect(get(store)).toEqual([{ id: 'a' }]);

		await authStore.login('b@dreamfly.test', 'pw'); // B 直接登入,無登出邊沿

		expect(get(store)).toEqual([]); // A 的清單即刻清空
		expect(get(gate.hydrated)).toBe(false);

		await gate.hydrate(); // B 真抓
		expect(get(store)).toEqual([{ id: 'b' }]); // 不是 A 的殘留
	});

	it('mutate:在飛換帳丟棄寫回但仍回傳結果(server 端事實成立)', async () => {
		const post = createDeferred<Item>();
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: async () => [], apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const p = gate.mutate(() => post.promise, (r) => store.update((l) => [r, ...l]));
		await authStore.logout(); // 在飛期間登出

		post.resolve({ id: 'a-new' });
		const result = await p;

		expect(result).toEqual({ id: 'a-new' }); // 回傳照舊(呼叫端已隨登出卸載,無害)
		expect(get(store)).toEqual([]); // 棄寫:不落在 B 的 store
		expect(get(gate.hydrated)).toBe(false); // 不 markMutated
	});

	it('訪客開機零觸發:未登入下建立 factory,立即回呼身分 null == baseline,reset 不觸發', () => {
		// beforeEach 已 await logout,authStore 為登出態。
		const reset = vi.fn();
		createSessionGate<Item[]>({ fetch: async () => [], apply: () => {}, reset });
		expect(reset).not.toHaveBeenCalled();
	});

	it('restored 開機單觸發:已登入下建立 factory 不炸(建構順序契約)+ 立即回呼觸 reset 恰一次(值冪等)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES }));
		await authStore.login('a@dreamfly.test', 'pw'); // 先登入 → restored session 態

		const reset = vi.fn();
		const store = writable<Item[]>([{ id: 'seed' }]); // 開機帶 seed
		// 建構期:createHydrationGate → chain → core 訂閱,立即回呼觸 onChange 時 gate/chain 已存在,不炸。
		const gate = createSessionGate<Item[]>({
			fetch: async () => [],
			apply: (d) => store.set(d),
			reset: () => { reset(); store.set([{ id: 'seed' }]); } // 值冪等:seed → seed clone
		});

		expect(reset).toHaveBeenCalledTimes(1); // 立即回呼恰一次
		expect(get(gate.hydrated)).toBe(false);
		expect(get(store)).toEqual([{ id: 'seed' }]); // 首繪 teaser 保留
	});
});

describe('createSessionGate — 和解家族(序列化 + 可重試 + 幽靈取消)', () => {
	it('F2:未水合 mutate → 和解重抓收斂為完整清單,旗標 true,之後 hydrate 被 guarded() 短路', async () => {
		const NEW = { id: 'new' };
		const OLD = { id: 'old' };
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /list': () => { gets++; return [NEW, OLD]; } }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await gate.mutate(async () => NEW, (r) => store.update((l) => [r, ...l]));
		await settleReconcile();

		expect(gets).toBe(1); // 和解重抓真的發生
		expect(get(store)).toEqual([NEW, OLD]);
		expect(get(gate.hydrated)).toBe(true);

		const calls = vi.mocked(api).mock.calls.length;
		await gate.hydrate(); // 水合真相已成立——guarded() 短路
		expect(vi.mocked(api).mock.calls.length).toBe(calls);
	});

	it('P2′ 序列化非空證:兩支未水合 mutation 併發 → 前和解未 settle 後和解不起跑,晚(完整)快照最後套用', async () => {
		const A = { id: 'a' };
		const B = { id: 'b' };
		const r1 = createDeferred<Item[]>();
		let gets = 0;
		// 首快照掛起且漏 B(server 端 race),次快照完整。
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /list': () => (++gets === 1 ? r1.promise : [B, A]) }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		const p1 = gate.mutate(async () => A, (r) => store.update((l) => [r, ...l]));
		const p2 = gate.mutate(async () => B, (r) => store.update((l) => [r, ...l])); // 兩支都在旗標 false 時進場
		await Promise.all([p1, p2]);
		await settleReconcile();

		expect(gets).toBe(1); // 序列化:首和解仍在飛,次和解不得起跑
		r1.resolve([A]); // 舊快照(漏 B)先套用
		await settleReconcile();

		expect(gets).toBe(2); // 首和解 settle 後,次和解才起跑(兩支各自和解)
		expect(get(store)).toEqual([B, A]); // 完整快照最後套用——B 存活,不被首快照倒序覆寫
		expect(get(gate.hydrated)).toBe(true);
	});

	it('可重試翻旗:和解重抓失敗 → 旗標翻回 false 留重試路徑,下一次 hydrate 重新真抓完整清單', async () => {
		const NEW = { id: 'new' };
		const OLD = { id: 'old' };
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /list': () => (++gets === 1 ? new Error('和解重抓網路失敗') : [NEW, OLD]) }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await gate.mutate(async () => NEW, (r) => store.update((l) => [r, ...l]));
		await settleReconcile();

		expect(get(gate.hydrated)).toBe(false); // 失敗不佯裝完整——可重試

		await gate.hydrate(); // 重試
		expect(get(store)).toEqual([NEW, OLD]);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('stillIncomplete 重排:和解失敗翻回 false 後,進場自以為已水合的 mutation 寫回時重查旗標 → 重排和解', async () => {
		const A = { id: 'a' };
		const B = { id: 'b' };
		let rejectR1!: (e: Error) => void;
		const r1 = new Promise<Item[]>((_, rej) => { rejectR1 = rej; });
		const post2 = createDeferred<Item>();
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /list': () => (++gets === 1 ? r1 : [B, A]) }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await gate.mutate(async () => A, (r) => store.update((l) => [r, ...l])); // M1 未水合 → markMutated + 排 R1
		await settleReconcile(); // R1 的 GET 出發(掛起)
		const p2 = gate.mutate(() => post2.promise, (r) => store.update((l) => [r, ...l])); // M2 進場:旗標 true
		rejectR1(new Error('和解重抓網路失敗')); // R1 失敗 → 旗標翻回 false
		await settleReconcile();
		expect(get(gate.hydrated)).toBe(false);

		post2.resolve(B); // M2 寫回:發現旗標已 false → 必須再排 R2
		await p2;
		await settleReconcile();

		expect(gets).toBe(2); // R2 真的排了(只看進場快照的舊法不會排)
		expect(get(store)).toEqual([B, A]); // R2 的完整快照落地
		expect(get(gate.hydrated)).toBe(true); // 完整之後才重新標完整
	});

	it('幽靈和解:登出時「已排隊、尚未起跑」的和解 callback 不得在下一個 session 起跑', async () => {
		const A = { id: 'a' };
		const B = { id: 'b' };
		const post1 = createDeferred<Item>();
		const post2 = createDeferred<Item>();
		const r1 = createDeferred<Item[]>();
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': AUTH_RES,
			'POST /auth/logout': undefined,
			'GET /list': () => { ++gets; return gets === 1 ? r1.promise : [B, A]; }
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const p1 = gate.mutate(() => post1.promise, (r) => store.update((l) => [r, ...l]));
		const p2 = gate.mutate(() => post2.promise, (r) => store.update((l) => [r, ...l])); // R1 起跑(掛起)、R2 排隊
		post1.resolve(A);
		post2.resolve(B);
		await Promise.all([p1, p2]);
		await settleReconcile();
		expect(gets).toBe(1); // R1 在飛,R2 尚未起跑

		await authStore.logout(); // session 結束:epoch+1、reset
		r1.resolve([A]); // R1 的舊 session 回應此刻才到
		await settleReconcile();

		expect(gets).toBe(1); // R2 沒有以新 session 起跑——幽靈和解不存在
		expect(get(store)).toEqual([]); // 舊 session 的套用全數作廢
		expect(get(gate.hydrated)).toBe(false);
	});

	it('跨帳號卡鏈重置:上一個 session 卡死的和解不得堵住下一個帳號的和解鏈', async () => {
		const A = { id: 'a' };
		const B = { id: 'b' };
		const B_OLD = { id: 'b-old' };
		let logins = 0;
		let posts = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'POST /auth/logout': undefined,
			'POST /add': () => (++posts === 1 ? A : B),
			'GET /list': () => (++gets === 1 ? new Promise(() => {}) : [B, B_OLD]) // R1 永不 settle
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		await gate.mutate(() => api<Item>('/add', { method: 'POST' }), (r) => store.update((l) => [r, ...l])); // A:R1 起跑 → 永掛
		await settleReconcile();
		expect(gets).toBe(1);

		await authStore.logout();
		await authStore.login('b@dreamfly.test', 'pw'); // 換帳號 → 鏈重置
		await gate.mutate(() => api<Item>('/add', { method: 'POST' }), (r) => store.update((l) => [r, ...l])); // B 的未水合 mutation → 排 B 的和解
		await settleReconcile();

		expect(gets).toBe(2); // B 的和解沒有堵在 A 的殭屍後面
		expect(get(store)).toEqual([B, B_OLD]); // B 收斂到完整清單
		expect(get(gate.hydrated)).toBe(true);
	});
});

describe('createSessionRefresher — 無條件重抓 + 身分感知', () => {
	it('無條件套用:無 guard,每次呼叫都真抓並套用', async () => {
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /pts': () => { gets++; return { n: gets }; } }));
		const store = writable<{ n: number }>({ n: 0 });
		const refresh = createSessionRefresher<{ n: number }>({ fetch: () => api('/pts'), apply: (d) => store.set(d), reset: () => store.set({ n: 0 }) });

		await refresh();
		await refresh(); // 無 guard:第二次照抓
		expect(gets).toBe(2);
		expect(get(store)).toEqual({ n: 2 });
	});

	it('在飛換帳靜默丟棄:in-flight 期間身分變更 → 回應不套用、不 throw(不新增換帳失敗模式)', async () => {
		const d = createDeferred<{ n: number }>();
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': AUTH_RES,
			'POST /auth/logout': undefined,
			'GET /pts': () => d.promise
		}));
		const store = writable<{ n: number }>({ n: 0 });
		const refresh = createSessionRefresher<{ n: number }>({ fetch: () => api('/pts'), apply: (data) => store.set(data), reset: () => store.set({ n: 0 }) });

		await authStore.login('a@dreamfly.test', 'pw');
		const p = refresh(); // A 的抓取掛起中
		await authStore.logout(); // 在飛換帳 → epoch+1

		d.resolve({ n: 99 });
		await expect(p).resolves.toBeUndefined(); // 靜默:resolve、不 throw

		expect(get(store)).toEqual({ n: 0 }); // A 的資料沒套用
	});

	it('reset 觸發:identity 變更 → reset 被呼叫', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const reset = vi.fn();
		createSessionRefresher<{ n: number }>({ fetch: async () => ({ n: 1 }), apply: () => {}, reset });

		await authStore.login('a@dreamfly.test', 'pw');
		expect(reset).toHaveBeenCalledTimes(1); // 登入 (null → u-f1)
		await authStore.logout();
		expect(reset).toHaveBeenCalledTimes(2); // 登出 (u-f1 → null)
	});
});

describe('onSessionReset — 外部旗標重置', () => {
	it('觸發:identity 變更 → reset 被呼叫', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const reset = vi.fn();
		onSessionReset(reset);

		await authStore.login('a@dreamfly.test', 'pw');
		expect(reset).toHaveBeenCalledTimes(1);
		await authStore.logout();
		expect(reset).toHaveBeenCalledTimes(2);
	});

	it('同 identity 重發不觸發:member.id 不變(同帳號再登入)→ reset 不重複觸發', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES }));
		const reset = vi.fn();
		onSessionReset(reset);

		await authStore.login('a@dreamfly.test', 'pw');
		expect(reset).toHaveBeenCalledTimes(1);

		await authStore.login('a@dreamfly.test', 'pw'); // 同一帳號再登入 → identity 不變
		expect(reset).toHaveBeenCalledTimes(1); // 不重複觸發
	});
});
