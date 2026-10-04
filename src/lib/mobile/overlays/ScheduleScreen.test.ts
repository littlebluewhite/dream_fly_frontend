import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScheduleScreen from './ScheduleScreen.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { myScheduleEntry } from '$lib/testing/wire-fixtures';

/* Task 19 — ScheduleScreen 改真後端(復用 getSchedule()，Task 9 週課表 seam)，
 * 取代先前直接 import 的 mock SCHEDULE 常數。Task 7(架構深化 R15·F-4)：
 * mobile/api.ts 原本的純轉手 getSchedule() 已退役，本畫面直取桌面 seam，mock
 * 目標同步改到擁有者模組。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// W4d：只假造 HTTP(api())，真 getSchedule + mapper 跑起來；畫面文字斷言不變。
// 後端 day_of_week 1 = 週一 → mapper day 0（#18）。
const FIXTURE = myScheduleEntry({
	course_name: '接縫測試專用課程',
	day_of_week: 1,
	start_time: '19:00:00',
	end_time: '20:30:00',
	venue: 'Z 教室',
	coach_name: '測試教練'
});

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(over, { 'GET /schedule/me': [FIXTURE] }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('ScheduleScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="schedule-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /schedule/me': new Error('boom') });
		render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後依 day 分組顯示課表(資料來自接縫，非直接 import 的 mock 常數)', async () => {
		render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('接縫測試專用課程')).toBeInTheDocument();
		expect(screen.getByText('週一')).toBeInTheDocument();
		expect(screen.getByText('19:00–20:30')).toBeInTheDocument();
	});

	it('空課表顯示誠實的空狀態文字，不留白也不拋例外', async () => {
		route({ 'GET /schedule/me': [] });
		render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('目前沒有排定的每週課表。')).toBeInTheDocument();
	});
});

describe('ScheduleScreen — 星期索引對齊 mapper(0=一)(#18)', () => {
	it('週一的課要出現(後端 day_of_week=1 → mapper day=0 → 「週一」)', async () => {
		route({ 'GET /schedule/me': [myScheduleEntry({ course_name: '週一專屬課', day_of_week: 1 })] });

		render(ScheduleScreen, { props: { onBack: () => {} } });

		expect(await screen.findByText('週一專屬課')).toBeInTheDocument();
		expect(screen.getByText('週一')).toBeInTheDocument();
	});
});
