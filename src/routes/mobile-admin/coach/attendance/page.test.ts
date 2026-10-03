import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AttendancePage from './+page.svelte';
import { toasts } from '$lib/mobile-admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { ApiCoach } from '$lib/public/api';
import type { TodaySessionResponse } from '$lib/api/wire';

/* R15 Task 3a(候選 轉手退役)：getAttendance/saveAttendance 原經 mobile-admin/api.ts 零映射
 * re-export，已退役，本頁直取 $lib/coach/api 實作，改 mock $lib/api/client 的 api()，讓它們走真實
 * fetch adapter；教練身分(requireCoach)真經 loginAs() 驅動，每個測試先登出再登入避免
 * session 閘門快取跨測試殘留(同 coach/page.test.ts 慣例)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const ME: TestUser = { id: 'u-c1', email: 'c1@test.com', name: '測試教練', phone: null, last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: ApiCoach = { id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' };

interface WireRosterEntry { enrolment_id: string; user_id: string; user_name: string; attendance_status: 'present' | 'absent' | 'leave' | null }

// 兩堂課同一天，證明「切換班級」FilterChips 恢復多選功能(舊 mock 因限制只給一堂課)。
const SESSION_1 = { id: 's1', course_id: 'c1', course_name: '測試班甲', coach_name: null, start_time: '19:00:00', end_time: '20:30:00', enrolled_count: 2, venue: null, status: 'upcoming' } satisfies TodaySessionResponse;
const SESSION_2 = { id: 's2', course_id: 'c2', course_name: '測試班乙', coach_name: null, start_time: '20:00:00', end_time: '21:00:00', enrolled_count: 1, venue: null, status: 'upcoming' } satisfies TodaySessionResponse;
const ROSTER_1: WireRosterEntry[] = [
	{ enrolment_id: 'T-001', user_id: 'zu1', user_name: '測試學員甲', attendance_status: 'present' },
	{ enrolment_id: 'T-002', user_id: 'zu2', user_name: '測試學員乙', attendance_status: 'leave' }
];
const ROSTER_2: WireRosterEntry[] = [{ enrolment_id: 'T-003', user_id: 'zu3', user_name: '測試學員丙', attendance_status: 'absent' }];

const defaultRoutes = (sessions: TodaySessionResponse[] = [SESSION_1, SESSION_2]) => ({
	'GET /users/me': ME,
	'GET /coaches': [MY_COACH],
	'GET /sessions/today': sessions,
	'GET /sessions/s1/roster': ROSTER_1,
	'GET /sessions/s2/roster': ROSTER_2
});

/** PUT /sessions/{id}/attendance 送出的 body({records:[{enrolment_id,status}]})——取代
 *  原本直接斷言 saveAttendance(對現在的真實函式)呼叫參數的作法。 */
function putBody(path: string): { records: { enrolment_id: string; status: string }[] } | undefined {
	const call = vi.mocked(api).mock.calls.find(([p, init]) => p === path && init?.method === 'PUT');
	return call ? JSON.parse((call[1]?.body as string) ?? '{}') : undefined;
}

// 每個測試先登出再登入(同 coach/page.test.ts 慣例):避免同一個 ME 連續 loginAs 不觸發
// identity 變更、教練身分閘門快取跨測試殘留。
beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(ME);
	vi.mocked(api).mockImplementation(fakeRouter(defaultRoutes()));
});

describe('mobile-admin/coach/attendance 頁', () => {
	it('loading 分支顯示骨架(data-testid="attendance-skeleton")', () => {
		// 只讓兩支名冊端點卡住(身分/今日場次照常回應，理由同 coach/page.test.ts 的
		// loading 測試註解——避免教練身分閘門的在飛 hydrate() 被卡死拖累後續測試)。
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...defaultRoutes(), 'GET /sessions/s1/roster': () => new Promise(() => {}), 'GET /sessions/s2/roster': () => new Promise(() => {}) })
		);
		const { container } = render(AttendancePage);
		expect(container.querySelector('[data-testid="attendance-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示第一堂課的名冊(相異 fixture，真 GET /sessions/today × roster)', async () => {
		const { findByText } = render(AttendancePage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
	});

	it('切換班級恢復多選功能(今日多堂課皆可點名，不再只鎖死單一硬編班級)', async () => {
		const { findByText, getByText, queryByText } = render(AttendancePage);
		await findByText('測試學員甲');
		expect(getByText('19:00 測試班甲')).toBeInTheDocument();
		expect(getByText('20:00 測試班乙')).toBeInTheDocument();

		await fireEvent.click(getByText('20:00 測試班乙'));
		expect(await findByText('測試學員丙')).toBeInTheDocument();
		expect(queryByText('測試學員甲')).toBeNull();
	});

	it('同日兩場同課名：第二場 chip 可選取並切到其名冊(selectClass 走 session id，0014 限制撤銷)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(defaultRoutes([SESSION_1, { ...SESSION_2, course_name: '測試班甲' }])));
		const { findByText, getByText, queryByText } = render(AttendancePage);
		await findByText('測試學員甲');
		// 兩顆 chip 同課名，靠 labelOf 的時間前綴區分顯示；選取靠 session id 分流。
		await fireEvent.click(getByText('20:00 測試班甲'));
		expect(await findByText('測試學員丙')).toBeInTheDocument(); // 第二場名冊
		expect(queryByText('測試學員甲')).toBeNull(); // 不是停在第一場
	});

	it('點名狀態切換仍正常運作(既有行為不變)', async () => {
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');
		await fireEvent.click(getAllByText('缺席')[0]);
		expect(getByText('儲存點名')).toBeInTheDocument();
	});

	it('儲存點名真打 PUT /sessions/{id}/attendance(saveAttendance)，並以伺服器回傳名冊同步', async () => {
		const savedRoster: WireRosterEntry[] = [
			{ enrolment_id: 'T-001', user_id: 'zu1', user_name: '測試學員甲', attendance_status: 'absent' },
			{ enrolment_id: 'T-002', user_id: 'zu2', user_name: '測試學員乙', attendance_status: 'leave' }
		];
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': savedRoster }));
		const { findByText, getByText, getAllByText } = render(AttendancePage);
		await findByText('測試學員甲');

		// getAllByText('缺席') 命中兩處:出勤統計卡的分類標籤(非按鈕)與名冊列(唯一
		// 非請假狀態、有按鈕)的實際狀態切換鈕——取索引 [1] 才是真正可點擊的那顆。
		await fireEvent.click(getAllByText('缺席')[1]);
		await fireEvent.click(getByText('儲存點名'));

		expect(await findByText('點名已儲存')).toBeInTheDocument();
		expect(putBody('/sessions/s1/attendance')?.records).toContainEqual({ enrolment_id: 'T-001', status: 'absent' });
		// 釘住完整成功 toast 文案（含時間前綴，同舊版格式）——防止日後把 label 換回
		// SaveOutcome.className（只有課名、沒有時間）而悄悄漂移。
		expect(get(toasts).some((t) => t.title === '點名已儲存' && t.body === '19:00 測試班甲 · 2 位學員出勤已記錄。')).toBe(true);
	});

	it('手機頁提供「請假」，點選後 PUT status=leave(不再只有出席/遲到/缺席)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': ROSTER_1 }));
		const { findByText, getByText, getAllByText, queryByText } = render(AttendancePage);
		await findByText('測試學員甲');
		expect(queryByText('遲到')).toBeNull();

		// 統計卡 [0] 為標籤、名冊列按鈕在後；T-001(甲)為第一列，唯一有請假鈕的列(乙已請假只顯示徽章)。
		const leaveBtn = getAllByText('請假').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(leaveBtn!);
		await fireEvent.click(getByText('儲存點名'));

		await vi.waitFor(() => expect(putBody('/sessions/s1/attendance')).toBeDefined());
		expect(putBody('/sessions/s1/attendance')?.records).toContainEqual({ enrolment_id: 'T-001', status: 'leave' });
	});

	it('「已請假」徽章只看名冊(r.def)：本地點選請假不會把分段鈕換成徽章', async () => {
		const { findByText, getAllByText, queryAllByText } = render(AttendancePage);
		await findByText('測試學員甲');
		expect(getAllByText('已請假')).toHaveLength(1); // 只有名冊本就請假的乙

		const leaveBtn = getAllByText('請假').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(leaveBtn!);

		expect(queryAllByText('已請假')).toHaveLength(1); // 甲仍可再改選，沒有被換成徽章
		expect(getAllByText('出席').some((el) => el.tagName === 'BUTTON')).toBe(true);
	});

	it('備註 Sheet 明示「僅存本機，重新整理後會消失」；已儲存後只改備註仍顯示「點名已儲存」(D1)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': ROSTER_1 }));
		const { findByText, getByText, getAllByText, getByPlaceholderText } = render(AttendancePage);
		await findByText('測試學員甲');
		await fireEvent.click(getByText('儲存點名'));
		expect(await findByText('點名已儲存')).toBeInTheDocument();

		await fireEvent.click(getAllByText('備註')[0]);
		expect(getByText('僅存本機，重新整理後會消失')).toBeInTheDocument();
		await fireEvent.input(getByPlaceholderText('例如：後手翻保護需加強、家長提醒早退…'), { target: { value: '早退' } });
		await fireEvent.click(getByText('儲存備註'));

		expect(await findByText('早退')).toBeInTheDocument(); // 備註預覽
		expect(getByText('點名已儲存')).toBeInTheDocument(); // 未被打回「儲存點名」
	});

	it('儲存失敗顯示錯誤提示，不假裝成功', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': new Error('boom') }));
		const { findByText, getByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		await vi.waitFor(() => expect(get(toasts).some((t) => t.title === '儲存失敗')).toBe(true));
		expect(getByText('儲存點名')).toBeInTheDocument(); // 未切換成「已儲存」字樣
	});

	// R15(候選 點名文案，bug #5)：標題照舊「儲存失敗」，內文依狀態碼分流(同桌面
	// coach/attendance/+page.svelte 的 attendanceErrorMessage)。
	it('403(非本課教練) → 儲存失敗 toast 內文顯示「沒有權限為此堂課點名。」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': new ApiError(403, 'forbidden') }));
		const { findByText, getByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		await vi.waitFor(() => expect(get(toasts).some((t) => t.title === '儲存失敗' && t.body === '沒有權限為此堂課點名。')).toBe(true));
	});

	it('404(場次不存在) → 儲存失敗 toast 內文顯示「找不到此場次，請重新整理頁面後再試。」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': new ApiError(404, 'session not found') }));
		const { findByText, getByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		await vi.waitFor(() => expect(get(toasts).some((t) => t.title === '儲存失敗' && t.body === '找不到此場次，請重新整理頁面後再試。')).toBe(true));
	});

	it('422(驗證失敗) → 儲存失敗 toast 內文顯示「點名資料有誤，本次變更未儲存，請重新整理後再試。」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': new ApiError(422, 'invalid status') }));
		const { findByText, getByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		await vi.waitFor(() => expect(get(toasts).some((t) => t.title === '儲存失敗' && t.body === '點名資料有誤，本次變更未儲存，請重新整理後再試。')).toBe(true));
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'GET /sessions/today': new Error('boom') }));
		const { findByText } = render(AttendancePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('CoachNotFoundError 顯示「此帳號未綁定教練檔案」而非泛用載入失敗(C6)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [] }));
		const { findByText, queryByText } = render(AttendancePage);
		expect(await findByText('請聯繫系統管理員協助設定教練檔案。')).toBeInTheDocument();
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('今日無場次(classes 空集合)顯示空狀態，不當機', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(defaultRoutes([])));
		const { findByText } = render(AttendancePage);
		expect(await findByText('今日尚無場次')).toBeInTheDocument();
	});

	it('部分場次名冊載入失敗時顯示提示 toast，其餘場次仍可點名', async () => {
		const SESSION_3 = { id: 's3', course_id: 'c3', course_name: '測試班丙', coach_name: null, start_time: '08:00:00', end_time: '09:00:00', enrolled_count: 1, venue: null, status: 'done' } satisfies TodaySessionResponse;
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...defaultRoutes([SESSION_1, SESSION_2, SESSION_3]), 'GET /sessions/s3/roster': new Error('boom') })
		);
		const { findByText } = render(AttendancePage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(get(toasts).some((t) => t.title === '部分場次名冊載入失敗')).toBe(true);
	});

	it('切班保留未存草稿(甲班點缺席→切乙班→切回甲班，選取仍在且未觸發 save)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': [] }));
		const { getByText, getAllByText, findByText } = render(AttendancePage);
		await findByText('測試學員甲');

		// 甲班第一列(測試學員甲，預設 present)標記「缺席」——getAllByText('缺席') 命中
		// 兩處:統計卡標籤與名冊列按鈕，索引 [1] 才是可點擊的分段鈕(同既有測試慣例)。
		await fireEvent.click(getAllByText('缺席')[1]);

		// 切到乙班確認乙班名冊顯示，再切回甲班。
		await fireEvent.click(getByText('20:00 測試班乙'));
		await findByText('測試學員丙');
		await fireEvent.click(getByText('19:00 測試班甲'));
		await findByText('測試學員甲');

		// 切班本身未觸發 save；儲存後草稿(缺席)仍在，證明切班沒有丟棄未存變更。
		expect(putBody('/sessions/s1/attendance')).toBeUndefined();
		await fireEvent.click(getByText('儲存點名'));
		expect(putBody('/sessions/s1/attendance')?.records).toContainEqual({ enrolment_id: 'T-001', status: 'absent' });
	});

	it('儲存中切班被擋(save pending 時點乙班 chip → 仍顯示甲班名冊 + info toast)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...defaultRoutes(), 'PUT /sessions/s1/attendance': () => new Promise(() => {}) }) // 模擬請求進行中，永不 resolve
		);
		const { getByText, queryByText, findByText } = render(AttendancePage);
		await findByText('測試學員甲');

		await fireEvent.click(getByText('儲存點名'));
		expect(await findByText('儲存中…')).toBeInTheDocument();

		await fireEvent.click(getByText('20:00 測試班乙'));

		// 切班被擋:仍顯示甲班名冊，乙班名冊未出現;並跳 info toast 提示。
		expect(getByText('測試學員甲')).toBeInTheDocument();
		expect(queryByText('測試學員丙')).toBeNull();
		expect(get(toasts).some((t) => t.title === '儲存中')).toBe(true);
	});
});
