import { describe, it, expect, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { createHydrationGate } from './hydration-gate';
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
		gate.invalidate(); // 和解失敗把旗標翻回 false(可重試)——不可因此拆掉 mutation-wins

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

	it('mutation 世代(經 pageEntry().hydrate.gen 讀):唯讀單調——只有 markMutated 推進,hydrate/refresh 不動它,旗標翻回 false 也不倒退', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });
		const gen = gate.pageEntry().hydrate.gen;

		expect(gen()).toBe(0);
		await gate.hydrate();
		expect(gen()).toBe(0); // 水合不是 mutation
		await gate.refresh();
		expect(gen()).toBe(0); // 重抓也不是

		gate.markMutated();
		expect(gen()).toBe(1);
		gate.hydrated.set(false); // 和解失敗的可重試縫:旗標可翻回,世代只增不減
		expect(gen()).toBe(1);
		gate.markMutated();
		expect(gen()).toBe(2);
	});

	/* R11 第五決策點——mutation settle 訊號。第四決策點(世代穩定)只比對進出場世代,對
	 * 「樂觀 mutation 的網路尾流(PATCH)還沒 settle」是盲的:markRead 是 mark-before-await
	 * (先寫 store、markMutated,才 await PATCH),refresh 的 GET 若在 PATCH 仍在飛時出發,
	 * server 回的是舊真值、而世代此刻已穩定 → 舊快照照套,已讀被打回未讀(ADR 0020 誠實
	 * 界線記載的 GET/PATCH server-race)。現在 refresh 族在出發前先等尾流全數 settle。
	 * 等待軸與丟棄軸正交:等待不看世代,丟棄仍只看進出場世代比對。 */
	it('mutation settle:markMutated(尾流) 未 settle → refresh() 不出發 GET;尾流 settle 後恰出發一次', async () => {
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		gate.markMutated(tail.promise); // 樂觀 mutation:store 已寫、PATCH 仍在飛
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

		gate.markMutated(tail.promise);
		// 呼叫端自己的 catch(生產上是 markRead 的 try/await);閘門的出帳不靠它,見下方斷言。
		const caughtByCaller = tail.promise.catch(() => {});
		const p = gate.refresh();
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		tail.reject(new Error('patch-boom'));
		await caughtByCaller;
		await p;

		expect(fetch).toHaveBeenCalledTimes(1); // 失敗的 mutation 一樣是「不再在飛」,不得永久卡住 refresh
	});

	it('mutation settle:等待期間第二筆尾流入帳 → 醒來重查、續等到真正靜止才出發(fetch 恰一次)', async () => {
		const t1 = createDeferred<void>();
		const t2 = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });

		gate.markMutated(t1.promise);
		// 第二筆刻意掛在 t1 settle 的當下入帳——正是「等待者剛被喚醒」那個窗口:醒來若不
		// 重查靜止與否,GET 會在 t2 仍在飛時出發,窗口原封不動地重開。
		t1.promise.then(() => gate.markMutated(t2.promise));

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
		 * markMutated(tail),舊寫法(前導只 await 一次)會直接往下捕捉世代並出發 GET——尾流在飛,
		 * 而且世代是在那筆 mutation 「之後」才捕捉的,丟棄軸也接不住。前導必須是迴圈:醒來後
		 * 重問 pendingSettle(),不靜止就再等。 */
		const t1 = createDeferred<void>();
		const t3 = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });

		gate.markMutated(t1.promise);
		// 探針:比 refresh 早一步入列的同批等待者,它的 resolve 鏈因此恆比 refresh 的早一拍
		// ——回呼執行的時點正落在上述窗口內。
		const probe = gate.pageEntry().hydrate.pendingSettle();
		let fetchesWhenT3Landed = -1;
		void probe?.then(() => {
			fetchesWhenT3Landed = fetch.mock.calls.length;
			gate.markMutated(t3.promise);
		});

		const p = gate.refresh();
		t1.resolve();
		await settleRetry();

		expect(fetchesWhenT3Landed).toBe(0); // 釘住這條真的打在窗裡(t3 早於 GET 入帳,不是事後才到)
		expect(fetch).not.toHaveBeenCalled(); // 窗口關閉:GET 不得帶著在飛尾流出發

		t3.resolve();
		await p;

		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('mutation settle:refresh 在飛期間 markMutated(尾流) → 世代作廢的補抓輪同樣等 settle 才出發', async () => {
		const d1 = createDeferred<{ v: number }>();
		const d2 = createDeferred<{ v: number }>();
		const tail = createDeferred<void>();
		const fetch = vi.fn().mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const p = gate.refresh();
		expect(fetch).toHaveBeenCalledTimes(1); // 進場靜止 → 第一發照常同步出發

		gate.markMutated(tail.promise); // 在飛 mutation:世代作廢 + 尾流入帳
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

	it('記帳順序:markMutated(尾流) 翻旗的同步通知裡重入 refresh() → GET 不得出發(尾流必須先入帳,再推世代/翻旗)', async () => {
		/* 半發布狀態:core.commit() 的 hydrated.set(true) 在旗標原為 false 時走 false→true 這道邊沿,
		 * 會**同步**通知 subscriber(svelte writable 只對 primitive 相同值短路,true→true 才不通知),
		 * subscriber 若在那個回呼裡同步重入 refresh(),而尾流是在
		 * commit **之後**才入帳,此刻 pendingSettle() 仍回 undefined —— GET 帶著已遞增的世代
		 * 同步出發,settle 後世代比對相符、server 舊真值照樣落地,丟棄軸也接不住(世代已穩)。
		 * 記帳全程同步,移到 commit 之前不會替靜止路徑多花任何一個 microtask。 */
		const tail = createDeferred<void>();
		const fetch = vi.fn(async () => ({ v: 1 }));
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		let refreshP: Promise<void> | undefined;
		// 訂閱當下的立即回呼帶 false(跳過);翻旗那一次才重入,且只重入一次。
		const unsub = gate.hydrated.subscribe((flag) => {
			if (flag && !refreshP) refreshP = gate.refresh();
		});

		gate.markMutated(tail.promise);

		expect(refreshP).toBeInstanceOf(Promise); // 釘住重入真的發生在翻旗的同步通知裡
		expect(fetch).not.toHaveBeenCalled(); // 尾流在飛 → 等待軸接住,GET 不得同步出發
		await settleRetry();
		expect(fetch).not.toHaveBeenCalled();

		tail.resolve();
		await refreshP;

		expect(fetch).toHaveBeenCalledTimes(1); // settle 後恰一次
		expect(apply).toHaveBeenCalledWith({ v: 1 });
		unsub();
	});

	it('mutation settle 守恆:markMutated() 不帶尾流 → refresh() 同步出發(無尾流的 mutation 行為一字不變)', async () => {
		const fetch = vi.fn(async () => ({ v: 1 }));
		const gate = createHydrationGate({ fetch, apply: () => {} });

		gate.markMutated(); // mobile-admin markOrderPaid(先寫後改,PATCH 已落定才 mark)等:無網路尾流
		const p = gate.refresh();

		expect(fetch).toHaveBeenCalledTimes(1); // 尚未 await 就已出發

		await p;
	});

	it('pendingSettle(經 pageEntry().hydrate.pendingSettle 讀):靜止時同步回 undefined(不得回 resolved promise——多一個 microtask 會鬆掉在飛判準),有未 settle 尾流才回 promise', async () => {
		const tail = createDeferred<void>();
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: () => {} });
		const pendingSettle = gate.pageEntry().hydrate.pendingSettle;

		expect(pendingSettle()).toBeUndefined(); // 開機靜止
		gate.markMutated();
		expect(pendingSettle()).toBeUndefined(); // 無尾流的 mutation 不入帳

		gate.markMutated(tail.promise);
		const wait = pendingSettle();
		expect(wait).toBeInstanceOf(Promise);

		tail.resolve();
		await wait;

		expect(pendingSettle()).toBeUndefined(); // settle 後回歸靜止
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

describe('hydrate 合併(R14 F2)', () => {
	/* F2:hydrate() 與 pageEntry().fetch 共用同一支在飛 GET——子頁 onMount 先於 layout,
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

	it('pageEntry().fetch(頁面 load-gate)與 hydrate()(暖機)併發 → 只 fetch 一次、apply 一次', async () => {
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

	it('refresh 族不併入在飛的 hydrate:gate.refresh() 與 pageEntry().refresh 都真抓', async () => {
		const d = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValue({ v: 2 });
		const gate = createHydrationGate({ fetch, apply: () => {} });

		const pHydrate = gate.hydrate(); // 在飛
		await gate.refresh();
		await gate.pageEntry().refresh();
		expect(fetch).toHaveBeenCalledTimes(3);

		d.resolve({ v: 1 });
		await pHydrate;
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

	it('出發後有 mutation 的在飛 GET 不借給之後進場的 hydrate(旗標被 invalidate 翻回 false 也一樣)——舊快照不得蓋掉 mutation', async () => {
		const dOld = createDeferred<{ v: number }>();
		const fetch = vi.fn().mockReturnValueOnce(dOld.promise).mockResolvedValueOnce({ v: 2 });
		const apply = vi.fn();
		const gate = createHydrationGate({ fetch, apply });

		const pOld = gate.hydrate(); // 世代 0 出發
		gate.markMutated();
		gate.invalidate(); // 和解失敗:旗標翻回 false
		const pNew = gate.hydrate(); // 世代 1 進場:不得併入世代 0 的那支

		dOld.resolve({ v: 1 });
		await Promise.all([pOld, pNew]);

		expect(fetch).toHaveBeenCalledTimes(2);
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

	it('不碰世代帳與尾流帳', () => {
		const tail = createDeferred<void>();
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: () => {} });
		const entry = gate.pageEntry();
		gate.markMutated(tail.promise);
		const gen = entry.hydrate.gen();

		gate.invalidate();

		expect(entry.hydrate.gen()).toBe(gen);
		expect(entry.hydrate.pendingSettle()).toBeInstanceOf(Promise); // 尾流仍在帳上
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
	 * 寫入交給 load-gate 的 hydrate.into,卸載與後發先至都由 load-gate 擋下。 */

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

	it('hydrate.gen 讀的是閘門自己的世代帳:markMutated() 之後 +1', () => {
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: () => {} });
		const entry = gate.pageEntry();

		const before = entry.hydrate.gen();
		gate.markMutated();

		expect(entry.hydrate.gen()).toBe(before + 1);
	});

	it('hydrate.pendingSettle 讀的是閘門自己的尾流帳:有尾流回 promise,靜止回 undefined', async () => {
		const tail = createDeferred<void>();
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: () => {} });
		const entry = gate.pageEntry();

		expect(entry.hydrate.pendingSettle()).toBeUndefined();
		gate.markMutated(tail.promise);
		const wait = entry.hydrate.pendingSettle();
		expect(wait).toBeInstanceOf(Promise);

		tail.resolve();
		await wait;
		expect(entry.hydrate.pendingSettle()).toBeUndefined();
	});

	it('spread 整合:真 createLoadGate({ ...gate.pageEntry() }) 走一輪 loading→ready,資料落回共享 store、旗標由 load-gate 翻', async () => {
		const store = writable<{ v: number } | null>(null);
		const gate = createHydrationGate({ fetch: async () => ({ v: 1 }), apply: (d) => store.set(d) });

		const page = createLoadGate({ ...gate.pageEntry() });
		const phases: LoadPhase[] = [];
		const unsub = page.subscribe((p) => phases.push(p));

		await page.load();

		expect(phases[0]).toBe('loading');
		expect(phases[phases.length - 1]).toBe('ready');
		expect(get(store)).toEqual({ v: 1 }); // hydrate.into 寫回的是同一顆共享 store
		expect(get(gate.hydrated)).toBe(true); // load-gate 的 commit 翻的正是閘門同一顆旗標

		unsub();
		page.destroy(); // 元件外建構無生命週期可掛(見 load-gate autoDestroyOnUnmount),呼叫端自行 destroy
	});
});
