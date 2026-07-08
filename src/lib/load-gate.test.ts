import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
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

	it('skip 短路 load()(不打 API、不呼叫 onData);refresh() 一律真抓、無視 skip', async () => {
		const data = { value: 42 };
		const fetch = vi.fn(async () => data);
		const onData = vi.fn();
		const gate = createLoadGate({ fetch, skip: () => true, onData });

		await gate.load();
		expect(get(gate)).toBe('ready');
		expect(fetch).not.toHaveBeenCalled();
		expect(onData).not.toHaveBeenCalled();

		await gate.refresh();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(onData).toHaveBeenCalledWith(data);
		expect(get(gate)).toBe('ready');

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

	it('不快取:未提供 skip 時連續兩次 load() 各自呼叫 fetch,onData 各自收到該次回應', async () => {
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
