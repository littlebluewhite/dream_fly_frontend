import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { getCoachHome } from '$lib/mobile-admin/api';
import type { Profile, TodayRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getCoachHome: vi.fn() }));

const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '測試教練', initial: '測', role: '測試教練職稱', desc: '', color: '#000', id: 'T-2' }
};
// 3 堂課、共 30 位學員 — 與 seed(COACH_TODAY: 2 堂 / 23 位)刻意不同,證明
// 「今日課堂/今日學員」統計讀 payload 動態算出,而非殘留頁面硬編的 2 / 23。
const FIXTURE_COACH_TODAY: TodayRow[] = [
	{ time: '09:00', name: '測試班 A', room: '測試教室', count: 10, tone: 'success', label: '進行中', taken: true },
	{ time: '11:00', name: '測試班 B', room: '測試教室', count: 10, tone: 'warning', label: '即將開始', taken: false },
	{ time: '13:00', name: '測試班 C', room: '測試教室', count: 10, tone: 'neutral', label: '尚未開始', taken: false }
];
const FIXTURE = { coachToday: FIXTURE_COACH_TODAY, profiles: FIXTURE_PROFILES };

beforeEach(() => {
	vi.mocked(getCoachHome).mockReset();
	vi.mocked(getCoachHome).mockResolvedValue(FIXTURE);
});

describe('mobile-admin/coach 頁(工作台首頁)', () => {
	it('loading 分支顯示骨架(data-testid="mcoach-home-skeleton")', () => {
		vi.mocked(getCoachHome).mockReturnValue(new Promise(() => {}));
		const { container } = render(CoachHomePage);
		expect(container.querySelector('[data-testid="mcoach-home-skeleton"]')).not.toBeNull();
	});

	it('今日課堂/今日學員統計改由 payload 的 coachToday 動態算出(單一來源,審查回修)', async () => {
		const { findByText, getByText, container } = render(CoachHomePage);
		await findByText('測試班 A');
		// 3 堂課、30 位學員(10+10+10)— 動態算出,不是殘留的舊硬編 2 / 23。
		expect(getByText(/今天有 3 堂課、30 位學員/)).toBeInTheDocument();
		expect(getByText(/你負責的 3 堂課/)).toBeInTheDocument();
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('今天有 2 堂課、23 位學員');
		expect(txt).not.toContain('你負責的 2 堂課');
	});

	it('render 每堂今日課表', async () => {
		const { findByText } = render(CoachHomePage);
		await findByText('測試班 A');
		expect(await findByText('測試班 B')).toBeInTheDocument();
		expect(await findByText('測試班 C')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCoachHome).mockRejectedValue(new Error('boom'));
		const { findByText } = render(CoachHomePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('coachToday 空集合不當機,統計顯示 0', async () => {
		vi.mocked(getCoachHome).mockResolvedValue({ coachToday: [], profiles: FIXTURE_PROFILES });
		const { findAllByText } = render(CoachHomePage);
		expect((await findAllByText('0')).length).toBeGreaterThan(0);
	});
});
