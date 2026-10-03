import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TodayPage from './+page.svelte';
import type { TodaySessionResponse } from '$lib/api/wire';
import { todayLabel } from '$lib/coach/schedule-dates';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getToday() 走真實 fetch
 * adapter；教練身分(requireCoach)經 loginAs() 驅動，每個測試先登出再登入避免 session
 * 閘門快取跨測試殘留(同 mobile-admin/coach/page.test.ts 慣例)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// todayLabel 由真實日期算出、吃系統時鐘，固定在本地 2026-05-30 11:00(只 fake Date，
// testing-library 的輪詢計時器照常)。場次狀態由後端 status 帶來(W-5)，不再吃時鐘。
const NOW = new Date(2026, 4, 30, 11, 0, 0);
const TODAY_LABEL = todayLabel(NOW);

// Task 1(C2 死種子退役):inline fixture(3 筆)。R16 Task 8:改為 GET /sessions/today 的
// wire 形狀；status 對齊 11:00 的牆鐘：tc1(09:00–10:00)=done、tc2(10:30–11:30)=ongoing、
// tc4(14:00–)=upcoming，涵蓋三態供下方 KPI/直播 banner 斷言。
const TODAY_CLASSES = [
	{ id: 'tc1', course_id: 'c1', course_name: '兒童體操初級班', coach_name: null, start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 12, venue: '主場館 A 教室', status: 'done' },
	{ id: 'tc2', course_id: 'c2', course_name: '青少年體操中級班', coach_name: null, start_time: '10:30:00', end_time: '11:30:00', enrolled_count: 8, venue: '主場館 B 教室', status: 'ongoing' },
	{ id: 'tc4', course_id: 'c4', course_name: '競技體操選手班', coach_name: null, start_time: '14:00:00', end_time: '15:30:00', enrolled_count: 6, venue: '競技訓練館', status: 'upcoming' }
] satisfies TodaySessionResponse[];
const DONE_COUNT = 1;

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /sessions/today': TODAY_CLASSES, ...overrides }, COACH_ROUTES));

beforeEach(async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(NOW);
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

afterEach(() => {
	vi.useRealTimers();
});

/* 今日課程 page — heading badge(TODAY_LABEL)+ live-class banner + KPI 3 欄 +
 * 今日課表/出勤進度/今日待辦/課堂提醒 panels。資料改由 getToday() 接縫載入(真 fetch adapter),三態
 * 閘門(loading/error/ready)。 */
describe('/coach/today (+page)', () => {
	it('renders the TODAY_LABEL badge and every class name', async () => {
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(TODAY_LABEL);
		for (const c of TODAY_CLASSES) expect(txt).toContain(c.course_name);
	});

	it('renders the live-class banner for the class currently in progress', async () => {
		const live = TODAY_CLASSES[1]; // status=ongoing → live
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`上課中：${live.course_name}`);
	});

	it('renders the 今日課程/已完成/學員總數 KPI numbers', async () => {
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const doneCount = DONE_COUNT;
		const totalCount = TODAY_CLASSES.reduce((sum, c) => sum + c.enrolled_count, 0);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`${TODAY_CLASSES.length} 堂`);
		expect(txt).toContain(`${doneCount} 堂`);
		expect(txt).toContain(`${totalCount} 位`);
	});

	it('零課程時(真資料下可能發生),今日進度/出勤進度顯示 0% 而非 NaN%', async () => {
		route({ 'GET /sessions/today': [] });
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		expect(container.textContent ?? '').toContain('今日進度 0%');
		// innerHTML 同時涵蓋文字與 style 屬性(出勤進度條的 width:{attendancePct}%)。
		expect(container.innerHTML).not.toContain('NaN');
	});

	it('沒有今日場次時，今日課表顯示「今日尚無場次」空狀態', async () => {
		route({ 'GET /sessions/today': [] });
		const { findByText } = render(TodayPage);
		await findByText('今日尚無場次');
	});
});

describe('/coach/today — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /sessions/today': new Error('network') });
		const { findByText } = render(TodayPage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError（查無教練檔案）時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		route({ 'GET /coaches': [] }); // 查無本人教練檔案 → 真 CoachNotFoundError
		const { findByText, queryByText } = render(TodayPage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		// 只讓今日場次端點卡住(身分照常回應，理由見 mobile-admin/coach/page.test.ts loading 註解)。
		route({ 'GET /sessions/today': () => new Promise(() => {}) });
		const { getByTestId } = render(TodayPage);
		expect(getByTestId('today-skeleton')).toBeTruthy();
	});
});
