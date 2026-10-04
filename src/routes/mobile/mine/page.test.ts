import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getMine } from '$lib/mobile/api';
import type { EnrolledCourse as MyCourse } from '$lib/domain/member-app';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import { myScheduleEntry } from '$lib/testing/wire-fixtures';

vi.mock('$lib/mobile/api', () => ({ getMine: vi.fn() }));
// #18 的案例要走真 mapper：只假造 HTTP(api())，getMine 改委派真實實作。
// 其餘案例的整檔遷移留待 Task 8。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* Task 1(C2 死種子退役):mobile/data.ts 的 MY_COURSES/SCHEDULE(值)已退役——改為
 * 檔內 inline fixture。無任何斷言檢查這兩者的具體內容(各 it() 若需要特定內容
 * 一律用自己的「相異 fixture」覆寫,同 CATALOG 退役後的既有模式),故 SCHEDULE
 * 沿用檔案其餘「相異 fixture」區塊的既有寫法,不額外標註型別。 */
const MY_COURSES: MyCourse[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', level: '進階', icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', att: 98, attended: 23, total: 24 }
];
const SCHEDULE = [
	{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' }
];

beforeEach(() => {
	vi.mocked(getMine).mockReset();
	vi.mocked(getMine).mockResolvedValue({
		courses: MY_COURSES,
		schedule: SCHEDULE,
		attendanceRate: 0.95,
		upcomingSessions7d: 14,
		attendedTotal: 8
	});
});

describe('我的課程頁 — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="mine-skeleton")', () => {
		vi.mocked(getMine).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="mine-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getMine).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示報名課程與摘要統計(相異 fixture 證明資料來自接縫,非直接 import seed)', async () => {
		const fixture = {
			courses: [
				{
					id: 'zz1',
					name: '接縫測試專用課程',
					level: '進階',
					icon: 'medal' as const,
					color: '#123456',
					schedule: '週日 09:00–10:00',
					att: 60,
					attended: 7,
					total: 9
				}
			],
			schedule: SCHEDULE,
			attendanceRate: 0.77,
			upcomingSessions7d: 3,
			attendedTotal: 2
		};
		vi.mocked(getMine).mockResolvedValue(fixture);

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
		vi.mocked(getMine).mockResolvedValue({
			courses: MY_COURSES,
			schedule: SCHEDULE,
			attendanceRate: null,
			upcomingSessions7d: 0,
			attendedTotal: 0
		});
		render(Page);
		expect(await screen.findByText('—')).toBeInTheDocument();
		expect(screen.queryByText('0%')).toBeNull();
	});

	it('報名課程為空陣列時顯示 MEmpty,不留白也不拋例外', async () => {
		vi.mocked(getMine).mockResolvedValue({
			courses: [],
			schedule: SCHEDULE,
			attendanceRate: 0,
			upcomingSessions7d: 0,
			attendedTotal: 0
		});
		render(Page);
		expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
		expect(screen.getByText('本季報名 0 門')).toBeInTheDocument();
	});
});

describe('我的課程頁 — 本週日程星期索引對齊 mapper(0=一)(#18)', () => {
	const useRealMine = async (schedule: ReturnType<typeof myScheduleEntry>[]) => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': schedule }, MEMBER_ROUTES));
		const actual = await vi.importActual<typeof import('$lib/mobile/api')>('$lib/mobile/api');
		vi.mocked(getMine).mockImplementation(actual.getMine);
	};

	it('週一的課要出現,且標示為「週一」', async () => {
		await useRealMine([myScheduleEntry({ course_name: '週一專屬課', day_of_week: 1 })]);
		render(Page);
		expect(await screen.findByText('週一')).toBeInTheDocument();
	});

	it('同一天兩堂課不會炸(each key 不可用 day 重複)', async () => {
		await useRealMine([
			myScheduleEntry({ course_name: '週三早課', day_of_week: 3, start_time: '09:00:00', end_time: '10:00:00' }),
			myScheduleEntry({ course_name: '週三晚課', day_of_week: 3, start_time: '19:00:00', end_time: '20:00:00' })
		]);
		render(Page);
		expect(await screen.findByText('週三早課')).toBeInTheDocument();
		expect(screen.getByText('週三晚課')).toBeInTheDocument();
	});
});
