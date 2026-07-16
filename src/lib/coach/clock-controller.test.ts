/* clock-controller.ts — coach 儀表板打卡編排層的單元測試。deps（clockIn/clockOut/
 * isClockedIn）全部注入 mock，可控 promise resolve 時序驗 hydrate 的 mutation-wins
 * 守衛（原頁面 render 之舞測試的無渲染替身）與 clocking 生命週期；409/404 校正的
 * outcome → toast 佈線由 routes/coach/page.test.ts 的既有 render its 覆蓋。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createClockController, type ClockController } from './clock-controller';
import { ApiError } from '$lib/api/client';

/** 手動控制 resolve/reject 時序的 promise，用於驗 await 前/後的狀態語意。 */
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
		clockIn: vi.fn<(coachId: string) => Promise<unknown>>(),
		clockOut: vi.fn<(coachId: string) => Promise<unknown>>(),
		isClockedIn: vi.fn<(coachId: string) => Promise<boolean>>()
	};
}

let deps: ReturnType<typeof makeDeps>;
let ctrl: ClockController;

beforeEach(() => {
	deps = makeDeps();
	ctrl = createClockController(deps);
});

describe('createClockController — 建構 / hydrate', () => {
	it('建構零副作用：初始視圖未打卡且非處理中，不觸發任何 dep（SSR 安全）', () => {
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
		expect(deps.clockIn).not.toHaveBeenCalled();
		expect(deps.clockOut).not.toHaveBeenCalled();
		expect(deps.isClockedIn).not.toHaveBeenCalled();
	});

	it('hydrate true：開機查詢回上班中 → clockedIn true，outcome 攜帶查詢結果', async () => {
		deps.isClockedIn.mockResolvedValue(true);
		const outcome = await ctrl.hydrate('c-1');
		expect(deps.isClockedIn).toHaveBeenCalledWith('c-1');
		expect(outcome).toEqual({ kind: 'hydrated', clockedIn: true });
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});

	it('hydrate false：開機查詢回未上班 → clockedIn 維持 false', async () => {
		deps.isClockedIn.mockResolvedValue(false);
		const outcome = await ctrl.hydrate('c-1');
		expect(outcome).toEqual({ kind: 'hydrated', clockedIn: false });
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
	});

	it('hydrate ABA：查詢往返期間手動打卡 → 晚到的查詢結果丟棄（stale），不覆寫 mutation 後狀態', async () => {
		const boot = deferred<boolean>();
		deps.isClockedIn.mockReturnValue(boot.promise);
		deps.clockIn.mockResolvedValue({});
		const pHydrate = ctrl.hydrate('c-1'); // 開機查詢起飛
		await ctrl.clockIn('c-1'); // 查詢往返期間手動打卡 → clockedIn true
		boot.resolve(false); // 晚到的開機查詢結果（false）現在才回來
		const outcome = await pHydrate;
		expect(outcome).toEqual({ kind: 'stale' }); // mutation wins，結果丟棄
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});

	// codex R2：釘住 clockTouched 不復位的契約——不只查詢往返「期間」的 mutation，
	// 任何 mutation 之後才起飛的 hydrate 也一律 stale（hydrate 只服務首次開機）。
	it('mutation 完成之後才起飛的 hydrate 也回 stale，不覆寫 mutation 後狀態', async () => {
		deps.clockIn.mockResolvedValue({});
		deps.isClockedIn.mockResolvedValue(false);
		await ctrl.clockIn('c-1'); // 已完成的 mutation
		const outcome = await ctrl.hydrate('c-1'); // 之後才開始的開機查詢
		expect(outcome).toEqual({ kind: 'stale' });
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});
});

describe('clockIn — 生命週期與 409 校正', () => {
	it('成功：呼叫 deps.clockIn(coachId)，outcome clockedIn、視圖轉上班中', async () => {
		deps.clockIn.mockResolvedValue({});
		const outcome = await ctrl.clockIn('c-1');
		expect(deps.clockIn).toHaveBeenCalledWith('c-1');
		expect(outcome).toEqual({ kind: 'clockedIn' });
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});

	it('clocking 生命週期：起飛同步發佈 clocking true（不等 resolve），落地復位', async () => {
		const d = deferred<unknown>();
		deps.clockIn.mockReturnValue(d.promise);
		const p = ctrl.clockIn('c-1');
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: true }); // 同步進行中
		d.resolve({});
		await p;
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});

	it('409（已在上班中）：outcome alreadyClockedIn，本地狀態校正為 clockedIn true', async () => {
		deps.clockIn.mockRejectedValue(new ApiError(409, 'already clocked in'));
		const outcome = await ctrl.clockIn('c-1');
		expect(outcome).toEqual({ kind: 'alreadyClockedIn' });
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});

	it('泛用失敗：outcome failed 透傳原始錯誤，clockedIn 不變、clocking 復位', async () => {
		const err = new Error('network down');
		deps.clockIn.mockRejectedValue(err);
		const outcome = await ctrl.clockIn('c-1');
		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
	});
});

describe('clockOut — 對稱生命週期與 404 校正', () => {
	beforeEach(async () => {
		// 先上班（讓 clockedIn true），再驗下班分支。
		deps.clockIn.mockResolvedValue({});
		await ctrl.clockIn('c-1');
	});

	it('成功：呼叫 deps.clockOut(coachId)，outcome clockedOut、視圖轉未上班', async () => {
		deps.clockOut.mockResolvedValue({});
		const outcome = await ctrl.clockOut('c-1');
		expect(deps.clockOut).toHaveBeenCalledWith('c-1');
		expect(outcome).toEqual({ kind: 'clockedOut' });
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
	});

	it('clocking 生命週期：起飛同步發佈 clocking true，落地復位並轉未上班', async () => {
		const d = deferred<unknown>();
		deps.clockOut.mockReturnValue(d.promise);
		const p = ctrl.clockOut('c-1');
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: true }); // 同步進行中
		d.resolve({});
		await p;
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
	});

	it('404（尚未上班）：outcome notClockedIn，本地狀態校正為 clockedIn false', async () => {
		deps.clockOut.mockRejectedValue(new ApiError(404, 'no active clock-in record found'));
		const outcome = await ctrl.clockOut('c-1');
		expect(outcome).toEqual({ kind: 'notClockedIn' });
		expect(get(ctrl)).toEqual({ clockedIn: false, clocking: false });
	});

	it('泛用失敗：outcome failed 透傳原始錯誤，clockedIn 維持 true（不校正）、clocking 復位', async () => {
		const err = new Error('network down');
		deps.clockOut.mockRejectedValue(err);
		const outcome = await ctrl.clockOut('c-1');
		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(ctrl)).toEqual({ clockedIn: true, clocking: false });
	});
});
