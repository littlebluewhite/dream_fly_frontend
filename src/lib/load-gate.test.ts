import { describe, it, expect, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { render } from '@testing-library/svelte';
import {
	createLoadGate,
	createPagedLoadGate,
	type LoadPhase,
	type PagedGateState,
	type PagedResponse
} from './load-gate';
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

interface RowsPage extends PagedResponse {
	rows: string[];
}
function page(overrides: Partial<RowsPage> = {}): RowsPage {
	return { total: 0, page: 1, perPage: 10, rows: [], ...overrides };
}

describe('createLoadGate', () => {
	it('建構後 phase 初值是 loading,不自動 load', () => {
		const gate = createLoadGate({ fetch: async () => ({}) });
		expect(get(gate)).toBe('loading');
		gate.destroy();
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

	it('元件外建構不丟錯(onDestroy 掛載失敗被吞掉)', () => {
		expect(() => {
			const gate = createLoadGate({ fetch: async () => ({}) });
			gate.destroy();
		}).not.toThrow();
	});

	it('onDestroy 自動掛載:元件 unmount 後,in-flight 回應 resolve 也不再呼叫 onData', async () => {
		const d = createDeferred<{ v: number }>();
		const onData = vi.fn();
		const fetch = () => d.promise;

		const { unmount } = render(LoadGateHarness, { options: { fetch, onData } });
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

/* Task T1(B0/K2-a)：hydrate 選項——把兩個通知頁手焊的「skip 讀旗標 + onData 寫旗標」
 * 4 行邏輯收進 load-gate 本身，成為型別層與 onData 互斥的獨立選項。語意仿
 * $lib/hydration-gate 的 createHydrationGate（guard 短路 + post-await re-check +
 * mutator 翻旗），差異只在 load() 的 in-flight 競態改由 flag 重查、且重查為 true 時
 * phase 仍要收斂 ready（資料已經在 store 裡，不該卡在骨架）。 */
describe('hydrate 選項', () => {
	it('旗標已 true → load() 短路不發 fetch、phase 收斂 ready', async () => {
		const flag = writable(true);
		const fetch = vi.fn(async () => ({ v: 1 }));
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		await gate.load();

		expect(fetch).not.toHaveBeenCalled();
		expect(into).not.toHaveBeenCalled();
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	it('旗標 false → load() 正常序:fetch → into(d) → 翻旗 → ready', async () => {
		const flag = writable(false);
		const data = { v: 1 };
		const fetch = vi.fn(async () => data);
		const into = vi.fn((d: typeof data) => {
			expect(d).toEqual(data);
			expect(get(flag)).toBe(false); // into 呼叫當下旗標還沒被翻
			expect(get(gate)).toBe('loading'); // into 呼叫當下 phase 還沒變成 ready
		});
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		await gate.load();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith(data);
		expect(get(flag)).toBe(true); // into 之後才翻旗
		expect(get(gate)).toBe('ready'); // 翻旗之後才收斂 ready

		gate.destroy();
	});

	it('refresh() 無視旗標:旗標 true 仍發 fetch 並套用 into + 翻旗', async () => {
		const flag = writable(true);
		const data = { v: 2 };
		const fetch = vi.fn(async () => data);
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith(data);
		expect(get(flag)).toBe(true);
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	/* F2(codex B0 r1):上面這條測試旗標從 true 開始,砍掉 applyRefreshed 的
	 * flag.set(true) 不會被它發現(true 砍成 true 還是 true)。這裡補從 false 出發的
	 * 版本,把「完成後旗標為 true」這個轉移本身釘住。 */
	it('refresh() 從旗標 false 出發:套用 into 後翻為 true(即使從未呼叫過 load())', async () => {
		const flag = writable(false);
		const data = { v: 3 };
		const fetch = vi.fn(async () => data);
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith(data);
		expect(get(flag)).toBe(true); // false → true 的轉移才是這條測試要釘的行為
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	it('in-flight 翻旗競態釘:load() fetch 進行中(await 期間)旗標被翻 true → resolve 後不套 into(共享 store 不被覆寫)、但 phase 收斂 ready', async () => {
		const flag = writable(false);
		const d = createDeferred<{ v: number }>();
		const into = vi.fn();
		const gate = createLoadGate({ fetch: () => d.promise, hydrate: { flag, into } });

		const loadPromise = gate.load();
		expect(get(gate)).toBe('loading'); // in-flight,尚未收斂

		flag.set(true); // in-flight 期間旗標被翻 true——模擬 mutator 直接對共用 writable set(true)
		d.resolve({ v: 1 });
		await loadPromise; // re-check 應放棄套用,promise 正常 resolve(不 reject)

		expect(into).not.toHaveBeenCalled(); // mutation 勝出,不覆寫共享 store
		expect(get(gate)).toBe('ready'); // 資料已在 store(mutation 寫的),仍要收斂離開骨架

		gate.destroy();
	});

	/* F3(codex B0 r1):F1 修的是比上面「外部旗標被直接 set(true)」更深一層的競態——
	 * into() 本身(它的 subscriber)同步重入 gate.load(),開出新一輪 generation。沒有
	 * F1 的重查,舊一輪的 into() 之後會無條件翻旗,新一輪自己的 into() 就會被這個旗標
	 * 擋下、真正的新資料永遠寫不進共享 store(最終停在 stale {v:1} 而非 {v:2})。 */
	it('重入釘子:into() 的 subscriber 同步重入 load(),最終共享 store 是第二次(新 generation)的 payload、phase ready、flag true', async () => {
		const flag = writable(false);
		const sharedStore = writable<{ v: number } | null>(null);
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const into = (data: { v: number }) => sharedStore.set(data);

		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		let reentrantLoad: Promise<void> | undefined;
		let sawWrite = false;
		const unsub = sharedStore.subscribe((val) => {
			// subscribe() 當下會用初值(null)立即同步觸發一次,跳過;第一次真正寫入
			// (into({v:1}))才同步重入 gate.load(),模擬共享 store 的訂閱者收到更新後
			// 自己也要重新拉一次資料。
			if (val !== null && !sawWrite) {
				sawWrite = true;
				reentrantLoad = gate.load();
			}
		});

		const p1 = gate.load();
		d1.resolve({ v: 1 });
		await p1;

		expect(fetch).toHaveBeenCalledTimes(2); // 重入已經發出第二次 fetch
		expect(get(flag)).toBe(false); // 舊一輪的 into() 之後不得翻旗(F1)
		expect(get(gate)).toBe('loading'); // 舊一輪不得把 phase 推成 ready(F1)

		d2.resolve({ v: 2 });
		await reentrantLoad;

		expect(get(sharedStore)).toEqual({ v: 2 }); // 是第二次(新 generation)的 payload,不是 stale {v:1}
		expect(get(flag)).toBe(true);
		expect(get(gate)).toBe('ready');

		unsub();
		gate.destroy();
	});

	/* F5(codex B0 r1 追補):applyRefreshed 有與 F1 完全同款的同步重入 gap——
	 * refresh() 的 into(data) 觸發 subscriber 同步重入 gate.load()(此刻旗標尚未翻,
	 * into 先於 flag.set,load 不短路、發第二次 fetch、generation++)。沒有 gen 重查,
	 * 舊 refresh 隨後的無條件翻旗會讓新 load 的回應在 applyLoaded 的旗標重查誤判
	 * mutation 勝出而丟棄新資料——store 停在 refresh 的舊資料。 */
	it('重入釘子(refresh 路徑):into() 的 subscriber 同步重入 load(),最終共享 store 是 load(新 generation)的 payload、phase ready、flag true', async () => {
		const flag = writable(false);
		const sharedStore = writable<{ v: number } | null>(null);
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const into = (data: { v: number }) => sharedStore.set(data);

		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		let reentrantLoad: Promise<void> | undefined;
		let sawWrite = false;
		const unsub = sharedStore.subscribe((val) => {
			// 同上一條:略過 subscribe() 當下的初值(null)觸發;第一次真正寫入
			// (refresh 的 into({v:1}))才同步重入 gate.load()。
			if (val !== null && !sawWrite) {
				sawWrite = true;
				reentrantLoad = gate.load();
			}
		});

		const p1 = gate.refresh(); // 與 F3 唯一的差別:第一輪從 refresh() 出發
		d1.resolve({ v: 1 });
		await p1;

		expect(fetch).toHaveBeenCalledTimes(2); // 重入時旗標尚未翻,load() 不短路、已發出第二次 fetch
		expect(get(flag)).toBe(false); // 舊 refresh 一輪的 into() 之後不得翻旗(F5)
		expect(get(gate)).toBe('loading'); // 舊一輪不得把 phase 推成 ready(F1 的 run() 重查)

		d2.resolve({ v: 2 });
		await reentrantLoad;

		expect(get(sharedStore)).toEqual({ v: 2 }); // 是 load(新 generation)的 payload,不是 refresh 的舊 {v:1}
		expect(get(flag)).toBe(true);
		expect(get(gate)).toBe('ready');

		unsub();
		gate.destroy();
	});

	it('失敗路徑:fetch reject → phase 進 error(與 onData 路徑相同語意),不翻旗', async () => {
		const flag = writable(false);
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });

		await gate.load();

		expect(into).not.toHaveBeenCalled();
		expect(get(flag)).toBe(false);
		expect(get(gate)).toBe('error');

		gate.destroy();
	});

	it('silentRefresh() 無條件套用 + 翻旗', async () => {
		const flag = writable(false);
		const fetch = vi.fn().mockResolvedValueOnce({ v: 1 }).mockResolvedValueOnce({ v: 2 });
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });
		await gate.load();
		expect(get(gate)).toBe('ready');
		expect(get(flag)).toBe(true);

		await gate.silentRefresh();

		expect(into).toHaveBeenCalledTimes(2); // load() 一次 + silentRefresh 一次
		expect(into).toHaveBeenLastCalledWith({ v: 2 });
		expect(get(flag)).toBe(true);
		expect(get(gate)).toBe('ready');

		gate.destroy();
	});

	/* F2(codex B0 r1):上面這條測試執行 silentRefresh() 當下,旗標已經被前面的
	 * load() 翻成 true 了,砍掉 applyRefreshed 的 flag.set(true) 一樣不會被發現。這裡
	 * 讓旗標先 true、借 hydrate 自己的短路讓 load() 到 ready 但不觸發 fetch/into,再手動
	 * 撥回 false,乾淨地釘住 silentRefresh() 自己的 false → true 轉移(T9:skip 選項退役,
	 * 原本借 skip 短路做同一件事,現改借 hydrate 短路)。 */
	it('silentRefresh() 從旗標 false 出發:套用 into 後翻為 true(hydrate 短路先到 ready,手動撥回旗標)', async () => {
		const flag = writable(true); // 先 true 讓 load() 走 hydrate 短路,不觸發 fetch/into
		const data = { v: 5 };
		const fetch = vi.fn(async () => data);
		const into = vi.fn();
		const gate = createLoadGate({ fetch, hydrate: { flag, into } });
		await gate.load();
		expect(get(gate)).toBe('ready');
		expect(fetch).not.toHaveBeenCalled();
		expect(into).not.toHaveBeenCalled();
		expect(get(flag)).toBe(true); // hydrate 短路,旗標維持建構時的初值,未被動過

		flag.set(false); // 手動撥回,隔離 silentRefresh() 自己的 false → true 轉移

		await gate.silentRefresh();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(into).toHaveBeenCalledWith(data);
		expect(get(flag)).toBe(true); // false → true 的轉移由 silentRefresh() 自己完成
		expect(get(gate)).toBe('ready');

		gate.destroy();
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

// F4(codex B0 r1):onData 與 hydrate 型別層互斥(LoadGateOptions 的 discriminated
// union)——同時提供兩者應為編譯期錯誤,靠下面的 @ts-expect-error 釘住;svelte-check
// 若在它「沒有錯誤可壓」時報錯,即代表這條負向測試失敗(XOR 契約鬆綁了)。這條只驗證
// 型別、不執行(it.skip)。
it.skip('型別:onData 與 hydrate 不得同時提供', () => {
	const flag = writable(false);
	// @ts-expect-error onData 與 hydrate 互斥,見 LoadGateOptions 的 discriminated union
	createLoadGate({
		fetch: async () => ({ v: 1 }),
		onData: () => {},
		hydrate: { flag, into: () => {} }
	});
});
