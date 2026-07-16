import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MyCourseDetail from './MyCourseDetail.svelte';
import { overlay, toasts } from '$lib/mobile/stores';
import { leaveRequests, refreshLeaveRequests, cancelLeaveRequest, type LeaveRequest } from '$lib/member/stores';
import { ApiError } from '$lib/api/client';
import { getEnrolmentAttendance } from '$lib/mobile/api';
import type { MyCourse, AttRecord } from '$lib/mobile/data';

/* Task 19：MyCourseDetail 動作列拿掉舊 mock 版「預約補課」課程層級快捷按鈕
 * (真後端的補課預約是針對一張已核准請假申請的動作，見 MakeupSheet)，改為
 * 「我的請假」卡片復用 $lib/member/stores 的 leaveRequests store，範圍收斂到
 * 這門課程(course_id 比對)。
 *
 * Task F7：出席紀錄改真 GET /enrolments/{id}/attendance——mock $lib/mobile/api
 * 的 getEnrolmentAttendance()(W3：該函式零映射委派桌面 member/api.ts 同名
 * 函式)。預設值刻意保留一筆 'leave' 紀錄(對齊已退役的
 * ATT_HISTORY mock 原本的內容)，讓下面既有測試(尤其「只剩請假/聯絡教練兩個
 * 動作」那則，見其註解)的既有假設不必因資料來源改變而跟著改。 */
vi.mock('$lib/member/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/stores')>();
	return { ...actual, refreshLeaveRequests: vi.fn(), cancelLeaveRequest: vi.fn() };
});
vi.mock('$lib/mobile/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile/api')>();
	return { ...actual, getEnrolmentAttendance: vi.fn() };
});

const COURSE: MyCourse = {
	id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '林雅婷',
	icon: 'sparkles', color: '#0066CC', schedule: '', room: '', att: 90, attended: 9, total: 10,
	next: '', term: '', remain: 0
};

const DEFAULT_ATTENDANCE: AttRecord[] = [
	{ date: '06/06', state: 'present' },
	{ date: '05/21', state: 'leave' }
];

const PENDING: LeaveRequest = {
	id: 'lr1', course_id: 'c1', course_name: COURSE.name, session_id: 's1', session_date: '2026-07-10',
	start_time: '19:00:00', reason: null, status: 'pending', makeup_session_id: null,
	makeup_session_date: null, makeup_start_time: null, created_at: '2026-07-01T00:00:00Z'
};
const APPROVED_NO_MAKEUP: LeaveRequest = { ...PENDING, id: 'lr2', status: 'approved' };
const OTHER_COURSE: LeaveRequest = { ...PENDING, id: 'lr3', course_id: 'c-other' };

beforeEach(() => {
	vi.mocked(refreshLeaveRequests).mockReset().mockResolvedValue(undefined);
	vi.mocked(cancelLeaveRequest).mockReset().mockResolvedValue(undefined);
	vi.mocked(getEnrolmentAttendance).mockReset().mockResolvedValue(DEFAULT_ATTENDANCE);
	overlay.closeAll();
});

describe('MyCourseDetail — 動作列不再有課程層級「預約補課」按鈕', () => {
	it('只剩請假/聯絡教練兩個動作', async () => {
		leaveRequests.set([]);
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

describe('MyCourseDetail — 我的請假(復用 leaveRequests store，範圍收斂到本課程)', () => {
	it('onMount 觸發 refreshLeaveRequests()', async () => {
		leaveRequests.set([]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(refreshLeaveRequests).toHaveBeenCalled();
	});

	it('只顯示這門課程的請假紀錄，其他課程的不顯示', async () => {
		leaveRequests.set([PENDING, OTHER_COURSE]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('待審核')).toBeInTheDocument();
		// OTHER_COURSE 也是 pending，若沒有 course_id 過濾會出現兩筆「待審核」。
		expect(screen.getAllByText('待審核')).toHaveLength(1);
	});

	it('沒有請假紀錄時顯示誠實空狀態文字', async () => {
		leaveRequests.set([]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('目前沒有這門課程的請假紀錄。')).toBeInTheDocument();
	});

	it('pending 顯示取消按鈕，點擊呼叫 cancelLeaveRequest', async () => {
		leaveRequests.set([PENDING]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('取消'));
		expect(cancelLeaveRequest).toHaveBeenCalledWith('lr1');
	});

	// 卡 6：busy 旗標佈線的可證偽測試——取消 in-flight（deps 未 resolve）期間按鈕
	// 必須停用；resolve 後旗標復位、按鈕重新可用（mock 的 cancelLeaveRequest 不
	// 改寫 store，pending 列仍在）。
	it('取消進行中（cancelLeaveRequest 尚未完成）時「取消」按鈕停用，完成後復位', async () => {
		leaveRequests.set([PENDING]);
		let resolveCancel!: () => void;
		vi.mocked(cancelLeaveRequest).mockImplementation(
			() => new Promise<void>((res) => { resolveCancel = res; })
		);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		const btn = await screen.findByText('取消');
		expect(btn).not.toBeDisabled();

		await fireEvent.click(btn);

		await vi.waitFor(() => expect(btn).toBeDisabled());
		resolveCancel(); // 收尾不留 in-flight
		await vi.waitFor(() => expect(btn).not.toBeDisabled());
	});

	// codex R1：mobile 端此前沒有取消失敗路徑測試——釘住 outcome 攜原始 ApiError →
	// leaveRequestErrorMessage 透傳 → toast 精確 body 的整條佈線。
	it('取消失敗（409）→ 顯示精確繁中錯誤 toast，pending 列不變', async () => {
		leaveRequests.set([PENDING]);
		vi.mocked(cancelLeaveRequest).mockRejectedValue(new ApiError(409, '僅待審核假單可取消'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('取消'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '取消請假失敗', '僅待審核假單可取消');
		});
		expect(await screen.findByText('待審核')).toBeInTheDocument();
	});

	it('approved 且未補課顯示「預約補課」，點擊開啟 makeup sheet 並帶入該筆 leaveRequest', async () => {
		leaveRequests.set([APPROVED_NO_MAKEUP]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		await fireEvent.click(await screen.findByText('預約補課'));
		expect(get(overlay).sheet).toEqual({ id: 'makeup', props: { leaveRequest: APPROVED_NO_MAKEUP } });
	});

	it('approved 且已補課則顯示補課時間文字，不顯示任何按鈕', async () => {
		const withMakeup: LeaveRequest = { ...APPROVED_NO_MAKEUP, makeup_session_id: 's9', makeup_session_date: '2026-07-15', makeup_start_time: '10:00:00' };
		leaveRequests.set([withMakeup]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		expect(await screen.findByText('已預約補課：', { exact: false })).toBeInTheDocument();
		expect(screen.queryByText('預約補課')).toBeNull();
		expect(screen.queryByText('取消')).toBeNull();
	});
});

describe('MyCourseDetail — 出席紀錄(Task F7：真後端 GET /enrolments/{id}/attendance，§3.12)', () => {
	it('onMount 呼叫 getEnrolmentAttendance(course.id)', async () => {
		leaveRequests.set([]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
		expect(getEnrolmentAttendance).toHaveBeenCalledWith('e1');
	});

	it('沒有出勤紀錄時顯示「尚無出勤紀錄」空狀態', async () => {
		leaveRequests.set([]);
		vi.mocked(getEnrolmentAttendance).mockResolvedValue([]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('尚無出勤紀錄')).toBeInTheDocument();
	});

	it('依 present/absent/leave 三態渲染出席徽章(late 態已隨後端 enum 收斂移除)', async () => {
		leaveRequests.set([]);
		vi.mocked(getEnrolmentAttendance).mockResolvedValue([
			{ date: '06/06', state: 'present' },
			{ date: '05/21', state: 'leave' },
			{ date: '05/14', state: 'absent' }
		]);
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });

		expect(await screen.findByText('出席')).toBeInTheDocument();
		expect(screen.getByText('缺席')).toBeInTheDocument();
		// 「請假」同時是動作列按鈕文字與 leave 狀態徽章文字(同本檔案開頭「只剩請假/
		// 聯絡教練兩個動作」測試的既有慣例)——用計數斷言避免撞到兩個相符元素。
		expect(screen.getAllByText('請假')).toHaveLength(2);
		expect(screen.queryByText('遲到')).toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		leaveRequests.set([]);
		vi.mocked(getEnrolmentAttendance).mockRejectedValue(new Error('boom'));
		render(MyCourseDetail, { props: { onBack: () => {}, course: COURSE } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});
