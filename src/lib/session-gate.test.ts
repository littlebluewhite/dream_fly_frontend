/* Dream Fly — session-gate 兩門工廠家族單測(架構深化 R7 C1;R9 C3 起門 (c)
 * onSessionReset 退役,pageEntry 進場包入列)。
 *
 * 泛型 session 協定的**單源**測試:F1 登出重置 / P1′ 在飛作廢 / P1″ A→B 直換 /
 * mutate 在飛丟棄 / 訪客·restored 開機零觸發 / F2 序列化可重試和解鏈家族 / queueWrite 寫入鏈 /
 * refresher 無條件套用 + 靜默丟棄 / pageEntry 進場包。六個 domain store 各自只留薄
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
import { createLoadGate, type LoadPhase } from './load-gate';
import { createSessionGate, createSessionRefresher, sessionIdentity } from './session-gate';

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
	// 每個 it 從登出態起跑:之後新建的 factory 以 null 為身分基準(建構當下決定)。
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
		gate.markMutated(); // 模擬已水合(旗標唯讀,改走 mutation 翻旗)
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

	/* 跨 session 尾流帳(R11 終審修波 F2)。identity 重置原本只清內容/旗標/和解鏈,**不清尾流
	 * 帳**:A 帳號一筆永不 settle 的 PATCH(掛死的樂觀 mutation)會讓 B 帳號的每一次 refresh
	 * 永遠等待、GET 一次都不出發——「必然自癒」的前提(尾流一定會 settle)在跨身分時不成立。
	 * 現在 onChange 一併清帳並喚醒全部等待者;被喚醒的舊 refresh 由既有的 epoch 核對處置。 */
	it('跨身分尾流清帳:A 的樂觀 mutation 尾流永不 settle → 換帳後 B 的 refresh 立即出發 GET,不被 A 的殘留尾流擋住', async () => {
		let logins = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'GET /list': () => { gets += 1; return [{ id: 'b' }]; }
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		gate.markMutated(new Promise(() => {})); // A 的樂觀 mutation:PATCH 掛死,永不 settle
		await authStore.login('b@dreamfly.test', 'pw'); // A→B 直換 → identity 重置即清帳

		const p = gate.refresh(); // B 的第一次重新整理

		expect(gets).toBe(1); // 立即出發(舊碼:0——B 永遠等 A 的尾流,GET 一次都不發)
		await p;
		expect(get(store)).toEqual([{ id: 'b' }]);
	});

	it('清帳不沖新帳:清帳後 B 自己的尾流照常擋住 refresh,A 的殘留尾流姍姍來遲地 settle 不得把 B 的帳減掉', async () => {
		/* 清帳的實作若只寫 pendingTails = 0,舊 tail 的出帳回呼仍掛在原地:它一 settle 就把 B
		 * 的帳從 1 減成 0 並喚醒等待者,B 的 GET 於是帶著自己在飛的 PATCH 出發——F2 想關的窗
		 * 原封不動地換一個帳號重開(而且帳可能被減成負數)。出帳必須認帳本世代。 */
		const staleTail = createDeferred<void>();
		const freshTail = createDeferred<void>();
		let logins = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'GET /list': () => { gets += 1; return [{ id: 'b' }]; }
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		gate.markMutated(staleTail.promise); // A 的尾流
		await authStore.login('b@dreamfly.test', 'pw'); // 清帳
		gate.markMutated(freshTail.promise); // B 自己的尾流入帳
		staleTail.resolve(); // A 的殘留尾流此刻才 settle——它已不在帳上,不得出帳
		await settleReconcile();

		const p = gate.refresh();
		await settleReconcile();

		expect(gets).toBe(0); // B 的尾流仍在飛 → GET 不出發

		freshTail.resolve();
		await p;

		expect(gets).toBe(1); // B 的尾流 settle 後才出發,而且只出發一次
		expect(get(store)).toEqual([{ id: 'b' }]);
	});

	it('清帳與同拍新尾流:換帳同一拍重入的新身分尾流照樣擋住 refresh(巢狀通知排在 onChange 之後,記在新帳本上)', async () => {
		/* 這條釘的是清帳與「同拍重入的新身分 mutation」之間的相對順序。曾被提報的反例是:清帳排在
		 * `reset()`/翻旗**之後**,而 reset() 寫 store 會**同步**通知 subscriber、subscriber 在那個
		 * 回呼裡重入新身分的樂觀 mutation → 新尾流記在舊帳本上、兩行後被同一輪清帳一併沖掉。前提
		 * 不成立:identity onChange 本身跑在 authStore 自己的通知 flush 裡,svelte writable 的
		 * subscriber_queue 會把巢狀 set 的通知**排到外層 flush 跑完之後**(實測序列:reset:enter →
		 * reset:exit → subscriber),故重入的 markMutated(tail) 必然落在整個 onChange(含清帳)
		 * 之後、記在新帳本上。此釘鎖住的正是那個真行為:同拍進場的新尾流仍擋得住 B 的 refresh。 */
		const tailB = createDeferred<void>();
		let logins = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'GET /list': () => { gets += 1; return [{ id: 'b' }]; }
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		gate.markMutated(new Promise(() => {})); // A 的樂觀 mutation:PATCH 掛死,永不 settle

		// 模擬頁面 subscriber:reset() 寫 store 的那次通知一到,新身分的樂觀 mutation 就進場(恰一次)。
		let armed = false;
		let reentered = false;
		const unsub = store.subscribe(() => {
			if (!armed) return;
			armed = false;
			reentered = true;
			gate.markMutated(tailB.promise);
		});

		armed = true;
		await authStore.login('b@dreamfly.test', 'pw'); // A→B 直換 → identity 重置
		unsub();

		expect(reentered).toBe(true); // 釘住重入真的發生(否則下面兩條是假綠)

		const p = gate.refresh(); // B 的重新整理

		expect(gets).toBe(0); // B 自己的尾流仍在帳、仍在飛 → GET 不得出發
		await settleReconcile();
		expect(gets).toBe(0);

		tailB.resolve();
		await p;

		expect(gets).toBe(1); // 尾流 settle 後才出發,而且只出發一次
		expect(get(store)).toEqual([{ id: 'b' }]);
	});

	it('訪客開機零觸發:未登入下建立 factory,身分基準 null,reset 不觸發', () => {
		// beforeEach 已 await logout,authStore 為登出態。
		const reset = vi.fn();
		createSessionGate<Item[]>({ fetch: async () => [], apply: () => {}, reset });
		expect(reset).not.toHaveBeenCalled();
	});

	it('restored 開機零觸發:已登入下建立 factory,建構當下只記身分基準——reset 不觸發、store 保留開機值', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES }));
		await authStore.login('a@dreamfly.test', 'pw'); // 先登入 → restored session 態

		const reset = vi.fn();
		const store = writable<Item[]>([{ id: 'seed' }]); // 開機帶 seed
		const gate = createSessionGate<Item[]>({
			fetch: async () => [],
			apply: (d) => store.set(d),
			reset: () => { reset(); store.set([]); }
		});

		expect(reset).not.toHaveBeenCalled(); // 身分基準 = 建構當下的身分,零觸發
		expect(get(gate.hydrated)).toBe(false);
		expect(get(store)).toEqual([{ id: 'seed' }]);
	});

	it('restored 開機:reset 讀的 let 宣告在 factory 之後也不炸(建構期不呼叫 reset,無 TDZ)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		await authStore.login('a@dreamfly.test', 'pw');

		const gate = createSessionGate<Item[]>({
			fetch: async () => [],
			apply: () => {},
			reset: () => { resets += 1; }
		});
		let resets = 0; // 宣告在 factory 之後

		expect(get(gate.hydrated)).toBe(false);
		await authStore.logout(); // 真的換身分才觸發
		expect(resets).toBe(1);
	});

	it('A 的 hydrate 在飛時換成 B → B 的 hydrate 重新 GET(不併入 A 那支),套用 B 的清單', async () => {
		const dA = createDeferred<Item[]>();
		let logins = 0;
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
			'GET /list': () => (++gets === 1 ? dA.promise : [{ id: 'b' }])
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const pA = gate.hydrate(); // A 在飛
		await authStore.login('b@dreamfly.test', 'pw'); // A→B 直換

		await gate.hydrate(); // B
		expect(gets).toBe(2);
		expect(get(store)).toEqual([{ id: 'b' }]);

		dA.resolve([{ id: 'a' }]);
		await expect(pA).rejects.toThrow(); // A 那支落地即作廢
		expect(get(store)).toEqual([{ id: 'b' }]);
	});
});

describe('createSessionGate — queueWrite 寫入鏈', () => {
	it('排隊中換帳號 → 輪到時回 skipped、task 不執行', async () => {
		let logins = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B) }));
		const gate = createSessionGate<Item[]>({ fetch: async () => [], apply: () => {}, reset: () => {} });
		await authStore.login('a@dreamfly.test', 'pw');

		const d = createDeferred<string>();
		const second = vi.fn(async () => 'ran');
		const p1 = gate.queueWrite(() => d.promise, 'skipped');
		const p2 = gate.queueWrite(second, 'skipped'); // 排在 p1 後面
		await authStore.login('b@dreamfly.test', 'pw');
		d.resolve('first');

		await expect(p1).resolves.toBe('first');
		await expect(p2).resolves.toBe('skipped');
		expect(second).not.toHaveBeenCalled();
	});

	it('stale() 看得見執行中途的換帳號', async () => {
		let logins = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B) }));
		const gate = createSessionGate<Item[]>({ fetch: async () => [], apply: () => {}, reset: () => {} });
		await authStore.login('a@dreamfly.test', 'pw');

		const d = createDeferred<void>();
		const seen: boolean[] = [];
		const p = gate.queueWrite(async (stale) => {
			seen.push(stale());
			await d.promise;
			seen.push(stale());
			return 'done';
		}, 'skipped');
		await Promise.resolve();
		await authStore.login('b@dreamfly.test', 'pw');
		d.resolve();

		await expect(p).resolves.toBe('done');
		expect(seen).toEqual([false, true]);
	});

	it('A 的寫入卡住不影響 B:換帳號即重置寫入鏈', async () => {
		let logins = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B) }));
		const gate = createSessionGate<Item[]>({ fetch: async () => [], apply: () => {}, reset: () => {} });
		await authStore.login('a@dreamfly.test', 'pw');

		void gate.queueWrite(() => new Promise<string>(() => {}), 'skipped'); // A 的 PATCH 掛死
		await authStore.login('b@dreamfly.test', 'pw');

		await expect(gate.queueWrite(async () => 'b-saved', 'skipped')).resolves.toBe('b-saved');
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

	it('R10 和解窗口閉合:R1 在飛期間 M2 完成(不排 R2)→ R1 的舊快照丟棄並原地重抓,M2 的直寫不被蓋掉', async () => {
		/* 和解快照 vs 後續 mutation 的殘窗:M1 未水合 → 排 R1;R1 掛起期間 M2 進場時旗標
		 * 已是 true、寫回時仍完整,故**不排** R2——R1 的舊快照(server 尚未看見 B)落地後
		 * 舊碼會無條件套用,B 蒸發。refresh 收進世代穩定重抓後,R1 進場捕捉的世代早於 M2
		 * 的 markMutated,落地比對不符 → 丟棄並原地重抓,窗口免費閉合(queueReconcile 零改)。 */
		const A = { id: 'a' };
		const B = { id: 'b' };
		const r1 = createDeferred<Item[]>();
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /list': () => (++gets === 1 ? r1.promise : [B, A]) }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (d) => store.set(d), reset: () => store.set([]) });

		await gate.mutate(async () => A, (r) => store.update((l) => [r, ...l])); // M1 未水合 → markMutated + 排 R1
		await settleReconcile();
		expect(gets).toBe(1); // R1 的 GET 出發(掛起)

		await gate.mutate(async () => B, (r) => store.update((l) => [r, ...l])); // M2:進場已水合且寫回時仍完整 → 不排 R2
		expect(get(store)).toEqual([B, A]);
		expect(gets).toBe(1); // 確認真的沒有第二支和解——閉合只能靠 R1 自己的世代比對

		r1.resolve([A]); // R1 的舊快照(server 尚未看見 B)此刻才落地
		await settleReconcile();

		expect(gets).toBe(2); // 世代已變 → 舊快照丟棄、原地重抓
		expect(get(store)).toEqual([B, A]); // B 沒有被舊快照蓋掉
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

describe('createSessionGate — pageEntry 頁面進場包(C3:關閉 ADR 0017 的 epoch 殘窗)', () => {
	// 殘窗原文:通知**頁**的 load-gate 直接把 raw getter 當 fetch,繞過 epoch 核對——
	// 跨登出/換帳的在飛回應會被 load-gate 無條件套用進共享 store。pageEntry() 把閘門自己的
	// 資料來源(fetch 是核對過的 epochFetch)整包交給頁面,頁面沒有機會拿到 raw getter。

	it('stale:頁面 load 跨 epoch → phase error,onError 收到 stale 錯誤、不套用舊帳號資料', async () => {
		const d = createDeferred<Item[]>();
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => d.promise, apply: (data) => store.set(data), reset: () => store.set([]) });
		const onError = vi.fn();

		await authStore.login('a@dreamfly.test', 'pw');
		const page = createLoadGate({ ...gate.pageEntry(), onError });
		const p = page.load();
		await authStore.logout(); // 在飛期間登出 → epoch+1

		d.resolve([{ id: 'a-item' }]);
		await p;

		expect(get(page)).toBe('error');
		expect(onError).toHaveBeenCalledWith(new Error('stale session: 回應跨登出/換帳號,作廢'));
		expect(get(store)).toEqual([]); // A 的資料沒有復活
		page.destroy();
	});

	it('retry:頁面 load 跨 epoch → phase error 之後,同一頁 refresh() 在新 epoch 下成功(同一支 epochFetch,零新程式路徑)', async () => {
		const d = createDeferred<Item[]>();
		let gets = 0;
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': AUTH_RES,
			'POST /auth/logout': undefined,
			'GET /list': () => (++gets === 1 ? d.promise : [{ id: 'fresh' }])
		}));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => api<Item[]>('/list'), apply: (x) => store.set(x), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const page = createLoadGate({ ...gate.pageEntry() }); // 頁面手上就這一包,retry 也是它
		const p = page.load();
		await authStore.logout();
		d.resolve([{ id: 'stale' }]);
		await p;
		expect(get(page)).toBe('error');

		await page.refresh(); // 新 epoch 下重試
		expect(get(page)).toBe('ready');
		expect(get(store)).toEqual([{ id: 'fresh' }]);
		page.destroy();
	});

	it('session 閘門的進場包帶 epoch 核對:真 createLoadGate({ ...gate.pageEntry() }) 在飛登出 → error 態、舊帳號資料不落地', async () => {
		/* R14 F1:session 閘門不再自己組 pageEntry,而是繼承 HydrationGate 的——它餵給水合閘門的
		 * fetch 就是 epochFetch,所以繼承下來的進場包自帶 epoch 核對。本釘守住這條繼承:若 session
		 * 閘門改餵 raw fetch,舊帳號資料會經閘門的 apply 落回共享 store。 */
		const d = createDeferred<Item[]>();
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));
		const store = writable<Item[]>([]);
		const gate = createSessionGate<Item[]>({ fetch: () => d.promise, apply: (data) => store.set(data), reset: () => store.set([]) });

		await authStore.login('a@dreamfly.test', 'pw');
		const page = createLoadGate({ ...gate.pageEntry() });
		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));
		const p = page.load();
		await authStore.logout(); // 在飛期間登出 → epoch+1

		d.resolve([{ id: 'a-item' }]);
		await p;

		expect(phases[phases.length - 1]).toBe('error');
		expect(get(store)).toEqual([]); // A 的資料沒有經 apply 落地
		expect(get(gate.hydrated)).toBe(false);

		unsub();
		page.destroy();
	});
});

describe('sessionIdentity(身分 key 單一來源)', () => {
	it('未登入 → null', () => {
		expect(sessionIdentity({ loggedIn: false, member: null })).toBeNull();
	});
	it('登入且有 member → member.id', () => {
		expect(sessionIdentity({ loggedIn: true, member: { id: 'u1' } as never })).toBe('u1');
	});
	it('登入但無 member → 空字串(與未登入的 null 區分)', () => {
		expect(sessionIdentity({ loggedIn: true, member: null })).toBe('');
	});
	it('未登入即使殘留 member 也是 null', () => {
		expect(sessionIdentity({ loggedIn: false, member: { id: 'u1' } as never })).toBeNull();
	});
});
