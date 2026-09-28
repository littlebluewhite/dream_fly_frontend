import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScheduleScreen from './ScheduleScreen.svelte';
import { getSchedule } from '$lib/member/api';
import type { Tone } from '$lib/api/wire';

/* Task 19 — ScheduleScreen 改真後端(復用 getSchedule()，Task 9 週課表 seam)，
 * 取代先前直接 import 的 mock SCHEDULE 常數。Task 7(架構深化 R15·F-4)：
 * mobile/api.ts 原本的純轉手 getSchedule() 已退役，本畫面直取桌面 seam，mock
 * 目標同步改到擁有者模組。 */
vi.mock('$lib/member/api', () => ({ getSchedule: vi.fn() }));

const FIXTURE = [
	{ day: 1, start: '19:00', end: '20:30', name: '接縫測試專用課程', room: 'Z 教室', coach: '測試教練', color: '#0066CC', tone: 'primary' as Tone }
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
