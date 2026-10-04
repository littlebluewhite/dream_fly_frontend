import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { memberReport, myEnrolment, myScheduleEntry } from '$lib/testing/wire-fixtures';

// W4d：只假造 HTTP(api())，真 mobile getMine + 桌面 getter/mapper 跑起來；畫面文字斷言不變。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* Task 1(C2 死種子退役):mobile/data.ts 的 MY_COURSES/SCHEDULE(值)已退役——改為
 * 檔內 inline fixture。無任何斷言檢查這兩者的具體內容(各 it() 若需要特定內容
 * 一律用自己的「相異 fixture」覆寫,同 CATALOG 退役後的既有模式)。
 * W4d：fixture 改成 wire 輸入；SCHEDULE 的 day_of_week 2 = 週二(後端 0=日…6=六)。 */
const MY_COURSES = [myEnrolment({ id: 'k1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', attended: 23, total: 24 })];
const SCHEDULE = [myScheduleEntry({ course_name: '競技啦啦隊 進階班', day_of_week: 2, venue: 'A 訓練館', coach_name: '林雅婷' })];

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(over, {
			'GET /enrolments/me': MY_COURSES,
			'GET /schedule/me': SCHEDULE,
			'GET /reports/me': memberReport({ attendance_rate: 0.95, upcoming_sessions_7d: 14, attended_total: 8 })
		})
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('我的課程頁 — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="mine-skeleton")', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="mine-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /enrolments/me': new Error('boom') });
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示報名課程與摘要統計(相異 fixture 證明資料來自接縫,非直接 import seed)', async () => {
		route({
			'GET /enrolments/me': [
				myEnrolment({ id: 'zz1', course_name: '接縫測試專用課程', course_level: 'advanced', schedule_text: '週日 09:00–10:00', attended: 7, total: 9 })
			],
			'GET /reports/me': memberReport({ attendance_rate: 0.77, upcoming_sessions_7d: 3, attended_total: 2 })
		});

		render(Page);

		expect(await screen.findByText('接縫測試專用課程')).toBeInTheDocument();
		expect(screen.getByText('77%')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('7 日內場次')).toBeInTheDocument();
		expect(screen.getByText('累計出席')).toBeInTheDocument();
		// R16 Task 2c:後端沒有季別,標題不再接「 · 季別」。
		expect(screen.getByText('本季報名 1 門')).toBeInTheDocument();
	});

	it('attendanceRate 為 null(無出勤資料，裁決 3)時顯示「—」，不是 0%(顯示層判斷，api.ts 原樣透傳)', async () => {
		route({ 'GET /reports/me': memberReport({ attendance_rate: null }) });
		render(Page);
		expect(await screen.findByText('—')).toBeInTheDocument();
		expect(screen.queryByText('0%')).toBeNull();
	});

	it('報名課程為空陣列時顯示 MEmpty,不留白也不拋例外', async () => {
		route({ 'GET /enrolments/me': [], 'GET /reports/me': memberReport({ attendance_rate: 0 }) });
		render(Page);
		expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
		expect(screen.getByText('本季報名 0 門')).toBeInTheDocument();
	});
});

describe('我的課程頁 — 本週日程星期索引對齊 mapper(0=一)(#18)', () => {
	it('週一的課要出現,且標示為「週一」', async () => {
		route({ 'GET /schedule/me': [myScheduleEntry({ course_name: '週一專屬課', day_of_week: 1 })] });
		render(Page);
		expect(await screen.findByText('週一專屬課')).toBeInTheDocument();
		expect(screen.getByText('週一')).toBeInTheDocument();
	});

	it('同一天兩堂課不會炸(each key 不可用 day 重複)', async () => {
		route({
			'GET /schedule/me': [
				myScheduleEntry({ course_name: '週三早課', day_of_week: 3, start_time: '09:00:00', end_time: '10:00:00' }),
				myScheduleEntry({ course_name: '週三晚課', day_of_week: 3, start_time: '19:00:00', end_time: '20:00:00' })
			]
		});
		render(Page);
		expect(await screen.findByText('週三早課')).toBeInTheDocument();
		expect(screen.getByText('週三晚課')).toBeInTheDocument();
	});
});
