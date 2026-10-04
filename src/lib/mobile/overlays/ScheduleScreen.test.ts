import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScheduleScreen from './ScheduleScreen.svelte';
import { getSchedule } from '$lib/member/api';
import type { ScheduleBlock } from '$lib/member/data';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { myScheduleEntry } from '$lib/testing/wire-fixtures';

/* Task 19 — ScheduleScreen 改真後端(復用 getSchedule()，Task 9 週課表 seam)，
 * 取代先前直接 import 的 mock SCHEDULE 常數。Task 7(架構深化 R15·F-4)：
 * mobile/api.ts 原本的純轉手 getSchedule() 已退役，本畫面直取桌面 seam，mock
 * 目標同步改到擁有者模組。 */
vi.mock('$lib/member/api', () => ({ getSchedule: vi.fn() }));
// #18 的案例要走真 mapper：只假造 HTTP(api())，getSchedule 改委派真實實作。
// 其餘案例的整檔遷移留待 Task 8。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const FIXTURE: ScheduleBlock[] = [
	{ day: 0, start: '19:00', end: '20:30', name: '接縫測試專用課程', room: 'Z 教室', coach: '測試教練', color: '#0066CC', tone: 'primary' }
];

beforeEach(() => {
	vi.mocked(getSchedule).mockReset();
	vi.mocked(getSchedule).mockResolvedValue({ schedule: FIXTURE });
});

describe('ScheduleScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(getSchedule).mockReturnValue(new Promise(() => {}));
		const { container } = render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="schedule-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getSchedule).mockRejectedValue(new Error('boom'));
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
		vi.mocked(getSchedule).mockResolvedValue({ schedule: [] });
		render(ScheduleScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('目前沒有排定的每週課表。')).toBeInTheDocument();
	});
});

describe('ScheduleScreen — 星期索引對齊 mapper(0=一)(#18)', () => {
	it('週一的課要出現(後端 day_of_week=1 → mapper day=0 → 「週一」)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({}, { 'GET /schedule/me': [myScheduleEntry({ course_name: '週一專屬課', day_of_week: 1 })] }));
		const actual = await vi.importActual<typeof import('$lib/member/api')>('$lib/member/api');
		vi.mocked(getSchedule).mockImplementation(actual.getSchedule);

		render(ScheduleScreen, { props: { onBack: () => {} } });

		expect(await screen.findByText('週一專屬課')).toBeInTheDocument();
		expect(screen.getByText('週一')).toBeInTheDocument();
	});
});
