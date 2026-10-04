import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MyCourseDetail from './MyCourseDetail.svelte';
import { overlay, toasts } from '$lib/mobile/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import type { LeaveRequest } from '$lib/member/leave';
import { attendanceEntry } from '$lib/testing/wire-fixtures';
import { apiCalls } from '$lib/testing/admin-routes';
import type { EnrolledCourse as MyCourse } from '$lib/domain/member-app';

/* Task 19：MyCourseDetail 動作列拿掉舊 mock 版「預約補課」課程層級快捷按鈕
 * (真後端的補課預約是針對一張已核准請假申請的動作，見 MakeupSheet)，改為
 * 「我的請假」卡片復用 $lib/member/leave 的 leaveRequests store，範圍收斂到
 * 這門課程(course_id 比對)。
 *
 * Task F7：出席紀錄改真 GET /enrolments/{id}/attendance。預設值刻意保留一筆 'leave' 紀錄
 * (對齊已退役的 ATT_HISTORY mock 原本的內容)，讓下面既有測試(尤其「只剩請假/
 * 聯絡教練兩個動作」那則，見其註解)的既有假設不必因資料來源改變而跟著改。
 *
 * Task 1(架構深化 R14·F6):「我的請假」改走 $lib/api/client + fakeRouter(寫法照
 * self-account.test.ts) —— refreshLeaveRequests/cancelLeaveRequest 不 mock
 * deps，fixture 改由 route 供給(GET /leave-requests/me、
 * DELETE /leave-requests/{id})，斷言改成「打了哪個端點、帶什麼 body」。
 * Task 7(架構深化 R15·F-4)：元件改直取 $lib/member/api 的 getEnrolmentAttendance
 * (mobile/api.ts 原本的純轉手 wrapper 已退役)。
 * W4d：出席紀錄也改成只假造 HTTP(api())，真 getter + mapper 跑起來；畫面文字斷言不變。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const COURSE: MyCourse = {
	id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', level: '進階', icon: 'sparkles', color: '#0066CC', schedule: '', att: 90, attended: 9, total: 10
};

// wire 輸入：session_date "YYYY-MM-DD" 經 mapper 變成 date "MM/DD" + year。
const ATT_KEY = 'GET /enrolments/e1/attendance';
const DEFAULT_ATTENDANCE = [
	attendanceEntry({ session_date: '2026-06-06', status: 'present' }),
	attendanceEntry({ session_date: '2026-05-21', status: 'leave' })
];

const PENDING: LeaveRequest = {
	id: 'lr1', course_id: 'c1', course_name: COURSE.name, session_id: 's1', session_date: '2026-07-10',
	start_time: '19:00:00', reason: null, status: 'pending', makeup_session_id: null,
	makeup_session_date: null, makeup_start_time: null, created_at: '2026-07-01T00:00:00Z'
};
const APPROVED_NO_MAKEUP: LeaveRequest = { ...PENDING, id: 'lr2', status: 'approved' };
const OTHER_COURSE: LeaveRequest = { ...PENDING, id: 'lr3', course_id: 'c-other' };

type Routes = Record<string, unknown>;
let routes: Routes;
function route(extra: Routes) {
	routes = { ...routes, ...extra };
}
function deleteCalls(): string[] {
	return vi.mocked(api).mock.calls.filter(([, init]) => init?.method === 'DELETE').map(([p]) => p);
}

beforeEach(() => {
	routes = { 'GET /leave-requests/me': [], [ATT_KEY]: DEFAULT_ATTENDANCE };
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
	overlay.closeAll();
});

describe('MyCourseDetail — 動作列不再有課程層級「預約補課」按鈕', () => {
	it('只剩請假/聯絡教練兩個動作', async () => {
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		// getByRole('button')，非 getByText —— 出席紀錄裡也有一筆 state:'leave' 的
		// Badge 文字同樣是「請假」(非按鈕)，純文字比對會撞到兩個相符元素;
		// 「聯絡教練」則同時是動作列按鈕與 ScreenHeader 的 HeaderIcon(兩個按鈕
		// 皆存在，本來就是既有設計，用 getAllByRole 確認兩者都在)。
		expect(await screen.findByRole('button', { name: '請假' })).toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: '聯絡教練' })).toHaveLength(2);
		expect(screen.queryByText('預約補課')).toBeNull();
	});
});

describe('MyCourseDetail — 只顯示後端有的課程資料(R16 Task 2c)', () => {
	it('不再顯示教室/教練/本季尚餘堂數/季別', async () => {
		const { container } = render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		await screen.findByRole('button', { name: '請假' });
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('本季尚餘');
		expect(txt).not.toContain(' 教練');
	});
});

describe('MyCourseDetail — 我的請假(GET /leave-requests/me，範圍收斂到本課程)', () => {
	it('onMount 打 GET /leave-requests/me', async () => {
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		await vi.waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith('/leave-requests/me'));
	});

	it('只顯示這門課程的請假紀錄，其他課程的不顯示', async () => {
		route({ 'GET /leave-requests/me': [PENDING, OTHER_COURSE] });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('待審核')).toBeInTheDocument();
		// OTHER_COURSE 也是 pending，若沒有 course_id 過濾會出現兩筆「待審核」。
		expect(screen.getAllByText('待審核')).toHaveLength(1);
	});

	it('沒有請假紀錄時顯示誠實空狀態文字', async () => {
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('目前沒有這門課程的請假紀錄。')).toBeInTheDocument();
	});

	it('pending 顯示取消按鈕，點擊打 DELETE /leave-requests/{id}', async () => {
		route({ 'GET /leave-requests/me': [PENDING], 'DELETE /leave-requests/lr1': undefined });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('取消'));
		await vi.waitFor(() => expect(deleteCalls()).toEqual(['/leave-requests/lr1']));
	});

	// 卡 6：busy 旗標佈線的可證偽測試——取消 in-flight（DELETE 尚未 resolve）期間按鈕
	// 必須停用；resolve 後 DELETE 真的落地(狀態改 cancelled)，取消按鈕隨之消失
	// (leaveAction 對 cancelled 不再回傳 'cancel'，同「approved 且已補課」那則的
	// 既有慣例：非 mock 版不能再靠「resolve 不改狀態」驗證復位，改驗證按鈕本身
	// 隨真實寫回消失，busy 守衛不再卡住 UI)。
	it('取消進行中（DELETE 尚未 resolve）時「取消」按鈕停用，完成後真的送出並消失', async () => {
		let resolveDelete!: () => void;
		route({
			'GET /leave-requests/me': [PENDING],
			'DELETE /leave-requests/lr1': () => new Promise<void>((res) => { resolveDelete = res; })
		});
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		const btn = await screen.findByText('取消');
		expect(btn).not.toBeDisabled();

		await fireEvent.click(btn);

		await vi.waitFor(() => expect(btn).toBeDisabled());
		resolveDelete(); // 收尾不留 in-flight
		await vi.waitFor(() => expect(screen.queryByText('取消')).toBeNull());
	});

	// codex R1：mobile 端此前沒有取消失敗路徑測試——釘住 outcome 攜原始 ApiError →
	// leaveRequestErrorMessage 透傳 → toast 精確 body 的整條佈線。
	it('取消失敗（409）→ 顯示精確繁中錯誤 toast，pending 列不變', async () => {
		route({ 'GET /leave-requests/me': [PENDING], 'DELETE /leave-requests/lr1': new ApiError(409, '僅待審核假單可取消') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('取消'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '取消請假失敗', '僅待審核假單可取消');
		});
		expect(await screen.findByText('待審核')).toBeInTheDocument();
	});

	it('approved 且未補課顯示「預約補課」，點擊開啟 makeup sheet 並帶入該筆 leaveRequest', async () => {
		route({ 'GET /leave-requests/me': [APPROVED_NO_MAKEUP] });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('預約補課'));
		expect(get(overlay).sheet).toEqual({ id: 'makeup', props: { leaveRequest: APPROVED_NO_MAKEUP } });
	});

	it('approved 且已補課則顯示補課時間文字，不顯示任何按鈕', async () => {
		const withMakeup: LeaveRequest = { ...APPROVED_NO_MAKEUP, makeup_session_id: 's9', makeup_session_date: '2026-07-15', makeup_start_time: '10:00:00' };
		route({ 'GET /leave-requests/me': [withMakeup] });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		expect(await screen.findByText('已預約補課：', { exact: false })).toBeInTheDocument();
		expect(screen.queryByText('預約補課')).toBeNull();
		expect(screen.queryByText('取消')).toBeNull();
	});
});

describe('MyCourseDetail — 出席紀錄(Task F7：真後端 GET /enrolments/{id}/attendance，§3.12)', () => {
	it('onMount 呼叫 getEnrolmentAttendance(course.id)', async () => {
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
		expect(apiCalls(ATT_KEY)).toHaveLength(1);
	});

	it('沒有出勤紀錄時顯示「尚無出勤紀錄」空狀態', async () => {
		route({ [ATT_KEY]: [] });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('尚無出勤紀錄')).toBeInTheDocument();
	});

	it('依 present/absent/leave 三態渲染出席徽章(late 態已隨後端 enum 收斂移除)', async () => {
		route({
			[ATT_KEY]: [
				attendanceEntry({ session_date: '2026-06-06', status: 'present' }),
				attendanceEntry({ session_date: '2026-05-21', status: 'leave' }),
				attendanceEntry({ session_date: '2026-05-14', status: 'absent' })
			]
		});
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		expect(await screen.findByText('出席')).toBeInTheDocument();
		expect(screen.getByText('缺席')).toBeInTheDocument();
		// 「請假」同時是動作列按鈕文字與 leave 狀態徽章文字(同本檔案開頭「只剩請假/
		// 聯絡教練兩個動作」測試的既有慣例)——用計數斷言避免撞到兩個相符元素。
		expect(screen.getAllByText('請假')).toHaveLength(2);
		expect(screen.queryByText('遲到')).toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ [ATT_KEY]: new Error('boom') });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('每筆紀錄顯示自己的 year，不是硬編某一年(pin：2025 年場次顯示 2025，不是 2026)', async () => {
		route({ [ATT_KEY]: [attendanceEntry({ session_date: '2025-12-30', status: 'present' })] });
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		expect(await screen.findByText('2025 / 12/30')).toBeInTheDocument();
	});
});
