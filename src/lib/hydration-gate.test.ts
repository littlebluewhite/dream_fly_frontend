import { describe, it, expect, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { createHydrationGate, resultOf, type HydrationGate } from './hydration-gate';
import { createLoadGate, type LoadPhase } from './load-gate';

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

/** 一筆已落地的非樂觀寫入(無尾流):推世代 + 翻旗。閘門已水合時不排和解,只動世代軸。 */
function landWrite(gate: HydrationGate): Promise<unknown> {
	return gate.write({ send: async () => undefined });
}

/** 一筆樂觀寫入、PATCH 尾流仍在飛:同一同步段內尾流入帳 + 推世代 + 翻旗。 */
function writeTail(gate: HydrationGate, tail: Promise<unknown>): Promise<unknown> {
	return gate.write({ optimistic: () => {}, send: () => tail });
}

describe('createHydrationGate', () => {
	it('競態(本 factory 存在的理由):hydrate() in-flight 期間 write() 落地 → 舊快照不套用、promise 正常 resolve', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const hydratePromise = gate.hydrate();
		expect(get(gate.hydrated)).toBe(false); // in-flight,尚未水合

		await landWrite(gate); // mutation 發生於 in-flight 期間 — 宣告本地資料即水合真相(未水合 → 排和解)
		expect(get(gate.hydrated)).toBe(true);

		d.resolve({ v: 1 });
		await hydratePromise; // re-check 應放棄套用,promise 正常 resolve(不 reject)
		await settleRetry();

		expect(apply).not.toHaveBeenCalledWith({ v: 1 }); // 出發早於寫入的舊快照被放棄
		expect(apply).toHaveBeenCalledWith({ v: 2 }); // 落地的是和解重抓那份
		expect(get(gate.hydrated)).toBe(true);
	});

	it('世代競態(帳本閉合輪):寫入後和解失敗把旗標翻回 false(可重試縫)——in-flight hydrate 仍須放棄套用,不得拿舊快照蓋掉 mutation', async () => {
		/* 單靠旗標當 mutation-wins 訊號的破洞:和解重抓失敗會把旗標翻回 false(留重試路徑),
		 * 等於拆掉 in-flight hydrate 的 mutation-wins——舊快照落地,直寫列蒸發。寫入因此推
		 * 單調世代:世代變了就放棄,不看旗標當下值。 */
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockRejectedValueOnce(new Error('offline'));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const hydratePromise = gate.hydrate(); // in-flight
		await landWrite(gate); // mutation 發生(未水合 → 排和解)
		await settleRetry(); // 和解失敗把旗標翻回 false(可重試)——不可因此拆掉 mutation-wins
		expect(get(gate.hydrated)).toBe(false);

		d.resolve({ v: 1 });
		await hydratePromise;

		expect(apply).not.toHaveBeenCalled(); // 舊快照仍被放棄(看世代,不看旗標)
		expect(get(gate.hydrated)).toBe(false); // 不 commit——可重試路徑保持開啟
	});

	it('guard:hydrated 已 true 時 hydrate() 不呼叫 fetch', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate(); // 翻旗 true
		fetch.mockClear();
		apply.mockClear();

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
		await gate.hydrate(); // 翻旗 true
		fetch.mockClear();
		apply.mockClear();

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
	 * 的 mutation」:進場捕捉世代、落地比對世代,**不看旗標當下值**——否則「await write()
	 * → refresh」這個正常序列(mobile-admin markOrderPaid → await refreshOps)
	 * 會被誤丟。與 hydrate 的不對稱是協定本體:hydrate 丟棄了事(本地即真相),refresh 是
	 * 顯式新鮮度、丟棄之後必須補抓。 */
	it('世代穩定重抓:refresh() in-flight 期間 write() 落地 → 舊快照丟棄並原地重抓,只套用重抓那份(fetch×2)', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate(); // 已水合:寫入不排和解,只看世代軸
		fetch.mockClear();
		apply.mockClear();

		const p = gate.refresh();
		await landWrite(gate); // refresh 進場「之後」的 mutation → 在飛快照作廢
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

	it('世代穩定重抓:重抓期間再度 write() 落地 → 續抓到世代穩定為止(fetch×3),套用最後一份', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const d3 = createDeferred<{ v: number }>();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce({ v: 0 })
			.mockReturnValueOnce(d1.promise)
			.mockReturnValueOnce(d2.promise)
			.mockReturnValueOnce(d3.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate();
		fetch.mockClear();
		apply.mockClear();

		const p = gate.refresh();
		await landWrite(gate);
		d1.resolve({ v: 1 });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2);

		await landWrite(gate); // 第一次重抓「進場之後」又一筆 mutation → 這份快照同樣作廢
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
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate();
		fetch.mockClear();
		apply.mockClear();

		const p = gate.refresh();
		await landWrite(gate);
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

	it('mutation 世代只有 write() 推進:refresh 在飛期間另一支 hydrate/refresh 落地 → 在飛那份照常套用、不補抓', async () => {
		/* 世代帳不再經讀取器外流(R15 F-1),改釘它的可觀察面:hydrate/refresh 若推進世代,在飛
		 * refresh 落地時會誤判「進場之後有 mutation」而丟棄重抓(fetch 會變成 4)。旗標翻回 false
		 * 不倒退世代,見上方「世代競態(帳本閉合輪)」釘。 */
		const d1 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockResolvedValue({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p = gate.refresh(); // 在飛
		await gate.hydrate(); // 水合不是 mutation
		await gate.refresh(); // 重抓也不是
		d1.resolve({ v: 1 });
		await p;

		expect(fetch).toHaveBeenCalledTimes(3); // 在飛那份世代穩定,不補抓
		expect(apply).toHaveBeenLastCalledWith({ v: 1 });
	});

	/* R11 第五決策點——mutation settle 訊號。第四決策點(世代穩定)只比對進出場世代,對
	 * 「樂觀 mutation 的網路尾流(PATCH)還沒 settle」是盲的:markRead 是 mark-before-await
	 * (write 的樂觀路徑先寫 store、宣告 mutation,才 await PATCH),refresh 的 GET 若在 PATCH 仍在飛時出發,
	 * server 回的是舊真值、而世代此刻已穩定 → 舊快照照套,已讀被打回未讀(ADR 0020 誠實
	 * 界線記載的 GET/PATCH server-race)。現在 refresh 族在出發前先等尾流全數 settle。
	 * 等待軸與丟棄軸正交:等待不看世代,丟棄仍只看進出場世代比對。以下各釘先水合,樂觀寫入
	 * 就不排和解,GET 次數只反映等待軸。 */
	it('mutation settle:樂觀寫入的尾流未 settle → refresh() 不出發 GET;尾流 settle 後恰出發一次', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate();
		fetch.mockClear();
		apply.mockClear();

		void writeTail(gate, tail.promise); // 樂觀 mutation:store 已寫、PATCH 仍在飛
		const p = gate.refresh();
		await settleRetry();

		expect(fetch).not.toHaveBeenCalled(); // 尾流未 settle,GET 一律不出發

		tail.resolve();
		await p;

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 1 });
	});

	it('mutation settle:尾流 reject 也算 settle → refresh() 照樣出發(閘門以 then(done, done) 記帳)', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		await gate.hydrate();
		fetch.mockClear();

		const writing = writeTail(gate, tail.promise);
		const p = gate.refresh();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		tail.reject(new Error('patch-boom'));
		await writing;
		await p;

		expect(fetch).toHaveBeenCalledTimes(1); // 失敗的 mutation 一樣是「不再在飛」,不得永久卡住 refresh
	});

	it('mutation settle:等待期間第二筆尾流入帳 → 醒來重查、續等到真正靜止才出發(fetch 恰一次)', async () => {
		const t1 = createDeferred<void>();
		const t2 = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		await gate.hydrate();
		fetch.mockClear();

		void writeTail(gate, t1.promise);
		// 第二筆刻意掛在 t1 settle 的當下入帳——正是「等待者剛被喚醒」那個窗口:醒來若不
		// 重查靜止與否,GET 會在 t2 仍在飛時出發,窗口原封不動地重開。
		t1.promise.then(() => writeTail(gate, t2.promise));

		const p = gate.refresh();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		t1.resolve();
		await settleRetry();

		expect(fetch).not.toHaveBeenCalled(); // t2 仍在飛,續等

		t2.resolve();
		await p;

		expect(fetch).toHaveBeenCalledTimes(1); // 全數 settle 後才出發,而且只出發一次
	});

	it('mutation settle:等待醒來與 GET 出發「之間」入帳的尾流 → 前導重問、仍不出發(pendingSettle 內部重查補不到這一段)', async () => {
		/* 上一條守的是 pendingSettle **內部**的醒後重查;這一條守的是它補不到的下一段:等待
		 * 的 promise 已經 resolve、fetchGenStable 卻還沒恢復執行,這中間的 microtask 若跑了一筆
		 * 樂觀寫入(尾流入帳),舊寫法(前導只 await 一次)會直接往下捕捉世代並出發 GET——尾流在飛,
		 * 而且世代是在那筆 mutation 「之後」才捕捉的,丟棄軸也接不住。前導必須是迴圈:醒來後
		 * 重問 pendingSettle(),不靜止就再等。 */
		const t1 = createDeferred<void>();
		const t3 = createDeferred<void>();
		// 探針:比受測 refresh 早一步排隊的另一支 refresh,兩者醒來的鏈同長、探針恆早一拍——
		// 它的 GET 出發點正落在上述窗口內,就在那一刻入帳 t3。
		let probeArmed = false;
		const fetch = vi.fn(async () => {
			if (probeArmed) {
				probeArmed = false;
				void writeTail(gate, t3.promise);
			}
			return { v: 1 };
		});
		const gate = createHydrationGate({ fetch, apply: () => {} });
		await gate.hydrate();
		fetch.mockClear();

		void writeTail(gate, t1.promise);
		probeArmed = true; // 下一發 GET(探針的)出發時入帳 t3
		const probe = gate.refresh();
		const p = gate.refresh();
		t1.resolve();
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(1); // 只有探針出發(t3 就在這一發裡入帳);受測 refresh 窗口關閉,不帶著在飛尾流出發

		t3.resolve();
		await Promise.all([probe, p]);

		expect(fetch).toHaveBeenCalledTimes(3); // t3 settle 後受測 refresh 才出發(探針那份因世代變而補抓一次)
	});

	it('mutation settle:refresh 在飛期間樂觀寫入(尾流) → 世代作廢的補抓輪同樣等 settle 才出發', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const tail = createDeferred<void>();
		const fetch = vi.fn().mockResolvedValueOnce({ v: 0 }).mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		await gate.hydrate();
		fetch.mockClear();
		apply.mockClear();

		const p = gate.refresh();
		expect(fetch).toHaveBeenCalledTimes(1); // 進場靜止 → 第一發照常同步出發

		void writeTail(gate, tail.promise); // 在飛 mutation:世代作廢 + 尾流入帳
		d1.resolve({ v: 1 });
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(1); // 補抓輪被 settle 訊號擋住,不搶在 PATCH 前面
		expect(apply).not.toHaveBeenCalled();

		tail.resolve();
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(2); // 尾流 settle 才補抓

		d2.resolve({ v: 2 });
		await p;

		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 2 });
	});

	it('mutation settle 守恆:非樂觀寫入不記尾流 → 落地後 refresh() 同步出發', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		await gate.hydrate();
		fetch.mockClear();

		await landWrite(gate); // mobile-admin markOrderPaid(先寫後改,PATCH 已落定才宣告)等:無網路尾流
		const p = gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1); // 尚未 await 就已出發

		await p;
	});

	it('硬契約(ADR-0021):尾流帳靜止時頁面 lg.refresh() 同步呼叫 fetch(不得多一個 microtask),有未 settle 尾流才等', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		const page = createLoadGate({ ...gate.pageEntry() });

		const r1 = page.refresh();
		expect(fetch).toHaveBeenCalledTimes(1); // 開機靜止:尚未 await 就已出發
		await r1; // 已水合:之後的寫入不排和解
		await landWrite(gate);
		const r2 = page.refresh();
		expect(fetch).toHaveBeenCalledTimes(2); // 非樂觀寫入不入帳,仍同步出發
		await r2;

		void writeTail(gate, tail.promise);
		const p = page.refresh();
		expect(fetch).toHaveBeenCalledTimes(2); // 尾流在飛:不出發

		tail.resolve();
		await p;
		expect(fetch).toHaveBeenCalledTimes(3);

		void page.refresh();
		expect(fetch).toHaveBeenCalledTimes(4); // settle 後回歸靜止,又是同步出發
		page.destroy();
	});
});

describe('hydrate 合併(R14 F2)', () => {
	/* F2:hydrate() 與頁面 load-gate 的 load 共用同一支在飛 GET——子頁 onMount 先於 layout,
	 * 暖機與頁面載入必然同時水合,不合併就打兩次 GET。只共用 GET,沒有世代迴圈(不是 ADR-0020
	 * 否決的形 3);refresh 族一律真抓、不併入。 */

	it('併發兩次 hydrate() 只 fetch 一次、apply 一次', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn(() => d.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p1 = gate.hydrate();
		const p2 = gate.hydrate();
		d.resolve({ v: 1 });
		await Promise.all([p1, p2]);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledTimes(1);
		expect(get(gate.hydrated)).toBe(true);
	});

	it('頁面 load-gate 的 load 與 hydrate()(暖機)併發 → 只 fetch 一次、apply 一次', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn(() => d.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		const page = createLoadGate({ ...gate.pageEntry() });

		const pPage = page.load();
		const pWarm = gate.hydrate();
		d.resolve({ v: 1 });
		await Promise.all([pPage, pWarm]);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledTimes(1);
		expect(get(page)).toBe('ready');
		page.destroy();
	});

	it('refresh 族不併入在飛的 hydrate:gate.refresh() 與頁面 load-gate 的 refresh 都真抓', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue({ v: 2 });
		const gate = createHydrationGate({ fetch, apply: () => {} });
		const page = createLoadGate({ ...gate.pageEntry() });

		const pHydrate = gate.hydrate(); // 在飛
		await gate.refresh();
		await page.refresh();
		expect(fetch).toHaveBeenCalledTimes(3);

		d.resolve({ v: 1 });
		await pHydrate;
		page.destroy();
	});

	it('在飛的 hydrate reject 之後,下一次 hydrate 重新 GET(合併的 promise settle 即清掉)', async () => {
		const fetch = vi.fn().mockRejectedValueOnce(new Error('網路失敗')).mockResolvedValueOnce({ v: 1 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		await expect(gate.hydrate()).rejects.toThrow('網路失敗');
		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(apply).toHaveBeenCalledWith({ v: 1 });
	});

	it('出發後有 mutation 的在飛 GET 不借給之後進場的 hydrate(旗標被和解失敗翻回 false 也一樣)——舊快照不得蓋掉 mutation', async () => {
		const dOld = createDeferred<{ v: number }>();
		const fetch = vi
			.fn()
			.mockReturnValueOnce(dOld.promise)
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const pOld = gate.hydrate(); // 世代 0 出發
		await landWrite(gate); // 世代 1;未水合 → 排和解
		await settleRetry(); // 和解失敗:旗標翻回 false
		expect(get(gate.hydrated)).toBe(false);
		const pNew = gate.hydrate(); // 世代 1 進場:不得併入世代 0 的那支

		dOld.resolve({ v: 1 });
		await Promise.all([pOld, pNew]);

		expect(fetch).toHaveBeenCalledTimes(3); // 水合 + 失敗的和解 + 新世代的水合
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 2 });
	});
});

describe('invalidate()(R14 F2)', () => {
	it('只翻旗 false:之後 hydrate 重新真抓', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		await gate.hydrate();

		gate.invalidate();
		expect(get(gate.hydrated)).toBe(false);
		await gate.hydrate();

		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('不碰世代帳與尾流帳', async () => {
		const tail = createDeferred<void>();
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		// 世代帳:在飛 refresh 期間 invalidate → 落地世代仍穩定,照常套用、不補抓
		const p1 = gate.refresh();
		gate.invalidate();
		d.resolve({ v: 1 });
		await p1;
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 1 });

		// 尾流帳:invalidate 不清帳,refresh 仍等尾流 settle 才出發
		const writing = writeTail(gate, tail.promise); // 已水合(上面那輪 refresh 翻的旗)
		gate.invalidate();
		const p2 = gate.refresh();
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(1); // 尾流仍在帳上

		tail.reject(new Error('patch')); // 以失敗 settle:寫入進場時已水合,失敗不排和解,GET 次數只看等待軸
		await Promise.all([writing, p2]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('不碰在飛合併:同世代 invalidate 之後進場的 hydrate 仍併入在飛那支', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn(() => d.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p1 = gate.hydrate();
		gate.invalidate();
		const p2 = gate.hydrate();
		d.resolve({ v: 1 });
		await Promise.all([p1, p2]);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledTimes(1);
	});
});

describe('pageEntry(plain gate)', () => {
	/* F1(R14):頁面進場包住在 HydrationGate 本身——ops 閘門是 plain gate(不是 session 閘門),
	 * mobile-admin 的 4 個 ops 頁原本拿 hydrate/refresh 當 load-gate 的 fetch/refresh:store 閘門
	 * 自己 apply,load-gate 的 generation/destroyed 守衛管不到寫入。改 spread pageEntry() 之後,
	 * load-gate 把棄追判準 isCurrent 交給閘門(R15 F-1),卸載與後發先至的回應都不寫。 */

	it('refresh 在飛時 destroy() → 回應落地不寫 store、不翻旗(已卸載的頁面不寫共享 store)', async () => {
		const d = createDeferred<{ v: number }>();
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch: () => d.promise, apply });
		const page = createLoadGate({ ...gate.pageEntry() });

		const p = page.refresh();
		page.destroy();
		d.resolve({ v: 1 });
		await p;

		expect(apply).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);
	});

	it('連續兩輪 refresh、先發的後到 → 舊快照不寫(只套用後發那一輪)', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });
		const page = createLoadGate({ ...gate.pageEntry() });

		const p1 = page.refresh();
		const p2 = page.refresh();
		d2.resolve({ v: 2 });
		await p2;
		d1.resolve({ v: 1 });
		await p1;

		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 2 });
		page.destroy();
	});

	it('spread 整合:真 createLoadGate({ ...gate.pageEntry() }) 走一輪 loading→ready,資料落回共享 store、翻的是閘門同一顆旗標', async () => {
		const store = writable<{ v: number } | null>(null);
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: (d) => store.set(d) });

		const page = createLoadGate({ ...gate.pageEntry() });
		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		await page.load();

		expect(phases[0]).toBe('loading');
		expect(phases[phases.length - 1]).toBe('ready');
		expect(get(store)).toEqual({ v: 1 }); // 閘門的 apply 寫回的是同一顆共享 store
		expect(get(gate.hydrated)).toBe(true); // 頁面這一輪的 commit 翻的正是閘門同一顆旗標

		unsub();
		page.destroy(); // 元件外建構無生命週期可掛(見 load-gate autoDestroyOnUnmount),呼叫端自行 destroy
	});
});

describe('reset()', () => {
	/* 閘門重置(R15):內容還原開機值(opts.reset)+ 旗標翻 false + 丟在飛合併 GET + 換尾流帳本並
	 * 喚醒全部等待者。重置之前出發的 GET 一律不寫(進場記 resetEpoch、落地比對)。session 閘門的
	 * identity 重置與各模組的測試出口 reset…ForTests 走的都是這一支。 */

	it('reset 後不借用舊的在飛 GET:之後進場的 hydrate 重新真抓', async () => {
		const dOld = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(dOld.promise).mockResolvedValueOnce({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const pOld = gate.hydrate(); // 在飛
		gate.reset();
		await gate.hydrate(); // 不得併入重置前那支

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(apply).toHaveBeenCalledWith({ v: 2 });

		dOld.resolve({ v: 1 });
		await pOld;
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('重置前出發的 GET 落地時不寫 store、不翻旗(hydrate 與 refresh 皆然)', async () => {
		const dHydrate = createDeferred<string>();
		const dRefresh = createDeferred<string>();
		const fetch = vi.fn().mockReturnValueOnce(dHydrate.promise).mockReturnValueOnce(dRefresh.promise);
		const store = writable('boot');
		const gate = createHydrationGate({ fetch, apply: (v: string) => store.set(v), reset: () => store.set('boot') });

		const pHydrate = gate.hydrate();
		const pRefresh = gate.refresh();
		store.set('dirty');
		gate.reset();
		expect(get(store)).toBe('boot'); // opts.reset 還原開機值

		dHydrate.resolve('old-h');
		dRefresh.resolve('old-r');
		await Promise.all([pHydrate, pRefresh]);

		expect(get(store)).toBe('boot');
		expect(get(gate.hydrated)).toBe(false);
	});

	it('reset 喚醒尾流等待者(舊 refresh 不再出發 GET);舊尾流之後 settle 也不再出帳', async () => {
		const oldTail = createDeferred<void>();
		const newTail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		void writeTail(gate, oldTail.promise);
		const pOld = gate.refresh(); // 等舊尾流
		gate.reset();
		await pOld; // 被喚醒即收束(永不 settle 的尾流也擋不住)
		expect(fetch).not.toHaveBeenCalled();
		expect(apply).not.toHaveBeenCalled();

		await gate.hydrate(); // 新擁有者先水合:之後的寫入不排和解,GET 次數只看等待軸
		fetch.mockClear();
		apply.mockClear();
		void writeTail(gate, newTail.promise); // 新帳本上的尾流
		oldTail.resolve(); // 舊尾流姍姍來遲——不得把新帳減掉
		await settleRetry();

		const p = gate.refresh();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled(); // 新尾流仍在帳上

		newTail.resolve();
		await p;
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ v: 1 });
	});

	it('reset() 期間訂閱者同步重入 hydrate() → 發新 GET、落地會寫', async () => {
		// bookkeeping(inflight/resetEpoch/pendingTails)必須先於 opts.reset()/翻旗——否則
		// opts.reset() 同步觸發的重入 hydrate() 會併到重置前那支還在飛的 GET。
		const dOld = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(dOld.promise).mockResolvedValueOnce({ v: 2 });
		const apply = vi.fn();
		let pReentrant: Promise<void> | undefined;
		const gate = createHydrationGate({
			fetch,
			apply,
			reset: () => {
				pReentrant = gate.hydrate(); // 模擬訂閱者在 reset() 期間同步重入
			}
		});

		const pOld = gate.hydrate(); // 在飛(重置前的舊 identity)
		gate.reset();
		await pReentrant;

		expect(fetch).toHaveBeenCalledTimes(2); // 重入沒有併入舊在飛 GET,發了一支新的
		expect(apply).toHaveBeenCalledWith({ v: 2 });

		dOld.resolve({ v: 1 });
		await pOld;
		expect(apply).toHaveBeenCalledTimes(1); // 重置前的舊 GET 落地仍不寫
	});

	it('hydrated 唯讀:不能從外部寫旗標', () => {
		const gate = createHydrationGate({ fetch: async () => 1, apply: () => {} });
		// @ts-expect-error hydrated 是 Readable,沒有 set
		expect(() => gate.hydrated.set(true)).toThrow(TypeError);
	});
});

describe('write()(R17:寫入動詞;markMutated/mutate 自 FE-8 退役,write 是唯一寫入動詞)', () => {
	/* write() 把「寫 store → 宣告水合真相 → 記尾流 → 失敗復原 → 未水合時和解」收進閘門:
	 *  - 樂觀路徑(有 optimistic):同一同步段 optimistic() → send() → 尾流入帳 → 世代 +1 翻旗;
	 *  - 非樂觀路徑:await send() 之後才 commit + 世代 +1 翻旗(無尾流可記);
	 *  - send 落地時 resetEpoch 已變 → stale,不碰 store;
	 *  - 失敗依 onFailure:keep / rollback(undo)/ resync(refresh,失敗退回 undo);
	 *  - 寫入前未水合(或寫回時已不完整)→ 排和解重抓(和解鏈自 R17 住在基礎閘門)。 */
	function makeGate(fetch: () => Promise<string[]>) {
		const store = writable<string[]>([]);
		const apply = vi.fn((list: string[]) => store.set(list));
		const gate = createHydrationGate({ fetch, apply, reset: () => store.set([]) });
		return { store, apply, gate };
	}

	it('非樂觀 written:send 落地後才 commit、翻旗;回傳 written{result};已水合時不和解', async () => {
		const fetch = vi.fn(async () => ['server']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const d = createDeferred<string>();
		const commit = vi.fn((r: string) => store.update((l) => [r, ...l]));

		const p = gate.write({ send: () => d.promise, commit });
		expect(commit).not.toHaveBeenCalled(); // 非樂觀:await 之前不寫
		d.resolve('new');

		expect(await p).toEqual({ kind: 'written', result: 'new' });
		expect(get(store)).toEqual(['new', 'server']);
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(1); // 已水合:不排和解
	});

	it('非樂觀失敗:不寫 store、不翻旗、不推世代(在飛 hydrate 照常套用)', async () => {
		const dGet = createDeferred<string[]>();
		const { store, gate } = makeGate(() => dGet.promise);
		const err = new Error('409');
		const commit = vi.fn();

		const hydrating = gate.hydrate();
		const o = await gate.write({ send: () => Promise.reject(err), commit });
		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'kept' });
		expect(commit).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);

		dGet.resolve(['server']);
		await hydrating;
		expect(get(store)).toEqual(['server']); // 世代未動:水合不被誤判 mutation 勝出
	});

	it('stale:send 在飛期間 reset → 不 commit、不碰 store;結果仍交付(settled)', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		await gate.hydrate();
		const d = createDeferred<string>();
		const commit = vi.fn();

		const p = gate.write({ send: () => d.promise, commit });
		gate.reset();
		store.set(['canary']); // 新擁有者的資料
		d.resolve('new');

		expect(await p).toEqual({ kind: 'stale', settled: { status: 'fulfilled', value: 'new' } });
		expect(commit).not.toHaveBeenCalled();
		expect(get(store)).toEqual(['canary']);
		expect(get(gate.hydrated)).toBe(false);
	});

	it('stale(樂觀):尾流在飛期間 reset、之後失敗 → 不 undo、不 resync', async () => {
		const fetch = vi.fn(async () => ['server']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const d = createDeferred<void>();
		const undo = vi.fn();
		const err = new Error('network');

		const p = gate.write({ optimistic: () => undo, send: () => d.promise, onFailure: 'resync' });
		gate.reset();
		d.reject(err);

		expect(await p).toEqual({ kind: 'stale', settled: { status: 'rejected', reason: err } });
		expect(undo).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(1); // 只有最初的水合
		expect(get(store)).toEqual([]);
	});

	it('樂觀:optimistic 與 send 同步發生,翻旗也同步(await 之前)', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		const d = createDeferred<void>();
		const send = vi.fn(() => d.promise);

		const p = gate.write({ optimistic: () => store.set(['local']), send });
		expect(get(store)).toEqual(['local']);
		expect(send).toHaveBeenCalledTimes(1);
		expect(get(gate.hydrated)).toBe(true);
		d.resolve();
		await p;
	});

	it('樂觀失敗 keep:不 undo,recovery kept', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		await gate.hydrate();
		const undo = vi.fn();
		const err = new Error('network');

		const o = await gate.write({
			optimistic: () => {
				store.set(['local']);
				return undo;
			},
			send: () => Promise.reject(err),
			onFailure: 'keep'
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'kept' });
		expect(undo).not.toHaveBeenCalled();
		expect(get(store)).toEqual(['local']);
	});

	it('樂觀失敗 rollback:呼叫 undo,recovery rolledBack', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		await gate.hydrate();
		const err = new Error('network');

		const o = await gate.write({
			optimistic: () => {
				store.set(['local']);
				return () => store.set(['server']);
			},
			send: () => Promise.reject(err),
			onFailure: 'rollback'
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'rolledBack' });
		expect(get(store)).toEqual(['server']);
	});

	it('樂觀失敗 resync:整包重抓伺服器真值、不 undo,recovery resynced', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(['server']).mockResolvedValueOnce(['truth']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const undo = vi.fn();
		const err = new Error('network');

		const o = await gate.write({
			optimistic: () => {
				store.set(['local']);
				return undo;
			},
			send: () => Promise.reject(err),
			onFailure: 'resync'
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'resynced' });
		expect(fetch).toHaveBeenCalledTimes(2); // 自己的尾流已出帳:resync 不等自己
		expect(get(store)).toEqual(['truth']);
		expect(undo).not.toHaveBeenCalled();
	});

	it('樂觀失敗 resync 也失敗:退回 undo,recovery rolledBack', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(['server']).mockRejectedValueOnce(new Error('offline'));
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const err = new Error('network');

		const o = await gate.write({
			optimistic: () => {
				store.set(['local']);
				return () => store.set(['server']);
			},
			send: () => Promise.reject(err),
			onFailure: 'resync'
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'rolledBack' });
		expect(get(store)).toEqual(['server']);
	});

	it('樂觀成功:commit 收到伺服器回覆', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		await gate.hydrate();

		const o = await gate.write({
			optimistic: () => store.set(['local']),
			send: async () => 'ack',
			commit: (r) => store.update((l) => [...l, r])
		});

		expect(o).toEqual({ kind: 'written', result: 'ack' });
		expect(get(store)).toEqual(['local', 'ack']);
	});

	it('ADR-0021:樂觀寫入的 PATCH 在飛 → refresh() 不出發 GET,等尾流 settle 才恰出發一次', async () => {
		const fetch = vi.fn(async () => ['server']);
		const { gate } = makeGate(fetch);
		await gate.hydrate();
		fetch.mockClear();
		const patch = createDeferred<void>();

		const writing = gate.write({ optimistic: () => {}, send: () => patch.promise });
		const refreshing = gate.refresh();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled(); // PATCH 在飛:GET 不得搶先

		patch.resolve();
		await Promise.all([writing, refreshing]);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('記帳順序:樂觀寫入翻旗的同步通知裡重入 refresh() → GET 不得出發(尾流先入帳,才推世代/翻旗)', async () => {
		const fetch = vi.fn(async () => ['server']);
		const { gate } = makeGate(fetch);
		const patch = createDeferred<void>();
		let reentrant: Promise<void> | undefined;
		const unsub = gate.hydrated.subscribe((h) => {
			if (h && !reentrant) reentrant = gate.refresh();
		});

		const writing = gate.write({ optimistic: () => {}, send: () => patch.promise });
		expect(reentrant).toBeDefined();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		patch.resolve();
		await writing;
		await reentrant;
		unsub();
		expect(fetch).toHaveBeenCalled();
	});

	it('ADR-0020 反例(非樂觀):await write() → await refresh() 恰一次 GET,快照照常套用', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(['server']).mockResolvedValueOnce(['after']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();

		await gate.write({ send: async () => 'new', commit: (r) => store.update((l) => [r, ...l]) });
		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(2); // 水合 1 + refresh 1:寫入在 refresh 進場之前,不補抓
		expect(get(store)).toEqual(['after']);
	});

	it('ADR-0020 反例(樂觀):await write() → await refresh() 恰一次 GET', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(['server']).mockResolvedValueOnce(['after']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();

		await gate.write({ optimistic: () => store.set(['local']), send: async () => undefined });
		await gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(get(store)).toEqual(['after']);
	});

	it('未水合的樂觀寫入同樣排和解(等尾流 settle 才出發)', async () => {
		const fetch = vi.fn(async () => ['a', 'b']);
		const { store, gate } = makeGate(fetch);
		const patch = createDeferred<void>();

		const writing = gate.write({ optimistic: () => store.set(['a']), send: () => patch.promise });
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();
		patch.resolve();
		await writing;
		await settleRetry();

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(get(store)).toEqual(['a', 'b']);
	});

	it('markMutated 已退役:閘門對外只剩 write() 一個寫入動詞', () => {
		const { gate } = makeGate(async () => []);
		expect('markMutated' in gate).toBe(false);
	});

	it('resync 在飛期間 reset → stale(不回報 resynced、不 undo,重抓快照不寫)', async () => {
		const resyncGet = createDeferred<string[]>();
		const fetch = vi.fn().mockResolvedValueOnce(['server']).mockReturnValueOnce(resyncGet.promise);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const undo = vi.fn();
		const err = new Error('network');

		const p = gate.write({ optimistic: () => undo, send: () => Promise.reject(err), onFailure: 'resync' });
		await settleRetry();
		expect(fetch).toHaveBeenCalledTimes(2); // PATCH 失敗 → resync 的 GET 已出發
		gate.reset();
		resyncGet.resolve(['old-owner']);

		expect(await p).toEqual({ kind: 'stale', settled: { status: 'rejected', reason: err } });
		expect(undo).not.toHaveBeenCalled();
		expect(get(store)).toEqual([]); // 新擁有者的開機值
	});

	it('send 同步拋出(非樂觀)→ failed,不寫 store、不翻旗', async () => {
		const { gate } = makeGate(async () => ['server']);
		const err = new Error('sync');
		const commit = vi.fn();

		const o = await gate.write({
			send: () => {
				throw err;
			},
			commit
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'kept' });
		expect(commit).not.toHaveBeenCalled();
		expect(get(gate.hydrated)).toBe(false);
	});

	it('send 同步拋出(樂觀 + rollback)→ failed,undo 照策略執行,尾流已出帳不卡 refresh', async () => {
		const fetch = vi.fn(async () => ['server']);
		const { store, gate } = makeGate(fetch);
		await gate.hydrate();
		const err = new Error('sync');

		const o = await gate.write({
			optimistic: () => {
				store.set(['local']);
				return () => store.set(['server']);
			},
			send: () => {
				throw err;
			},
			onFailure: 'rollback'
		});

		expect(o).toEqual({ kind: 'failed', error: err, recovery: 'rolledBack' });
		expect(get(store)).toEqual(['server']);
		await gate.refresh();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('rollback 但沒有 undo → recovery kept(什麼都沒做,不謊報 rolledBack)', async () => {
		const { store, gate } = makeGate(async () => ['server']);
		await gate.hydrate();
		const err = new Error('409');

		const nonOptimistic = await gate.write({ send: () => Promise.reject(err), onFailure: 'rollback' });
		const voidUndo = await gate.write({
			optimistic: () => store.set(['local']),
			send: () => Promise.reject(err),
			onFailure: 'rollback'
		});

		expect(nonOptimistic).toEqual({ kind: 'failed', error: err, recovery: 'kept' });
		expect(voidUndo).toEqual({ kind: 'failed', error: err, recovery: 'kept' });
	});

	it('resultOf:written → result;failed → 拋出 error;stale → 交付 settled(成功給值、失敗拋出)', () => {
		const err = new Error('x');
		expect(resultOf({ kind: 'written', result: 1 })).toBe(1);
		expect(() => resultOf({ kind: 'failed', error: err, recovery: 'kept' })).toThrow(err);
		expect(resultOf({ kind: 'stale', settled: { status: 'fulfilled', value: 2 } })).toBe(2);
		expect(() => resultOf({ kind: 'stale', settled: { status: 'rejected', reason: err } })).toThrow(err);
	});

	describe('和解家族(序列化 + 可重試 + 幽靈取消;R17 自 session-gate.test.ts 搬來,擁有者換人改用 reset())', () => {
		const prepend = (store: { update: (fn: (l: string[]) => string[]) => void }) => (r: string) =>
			store.update((l) => [r, ...l]);

		it('F2:未水合 write → 和解重抓收斂為完整清單,旗標 true,之後 hydrate 被 guarded() 短路', async () => {
			const fetch = vi.fn(async () => ['new', 'old']);
			const { store, gate } = makeGate(fetch);

			await gate.write({ send: async () => 'new', commit: prepend(store) });
			expect(get(store)).toEqual(['new']); // 只有直寫那筆
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(1); // 和解重抓真的發生
			expect(get(store)).toEqual(['new', 'old']);
			expect(get(gate.hydrated)).toBe(true);

			await gate.hydrate(); // 水合真相已成立——guarded() 短路
			expect(fetch).toHaveBeenCalledTimes(1);
		});

		it('P2′ 序列化非空證:兩支未水合寫入併發 → 前和解未 settle 後和解不起跑,晚(完整)快照最後套用', async () => {
			const r1 = createDeferred<string[]>();
			// 首快照掛起且漏 b(server 端 race),次快照完整。
			const fetch = vi.fn().mockReturnValueOnce(r1.promise).mockResolvedValueOnce(['b', 'a']);
			const { store, gate } = makeGate(fetch);

			const p1 = gate.write({ send: async () => 'a', commit: prepend(store) });
			const p2 = gate.write({ send: async () => 'b', commit: prepend(store) }); // 兩支都在旗標 false 時進場
			await Promise.all([p1, p2]);
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(1); // 序列化:首和解仍在飛,次和解不得起跑
			r1.resolve(['a']); // 舊快照(漏 b)先套用
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(2); // 首和解 settle 後,次和解才起跑(兩支各自和解)
			expect(get(store)).toEqual(['b', 'a']); // 完整快照最後套用——b 存活,不被首快照倒序覆寫
			expect(get(gate.hydrated)).toBe(true);
		});

		it('R10 和解窗口閉合:R1 在飛期間 M2 完成(不排 R2)→ R1 的舊快照丟棄並原地重抓,M2 的直寫不被蓋掉', async () => {
			/* 和解快照 vs 後續寫入的殘窗:M1 未水合 → 排 R1;R1 掛起期間 M2 進場時旗標已是 true、
			 * 寫回時仍完整,故**不排** R2——R1 的舊快照(server 尚未看見 b)若無條件套用,b 蒸發。
			 * R1 走 refreshRun 的世代穩定重抓:進場世代早於 M2 的世代 +1,落地比對不符 → 丟棄並原地重抓。 */
			const r1 = createDeferred<string[]>();
			const fetch = vi.fn().mockReturnValueOnce(r1.promise).mockResolvedValueOnce(['b', 'a']);
			const { store, gate } = makeGate(fetch);

			await gate.write({ send: async () => 'a', commit: prepend(store) }); // M1 未水合 → 排 R1
			await settleRetry();
			expect(fetch).toHaveBeenCalledTimes(1); // R1 的 GET 出發(掛起)

			await gate.write({ send: async () => 'b', commit: prepend(store) }); // M2:進場已水合且寫回時仍完整 → 不排 R2
			expect(get(store)).toEqual(['b', 'a']);
			expect(fetch).toHaveBeenCalledTimes(1); // 確認真的沒有第二支和解——閉合只能靠 R1 自己的世代比對

			r1.resolve(['a']); // R1 的舊快照(server 尚未看見 b)此刻才落地
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(2); // 世代已變 → 舊快照丟棄、原地重抓
			expect(get(store)).toEqual(['b', 'a']); // b 沒有被舊快照蓋掉
			expect(get(gate.hydrated)).toBe(true);
		});

		it('可重試翻旗:和解重抓失敗 → 旗標翻回 false 留重試路徑,下一次 hydrate 重新真抓完整清單', async () => {
			const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(['new', 'old']);
			const { store, gate } = makeGate(fetch);

			await gate.write({ send: async () => 'new', commit: prepend(store) });
			await settleRetry();

			expect(get(gate.hydrated)).toBe(false); // 失敗不佯裝完整——可重試

			await gate.hydrate(); // 重試
			expect(get(store)).toEqual(['new', 'old']);
			expect(get(gate.hydrated)).toBe(true);
		});

		it('stillIncomplete 重排:和解失敗翻回 false 後,進場自以為已水合的寫入寫回時重查旗標 → 重排和解', async () => {
			const r1 = createDeferred<string[]>();
			const post2 = createDeferred<string>();
			const fetch = vi.fn().mockReturnValueOnce(r1.promise).mockResolvedValueOnce(['b', 'a']);
			const { store, gate } = makeGate(fetch);

			await gate.write({ send: async () => 'a', commit: prepend(store) }); // M1 未水合 → 排 R1
			await settleRetry(); // R1 的 GET 出發(掛起)
			const p2 = gate.write({ send: () => post2.promise, commit: prepend(store) }); // M2 進場:旗標 true
			r1.reject(new Error('offline')); // R1 失敗 → 旗標翻回 false
			await settleRetry();
			expect(get(gate.hydrated)).toBe(false);

			post2.resolve('b'); // M2 寫回:發現旗標已 false → 必須再排 R2
			await p2;
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(2); // R2 真的排了(只看進場快照的舊法不會排)
			expect(get(store)).toEqual(['b', 'a']); // R2 的完整快照落地
			expect(get(gate.hydrated)).toBe(true); // 完整之後才重新標完整
		});

		it('幽靈和解:reset 時「已排隊、尚未起跑」的和解不得在新擁有者身上起跑', async () => {
			const post1 = createDeferred<string>();
			const post2 = createDeferred<string>();
			const r1 = createDeferred<string[]>();
			const fetch = vi.fn().mockReturnValueOnce(r1.promise).mockResolvedValue(['b', 'a']);
			const { store, gate } = makeGate(fetch);

			const p1 = gate.write({ send: () => post1.promise, commit: prepend(store) });
			const p2 = gate.write({ send: () => post2.promise, commit: prepend(store) }); // R1 起跑(掛起)、R2 排隊
			post1.resolve('a');
			post2.resolve('b');
			await Promise.all([p1, p2]);
			await settleRetry();
			expect(fetch).toHaveBeenCalledTimes(1); // R1 在飛,R2 尚未起跑

			gate.reset(); // 擁有者換人
			r1.resolve(['a']); // R1 的舊擁有者回應此刻才到
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(1); // R2 沒有在新擁有者身上起跑——幽靈和解不存在
			expect(get(store)).toEqual([]); // 舊擁有者的套用全數作廢
			expect(get(gate.hydrated)).toBe(false);
		});

		it('卡鏈重置:舊擁有者的和解 GET 永不 settle → reset 後新擁有者的未水合寫入照樣起跑和解', async () => {
			/* 釘的是 reset() 裡的 reconcileChain = Promise.resolve():舊鏈卡在永不 settle 的 R1 上,
			 * 新擁有者的和解若排在同一條鏈,一次都不會起跑。 */
			const fetch = vi
				.fn()
				.mockReturnValueOnce(new Promise<string[]>(() => {})) // R1 永不 settle
				.mockResolvedValueOnce(['b', 'b-old']);
			const { store, gate } = makeGate(fetch);

			await gate.write({ send: async () => 'a', commit: prepend(store) }); // 舊擁有者:R1 起跑 → 永掛
			await settleRetry();
			expect(fetch).toHaveBeenCalledTimes(1);

			gate.reset();
			await gate.write({ send: async () => 'b', commit: prepend(store) }); // 新擁有者的未水合寫入 → 排和解
			await settleRetry();

			expect(fetch).toHaveBeenCalledTimes(2); // 新擁有者的和解沒有堵在舊擁有者的殭屍後面
			expect(get(store)).toEqual(['b', 'b-old']);
			expect(get(gate.hydrated)).toBe(true);
		});
	});
});
