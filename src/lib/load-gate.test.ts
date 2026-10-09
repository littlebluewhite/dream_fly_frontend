import { describe, it, expect, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { render, waitFor } from '@testing-library/svelte';
import {
	createLoadGate,
	createPagedLoadGate,
	type LoadPhase,
	type LoadSource,
	type PagedGateState,
	type PagedResponse
} from './load-gate';
import { createHydrationGate, type HydrationGate } from './hydration-gate';
import LoadGateHarness from './load-gate.harness.svelte';

/** 手動控時序的 deferred promise——測 generation/destroy 競態不用 fake timers。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** 讓「原地重抓」跑完一圈(舊快照落地 → 世代比對 → 再發一次 fetch)——跳一個 macrotask
 *  保證期間的 microtask 全數收束。 */
function settleRetry() {
	return new Promise<void>((r) => setTimeout(r, 0));
}

/** 一筆已落地的非樂觀寫入(無尾流):推世代 + 翻旗。閘門已水合時不排和解,只動世代軸。 */
function landWrite(gate: HydrationGate): Promise<unknown> {
	return gate.write({ send: async () => undefined });
}

/** 一筆樂觀寫入、PATCH 尾流仍在飛:同一同步段內尾流入帳 + 推世代 + 翻旗。 */
function writeTail(gate: HydrationGate, tail: Promise<unknown>): Promise<unknown> {
	return gate.write({ optimistic: () => {}, send: () => tail });
}

interface RowsPage extends PagedResponse {
	rows: string[];
}
function page(overrides: Partial<RowsPage> = {}): RowsPage {
	return { total: 0, page: 1, perPage: 10, rows: [], ...overrides };
}

describe('createLoadGate', () => {
	it('建構後 phase 初值是 loading;元件外建構(無掛載生命週期)不自動 load', () => {
		const fetch = vi.fn().mockResolvedValue({});
		const gate = createLoadGate({ fetch });
		expect(get(gate)).toBe('loading');
		expect(fetch).not.toHaveBeenCalled();
		gate.destroy();
	});

	it('掛載即自動首載:元件掛載後 fetch 被呼叫 1 次並進入 ready', async () => {
		const fetch = vi.fn().mockResolvedValue({ v: 1 });
		const { findByText } = render(LoadGateHarness, { options: { fetch } });
		await findByText('ready');
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('load() 成功流程依序 onData → phase=ready', async () => {
		const data = { value: 1 };
		let phaseDuringOnData: LoadPhase | undefined;
		const gate = createLoadGate({
			fetch: async () => data,
			onData: (d) => {
				phaseDuringOnData = get(gate);
				expect(d).toEqual(data);
			}
		});
		await gate.load();
		expect(phaseDuringOnData).toBe('loading'); // onData 呼叫當下 phase 還沒變成 ready
		expect(get(gate)).toBe('ready');
		gate.destroy();
	});

	it('load() 失敗流程依序 onError → phase=error', async () => {
		const err = new Error('boom');
		let phaseDuringOnError: LoadPhase | undefined;
		const gate = createLoadGate({
			fetch: async () => {
				throw err;
			},
			onError: (e) => {
				phaseDuringOnError = get(gate);
				expect(e).toBe(err);
			}
		});
		await gate.load();
		expect(phaseDuringOnError).toBe('loading');
		expect(get(gate)).toBe('error');
		gate.destroy();
	});

	it('destroy 後 in-flight 回應不寫入:load() 進行中 destroy(),resolve 後 phase 仍是 loading、onData 未被呼叫', async () => {
		const d = createDeferred<{ v: number }>();
		const onData = vi.fn();
		const gate = createLoadGate({ fetch: () => d.promise, onData });

		const loadPromise = gate.load();
		gate.destroy();
		d.resolve({ v: 1 });
		await loadPromise;

		expect(get(gate)).toBe('loading');
		expect(onData).not.toHaveBeenCalled();
	});

	it('不快取:連續兩次 load() 各自呼叫 fetch,onData 各自收到該次回應', async () => {
		const fetch = vi.fn().mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 });
		const onData = vi.fn();
		const gate = createLoadGate({ fetch, onData });

		await gate.load();
		await gate.load();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(onData).toHaveBeenNthCalledWith(1, { v: 1 });
		expect(onData).toHaveBeenNthCalledWith(2, { v: 2 });
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	it('過期回應丟棄(resolve):較快的第二次 load() ready 後,較慢的第一次才 resolve,不覆寫', async () => {
		const slow = createDeferred<{ v: string }>();
		const fast = createDeferred<{ v: string }>();
		const fetch = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
		const onData = vi.fn();
		const gate = createLoadGate({ fetch, onData });

		const p1 = gate.load();
		const p2 = gate.load();

		fast.resolve({ v: 'fast' });
		await p2;
		expect(get(gate)).toBe('ready');
		expect(onData).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith({ v: 'fast' });

		slow.resolve({ v: 'slow' });
		await p1;
		expect(onData).toHaveBeenCalledTimes(1); // 舊資料沒有再次觸發 onData
		expect(get(gate)).toBe('ready'); // phase 沒有退化

		gate.destroy();
	});

	it('過期回應丟棄(reject):較慢的第一次事後才 reject,不呼叫 onError、不覆寫 ready', async () => {
		const slow = createDeferred<{ v: string }>();
		const fast = createDeferred<{ v: string }>();
		const fetch = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
		const onData = vi.fn();
		const onError = vi.fn();
		const gate = createLoadGate({ fetch, onData, onError });

		const p1 = gate.load();
		const p2 = gate.load();

		fast.resolve({ v: 'fast' });
		await p2;
		expect(get(gate)).toBe('ready');

		slow.reject(new Error('stale failure'));
		await p1;
		expect(onError).not.toHaveBeenCalled();
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	it('元件外建構不丟錯(onDestroy 與 onMount 掛載失敗被吞掉),也不 fetch', () => {
		const fetch = vi.fn().mockResolvedValue({});
		expect(() => {
			const gate = createLoadGate({ fetch });
			gate.destroy();
		}).not.toThrow();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('onDestroy 自動掛載:元件 unmount 後,in-flight 回應 resolve 也不再呼叫 onData', async () => {
		const d = createDeferred<{ v: number }>();
		const onData = vi.fn();
		const fetch = vi.fn(() => d.promise);

		const { unmount } = render(LoadGateHarness, { options: { fetch, onData } });
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1)); // 首載確實發出,in-flight 才有意義
		unmount();
		d.resolve({ v: 1 });
		await d.promise; // 讓 gate 內部 await 之後的續行程式跑完

		expect(onData).not.toHaveBeenCalled();
	});

	/* Task F4：非分頁頁面(如 venues/+page.svelte)寫入成功後也需要「突變後靜默重同步、
	 * 不動 phase」——先前只有 PagedLoadGate 有 silentRefresh()，這裡補上對稱實作，
	 * 語意與行為完全比照 PagedLoadGate.silentRefresh()(見下方 describe 區塊)。 */
	it('silentRefresh() 成功時呼叫 onData 更新資料,但全程不觸發任何 phase 變動', async () => {
		const fetch = vi.fn().mockResolvedValueOnce({ v: 1 });
		const onData = vi.fn();
		const gate = createLoadGate({ fetch, onData });
		await gate.load();
		expect(get(gate)).toBe('ready');

		const seenPhases: LoadPhase[] = [];
		const unsub = gate.subscribe((p) => seenPhases.push(p));

		fetch.mockResolvedValueOnce({ v: 2 });
		await gate.silentRefresh();
		unsub();

		expect(seenPhases.every((p) => p === 'ready')).toBe(true);
		expect(onData).toHaveBeenCalledTimes(2); // load() 一次 + silentRefresh 一次
		expect(onData).toHaveBeenLastCalledWith({ v: 2 });
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	it('silentRefresh() 失敗時吞掉錯誤:phase 仍是 ready、不呼叫 onError、不呼叫 onData', async () => {
		const fetch = vi.fn().mockResolvedValueOnce({ v: 1 });
		const onData = vi.fn();
		const onError = vi.fn();
		const gate = createLoadGate({ fetch, onData, onError });
		await gate.load();

		fetch.mockRejectedValueOnce(new Error('network'));
		await gate.silentRefresh();

		expect(get(gate)).toBe('ready');
		expect(onError).not.toHaveBeenCalled();
		expect(onData).toHaveBeenCalledTimes(1); // 只有 load() 那次

		gate.destroy();
	});

	it('silentRefresh() 與 in-flight load() 交錯:phase 非 ready 時 no-op,不作廢 in-flight load 的回應', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise);
		const onData = vi.fn();
		const gate = createLoadGate({ fetch, onData });

		const loadPromise = gate.load(); // phase → loading,generation 已遞增
		expect(get(gate)).toBe('loading');
		expect(fetch).toHaveBeenCalledTimes(1);

		await gate.silentRefresh(); // phase 非 ready → no-op,不得再次呼叫 fetch、不得遞增 generation
		expect(fetch).toHaveBeenCalledTimes(1);

		d.resolve({ v: 1 });
		await loadPromise;

		expect(get(gate)).toBe('ready'); // 未被誤判為過期而 strand 在 loading
		expect(onData).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith({ v: 1 });

		gate.destroy();
	});
});

/* R15 Task 1(候選 F-1):頁面進場包改交「資料來源」(LoadSource)——水合協定的決策(guard
 * 短路、mutation 勝出、翻旗、世代穩定重抓、尾流等待)全數住在水合閘門,load-gate 只管 phase、
 * run 世代、卸載與 onError,並把棄追判準 isCurrent 交給 source。以下鎖定釘原本用合成旗標 +
 * `hydrate` 選項寫成,改用真的 `createHydrationGate(...).pageEntry()` 後斷言不變;語意沿革見
 * 各釘註解(T1 hydrate 選項、codex B0 r1 的重入防護(F1)/(F5)、R10 世代穩定、R11 尾流等待)。 */
describe('source 選項（pageEntry 整合）', () => {
	it('load 在飛 → write() 直寫 → 和解失敗翻回 false → 回應落地：舊快照不套用、直寫列保留', async () => {
		/* bug #3(ADR-0024 記錄的潛伏窗口):舊 load 路徑判斷 mutation 勝出只看旗標,和解失敗
		 * 把旗標翻回 false(invalidate)就拆掉了在飛 load 的 mutation-wins——舊快照落地、直寫列
		 * 蒸發。load 路徑自此與 gate.hydrate 同一判準:進場捕捉世代、落地比對。 */
		const store = writable<string[]>([]);
		const d = createDeferred<string[]>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockRejectedValueOnce(new Error('offline'));
		const gate = createHydrationGate({ fetch, apply: (rows: string[]) => store.set(rows) });
		const page = createLoadGate({ ...gate.pageEntry() });

		const p = page.load();
		await gate.write({ send: async () => 'direct', commit: (r) => store.update((rows) => [...rows, r]) }); // 在飛期間的本地直寫
		await settleRetry(); // 未水合寫入的和解重抓失敗:旗標翻回 false(可重試縫)
		expect(get(gate.hydrated)).toBe(false);

		d.resolve(['stale']);
		await p;

		expect(get(store)).toEqual(['direct']); // 舊快照不套用,直寫列保留
		expect(get(gate.hydrated)).toBe(false); // 不翻旗——可重試路徑保持開啟
		expect(get(page)).toBe('ready'); // 資料已在 store,仍收斂離開骨架

		page.destroy();
	});

	it('旗標 false → load() 正常序:fetch → into(d) → 翻旗 → ready', async () => {
		const data = { v: 1 };
		const fetch = vi.fn(async () => data);
		const into = vi.fn((d: typeof data) => {
			expect(d).toEqual(data);
			expect(get(gate.hydrated)).toBe(false); // into 呼叫當下旗標還沒被翻
			expect(get(page)).toBe('loading'); // into 呼叫當下 phase 還沒變成 ready
		});
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });

		await page.load();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith(data);
		expect(get(gate.hydrated)).toBe(true); // into 之後才翻旗
		expect(get(page)).toBe('ready'); // 翻旗之後才收斂 ready

		page.destroy();
	});

	it('in-flight mutation 勝出釘:load() fetch 進行中(await 期間)write() 落地 → resolve 後不套舊快照(共享 store 不被覆寫)、但 phase 收斂 ready', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce({ v: 2 });
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });

		const loadPromise = page.load();
		expect(get(page)).toBe('loading'); // in-flight,尚未收斂

		await landWrite(gate); // in-flight 期間的本地 mutation(未水合 → 和解重抓 {v:2})
		d.resolve({ v: 1 });
		await loadPromise; // re-check 應放棄套用,promise 正常 resolve(不 reject)

		expect(into).not.toHaveBeenCalledWith({ v: 1 }); // mutation 勝出,舊快照不覆寫共享 store
		expect(get(page)).toBe('ready'); // 資料已在 store(mutation 寫的),仍要收斂離開骨架
		await new Promise<void>((r) => setTimeout(r, 0)); // 和解重抓收束
		expect(into).toHaveBeenCalledWith({ v: 2 }); // 落地的是和解重抓那份

		page.destroy();
	});

	/* 重入防護(F1)(codex B0 r1 F3):into() 本身(它的 subscriber)同步重入 page.load(),開出
	 * 新一輪 run 世代。沒有 into() 之後的 isCurrent 重查,舊一輪會無條件翻旗,新一輪自己的
	 * 落地就會被這個旗標判成 mutation 勝出、真正的新資料永遠寫不進共享 store。 */
	it('重入釘子:into() 的 subscriber 同步重入 load(),最終共享 store 是第二次(新 generation)的 payload、phase ready、flag true', async () => {
		const sharedStore = writable<{ v: number } | null>(null);
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const gate = createHydrationGate({ fetch, apply: (data: { v: number }) => sharedStore.set(data) });
		const page = createLoadGate({ ...gate.pageEntry() });

		let reentrantLoad: Promise<void> | undefined;
		let sawWrite = false;
		const unsub = sharedStore.subscribe((val) => {
			// subscribe() 當下會用初值(null)立即同步觸發一次,跳過;第一次真正寫入
			// (into({v:1}))才同步重入 page.load(),模擬共享 store 的訂閱者收到更新後
			// 自己也要重新拉一次資料。
			if (val !== null && !sawWrite) {
				sawWrite = true;
				reentrantLoad = page.load();
			}
		});

		const p1 = page.load();
		d1.resolve({ v: 1 });
		await p1;

		expect(fetch).toHaveBeenCalledTimes(2); // 重入已經發出第二次 fetch
		expect(get(gate.hydrated)).toBe(false); // 舊一輪的 into() 之後不得翻旗(F1)
		expect(get(page)).toBe('loading'); // 舊一輪不得把 phase 推成 ready(F1)

		d2.resolve({ v: 2 });
		await reentrantLoad;

		expect(get(sharedStore)).toEqual({ v: 2 }); // 是第二次(新 generation)的 payload,不是 stale {v:1}
		expect(get(gate.hydrated)).toBe(true);
		expect(get(page)).toBe('ready');

		unsub();
		page.destroy();
	});

	/* 重入防護(F5)(codex B0 r1 追補):refresh 路徑有與 F1 完全同款的同步重入 gap——
	 * refresh() 的 into(data) 觸發 subscriber 同步重入 page.load()(此刻旗標尚未翻,load 不短路、
	 * 發第二次 fetch、run 世代++)。沒有 isCurrent 重查,舊 refresh 隨後的翻旗會讓新 load 的落地
	 * 誤判 mutation 勝出而丟棄新資料——store 停在 refresh 的舊資料。 */
	it('重入釘子(refresh 路徑):into() 的 subscriber 同步重入 load(),最終共享 store 是 load(新 generation)的 payload、phase ready、flag true', async () => {
		const sharedStore = writable<{ v: number } | null>(null);
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const gate = createHydrationGate({ fetch, apply: (data: { v: number }) => sharedStore.set(data) });
		const page = createLoadGate({ ...gate.pageEntry() });

		let reentrantLoad: Promise<void> | undefined;
		let sawWrite = false;
		const unsub = sharedStore.subscribe((val) => {
			// 同上一條:略過 subscribe() 當下的初值(null)觸發;第一次真正寫入
			// (refresh 的 into({v:1}))才同步重入 page.load()。
			if (val !== null && !sawWrite) {
				sawWrite = true;
				reentrantLoad = page.load();
			}
		});

		const p1 = page.refresh(); // 與上一條唯一的差別:第一輪從 refresh() 出發
		d1.resolve({ v: 1 });
		await p1;

		expect(fetch).toHaveBeenCalledTimes(2); // 重入時旗標尚未翻,load() 不短路、已發出第二次 fetch
		expect(get(gate.hydrated)).toBe(false); // 舊 refresh 一輪的 into() 之後不得翻旗(F5)
		expect(get(page)).toBe('loading'); // 舊一輪不得把 phase 推成 ready

		d2.resolve({ v: 2 });
		await reentrantLoad;

		expect(get(sharedStore)).toEqual({ v: 2 }); // 是 load(新 generation)的 payload,不是 refresh 的舊 {v:1}
		expect(get(gate.hydrated)).toBe(true);
		expect(get(page)).toBe('ready');

		unsub();
		page.destroy();
	});

	it('失敗路徑:fetch reject → phase 進 error(與 onData 路徑相同語意),不翻旗', async () => {
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });

		await page.load();

		expect(into).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);
		expect(get(page)).toBe('error');

		page.destroy();
	});

	/* R10(第四決策點):refresh 族的世代穩定重抓——進場捕捉 mutation 世代、落地比對,飛行窗口
	 * 內發生的本地 mutation 讓那份快照作廢並原地重抓。load() 不走(hydrate 契約是丟棄了事)。 */
	it('世代穩定重抓(refresh):in-flight 世代變 → 舊快照丟棄並原地重抓,phase 全程單一週期(不回 loading)', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 已水合:寫入不排和解,只看世代軸
		fetch.mockClear();
		into.mockClear();

		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		const p = page.refresh();
		await landWrite(gate); // refresh 進場「之後」的本地 mutation
		d1.resolve({ v: 1 });
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(2); // 舊快照丟棄 + 原地重抓
		expect(into).not.toHaveBeenCalled();

		d2.resolve({ v: 2 });
		await p;

		expect(into).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 2 });
		expect(get(gate.hydrated)).toBe(true);
		expect(phases).toEqual(['loading', 'ready']); // 重抓不把 phase 打回 loading（契約：單一週期）

		unsub();
		page.destroy();
	});

	it('世代穩定重抓的棄追:重抓期間被新一輪 load() 取代 → 舊輪不再重抓、靜默退場,共享 store 是新一輪的 payload', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const d3 = createDeferred<{ v: number }>();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce({ v: 0 })
			.mockReturnValueOnce(d1.promise)
			.mockReturnValueOnce(d2.promise)
			.mockReturnValueOnce(d3.promise);
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 已水合:寫入不排和解,只看世代軸
		fetch.mockClear();
		into.mockClear();

		const p1 = page.refresh();
		await landWrite(gate);
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2); // 舊輪的第一次重抓已出發

		await landWrite(gate); // 舊輪的重抓快照落地前世代又變(發生在新一輪進場之前,不影響新一輪)
		gate.invalidate(); // 旗標翻回 false,下面的 load() 才不短路
		const p2 = page.load(); // 新一輪取代舊輪（run 世代++），旗標仍 false 故不短路
		expect(fetch).toHaveBeenCalledTimes(3); // 第 3 次 = 新一輪自己的 fetch

		d2.resolve({ v: 2 });
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(3); // 棄追:舊輪不再抓下一次（否則會是 4）
		expect(into).not.toHaveBeenCalled();

		d3.resolve({ v: 3 });
		await Promise.all([p1, p2]);

		expect(into).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 3 }); // 落地的是新一輪的 payload
		expect(get(page)).toBe('ready');

		page.destroy();
	});

	it('世代穩定重抓(silentRefresh):世代變 → 重抓,全程 phase 不動', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 先水合,讓 load() 走 guard 短路到 ready 而不觸發 fetch/into
		fetch.mockClear();
		into.mockClear();
		await page.load();
		expect(get(page)).toBe('ready');
		expect(fetch).not.toHaveBeenCalled();

		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		const p = page.silentRefresh();
		await landWrite(gate);
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2);

		d2.resolve({ v: 2 });
		await p;
		unsub();

		expect(into).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 2 });
		expect(phases.every((x) => x === 'ready')).toBe(true); // 靜默:重抓也不動 phase
		expect(get(page)).toBe('ready');

		page.destroy();
	});

	/* R11(第五決策點):refresh 族每次出發 GET 之前先等未 settle 的樂觀 mutation 尾流
	 * (樂觀 write() 的 PATCH 入帳)——關閉「GET 在 PATCH 仍在飛時出發、server 回舊真值」的
	 * server-race 窗。 */
	it('mutation settle(refresh):尾流未 settle → GET 不出發;settle 後才出發,phase 全程單一週期', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 已水合:樂觀寫入不排和解,GET 次數只看等待軸
		fetch.mockClear();
		into.mockClear();
		void writeTail(gate, tail.promise); // 樂觀 mutation:PATCH 尾流仍在飛

		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		const p = page.refresh();
		await settleRetry();

		expect(fetch).not.toHaveBeenCalled(); // PATCH 尾流仍在飛,GET 不出發

		tail.resolve();
		await p;

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 1 });
		expect(get(gate.hydrated)).toBe(true);
		expect(phases).toEqual(['loading', 'ready']); // 等待不多推一次 phase（契約：單一週期）

		unsub();
		page.destroy();
	});

	it('mutation settle(silentRefresh):尾流未 settle → GET 不出發;settle 後才出發,全程 phase 不動', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 2 }));
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 已水合(load() 走 guard 短路)
		fetch.mockClear();
		into.mockClear();
		void writeTail(gate, tail.promise); // 尾流入帳
		await page.load();
		expect(fetch).not.toHaveBeenCalled();

		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		const p = page.silentRefresh();
		await settleRetry();

		expect(fetch).not.toHaveBeenCalled();

		tail.resolve();
		await p;
		unsub();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 2 });
		expect(phases.every((x) => x === 'ready')).toBe(true); // 靜默:等待也不動 phase

		page.destroy();
	});

	it('mutation settle 的棄追:等待期間被新一輪 load() 取代 → 醒來即棄追,舊輪的 GET 永不出發', async () => {
		const tail = createDeferred<void>();
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockImplementation(() => d.promise);
		const into = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry() });
		await gate.hydrate(); // 已水合:樂觀寫入不排和解
		fetch.mockClear();
		into.mockClear();
		void writeTail(gate, tail.promise);
		gate.invalidate(); // 旗標翻回 false,下面的 load() 才不短路;尾流帳不受影響

		const p1 = page.refresh(); // 舊輪:卡在等尾流 settle
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		const p2 = page.load(); // 新一輪取代舊輪（run 世代++）;load() 不套等待,直接出發
		expect(fetch).toHaveBeenCalledTimes(1);

		d.resolve({ v: 9 });
		await p2; // 新一輪先落地翻旗:尾流 settle 時寫入看到已完整,不排和解
		tail.resolve();
		await p1;

		expect(fetch).toHaveBeenCalledTimes(1); // 棄追:舊輪醒來已無意義,不補發 GET（否則會是 2）
		expect(into).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith({ v: 9 }); // 落地的是新一輪的 payload
		expect(get(page)).toBe('ready');

		page.destroy();
	});

	it('世代穩定重抓的失敗:第 N 次重抓 reject → 原樣傳給 load-gate（onError + phase=error）,不翻旗', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const into = vi.fn();
		const onError = vi.fn();
		const gate = createHydrationGate({ fetch, apply: into });
		const page = createLoadGate({ ...gate.pageEntry(), onError });
		await gate.hydrate(); // 已水合:寫入不排和解,只看世代軸
		fetch.mockClear();
		into.mockClear();

		const p = page.refresh();
		await landWrite(gate);
		gate.invalidate(); // 旗標翻回 false,「不翻旗」才釘得到
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2);

		const err = new Error('retry-boom');
		d2.reject(err);
		await p;

		expect(onError).toHaveBeenCalledWith(err); // 重抓的失敗就是這一輪的失敗
		expect(get(page)).toBe('error');
		expect(into).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);

		page.destroy();
	});
});

/* LoadSource 契約(R15 F-1):用假 source 釘 load-gate 自己的那一半——phase、run 世代、卸載與
 * onError 的寫入點都在 load-gate,source 只能讀 isCurrent。水合語意由上方 pageEntry 整合釘負責。 */
describe('LoadSource 契約(假 source)', () => {
	function fakeSource(overrides: Partial<LoadSource> = {}): LoadSource {
		return { guarded: () => false, load: async () => {}, refresh: async () => {}, ...overrides };
	}

	it('guarded 為真 → load() 同步收斂 ready,不呼叫 source.load', async () => {
		const load = vi.fn(async () => {});
		const page = createLoadGate({ source: fakeSource({ guarded: () => true, load }) });

		const p = page.load();
		expect(get(page)).toBe('ready'); // 同步:尚未 await 就已 ready
		await p;

		expect(load).not.toHaveBeenCalled();
		page.destroy();
	});

	it('isCurrent:被新一輪取代之後、destroy 之後都回 false', async () => {
		const seen: Array<() => boolean> = [];
		const load = vi.fn((isCurrent: () => boolean) => {
			seen.push(isCurrent);
			return new Promise<void>(() => {}); // 永不落地:只看棄追判準
		});
		const page = createLoadGate({ source: fakeSource({ load }) });

		void page.load();
		expect(seen[0]()).toBe(true);

		void page.load(); // 新一輪取代舊一輪
		expect(seen[0]()).toBe(false);
		expect(seen[1]()).toBe(true);

		page.destroy();
		expect(seen[1]()).toBe(false);
	});

	it('source 跨多個 tick → phase 仍只有 loading→ready 一個週期', async () => {
		const source = fakeSource({
			load: async () => {
				await Promise.resolve();
				await settleRetry();
				await settleRetry();
			}
		});
		const page = createLoadGate({ source });
		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		await page.load();

		expect(phases).toEqual(['loading', 'ready']);
		unsub();
		page.destroy();
	});

	it('silentRefresh():把 isCurrent 交給 source.refresh、吞掉錯誤、不動 phase、不呼叫 onError', async () => {
		let handed: (() => boolean) | undefined;
		const refresh = vi.fn(async (isCurrent: () => boolean) => {
			handed = isCurrent;
			throw new Error('boom');
		});
		const onError = vi.fn();
		const page = createLoadGate({ source: fakeSource({ refresh }), onError });
		await page.load();
		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		await page.silentRefresh();

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(handed?.()).toBe(true); // 交出的就是這一輪的棄追判準
		expect(phases.every((x) => x === 'ready')).toBe(true);
		expect(onError).not.toHaveBeenCalled();
		unsub();
		page.destroy();
	});
});

describe('createPagedLoadGate', () => {
	it('建構後狀態初值:loading、page=1、total=0、perPage 預設 10', () => {
		const gate = createPagedLoadGate({ fetch: async () => page() });
		expect(get(gate)).toEqual({ phase: 'loading', page: 1, total: 0, perPage: 10 });
		gate.destroy();
	});

	it('perPage 可自訂初值', () => {
		const gate = createPagedLoadGate({ fetch: async () => page(), perPage: 20 });
		expect(get(gate).perPage).toBe(20);
		gate.destroy();
	});

	it('掛載即自動首載:元件掛載後 fetch 被呼叫 1 次並進入 ready', async () => {
		const fetch = vi.fn().mockResolvedValue(page());
		const { findByText } = render(LoadGateHarness, { options: { fetch }, paged: true });
		await findByText('ready');
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('元件外建構不自動 load、不 fetch', () => {
		const fetch = vi.fn().mockResolvedValue(page());
		const gate = createPagedLoadGate({ fetch });
		expect(fetch).not.toHaveBeenCalled();
		gate.destroy();
	});

	it('load() 成功以回應的 total/page/perPage 更新 meta(以回應為準),onData 前已寫入、phase 最後才 ready', async () => {
		const resp = page({ total: 35, page: 2, perPage: 10, rows: ['a'] });
		const fetch = vi.fn().mockResolvedValue(resp);
		let snapshotDuringOnData: PagedGateState | undefined;
		const gate = createPagedLoadGate({
			fetch,
			onData: () => {
				snapshotDuringOnData = get(gate);
			}
		});

		await gate.load(2);

		expect(fetch).toHaveBeenCalledWith(2);
		expect(snapshotDuringOnData).toMatchObject({
			total: 35,
			page: 2,
			perPage: 10,
			phase: 'loading'
		});
		expect(get(gate)).toMatchObject({ total: 35, page: 2, perPage: 10, phase: 'ready' });

		gate.destroy();
	});

	it('失敗頁碼樂觀重試:load(3) reject 後 page 仍是 3、phase 是 error;refresh() 用同一頁重試', async () => {
		const err = new Error('boom');
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(err)
			.mockResolvedValueOnce(page({ total: 30, page: 3, perPage: 10 }));
		const onError = vi.fn();
		const gate = createPagedLoadGate({ fetch, onError });

		await gate.load(3);
		expect(fetch).toHaveBeenCalledWith(3);
		expect(get(gate)).toMatchObject({ page: 3, phase: 'error' });
		expect(onError).toHaveBeenCalledWith(err);

		gate.refresh();
		expect(fetch).toHaveBeenLastCalledWith(3); // refresh 沿用目前(失敗那頁)頁碼重抓

		gate.destroy();
	});

	it('changePage() 邊界檢查:小於 1 或超過總頁數是 no-op,合法頁碼才觸發 load(p)', async () => {
		const fetch = vi.fn().mockResolvedValue(page({ total: 25, page: 1, perPage: 10 })); // 3 頁
		const gate = createPagedLoadGate({ fetch, perPage: 10 });
		await gate.load(); // total=25, perPage=10 → maxPage=3

		fetch.mockClear();
		gate.changePage(0);
		gate.changePage(4);
		expect(fetch).not.toHaveBeenCalled();
		expect(get(gate).page).toBe(1);

		gate.changePage(3);
		expect(fetch).toHaveBeenCalledWith(3);

		gate.destroy();
	});

	it('silentRefresh() 成功時更新 meta、呼叫 onData,但全程不觸發任何 phase 變動', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(page({ total: 10, page: 1, perPage: 10 }));
		const onData = vi.fn();
		const gate = createPagedLoadGate({ fetch, onData });
		await gate.load();
		expect(get(gate).phase).toBe('ready');

		const seenPhases: LoadPhase[] = [];
		const unsub = gate.subscribe((s) => seenPhases.push(s.phase));

		fetch.mockResolvedValueOnce(page({ total: 20, page: 1, perPage: 10 }));
		await gate.silentRefresh();
		unsub();

		expect(seenPhases.every((p) => p === 'ready')).toBe(true);
		expect(get(gate).total).toBe(20);
		expect(onData).toHaveBeenCalledTimes(2); // load() 一次 + silentRefresh 一次

		gate.destroy();
	});

	it('silentRefresh() 失敗時吞掉錯誤:phase 仍是 ready、不呼叫 onError、不呼叫 onData', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(page({ total: 10, page: 1, perPage: 10 }));
		const onData = vi.fn();
		const onError = vi.fn();
		const gate = createPagedLoadGate({ fetch, onData, onError });
		await gate.load();

		fetch.mockRejectedValueOnce(new Error('network'));
		await gate.silentRefresh();

		expect(get(gate).phase).toBe('ready');
		expect(onError).not.toHaveBeenCalled();
		expect(onData).toHaveBeenCalledTimes(1); // 只有 load() 那次

		gate.destroy();
	});

	it('silentRefresh() 與 in-flight load() 交錯:phase 非 ready 時 no-op,不作廢 in-flight load 的回應', async () => {
		const d = createDeferred<RowsPage>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise);
		const onData = vi.fn();
		const gate = createPagedLoadGate({ fetch, onData });

		const loadPromise = gate.load(2); // phase → loading,generation 已遞增
		expect(get(gate).phase).toBe('loading');
		expect(fetch).toHaveBeenCalledTimes(1);

		await gate.silentRefresh(); // phase 非 ready → no-op,不得再次呼叫 fetch、不得遞增 generation
		expect(fetch).toHaveBeenCalledTimes(1);

		d.resolve(page({ total: 20, page: 2, perPage: 10, rows: ['a'] }));
		await loadPromise;

		expect(get(gate)).toMatchObject({ phase: 'ready', page: 2, total: 20 }); // 未被誤判為過期而 strand 在 loading
		expect(onData).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith(page({ total: 20, page: 2, perPage: 10, rows: ['a'] }));

		gate.destroy();
	});

	it('事件參數安全:MouseEvent 傳入 load()/refresh() 不會被誤判為頁碼', async () => {
		const fetch = vi.fn().mockResolvedValue(page({ total: 50, page: 2, perPage: 10 }));
		const gate = createPagedLoadGate({ fetch, perPage: 10 });
		await gate.load(2); // 先到第 2 頁
		fetch.mockClear();

		const evt = new MouseEvent('click');
		(gate.refresh as unknown as (e: MouseEvent) => void)(evt);
		expect(fetch).toHaveBeenCalledWith(2); // 事件被安全忽略,頁碼不變

		fetch.mockClear();
		void (gate.load as unknown as (e: MouseEvent) => Promise<void>)(evt);
		expect(fetch).toHaveBeenCalledWith(2); // typeof 擋下,沿用原頁碼
		expect(get(gate).page).toBe(2); // 沒有把事件物件寫進 page

		gate.destroy();
	});
});

// F4(codex B0 r1):一個 gate 只能擇一——fetch(+onData)或 source(LoadGateOptions 的
// discriminated union)。同時提供應為編譯期錯誤,靠下面的 @ts-expect-error 釘住;svelte-check
// 若在它「沒有錯誤可壓」時報錯,即代表這條負向測試失敗(互斥契約鬆綁了)。這條只驗證型別、
// 不執行(it.skip)。
it.skip('型別:fetch 與 source 不得同時提供、onData 與 source 不得同時提供', () => {
	const source: LoadSource = { guarded: () => false, load: async () => {}, refresh: async () => {} };
	// @ts-expect-error fetch 與 source 互斥,見 LoadGateOptions 的 discriminated union
	createLoadGate({ fetch: async () => ({ v: 1 }), source });
	// @ts-expect-error onData 與 source 互斥(onData 只屬於 plain 的 fetch 分支)
	createLoadGate({ source, onData: () => {} });
});
