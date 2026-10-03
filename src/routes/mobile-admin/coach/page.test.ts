import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { ApiCoach } from '$lib/public/api';
import type { TodaySessionResponse } from '$lib/api/wire';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getCoachHome()(組合器，
 * 3b 留任；轉呼叫 coach/api.ts 真 getDashboard())走真實 fetch adapter。教練身分由
 * coach/api.ts 內的 session 閘門快取，經真 authStore.login() 驅動(loginAs harness，
 * 見 $lib/testing/coach-session)，不是靠 module mock 偽造；每個測試各自 loginAs 避免
 * 身分快取跨測試殘留。taken(是否已點名)欄位無真實訊號可推導、getCoachHome 一律不設，
 * 頁面因此固定顯示「點名」按鈕分支——原 fixture 的 taken:true/false 已無意義，本檔
 * 未斷言該分支。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const ME: TestUser = { id: 'u-c1', email: 'c1@test.com', name: '測試教練', phone: null, last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: ApiCoach = { id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' };

// 3 堂課、共 30 位學員 — 與桌面 seed 慣例刻意不同,證明「今日課堂/今日學員」統計
// 讀 payload 動態算出,而非殘留頁面硬編字面。status 由後端帶來(W-5),狀態本身
// 這頁也不顯示(見上方模組註解),不影響本檔任何斷言。
const SESSIONS_TODAY = [
	{ id: 's1', course_id: 'c1', course_name: '測試班 A', coach_name: ME.name, start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 10, venue: '測試教室', status: 'ongoing' },
	{ id: 's2', course_id: 'c2', course_name: '測試班 B', coach_name: ME.name, start_time: '23:59:00', end_time: '23:59:59', enrolled_count: 10, venue: '測試教室', status: 'upcoming' },
	{ id: 's3', course_id: 'c3', course_name: '測試班 C', coach_name: ME.name, start_time: '23:59:58', end_time: '23:59:59', enrolled_count: 10, venue: '測試教室', status: 'upcoming' }
] satisfies TodaySessionResponse[];

const REPORTS = { today_sessions: 3, pending_attendance: 2, unread_messages: 4, student_count: 30, attendance_rate_30d: 0.9 };

const homeRoutes = (sessions: TodaySessionResponse[], reports = REPORTS) => ({
	'GET /users/me': ME,
	'GET /coaches': [MY_COACH],
	'GET /sessions/today': sessions,
	'GET /reports/coach': reports,
	'GET /conversations/me': []
});

// 每個測試先登出再登入(同 coach/api.test.ts 慣例):identity key = loggedIn ?
// member.id : null,強制經過 null 這個中繼態,才能保證教練身分閘門(session-gate)
// 真的重置——同一個 ME 連續 loginAs 兩次不會觸發 identity 變更,快取會跨測試殘留。
beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(ME);
	vi.mocked(api).mockImplementation(fakeRouter(homeRoutes(SESSIONS_TODAY)));
});

describe('mobile-admin/coach 頁(工作台首頁)', () => {
	it('loading 分支顯示骨架(data-testid="mcoach-home-skeleton")', () => {
		// 只讓 GET /sessions/today 卡住(其餘照常回應)——教練身分閘門(requireCoach)
		// 由 GET /users/me + GET /coaches 解析,若連身分都卡住,這支在飛的 hydrate()
		// 會被同模組後續測試的併發呼叫合併(見 coach/api.ts session 閘門「併發呼叫共用
		// 同一支在飛解析」設計)、永遠不落地,拖累同檔後面所有測試一起卡住。
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...homeRoutes(SESSIONS_TODAY), 'GET /sessions/today': () => new Promise(() => {}) })
		);
		const { container } = render(CoachHomePage);
		expect(container.querySelector('[data-testid="mcoach-home-skeleton"]')).not.toBeNull();
	});

	it('hero 顯示真實教練姓名(相異 fixture，非殘留的 PROFILES.coach mock)', async () => {
		const { findByText } = render(CoachHomePage);
		expect(await findByText('測教練，午安 👋')).toBeInTheDocument();
	});

	it('今日課堂/今日學員統計由 payload 的 coachToday 動態算出(單一來源)', async () => {
		const { findByText, getByText, container } = render(CoachHomePage);
		await findByText('測試班 A');
		// 3 堂課、30 位學員(10+10+10)
		expect(getByText(/今天有 3 堂課、30 位學員/)).toBeInTheDocument();
		expect(getByText(/你負責的 3 堂課/)).toBeInTheDocument();
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('我的學員');
	});

	it('待辦事項讀 payload 的真實 pendingClasses/pendingReplies 計數(GET /reports/coach)', async () => {
		const { findByText, queryByText } = render(CoachHomePage);
		await findByText('測試班 A');
		expect(await findByText('2 班 待點名')).toBeInTheDocument();
		expect(await findByText('4 則 訊息待回覆')).toBeInTheDocument();
		// 舊「技能評量待更新」提醒已隨假技能評量功能整個移除。
		expect(queryByText(/技能評量/)).toBeNull();
	});

	it('render 每堂今日課表', async () => {
		const { findByText } = render(CoachHomePage);
		await findByText('測試班 A');
		expect(await findByText('測試班 B')).toBeInTheDocument();
		expect(await findByText('測試班 C')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...homeRoutes(SESSIONS_TODAY), 'GET /reports/coach': new Error('boom') }));
		const { findByText } = render(CoachHomePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('找不到教練檔案(CoachNotFoundError)顯示對應錯誤訊息', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [] }));
		const { findByText } = render(CoachHomePage);
		expect(await findByText('此帳號未綁定教練檔案')).toBeInTheDocument();
	});

	it('coachToday 空集合不當機,統計顯示 0', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(homeRoutes([])));
		const { findAllByText } = render(CoachHomePage);
		expect((await findAllByText('0')).length).toBeGreaterThan(0);
	});
});
