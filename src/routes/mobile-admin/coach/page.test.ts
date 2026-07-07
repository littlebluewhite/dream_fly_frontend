import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { getCoachHome, CoachNotFoundError } from '$lib/mobile-admin/api';
import type { TodayRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getCoachHome: vi.fn() };
});

// 3 堂課、共 30 位學員 — 與桌面 seed 慣例刻意不同,證明「今日課堂/今日學員」統計
// 讀 payload 動態算出,而非殘留頁面硬編字面。
const FIXTURE_COACH_TODAY: TodayRow[] = [
	{ time: '09:00', name: '測試班 A', room: '測試教室', count: 10, tone: 'success', label: '上課中', taken: true },
	{ time: '11:00', name: '測試班 B', room: '測試教室', count: 10, tone: 'warning', label: '即將開始', taken: false },
	{ time: '13:00', name: '測試班 C', room: '測試教室', count: 10, tone: 'neutral', label: '尚未開始', taken: false }
];
// coach 身分改用真實教練資料(取代舊 PROFILES.coach 固定假人名)，姓名刻意與
// PROFILES.coach.name(林雅婷)不同，證明頁面讀 payload 而非殘留 mock import。
const FIXTURE = {
	coach: { name: '測試教練', display: '測教練', initial: '測', role: '測試職稱', id: 'coach-1' },
	coachToday: FIXTURE_COACH_TODAY,
	pendingClasses: '2 班',
	pendingReplies: '4 則'
};

beforeEach(() => {
	vi.mocked(getCoachHome).mockReset();
	vi.mocked(getCoachHome).mockResolvedValue(FIXTURE as never);
});

describe('mobile-admin/coach 頁(工作台首頁)', () => {
	it('loading 分支顯示骨架(data-testid="mcoach-home-skeleton")', () => {
		vi.mocked(getCoachHome).mockReturnValue(new Promise(() => {}));
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
		vi.mocked(getCoachHome).mockRejectedValue(new Error('boom'));
		const { findByText } = render(CoachHomePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('找不到教練檔案(CoachNotFoundError)顯示對應錯誤訊息', async () => {
		vi.mocked(getCoachHome).mockRejectedValue(new CoachNotFoundError());
		const { findByText } = render(CoachHomePage);
		expect(await findByText('此帳號未綁定教練檔案')).toBeInTheDocument();
	});

	it('coachToday 空集合不當機,統計顯示 0', async () => {
		vi.mocked(getCoachHome).mockResolvedValue({ ...FIXTURE, coachToday: [] } as never);
		const { findAllByText } = render(CoachHomePage);
		expect((await findAllByText('0')).length).toBeGreaterThan(0);
	});
});
