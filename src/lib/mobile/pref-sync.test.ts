import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import { createPrefSync } from './pref-sync';
import type { Prefs } from './stores';

/* pref-sync.ts — mobile 帳號設定偏好同步機的單元測試(R11 架構深化 Task 2，ADR 0012
 * 名冊第九例)。只測機器本身(hydrate 水合、set() 樂觀更新 + saveChain 序列鏈、
 * sendPref 失敗 resync/雙重失敗回滾、三種 outcome kind)，deps 全注入 mock(含真
 * writable 當 prefs store)、離開 DOM；元件端的 markup 綁定與 outcome→toast 佈線
 * 仍由 overlays/SettingsScreen.test.ts 把關(mock $lib/mobile/api 不變)，兩層各測
 * 各的(同 contact-form.ts/ContactForm.test.ts 的既有分層慣例)。
 *
 * 交錯競態 it 移植自 SettingsScreen.test.ts 原 :125-168(DOM 版)，語意逐字保留，
 * 只是不再需要 render()/fireEvent()/waitFor()——deps 全同步可控，用 deferred()
 * 手動控制 resolve/reject 時序，配合 `await Promise.resolve()` 手動推進一次
 * microtask 佇列即可斷言「call2 尚未送出」(同 EditModal.test.ts 的既有慣例)。 */

const DEFAULT_PREFS: Prefs = { classReminder: true, coachMsg: true, promo: false, dark: false };

/** 手動控制 resolve/reject 時序的 promise(repo 既有慣例，見 attendance-controller.test.ts
 *  /mine-controller.test.ts/messages-controller.test.ts 同名函式)。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDeps() {
	return {
		getPreferences: vi.fn<() => Promise<Prefs>>(),
		savePreferences: vi.fn<(p: Prefs) => Promise<void>>(),
		prefs: writable<Prefs>({ ...DEFAULT_PREFS })
	};
}

let deps: ReturnType<typeof makeDeps>;
let sync: ReturnType<typeof createPrefSync>;

beforeEach(() => {
	deps = makeDeps();
	sync = createPrefSync(deps);
});

describe('createPrefSync — hydrate()', () => {
	it('成功：整包覆蓋 store 為伺服器回傳值', async () => {
		const serverPrefs: Prefs = { classReminder: false, coachMsg: false, promo: true, dark: true };
		deps.getPreferences.mockResolvedValue(serverPrefs);

		await sync.hydrate();

		expect(get(deps.prefs)).toEqual(serverPrefs);
	});

	it('失敗：吞錯留本地快取，不 throw', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		deps.getPreferences.mockRejectedValue(new Error('offline'));

		await expect(sync.hydrate()).resolves.toBeUndefined();

		expect(get(deps.prefs)).toEqual(DEFAULT_PREFS);
		expect(consoleErrorSpy).toHaveBeenCalledWith('pref-sync: 偏好載入失敗，沿用本地快取', expect.any(Error));
		consoleErrorSpy.mockRestore();
	});
});

describe('createPrefSync — set() 三種 outcome', () => {
	it("送出成功 → { kind: 'saved' }；store 維持樂觀更新後的值", async () => {
		deps.savePreferences.mockResolvedValue(undefined);

		const outcome = await sync.set('classReminder', false);

		expect(outcome).toEqual({ kind: 'saved' });
		expect(get(deps.prefs)).toEqual({ ...DEFAULT_PREFS, classReminder: false });
		expect(deps.savePreferences).toHaveBeenCalledWith({ ...DEFAULT_PREFS, classReminder: false });
	});

	it("送出失敗、resync 成功 → { kind: 'resynced' }；store 被伺服器真值整包覆蓋(非單鍵回滾)", async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		deps.savePreferences.mockRejectedValue(new Error('network'));
		// 4 個 key 都刻意與「切換前」的本地值不同，證明整包蓋掉的是 getPreferences()
		// 的回應，不是巧合對到單鍵回滾的舊值(同 SettingsScreen.test.ts 原 :86 慣例)。
		const serverTruth: Prefs = { classReminder: false, coachMsg: false, promo: true, dark: true };
		deps.getPreferences.mockResolvedValue(serverTruth);

		const outcome = await sync.set('coachMsg', false);

		expect(outcome).toEqual({ kind: 'resynced' });
		expect(get(deps.prefs)).toEqual(serverTruth);
		consoleErrorSpy.mockRestore();
	});

	it("送出與 resync 都失敗 → { kind: 'rolledBack' }；僅該鍵回滾，其餘 key 不受影響", async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		deps.prefs.set({ classReminder: false, coachMsg: true, promo: true, dark: false }); // 已偏離 DEFAULT_PREFS(非首次水合狀態)
		deps.savePreferences.mockRejectedValue(new Error('network'));
		deps.getPreferences.mockRejectedValue(new Error('offline')); // 雙重離線，resync 也失敗

		const outcome = await sync.set('coachMsg', false); // true→false，稍後回滾

		expect(outcome).toEqual({ kind: 'rolledBack' });
		// 僅 coachMsg 回滾回切換前的 true；classReminder/promo/dark 三個未涉入本次
		// 切換的 key 維持原樣，證明這是單鍵回滾而非整包覆寫。
		expect(get(deps.prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });
		consoleErrorSpy.mockRestore();
	});
});

describe('createPrefSync — 交錯競態(saveChain 序列鏈；移植自 SettingsScreen.test.ts 原 :125 語意)', () => {
	it('切 A 在飛(savePreferences 掛住)又切 B → 序列化：call2 在 call1 的失敗處理(含 resync)完成後才送出，且 call2 的 body 是「輪到時」的最新整包', async () => {
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const call1Save = deferred<void>();
		deps.savePreferences
			.mockImplementationOnce(() => call1Save.promise) // call1：classReminder 切換，稍後失敗
			.mockImplementationOnce(() => Promise.resolve()); // call2：promo 切換，成功
		deps.getPreferences.mockResolvedValueOnce({ ...DEFAULT_PREFS }); // call1 失敗後的整包 resync(伺服器從未收到 call1 的變更，仍是預設值)

		const call1 = sync.set('classReminder', false); // A：true→false，送出中，尚未回應
		expect(get(deps.prefs).classReminder).toBe(false); // 樂觀更新立即生效

		const call2 = sync.set('promo', true); // B：false→true，本地樂觀更新立即生效，排隊等候
		expect(get(deps.prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });

		await Promise.resolve(); // 推進一次 microtask 佇列，讓 call1 的 sendPref 起飛
		expect(deps.savePreferences).toHaveBeenCalledTimes(1); // 序列化：call2 尚未送出

		call1Save.reject(new Error('network')); // call1 失敗
		const outcome1 = await call1;
		expect(outcome1).toEqual({ kind: 'resynced' });
		expect(deps.getPreferences).toHaveBeenCalledTimes(1); // 觸發整包 resync

		const outcome2 = await call2;
		expect(outcome2).toEqual({ kind: 'saved' });
		expect(deps.savePreferences).toHaveBeenCalledTimes(2); // resync 結束、call2 才輪到送出

		// call2 的 body：classReminder 已是 resync 後的正確值(true)，不是排隊當下
		// 的舊快照(false)；promo 因整包 resync 覆寫(伺服器當時還沒收到 call2 的
		// 變更)一併回到伺服器真值 false——同 SettingsScreen.test.ts 原 :125 的
		// 刻意設計取捨：寧可讓尚未送出的樂觀值被伺服器真值蓋過、需要使用者重新切
		// 一次，也不讓本地顯示跟伺服器真值悄悄分歧。
		expect(deps.savePreferences).toHaveBeenLastCalledWith({ classReminder: true, coachMsg: true, promo: false, dark: false });
		expect(get(deps.prefs)).toEqual({ classReminder: true, coachMsg: true, promo: false, dark: false });

		consoleErrorSpy.mockRestore();
	});
});
