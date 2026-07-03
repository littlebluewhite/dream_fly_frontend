import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { COACH, TODAY_LABEL, TODAY_CLASSES, CONVERSATIONS } from '$lib/coach/data';
import { getDashboard } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getDashboard: vi.fn() }));

/* 儀表板(index)— welcome hero + next-class command bar + 4 欄 KpiCard + 今日課程表
 * /最新訊息/本週待辦。資料改由 getDashboard() 接縫載入,三態閘門(loading/error/
 * ready)。KPI 卡「待點名/學員出席率/待回覆訊息」原為頁面硬編字串,一併移入
 * payload — fixture 刻意用與 seed 不同的數字,證明頁面讀 payload 而非殘留硬編。 */
const FIXTURE = {
	coach: COACH,
	todayLabel: TODAY_LABEL,
	todayClasses: TODAY_CLASSES,
	conversations: CONVERSATIONS,
	pendingClasses: '9 班',
	attendanceRate: '11%',
	pendingReplies: '7 則'
};

beforeEach(() => {
	vi.mocked(getDashboard).mockReset();
	vi.mocked(getDashboard).mockResolvedValue(FIXTURE);
});

describe('/coach (+page) — 儀表板首頁', () => {
	it('renders the welcome hero with coach display name and TODAY_LABEL', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`早安，${COACH.display}`);
		expect(txt).toContain(TODAY_LABEL);
	});

	it('renders every today class name in the 今日課程表 panel', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		for (const c of TODAY_CLASSES) expect(txt).toContain(c.name);
	});

	it('renders the KPI values from the payload, not the old hardcoded strings', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE.pendingClasses);
		expect(txt).toContain(FIXTURE.attendanceRate);
		expect(txt).toContain(FIXTURE.pendingReplies);
	});

	it('renders the first 3 conversations in 最新訊息', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const txt = container.textContent ?? '';
		for (const m of CONVERSATIONS.slice(0, 3)) expect(txt).toContain(m.name);
		// the 4th+ conversation should not appear in the 最新訊息 panel.
		if (CONVERSATIONS.length > 3) expect(txt).not.toContain(CONVERSATIONS[3].preview);
	});

	it('the 本週待辦 checklist toggles a todo item', async () => {
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(TODAY_LABEL);
		const item = getByText('更新競技選手班評量');
		const checkbox = item.closest('label')?.querySelector('input[type="checkbox"]');
		expect(checkbox).toBeTruthy();
		expect((checkbox as HTMLInputElement).checked).toBe(false);
		await fireEvent.click(checkbox!);
		expect((checkbox as HTMLInputElement).checked).toBe(true);
	});
});

describe('/coach — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getDashboard).mockReset();
		vi.mocked(getDashboard).mockRejectedValue(new Error('network'));
		const { findByText } = render(CoachHomePage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getDashboard).mockReset();
		vi.mocked(getDashboard).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CoachHomePage);
		expect(getByTestId('coach-home-skeleton')).toBeTruthy();
	});
});
