import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MyCourseDetail from './MyCourseDetail.svelte';
import { overlay } from '$lib/mobile/stores';
import { leaveRequests, refreshLeaveRequests, cancelLeaveRequest, type LeaveRequest } from '$lib/member/stores';
import type { MyCourse } from '$lib/mobile/data';

/* Task 19：MyCourseDetail 動作列拿掉舊 mock 版「預約補課」課程層級快捷按鈕
 * (真後端的補課預約是針對一張已核准請假申請的動作，見 MakeupSheet)，改為
 * 「我的請假」卡片復用 $lib/member/stores 的 leaveRequests store，範圍收斂到
 * 這門課程(course_id 比對)。 */
vi.mock('$lib/member/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/stores')>();
	return { ...actual, refreshLeaveRequests: vi.fn(), cancelLeaveRequest: vi.fn() };
});

const COURSE: MyCourse = {
	id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '林雅婷',
	icon: 'sparkles', color: '#0066CC', schedule: '', room: '', att: 90, attended: 9, total: 10,
	next: '', term: '', remain: 0
};

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
