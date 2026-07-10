import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getMine } from '$lib/mobile/api';
import type { MyCourse } from '$lib/mobile/data';

vi.mock('$lib/mobile/api', () => ({ getMine: vi.fn() }));

/* Task 1(C2 死種子退役):mobile/data.ts 的 MY_COURSES/SCHEDULE(值)已退役——改為
 * 檔內 inline fixture。無任何斷言檢查這兩者的具體內容(各 it() 若需要特定內容
 * 一律用自己的「相異 fixture」覆寫,同 CATALOG 退役後的既有模式),故 SCHEDULE
 * 沿用檔案其餘「相異 fixture」區塊的既有寫法,不額外標註型別。 */
const MY_COURSES: MyCourse[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', cat: '競技啦啦隊', level: '進階', coach: '林雅婷', icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', room: 'A 訓練館', att: 98, attended: 23, total: 24, next: '明日 19:00', term: '2026 春季', remain: 14 }
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
					cat: '競技體操',
					level: '進階',
					coach: '測試教練',
					icon: 'medal',
					color: '#123456',
					schedule: '週日 09:00–10:00',
					room: 'Z 教室',
					att: 60,
					attended: 7,
					total: 9,
					next: '週日 09:00',
					term: '2026 測試季',
					remain: 3
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
		// 「本季報名 N 門 · 季別」的季別不再是硬編 '2026 春季',而是隨 courses[0].term 衍生。
		expect(screen.getByText('本季報名 1 門 · 2026 測試季')).toBeInTheDocument();
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
