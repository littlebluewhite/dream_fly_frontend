import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AttendancePage from './+page.svelte';
import { ATT_TODAY_CLASSES } from '$lib/coach/data';
import { getAttendance, saveAttendance } from '$lib/coach/api';
import { toasts } from '$lib/coach/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/coach/api', () => ({ getAttendance: vi.fn(), saveAttendance: vi.fn() }));

beforeEach(() => {
	vi.mocked(getAttendance).mockReset();
	vi.mocked(getAttendance).mockResolvedValue({ classes: ATT_TODAY_CLASSES, failedClasses: [] });
	vi.mocked(saveAttendance).mockReset();
	vi.mocked(saveAttendance).mockResolvedValue([]);
});

/* 出勤記錄 — switch-class + undo.
 * Class/roster are stateful (curClassId); the 切換班級 CoachDropdown swaps the
 * roster and rebuilds marks. Each edit snapshots the WHOLE save-bar state so 復原
 * restores marks + dirtyCount + state. Data now arrives through the
 * getAttendance() seam (async), so every scenario first awaits the ready phase. */
const C1 = ATT_TODAY_CLASSES[0]; // 兒童體操初階班 — has 王承恩
const C2 = ATT_TODAY_CLASSES[1]; // 青少年體操中級班 — has 周彥廷

describe('/coach/attendance (+page) — switch class', () => {
	it('opens on the first class roster (王承恩 visible)', async () => {
		const { findByText } = render(AttendancePage);
		expect(await findByText(C1.roster[0].name)).toBeInTheDocument(); // 王承恩
	});

	it('switching class swaps the roster and drops the old roster names', async () => {
		const { getByText, queryByText, getAllByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		// open the 切換班級 dropdown (CoachDropdown shows the current class name).
		const opener = getAllByText(C1.name).find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		// pick the second class from the popover.
		const opt = getAllByText(C2.name).find((el) => el.closest('button'));
		await fireEvent.click(opt!);
		// new roster present, old roster gone.
		expect(getByText(C2.roster[0].name)).toBeInTheDocument(); // 周彥廷
		expect(queryByText(C1.roster[0].name)).toBeNull(); // 王承恩 gone
	});

	it('preserves a class draft when switching away and back', async () => {
		// codex round 2 P2: an unsaved edit must survive switching to another class
		// and back — switching must not silently reset the draft to defaults.
		const { getAllByText, container, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		// open the trigger (shows the current class `from`), then pick `to`.
		const switchTo = async (from: string, to: string) => {
			const opener = getAllByText(from).find((el) => el.closest('button'));
			await fireEvent.click(opener!);
			const opt = getAllByText(to).find((el) => el.closest('button'));
			await fireEvent.click(opt!);
		};
		// edit row 1 in C1 → 遲到, dirty climbs 3 → 4.
		const lateBtn = getAllByText('遲到').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(lateBtn!);
		expect(container.textContent).toContain('4 筆變更');
		// switch away to C2, then back to C1.
		await switchTo(C1.name, C2.name);
		await switchTo(C2.name, C1.name);
		// C1's draft is restored (still 4 筆變更, not reset to the default 3).
		expect(container.textContent).toContain('4 筆變更');
	});

	it('blocks switching class while a save is in flight (no stuck 儲存中 state)', async () => {
		// codex round 3 P1: a save started on A then a switch to B would stash A as
		// state:'saving'; the in-flight callback (keyed on the live state) never
		// completes A, leaving it stuck on 儲存中 forever. Block the switch instead.
		const { getByText, getAllByText, queryByText, container, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		// saveAttendance never resolves — 模擬請求進行中，同真實網路慢速情境。
		vi.mocked(saveAttendance).mockReturnValue(new Promise(() => {}));

		// start saving class C1 (bottom-bar 儲存點名 button) → state goes 'saving'.
		await fireEvent.click(getByText('儲存點名'));
		expect(container.textContent).toContain('儲存中');
		// attempt to switch to C2 while saving.
		const opener = getAllByText(C1.name).find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		const opt = getAllByText(C2.name).find((el) => el.closest('button'));
		if (opt) await fireEvent.click(opt);
		// switch was blocked: still on C1 (王承恩 present, 周彥廷 absent).
		expect(getByText(C1.roster[0].name)).toBeInTheDocument();
		expect(queryByText(C2.roster[0].name)).toBeNull();
	});
});

describe('/coach/attendance (+page) — undo', () => {
	it('an edit bumps the dirty count and reveals 復原; undo restores both', async () => {
		const { getByText, getAllByText, queryByText, container, findByText } = render(AttendancePage);
		// initial dirty count is 3 → bottom bar reads "3 筆變更".
		await findByText(C1.roster[0].name);
		expect(container.textContent).toContain('3 筆變更');
		// no 復原 control before any unsaved edit.
		expect(queryByText('復原')).toBeNull();

		// edit row 1 (王承恩, default present) → click its 遲到 segment button.
		// "遲到" also appears as a stats-chip <span>; target the AttSegment <button>.
		const lateBtn = getAllByText('遲到').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(lateBtn!);

		// dirty count climbed to 4 and 復原 is now offered.
		expect(container.textContent).toContain('4 筆變更');
		expect(getByText('復原')).toBeInTheDocument();

		// undo → dirty count back to 3 and 復原 hidden again.
		await fireEvent.click(getByText('復原'));
		expect(container.textContent).toContain('3 筆變更');
		expect(queryByText('復原')).toBeNull();
	});
});

describe('/coach/attendance (+page) — 儲存點名 PUT /sessions/{id}/attendance', () => {
	it('點擊「儲存點名」呼叫 saveAttendance(場次 id, 目前 marks)；成功後顯示成功 toast 且以回應同步名冊', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		const updatedRoster = C1.roster.map((r) => ({ ...r, def: 'present' as const }));
		vi.mocked(saveAttendance).mockResolvedValue(updatedRoster);

		await fireEvent.click(getByText('儲存點名'));

		expect(saveAttendance).toHaveBeenCalledWith(C1.id, expect.any(Object));
		expect(await findByText('已儲存 ✓')).toBeInTheDocument();
		expect(notifySpy).toHaveBeenCalledWith('success', '點名已儲存', expect.stringContaining(C1.name));
	});

	it('403(非本課教練) → 顯示對應繁中錯誤 toast，state 回到可重試', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockRejectedValue(new ApiError(403, 'forbidden'));

		await fireEvent.click(getByText('儲存點名'));

		expect(await findByText('儲存點名')).toBeInTheDocument(); // 按鈕文案退回可再次點擊(非停在「儲存中…」)
		expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('權限'));
	});

	it('404(場次不存在) → 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockRejectedValue(new ApiError(404, 'session not found'));

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('場次'));
		});
	});

	it('422(驗證失敗，整批未寫入) → 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockRejectedValue(new ApiError(422, 'invalid status'));

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('未儲存'));
		});
	});

	it('非 ApiError(如網路失敗) → 顯示通用錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockRejectedValue(new Error('network down'));

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', '連線發生問題，請稍後再試。');
		});
	});

	it('本批含「遲到」標記時，成功 toast 追加折疊說明(後端不區分遲到、以出席紀錄)', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		notifySpy.mockClear();
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockResolvedValue(C1.roster.map((r) => ({ ...r, def: 'present' as const })));

		// C1 名冊預設含一筆遲到(林佳穎 def:'late')，直接儲存即屬「含遲到」批次。
		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith(
				'success',
				'點名已儲存',
				expect.stringContaining('遲到已以出席紀錄（系統不區分遲到）')
			);
		});
	});

	it('本批不含「遲到」標記時，成功 toast 不出現折疊說明', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, getAllByText, findByText } = render(AttendancePage);
		await findByText(C1.roster[0].name);
		vi.mocked(saveAttendance).mockResolvedValue(C1.roster.map((r) => ({ ...r, def: 'present' as const })));

		// 先全部標記出席(請假列除外) → marks 不再含 late，再儲存。
		await fireEvent.click(getAllByText('全部標記出席')[0]);
		notifySpy.mockClear(); // 清掉先前累積的呼叫,只驗證本次儲存產生的 toast
		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			const successCall = notifySpy.mock.calls.find((c) => c[0] === 'success' && c[1] === '點名已儲存');
			expect(successCall).toBeTruthy();
			expect(successCall![2]).not.toContain('遲到已以出席紀錄');
		});
	});
});

describe('/coach/attendance — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getAttendance).mockReset();
		vi.mocked(getAttendance).mockRejectedValue(new Error('network'));
		const { findByText } = render(AttendancePage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getAttendance).mockReset();
		vi.mocked(getAttendance).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(AttendancePage);
		expect(getByTestId('attendance-skeleton')).toBeTruthy();
	});

	it('今日沒有場次時顯示空狀態，不渲染名冊/儲存列', async () => {
		vi.mocked(getAttendance).mockReset();
		vi.mocked(getAttendance).mockResolvedValue({ classes: [], failedClasses: [] });
		const { findByText, queryByText } = render(AttendancePage);
		await findByText('今日尚無場次');
		expect(queryByText('儲存點名')).toBeNull();
	});

	it('部分名冊載入失敗：成功班級照常渲染可點名，並顯示提示 toast(不整頁 error)', async () => {
		vi.mocked(getAttendance).mockReset();
		vi.mocked(getAttendance).mockResolvedValue({ classes: [C1], failedClasses: ['青少年體操中級班'] });
		const notifySpy = vi.spyOn(toasts, 'notify');
		notifySpy.mockClear();
		const { findByText, getByText, queryByText } = render(AttendancePage);

		// 成功班級名冊照常渲染、儲存列可操作。
		await findByText(C1.roster[0].name);
		expect(getByText('儲存點名')).toBeInTheDocument();
		expect(queryByText('載入失敗')).toBeNull();
		// 失敗班級以 warning toast 提示。
		expect(notifySpy).toHaveBeenCalledWith(
			'warning',
			'部分名冊載入失敗',
			expect.stringContaining('青少年體操中級班')
		);
	});
});
