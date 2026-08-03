import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createMineController, type MineController } from './mine-controller';
import type { AttRecord } from '$lib/domain/member-app';
import type { WaitlistEntry } from './waitlist';

/* mine-controller.ts — member/mine 內層編排層的單元測試（R10 架構深化 D 案）。只測
 * 機制（selectCourse 的先寫後抓 + stale-guard、cancelWaitlistEntry 的 busy 守衛 /
 * outcome），deps 注入 mock、無渲染；頁面端的 toast 文案佈線與 attState 三分支渲染
 * 仍由 routes/member/mine/page.test.ts 把關（24 it 全保留零改）。 */

/** 手動控制 resolve/reject 時序的 promise，用於驗 stale-guard 的 A→B 快切情境
 *  （同 coach/messages-controller.test.ts、member/cancel-leave.test.ts 慣例）。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const WL_ENTRY: WaitlistEntry = { id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X' };

function makeDeps() {
	return {
		getEnrolmentAttendance: vi.fn<(id: string) => Promise<AttRecord[]>>(),
		cancelWaitlist: vi.fn<(id: string) => Promise<void>>()
	};
}

let deps: ReturnType<typeof makeDeps>;
let ctrl: MineController;

beforeEach(() => {
	deps = makeDeps();
	ctrl = createMineController(deps);
});

describe('createMineController — 建構', () => {
	it('建構零副作用：初始快照 loading/空，未呼叫任何 dep（SSR 安全）', () => {
		expect(get(ctrl)).toEqual({ active: null, attState: 'loading', attendance: [], cancellingId: null });
		expect(deps.getEnrolmentAttendance).not.toHaveBeenCalled();
		expect(deps.cancelWaitlist).not.toHaveBeenCalled();
	});
});

describe('init — 首課載入 / 無課程', () => {
	it('init(firstCourseId)：寫入 active 並立即以該 id 呼叫 getEnrolmentAttendance，resolve 後 attState 轉 ready', async () => {
		deps.getEnrolmentAttendance.mockResolvedValue([{ date: '06/06', state: 'present' }]);

		ctrl.init('k1');

		expect(get(ctrl).active).toBe('k1');
		expect(get(ctrl).attState).toBe('loading');
		expect(deps.getEnrolmentAttendance).toHaveBeenCalledWith('k1');

		await new Promise((r) => setTimeout(r, 0)); // 讓 getEnrolmentAttendance 的 .then 鏈跑完
		expect(get(ctrl).attState).toBe('ready');
		expect(get(ctrl).attendance).toEqual([{ date: '06/06', state: 'present' }]);
	});

	it('init(null)：收斂 ready + 空陣列，不呼叫 getEnrolmentAttendance（無課不觸發）', () => {
		ctrl.init(null);

		expect(get(ctrl)).toEqual({ active: null, attState: 'ready', attendance: [], cancellingId: null });
		expect(deps.getEnrolmentAttendance).not.toHaveBeenCalled();
	});
});

describe('selectCourse — 去重 + 先寫後抓', () => {
	it('同課 id 再選為 no-op，不重複呼叫 getEnrolmentAttendance', async () => {
		deps.getEnrolmentAttendance.mockResolvedValue([]);
		ctrl.init('k1');
		await new Promise((r) => setTimeout(r, 0));
		expect(get(ctrl).attState).toBe('ready');

		ctrl.selectCourse('k1');

		expect(deps.getEnrolmentAttendance).toHaveBeenCalledTimes(1);
	});

	it('切換課程：active 立即寫入新 id，fetch 收到的參數就是剛選的 id（先寫後抓）', () => {
		deps.getEnrolmentAttendance.mockReturnValue(new Promise(() => {})); // 永不 resolve，只驗寫入時序與呼叫參數
		ctrl.init('k1');

		ctrl.selectCourse('k2');

		expect(get(ctrl).active).toBe('k2'); // 已先寫入新 selection
		expect(deps.getEnrolmentAttendance).toHaveBeenLastCalledWith('k2'); // fetch 用的是剛選的 id 參數
	});
});

describe('selectCourse — stale-guard（快速切課，較舊回應被丟棄）', () => {
	it('A→B 快切：A 遲到的成功回應不覆蓋 B 的出席明細（resolve 分支驗 token）', async () => {
		const a = deferred<AttRecord[]>();
		deps.getEnrolmentAttendance.mockReturnValueOnce(a.promise);
		ctrl.init('k1'); // 觸發 A(k1) 的 fetch，尚未 resolve

		deps.getEnrolmentAttendance.mockResolvedValueOnce([{ date: '05/01', state: 'leave' }]);
		ctrl.selectCourse('k2'); // 快切到 B(k2)，B 立即 resolve
		await new Promise((r) => setTimeout(r, 0));

		expect(get(ctrl).attState).toBe('ready');
		expect(get(ctrl).attendance).toEqual([{ date: '05/01', state: 'leave' }]);

		a.resolve([{ date: '01/01', state: 'present' }]); // A 的舊回應這時才回來
		await new Promise((r) => setTimeout(r, 0));

		expect(get(ctrl).active).toBe('k2'); // selection 未被 A 的過期回應動搖
		expect(get(ctrl).attendance).toEqual([{ date: '05/01', state: 'leave' }]); // 未被覆蓋
		expect(get(ctrl).attState).toBe('ready');
	});

	it('A→B 快切：A 遲到的失敗回應也不覆蓋 B 的 ready 狀態（reject 分支同樣驗 token）', async () => {
		const a = deferred<AttRecord[]>();
		deps.getEnrolmentAttendance.mockReturnValueOnce(a.promise);
		ctrl.init('k1');

		deps.getEnrolmentAttendance.mockResolvedValueOnce([]);
		ctrl.selectCourse('k2');
		await new Promise((r) => setTimeout(r, 0));
		expect(get(ctrl).attState).toBe('ready');

		a.reject(new Error('network')); // A 的舊回應這時才失敗
		await new Promise((r) => setTimeout(r, 0));

		expect(get(ctrl).attState).toBe('ready'); // 未被 A 的過期失敗回應打成 error
		expect(get(ctrl).active).toBe('k2');
	});
});

describe('retryAttendance', () => {
	it('針對目前 active 課程重新 fetch，成功後 attState 轉 ready', async () => {
		deps.getEnrolmentAttendance.mockRejectedValueOnce(new Error('boom'));
		ctrl.init('k1');
		await new Promise((r) => setTimeout(r, 0));
		expect(get(ctrl).attState).toBe('error');

		deps.getEnrolmentAttendance.mockResolvedValueOnce([{ date: '06/06', state: 'present' }]);
		ctrl.retryAttendance();

		expect(get(ctrl).attState).toBe('loading'); // 立即翻 loading（同步）
		expect(deps.getEnrolmentAttendance).toHaveBeenLastCalledWith('k1');

		await new Promise((r) => setTimeout(r, 0));
		expect(get(ctrl).attState).toBe('ready');
		expect(get(ctrl).attendance).toEqual([{ date: '06/06', state: 'present' }]);
	});

	it('active 仍為初始 null 時呼叫（結構上不可達，型別層防護）：靜默不做事，不呼叫 deps', () => {
		ctrl.retryAttendance();

		expect(deps.getEnrolmentAttendance).not.toHaveBeenCalled();
		expect(get(ctrl).attState).toBe('loading'); // 維持建構預設，未被動到
	});
});

describe('cancelWaitlistEntry — busy 守衛（比照 cancel-leave.ts 的 createCancelLeave）', () => {
	it('in-flight 期間再呼叫回 null，deps.cancelWaitlist 不被重複呼叫', async () => {
		const d = deferred<void>();
		deps.cancelWaitlist.mockReturnValue(d.promise);

		const first = ctrl.cancelWaitlistEntry(WL_ENTRY); // 起飛，旗標同步翻上（不等 resolve）
		expect(deps.cancelWaitlist).toHaveBeenCalledWith('wl-1');
		expect(get(ctrl).cancellingId).toBe('wl-1');

		expect(await ctrl.cancelWaitlistEntry({ ...WL_ENTRY, id: 'wl-2' })).toBeNull(); // 第二發被守衛擋下
		expect(deps.cancelWaitlist).toHaveBeenCalledTimes(1);

		d.resolve();
		expect(await first).toEqual({ kind: 'waitlistCancelled', courseName: '候補課程 X' });
		expect(get(ctrl).cancellingId).toBeNull();
	});
});

describe('cancelWaitlistEntry — outcome 生命週期', () => {
	it('成功：outcome 為 waitlistCancelled 攜 courseName，cancellingId 起飛同步設 id、完成後復位', async () => {
		const d = deferred<void>();
		deps.cancelWaitlist.mockReturnValue(d.promise);
		expect(get(ctrl).cancellingId).toBeNull(); // 建構零副作用

		const p = ctrl.cancelWaitlistEntry(WL_ENTRY);
		expect(get(ctrl).cancellingId).toBe('wl-1');

		d.resolve();
		expect(await p).toEqual({ kind: 'waitlistCancelled', courseName: '候補課程 X' });
		expect(get(ctrl).cancellingId).toBeNull();
	});

	it('失敗：outcome 為 failed 透傳原始拋出物（非包裝/翻譯），cancellingId 復位', async () => {
		const err = new Error('waitlist entry not found');
		deps.cancelWaitlist.mockRejectedValue(err);

		const outcome = await ctrl.cancelWaitlistEntry(WL_ENTRY);

		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(ctrl).cancellingId).toBeNull();
	});
});
