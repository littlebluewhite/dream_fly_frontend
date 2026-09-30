import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import type { ApiTodaySession } from '$lib/api/wire';
import { todayLabel } from '$lib/coach/schedule-dates';
import { clockIn, clockOut, isClockedIn } from '$lib/coach/clock';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER, COACH_FIXTURE } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getDashboard() 走真實 fetch
 * adapter；教練身分(requireCoach)經 loginAs() 驅動，每個測試先登出再登入避免 session
 * 閘門快取跨測試殘留(同 mobile-admin/coach/page.test.ts 慣例)。打卡(clock)仍整支
 * mock——它不是 $lib/coach/api，本任務不動。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});
vi.mock('$lib/coach/clock', () => ({ clockIn: vi.fn(), clockOut: vi.fn(), isClockedIn: vi.fn() }));

/* 儀表板(index)— welcome hero + next-class command bar + 4 欄 KpiCard + 今日課程表
 * /最新訊息/本週待辦。資料由 getDashboard() 接縫載入,三態閘門(loading/error/
 * ready)。KPI 卡「待點名/學員出席率/待回覆訊息」原為頁面硬編字串,改讀
 * GET /reports/coach — fixture 刻意用與 seed 不同的數字,證明頁面讀 payload 而非
 * 殘留硬編。todayLabel 由真實日期算出,系統時鐘固定在 2099-12-31(與執行當天必然相異)。
 *
 * Task 1(C2 死種子退役):inline fixture(今日課程 3 筆、對話 4 筆)。R16 Task 8:改為
 * GET /sessions/today、GET /conversations/me 的 wire 形狀。 */
const REAL_TODAY_LABEL = todayLabel(); // 模組載入時(尚未 fake Date)的真實當日標籤
const NOW = new Date(2099, 11, 31, 11, 0, 0);
const TODAY_LABEL = todayLabel(NOW);
const COACH_DISPLAY = '林教練'; // COACH_USER.name 林雅婷 → 首字姓氏推導

const TODAY_CLASSES: ApiTodaySession[] = [
	{ id: 'tc1', course_id: 'c1', course_name: '兒童體操初級班', coach_name: null, start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 12, venue: '主場館 A 教室' },
	{ id: 'tc2', course_id: 'c2', course_name: '青少年體操中級班', coach_name: null, start_time: '10:30:00', end_time: '11:30:00', enrolled_count: 8, venue: '主場館 B 教室' },
	{ id: 'tc3', course_id: 'c3', course_name: '幼兒體操啟蒙班', coach_name: null, start_time: '11:45:00', end_time: '12:45:00', enrolled_count: 10, venue: '主場館 A 教室' }
];
const CONVERSATIONS = [
	{ id: 'cv1', peer_id: 'm1', peer_name: '張大文', last_message_body: '教練這週六可以加練嗎？', last_message_at: '2026-07-05T09:42:00Z', unread_count: 3 },
	{ id: 'cv2', peer_id: 'm2', peer_name: '劉品妍', last_message_body: '謝謝老師的指導！', last_message_at: '2026-07-05T09:20:00Z', unread_count: 0 },
	{ id: 'cv3', peer_id: 'm3', peer_name: '周宜蓁', last_message_body: '想請問補課的時間', last_message_at: '2026-07-04T18:05:00Z', unread_count: 1 },
	{ id: 'cv4', peer_id: 'm4', peer_name: '鄭凱文', last_message_body: '孩子明天想請假一次', last_message_at: '2026-07-04T12:30:00Z', unread_count: 0 }
];
const REPORTS = { today_sessions: 3, pending_attendance: 9, unread_messages: 7, student_count: 30, attendance_rate_30d: 0.11 };
// GET /reports/coach 經 getDashboard 映射後的 KPI 字面。
const FIXTURE = { pendingClasses: '9 班', attendanceRate: '11%', pendingReplies: '7 則' };

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(
			{ 'GET /sessions/today': TODAY_CLASSES, 'GET /reports/coach': REPORTS, 'GET /conversations/me': CONVERSATIONS, ...overrides },
			COACH_ROUTES
		)
	);

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
	vi.mocked(clockIn).mockReset();
	vi.mocked(clockOut).mockReset();
	vi.mocked(isClockedIn).mockReset();
	vi.mocked(isClockedIn).mockResolvedValue(false);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('/coach (+page) — 儀表板首頁', () => {
	it('renders the welcome hero with coach display name and the clock-derived todayLabel', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`早安，${COACH_DISPLAY}`);
		// 日期標籤跟著(固定的)系統時鐘走,不是殘留的 seed 值或執行當天。
		expect(txt).toContain(TODAY_LABEL);
		expect(txt).not.toContain(REAL_TODAY_LABEL);
		expect(txt).not.toContain('（李教練）');
	});

	it('renders every today class name in the 今日課程表 panel', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		for (const c of TODAY_CLASSES) expect(txt).toContain(c.course_name);
	});

	it('renders the KPI values from the payload, not the old hardcoded strings', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE.pendingClasses);
		expect(txt).toContain(FIXTURE.attendanceRate);
		expect(txt).toContain(FIXTURE.pendingReplies);
	});

	it('KPI 待回覆卡不再渲染硬編的「逾時」副標(R11 R1:SLA 概念後端不存在,恆假文案退役)', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE.pendingReplies); // 待回覆本體仍在(正斷言錨,防 render 失敗的空負斷言)
		expect(txt).not.toContain('逾時');
	});

	it('橫幅與優先排序 chips 的待點名/待回覆跟著 payload 走(審查回修:單一來源)', async () => {
		const { getByText, container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		// 歡迎橫幅:今天有 N 堂課，{pendingClasses}待點名。
		expect(txt).toContain(`今天有 ${TODAY_CLASSES.length} 堂課，${FIXTURE.pendingClasses}待點名`);
		// 優先排序 chips:待點名/待回覆由 payload 插值組字。
		expect(getByText(`待點名 ${FIXTURE.pendingClasses}`)).toBeInTheDocument();
		expect(getByText(`待回覆 ${FIXTURE.pendingReplies}`)).toBeInTheDocument();
		// 舊硬編字串('2 班'/'3 則' 版本)不得殘留。
		expect(txt).not.toContain('待點名 2 班');
		expect(txt).not.toContain('待回覆 3 則');
	});

	it('renders the first 3 conversations in 最新訊息', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		for (const m of CONVERSATIONS.slice(0, 3)) expect(txt).toContain(m.peer_name);
		// the 4th+ conversation should not appear in the 最新訊息 panel.
		if (CONVERSATIONS.length > 3) expect(txt).not.toContain(CONVERSATIONS[3].last_message_body);
	});

	it('沒有對話時,最新訊息面板顯示「尚無訊息」空狀態', async () => {
		route({ 'GET /conversations/me': [] });
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		expect(container.textContent ?? '').toContain('尚無訊息');
	});

	it('the 本週待辦 checklist toggles a todo item', async () => {
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const item = getByText('更新競技選手班評量');
		const checkbox = item.closest('label')?.querySelector('input[type="checkbox"]');
		expect(checkbox).toBeTruthy();
		expect((checkbox as HTMLInputElement).checked).toBe(false);
		await fireEvent.click(checkbox!);
		expect((checkbox as HTMLInputElement).checked).toBe(true);
	});
});

describe('/coach — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /reports/coach': new Error('network') });
		const { findByText } = render(CoachHomePage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError（查無教練檔案）時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		route({ 'GET /coaches': [] }); // 查無本人教練檔案 → 真 CoachNotFoundError
		const { findByText, queryByText } = render(CoachHomePage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		// 只讓報表端點卡住(身分照常回應，理由見 mobile-admin/coach/page.test.ts loading 註解)。
		route({ 'GET /reports/coach': () => new Promise(() => {}) });
		const { getByTestId } = render(CoachHomePage);
		expect(getByTestId('coach-home-skeleton')).toBeTruthy();
	});
});

describe('/coach — 上班/下班打卡', () => {
	it('進頁面時查詢開機狀態：最新打卡紀錄未結束 → 直接顯示「下班打卡」(重新整理不再誤顯示尚未打卡)', async () => {
		vi.mocked(isClockedIn).mockResolvedValue(true);
		const { findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);

		expect(await findByText('下班打卡')).toBeInTheDocument();
		expect(isClockedIn).toHaveBeenCalledWith(COACH_FIXTURE.id);
	});

	it('點擊「上班打卡」呼叫 clockIn(coach.id)，成功後切換為「下班打卡」', async () => {
		vi.mocked(clockIn).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: null, note: null, created_at: '' });
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);

		await fireEvent.click(getByText('上班打卡'));

		expect(clockIn).toHaveBeenCalledWith(COACH_FIXTURE.id);
		expect(await findByText('下班打卡')).toBeInTheDocument();
	});

	it('已在上班中(後端 409)時顯示「已在上班中」toast，並將按鈕視為已上班', async () => {
		vi.mocked(clockIn).mockRejectedValue(new ApiError(409, 'already clocked in'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);

		await fireEvent.click(getByText('上班打卡'));

		expect(await findByText('下班打卡')).toBeInTheDocument(); // 本地狀態用回應校正
		expect(notifySpy).toHaveBeenCalledWith('error', '已在上班中', expect.any(String));
	});

	it('點擊「下班打卡」呼叫 clockOut(coach.id)，成功後切換回「上班打卡」', async () => {
		vi.mocked(clockIn).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: null, note: null, created_at: '' });
		vi.mocked(clockOut).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: '', note: null, created_at: '' });
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		await fireEvent.click(getByText('上班打卡'));
		await findByText('下班打卡');

		await fireEvent.click(getByText('下班打卡'));

		expect(clockOut).toHaveBeenCalledWith(COACH_FIXTURE.id);
		expect(await findByText('上班打卡')).toBeInTheDocument();
	});

	it('尚未上班(後端 404)時顯示「尚未上班」toast，並將按鈕視為已下班', async () => {
		vi.mocked(isClockedIn).mockResolvedValue(true);
		vi.mocked(clockOut).mockRejectedValue(new ApiError(404, 'no active clock-in record found'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		expect(await findByText('下班打卡')).toBeInTheDocument();

		await fireEvent.click(getByText('下班打卡'));

		expect(await findByText('上班打卡')).toBeInTheDocument();
		expect(notifySpy).toHaveBeenCalledWith('error', '尚未上班', expect.any(String));
	});
});
