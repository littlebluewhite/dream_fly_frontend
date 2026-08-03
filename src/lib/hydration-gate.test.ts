import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { createHydrationGate } from './hydration-gate';

/** 手動控時序的 deferred promise——測 in-flight 競態不用 fake timers（抄
 *  load-gate.test.ts 開頭寫法）。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** 讓「原地重抓」跑完一圈(舊快照落地 → 世代比對 → 再發一次 fetch)。跳一個 macrotask
 *  保證期間的 microtask 全數收束（同 session-gate.test.ts 的 settleReconcile 手法）。 */
function settleRetry() {
	return new Promise<void>((r) => setTimeout(r, 0));
}

describe('createHydrationGate', () => {
	it('競態(本 factory 存在的理由):hydrate() in-flight 期間 markMutated() → fetch resolve 後 apply 不被呼叫、promise 正常 resolve', async () => {
		const d = createDeferred<{ v: number }>();
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch: () => d.promise, apply });

		const hydratePromise = gate.hydrate();
		expect(get(gate.hydrated)).toBe(false); // in-flight,尚未水合

		gate.markMutated(); // mutation 發生於 in-flight 期間 — 宣告本地資料即水合真相
		expect(get(gate.hydrated)).toBe(true);

		d.resolve({ v: 1 });
		await hydratePromise; // re-check 應放棄套用,promise 正常 resolve(不 reject)

		expect(apply).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(true); // mutation 的旗子保留,沒被覆寫或重置
	});

	it('世代競態(帳本閉合輪):markMutated 後旗標被外部翻回 false(和解失敗可重試縫)——in-flight hydrate 仍須放棄套用,不得拿舊快照蓋掉 mutation', async () => {
		/* 單靠旗標當 mutation-wins 訊號的破洞:waitlist/leave 的和解重抓失敗會把旗標翻回
		 * false(留重試路徑),等於拆掉 in-flight hydrate 的 mutation-wins——舊快照落地,
		 * 直寫列蒸發。markMutated 因此帶單調世代:世代變了就放棄,不看旗標當下值。 */
		const d = createDeferred<{ v: number }>();
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch: () => d.promise, apply });

		const hydratePromise = gate.hydrate(); // in-flight
		gate.markMutated(); // mutation 發生
		gate.hydrated.set(false); // 和解失敗把旗標翻回 false(可重試)——不可因此拆掉 mutation-wins

		d.resolve({ v: 1 });
		await hydratePromise;

		expect(apply).not.toHaveBeenCalled(); // 舊快照仍被放棄(看世代,不看旗標)
		expect(get(gate.hydrated)).toBe(false); // 不 commit——可重試路徑保持開啟
	});

	it('guard:hydrated 已 true 時 hydrate() 不呼叫 fetch', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		gate.hydrated.set(true);

		await gate.hydrate();

		expect(fetch).not.toHaveBeenCalled();
		expect(apply).not.toHaveBeenCalled();
	});

	it('guard:hydrated 為 false 時正常走 fetch → apply → hydrated=true', async () => {
		const data = { v: 1 };
		const fetch = vi.fn(async () => data);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith(data);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('refresh() 略過 guard:hydrated 已 true 仍真的呼叫 fetch 並 apply(無在飛 mutation → 世代穩定,fetch 恰一次)', async () => {
		const data = { v: 2 };
		const fetch = vi.fn(async () => data);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		gate.hydrated.set(true);

		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith(data);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('refresh() 的 fetch rejection 原樣拋出,apply 不被呼叫', async () => {
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await expect(gate.refresh()).rejects.toThrow('boom');

		expect(apply).not.toHaveBeenCalled();
	});

	/* R10 第四決策點——世代穩定重抓(fetchGenStable)。判準是「refresh **進場之後**才發生
	 * 的 mutation」:進場捕捉世代、落地比對世代,**不看旗標當下值**——否則「寫入 →
	 * markMutated → refresh」這個正常序列(mobile-admin markOrderPaid → await refreshOps)
	 * 會被誤丟。與 hydrate 的不對稱是協定本體:hydrate 丟棄了事(本地即真相),refresh 是
	 * 顯式新鮮度、丟棄之後必須補抓。 */
	it('世代穩定重抓:refresh() in-flight 期間 markMutated() → 舊快照丟棄並原地重抓,只套用重抓那份(fetch×2)', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p = gate.refresh();
		gate.markMutated(); // refresh 進場「之後」的 mutation → 在飛快照作廢
		d1.resolve({ v: 1 });
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(2); // 丟棄之後補抓,不是丟棄了事
		expect(apply).not.toHaveBeenCalled(); // 舊快照不落地,不蓋掉剛剛的本地 mutation

		d2.resolve({ v: 2 });
		await p;

		expect(fetch).toHaveBeenCalledTimes(2); // 世代已穩定,不再續抓
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 2 });
	});

	it('世代穩定重抓:重抓期間再度 markMutated() → 續抓到世代穩定為止(fetch×3),套用最後一份', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const d3 = createDeferred<{ v: number }>();
		const fetch = vi
			.fn()
			.mockReturnValueOnce(d1.promise)
			.mockReturnValueOnce(d2.promise)
			.mockReturnValueOnce(d3.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p = gate.refresh();
		gate.markMutated();
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2);

		gate.markMutated(); // 第一次重抓「進場之後」又一筆 mutation → 這份快照同樣作廢
		d2.resolve({ v: 2 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(apply).not.toHaveBeenCalled();

		d3.resolve({ v: 3 });
		await p;

		expect(fetch).toHaveBeenCalledTimes(3);
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 3 });
	});

	it('世代穩定重抓:第 N 次重抓的 rejection 原樣拋出(不吞、不回頭套用被丟棄的舊快照)', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p = gate.refresh();
		gate.markMutated();
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2);

		d2.reject(new Error('retry-boom'));

		await expect(p).rejects.toThrow('retry-boom'); // 重抓失敗照樣傳給呼叫端(load-gate 收 error 態)
		expect(apply).not.toHaveBeenCalled(); // 被丟棄的 {v:1} 不會在失敗時回頭補套
		expect(fetch).toHaveBeenCalledTimes(2); // 失敗即止,不繼續無限重抓
	});

	it('hydrate() 的 fetch rejection 原樣拋出,apply 不被呼叫、hydrated 維持 false', async () => {
		const err = new Error('boom');
		const fetch = vi.fn(async () => {
			throw err;
		});
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await expect(gate.hydrate()).rejects.toThrow('boom');

		expect(apply).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);
	});

	it('mutationGen():唯讀單調世代——只有 markMutated 推進,hydrate/refresh 不動它,旗標翻回 false 也不倒退', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });

		expect(gate.mutationGen()).toBe(0);
		await gate.hydrate();
		expect(gate.mutationGen()).toBe(0); // 水合不是 mutation
		await gate.refresh();
		expect(gate.mutationGen()).toBe(0); // 重抓也不是

		gate.markMutated();
		expect(gate.mutationGen()).toBe(1);
		gate.hydrated.set(false); // 和解失敗的可重試縫:旗標可翻回,世代只增不減
		expect(gate.mutationGen()).toBe(1);
		gate.markMutated();
		expect(gate.mutationGen()).toBe(2);
	});

	it('markMutated() 把 hydrated 翻 true;hydrated.set(false) 後可再次水合(測試重置縫)', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		gate.markMutated();
		expect(get(gate.hydrated)).toBe(true);

		gate.hydrated.set(false);
		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 1 });
		expect(get(gate.hydrated)).toBe(true);
	});
});
