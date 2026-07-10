import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TodayPage from './+page.svelte';
import { TODAY_LABEL } from '$lib/coach/data';
import type { TodayClass } from '$lib/coach/data';
import { getToday } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getToday: vi.fn() }));

// Task 1(C2 死種子退役):coach/data.ts 的 TODAY_CLASSES(值)已退役——改為檔內
// inline fixture(3 筆,涵蓋 done/live/wait 三態,供下方 KPI/直播 banner 斷言)。
const TODAY_CLASSES: TodayClass[] = [
	{ id: 'tc1', start: '09:00', end: '10:00', name: '兒童體操初級班', room: '主場館 A 教室', count: 12, level: '入門', cat: '體操', status: 'done' },
	{ id: 'tc2', start: '10:30', end: '11:30', name: '青少年體操中級班', room: '主場館 B 教室', count: 8, level: '基礎', cat: '體操', status: 'live' },
	{ id: 'tc4', start: '14:00', end: '15:30', name: '競技體操選手班', room: '競技訓練館', count: 6, level: '選手', cat: '體操', status: 'wait' }
];

beforeEach(() => {
	vi.mocked(getToday).mockReset();
	vi.mocked(getToday).mockResolvedValue({ todayLabel: TODAY_LABEL, todayClasses: TODAY_CLASSES });
});

/* 今日課程 page — heading badge(TODAY_LABEL)+ live-class banner + KPI 3 欄 +
 * 今日課表/出勤進度/今日待辦/課堂提醒 panels。資料改由 getToday() 接縫載入,三態
 * 閘門(loading/error/ready)。 */
describe('/coach/today (+page)', () => {
	it('renders the TODAY_LABEL badge and every class name', async () => {
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(TODAY_LABEL);
		for (const c of TODAY_CLASSES) expect(txt).toContain(c.name);
	});

	it('renders the live-class banner for the class currently in progress', async () => {
		const live = TODAY_CLASSES.find((c) => c.status === 'live')!;
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`上課中：${live.name}`);
	});

	it('renders the 今日課程/已完成/學員總數 KPI numbers', async () => {
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		const doneCount = TODAY_CLASSES.filter((c) => c.status === 'done').length;
		const totalCount = TODAY_CLASSES.reduce((sum, c) => sum + c.count, 0);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`${TODAY_CLASSES.length} 堂`);
		expect(txt).toContain(`${doneCount} 堂`);
		expect(txt).toContain(`${totalCount} 位`);
	});

	it('零課程時(真資料下可能發生),今日進度/出勤進度顯示 0% 而非 NaN%', async () => {
		vi.mocked(getToday).mockReset();
		vi.mocked(getToday).mockResolvedValue({ todayLabel: TODAY_LABEL, todayClasses: [] });
		const { container, findByText } = render(TodayPage);
		await findByText(TODAY_LABEL);
		expect(container.textContent ?? '').toContain('今日進度 0%');
		// innerHTML 同時涵蓋文字與 style 屬性(出勤進度條的 width:{attendancePct}%)。
		expect(container.innerHTML).not.toContain('NaN');
	});

	it('沒有今日場次時，今日課表顯示「今日尚無場次」空狀態', async () => {
		vi.mocked(getToday).mockReset();
		vi.mocked(getToday).mockResolvedValue({ todayLabel: TODAY_LABEL, todayClasses: [] });
		const { findByText } = render(TodayPage);
		await findByText('今日尚無場次');
	});
});

describe('/coach/today — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getToday).mockReset();
		vi.mocked(getToday).mockRejectedValue(new Error('network'));
		const { findByText } = render(TodayPage);
		await findByText('載入失敗');
	});

	it('myCoachProfile 找不到教練檔案時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		vi.mocked(getToday).mockReset();
		const notFound = new Error('此帳號未綁定教練檔案');
		notFound.name = 'CoachNotFoundError';
		vi.mocked(getToday).mockRejectedValue(notFound);
		const { findByText, queryByText } = render(TodayPage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getToday).mockReset();
		vi.mocked(getToday).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(TodayPage);
		expect(getByTestId('today-skeleton')).toBeTruthy();
	});
});
