import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AttendancePage from './+page.svelte';
import type { TodaySessionResponse } from '$lib/api/wire';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getAttendance/saveAttendance 走
 * 真實 fetch adapter(GET /sessions/today × GET /sessions/{id}/roster、PUT
 * /sessions/{id}/attendance)；教練身分經 loginAs() 驅動，每個測試先登出再登入避免
 * session 閘門快取跨測試殘留(同 mobile-admin/coach/attendance/page.test.ts 慣例)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

type WireRosterEntry = { enrolment_id: string; user_id: string; user_name: string; attendance_status: 'present' | 'absent' | 'leave' | null };

/* Task 1(C2 死種子退役):inline fixture(≥2 班、含請假(leave)學員,維持既有測試
 * 前提)。R16 Task 8:改為 wire 形狀。C1 的 4 筆名冊:1 筆 present(王承恩,index 0,
 * 供多個斷言鎖定第一列)+ 1 筆 absent(林佳穎)+ 1 筆 leave(張雅婷,供「已請假」
 * 靜態 badge 分支)+ 1 筆 absent(吳柏宇)——非 present 筆數(3)對到「初始 3 筆變更」
 * 的既有斷言。 */
const C1 = {
	session: { id: 'ac1', course_id: 'c1', course_name: '兒童體操初階班', coach_name: null, start_time: '16:00:00', end_time: '17:30:00', enrolled_count: 4, venue: 'A 教室', status: 'upcoming' } satisfies TodaySessionResponse,
	roster: [
		{ enrolment_id: 'GY2024001', user_id: 'm1', user_name: '王承恩', attendance_status: 'present' },
		{ enrolment_id: 'GY2024014', user_id: 'm2', user_name: '林佳穎', attendance_status: 'absent' },
		{ enrolment_id: 'GY2024030', user_id: 'm3', user_name: '張雅婷', attendance_status: 'leave' },
		{ enrolment_id: 'GY2024063', user_id: 'm4', user_name: '吳柏宇', attendance_status: 'absent' }
	] as WireRosterEntry[],
	name: '兒童體操初階班',
	first: '王承恩'
};
const C2 = {
	session: { id: 'ac2', course_id: 'c2', course_name: '青少年體操中級班', coach_name: null, start_time: '13:30:00', end_time: '15:00:00', enrolled_count: 2, venue: 'B 教室', status: 'upcoming' } satisfies TodaySessionResponse,
	roster: [
		{ enrolment_id: 'GY2023012', user_id: 'm5', user_name: '周彥廷', attendance_status: 'present' },
		{ enrolment_id: 'GY2023027', user_id: 'm6', user_name: '簡子涵', attendance_status: 'present' }
	] as WireRosterEntry[],
	first: '周彥廷'
};

const SAVE_PATH = 'PUT /sessions/ac1/attendance';
const ALL_PRESENT = C1.roster.map((r) => ({ ...r, attendance_status: r.attendance_status === 'leave' ? 'leave' : 'present' }));

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(
			{
				'GET /sessions/today': [C1.session, C2.session],
				'GET /sessions/ac1/roster': C1.roster,
				'GET /sessions/ac2/roster': C2.roster,
				[SAVE_PATH]: ALL_PRESENT,
				...overrides
			},
			COACH_ROUTES
		)
	);

/** PUT /sessions/ac1/attendance 送出的 body——取代原本斷言 saveAttendance 呼叫參數。 */
const putBody = (): { records: { enrolment_id: string; status: string }[] } | undefined => {
	const call = vi.mocked(api).mock.calls.find(([p, init]) => p === '/sessions/ac1/attendance' && init?.method === 'PUT');
	return call ? JSON.parse(call[1]!.body as string) : undefined;
};

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

/* 出勤記錄 — switch-class + undo.
 * Class/roster are stateful (curClassId); the 切換班級 CoachDropdown swaps the
 * roster and rebuilds marks. Each edit snapshots the WHOLE save-bar state so 復原
 * restores marks + dirtyCount + state. Data now arrives through the
 * getAttendance() seam (async, real fetch adapter), so every scenario first awaits the ready phase. */

describe('/coach/attendance (+page) — switch class', () => {
	it('opens on the first class roster (王承恩 visible)', async () => {
		const { findByText } = render(AttendancePage);
		expect(await findByText(C1.first)).toBeInTheDocument(); // 王承恩
	});

	it('switching class swaps the roster and drops the old roster names', async () => {
		const { getByText, queryByText, getAllByText, findByText } = render(AttendancePage);
		await findByText(C1.first);
		// open the 切換班級 dropdown (CoachDropdown shows the current class's sessionChipLabel:
		// 時間前綴 + 課名，非裸課名——R3 K9 銷帳 ADR 0014 :224-226)。
		const opener = getAllByText('16:00 兒童體操初階班').find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		// pick the second class from the popover.
		const opt = getAllByText('13:30 青少年體操中級班').find((el) => el.closest('button'));
		await fireEvent.click(opt!);
		// new roster present, old roster gone.
		expect(getByText(C2.first)).toBeInTheDocument(); // 周彥廷
		expect(queryByText(C1.first)).toBeNull(); // 王承恩 gone
	});

	it('同日兩場同課名：dropdown 兩個同名選項各自可選並切到各自名冊(keyed by session id，0014 限制撤銷)', async () => {
		// key 佈線非 label——即使兩堂課同課名，each key 走 o.key(session id)非 o.label，
		// 選取(onChange)也走 id：兩個選項互不干擾各自可選。sessionChipLabel 的時間前綴
		// 讓兩者顯示字串其實不再相同(見下方相異斷言)，但此測試鎖的是 id 佈線，非顯示文字。
		route({ 'GET /sessions/today': [C1.session, { ...C2.session, course_name: C1.name }] });
		const { container, getAllByText, findByText, getByText, queryByText } = render(AttendancePage);
		await findByText(C1.first); // 第一場名冊(王承恩)
		const opener = getAllByText('16:00 兒童體操初階班').find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		// popover 的選項按鈕(df-rowhover)恰兩顆、同課名但時間前綴不同——點第二顆(第二場)。
		const opts = container.querySelectorAll('button.df-rowhover');
		expect(opts.length).toBe(2);
		expect(opts[0].textContent).not.toBe(opts[1].textContent); // 兩選項顯示字串相異(時間前綴消歧義)
		await fireEvent.click(opts[1]);
		expect(getByText(C2.first)).toBeInTheDocument(); // 第二場名冊(周彥廷)
		expect(queryByText(C1.first)).toBeNull(); // 王承恩 gone——沒有停在第一場
	});

	it('preserves a class draft when switching away and back', async () => {
		// codex round 2 P2: an unsaved edit must survive switching to another class
		// and back — switching must not silently reset the draft to defaults.
		const { getAllByText, container, findByText } = render(AttendancePage);
		await findByText(C1.first);
		// open the trigger (shows the current class `from`), then pick `to`.
		const switchTo = async (from: string, to: string) => {
			const opener = getAllByText(from).find((el) => el.closest('button'));
			await fireEvent.click(opener!);
			const opt = getAllByText(to).find((el) => el.closest('button'));
			await fireEvent.click(opt!);
		};
		// edit row 1 in C1 → 缺席, dirty climbs 3 → 4.
		const absentBtn = getAllByText('缺席').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(absentBtn!);
		expect(container.textContent).toContain('4 筆變更');
		// switch away to C2, then back to C1(sessionChipLabel 的時間前綴完整字串)。
		await switchTo('16:00 兒童體操初階班', '13:30 青少年體操中級班');
		await switchTo('13:30 青少年體操中級班', '16:00 兒童體操初階班');
		// C1's draft is restored (still 4 筆變更, not reset to the default 3).
		expect(container.textContent).toContain('4 筆變更');
	});

	it('blocks switching class while a save is in flight (no stuck 儲存中 state)', async () => {
		// codex round 3 P1: a save started on A then a switch to B would stash A as
		// state:'saving'; the in-flight callback (keyed on the live state) never
		// completes A, leaving it stuck on 儲存中 forever. Block the switch instead.
		const { getByText, getAllByText, queryByText, container, findByText } = render(AttendancePage);
		await findByText(C1.first);
		// PUT never resolves — 模擬請求進行中，同真實網路慢速情境。
		route({ [SAVE_PATH]: () => new Promise(() => {}) });

		// start saving class C1 (bottom-bar 儲存點名 button) → state goes 'saving'.
		await fireEvent.click(getByText('儲存點名'));
		expect(container.textContent).toContain('儲存中');
		// attempt to switch to C2 while saving.
		const opener = getAllByText('16:00 兒童體操初階班').find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		const opt = getAllByText('13:30 青少年體操中級班').find((el) => el.closest('button'));
		if (opt) await fireEvent.click(opt);
		// switch was blocked: still on C1 (王承恩 present, 周彥廷 absent).
		expect(getByText(C1.first)).toBeInTheDocument();
		expect(queryByText(C2.first)).toBeNull();
	});
});

describe('/coach/attendance (+page) — undo', () => {
	it('an edit bumps the dirty count and reveals 復原; undo restores both', async () => {
		const { getByText, getAllByText, queryByText, container, findByText } = render(AttendancePage);
		// initial dirty count is 3 → bottom bar reads "3 筆變更".
		await findByText(C1.first);
		expect(container.textContent).toContain('3 筆變更');
		// no 復原 control before any unsaved edit.
		expect(queryByText('復原')).toBeNull();

		// edit row 1 (王承恩, default present) → click its 缺席 segment button.
		// "缺席" also appears as a stats-chip <span>; target the AttSegment <button>.
		const absentBtn = getAllByText('缺席').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(absentBtn!);

		// dirty count climbed to 4 and 復原 is now offered.
		expect(container.textContent).toContain('4 筆變更');
		expect(getByText('復原')).toBeInTheDocument();

		// undo → dirty count back to 3 and 復原 hidden again.
		await fireEvent.click(getByText('復原'));
		expect(container.textContent).toContain('3 筆變更');
		expect(queryByText('復原')).toBeNull();
	});
});

describe('/coach/attendance (+page) — 備註僅存本機(D1)', () => {
	it('備註 Dialog 明示「僅存本機，重新整理後會消失」；儲存備註不增加未存變更筆數', async () => {
		const { getAllByLabelText, getByText, getByPlaceholderText, container, findByText } = render(AttendancePage);
		await findByText(C1.first);
		expect(container.textContent).toContain('3 筆變更');

		await fireEvent.click(getAllByLabelText('備註')[0]);
		expect(getByText('僅存本機，重新整理後會消失')).toBeInTheDocument();
		await fireEvent.input(getByPlaceholderText('輸入對此學員的備註…'), { target: { value: '本週表現進步' } });
		await fireEvent.click(getByText('儲存備註'));

		expect(await findByText('本週表現進步')).toBeInTheDocument(); // 備註預覽 chip
		expect(container.textContent).toContain('3 筆變更'); // 不計入待同步
	});
});

describe('/coach/attendance (+page) — 儲存點名 PUT /sessions/{id}/attendance', () => {
	it('點擊「儲存點名」送出 PUT /sessions/{場次 id}/attendance(目前 marks)；成功後顯示成功 toast 且以回應同步名冊', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.first);

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => expect(putBody()?.records).toHaveLength(C1.roster.length));
		expect(await findByText('已儲存 ✓')).toBeInTheDocument();
		expect(notifySpy).toHaveBeenCalledWith('success', '點名已儲存', expect.stringContaining(C1.name));
	});

	it('403(非本課教練) → 顯示對應繁中錯誤 toast，state 回到可重試', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.first);
		route({ [SAVE_PATH]: new ApiError(403, 'forbidden') });

		await fireEvent.click(getByText('儲存點名'));

		expect(await findByText('儲存點名')).toBeInTheDocument(); // 按鈕文案退回可再次點擊(非停在「儲存中…」)
		expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('權限'));
	});

	it('404(場次不存在) → 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.first);
		route({ [SAVE_PATH]: new ApiError(404, 'session not found') });

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('場次'));
		});
	});

	it('422(驗證失敗，整批未寫入) → 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.first);
		route({ [SAVE_PATH]: new ApiError(422, 'invalid status') });

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', expect.stringContaining('未儲存'));
		});
	});

	it('非 ApiError(如網路失敗) → 顯示通用錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(AttendancePage);
		await findByText(C1.first);
		route({ [SAVE_PATH]: new Error('network down') });

		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '點名儲存失敗', '連線發生問題，請稍後再試。');
		});
	});
});

describe('/coach/attendance — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /sessions/today': new Error('network') });
		const { findByText } = render(AttendancePage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError:顯示「此帳號未綁定教練檔案」而非泛用載入失敗(C6)', async () => {
		route({ 'GET /coaches': [] }); // 查無本人教練檔案 → 真 CoachNotFoundError
		const { findByText, queryByText } = render(AttendancePage);
		await findByText('請聯繫系統管理員協助設定教練檔案。');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		// 只讓兩支名冊端點卡住(身分/今日場次照常回應，理由見 mobile-admin/coach/page.test.ts loading 註解)。
		route({ 'GET /sessions/ac1/roster': () => new Promise(() => {}), 'GET /sessions/ac2/roster': () => new Promise(() => {}) });
		const { getByTestId } = render(AttendancePage);
		expect(getByTestId('attendance-skeleton')).toBeTruthy();
	});

	it('今日沒有場次時顯示空狀態，不渲染名冊/儲存列', async () => {
		route({ 'GET /sessions/today': [] });
		const { findByText, queryByText } = render(AttendancePage);
		await findByText('今日尚無場次');
		expect(queryByText('儲存點名')).toBeNull();
	});

	it('部分名冊載入失敗：成功班級照常渲染可點名，並顯示提示 toast(不整頁 error)', async () => {
		route({ 'GET /sessions/ac2/roster': new Error('rate limited') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		notifySpy.mockClear();
		const { findByText, getByText, queryByText } = render(AttendancePage);

		// 成功班級名冊照常渲染、儲存列可操作。
		await findByText(C1.first);
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

describe('/coach/attendance — 出席保存狀態卡文案誠實(Task 1，R13 小 bug 包)', () => {
	it('說明文字不再宣稱「支援離線暫存與多裝置衝突處理」(功能不存在，只有即時儲存進度)', async () => {
		const { findByText, queryByText } = render(AttendancePage);
		await findByText(C1.first);
		expect(await findByText('即時顯示儲存進度。')).toBeInTheDocument();
		expect(queryByText('支援離線暫存與多裝置衝突處理', { exact: false })).toBeNull();
	});

	it('未儲存變更時不再顯示假的「已自動暫存於本機 14:30」硬編時間(初始名冊已有 3 筆非 present，一進頁就是「尚未儲存」)', async () => {
		const { findByText, queryByText } = render(AttendancePage);
		await findByText(C1.first);
		await findByText('尚未儲存 · 3 筆變更');
		expect(queryByText('已自動暫存於本機', { exact: false })).toBeNull();
	});
});
