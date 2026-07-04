import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { COACH, TODAY_LABEL, TODAY_CLASSES, CONVERSATIONS } from '$lib/coach/data';
import { getDashboard } from '$lib/coach/api';
import { clockIn, clockOut } from '$lib/coach/clock';
import { toasts } from '$lib/coach/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/coach/api', () => ({ getDashboard: vi.fn() }));
vi.mock('$lib/coach/clock', () => ({ clockIn: vi.fn(), clockOut: vi.fn() }));

/* 儀表板(index)— welcome hero + next-class command bar + 4 欄 KpiCard + 今日課程表
 * /最新訊息/本週待辦。資料改由 getDashboard() 接縫載入,三態閘門(loading/error/
 * ready)。KPI 卡「待點名/學員出席率/待回覆訊息」原為頁面硬編字串,一併移入
 * payload — fixture 刻意用與 seed 不同的數字/日期標籤,證明頁面讀 payload 而非
 * 殘留硬編(todayLabel 也相異化,審查回修 Minor)。 */
const FIXTURE = {
	coach: COACH,
	todayLabel: '2099年12月31日 星期四(測試)',
	todayClasses: TODAY_CLASSES,
	conversations: CONVERSATIONS,
	pendingClasses: '9 班',
	attendanceRate: '11%',
	pendingReplies: '7 則'
};

beforeEach(() => {
	vi.mocked(getDashboard).mockReset();
	vi.mocked(getDashboard).mockResolvedValue(FIXTURE);
	vi.mocked(clockIn).mockReset();
	vi.mocked(clockOut).mockReset();
});

describe('/coach (+page) — 儀表板首頁', () => {
	it('renders the welcome hero with coach display name and the payload todayLabel', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		const txt = container.textContent ?? '';
		expect(txt).toContain(`早安，${COACH.display}`);
		// 日期標籤跟著 payload 走,不是殘留的 seed 值。
		expect(txt).toContain(FIXTURE.todayLabel);
		expect(txt).not.toContain(TODAY_LABEL);
	});

	it('renders every today class name in the 今日課程表 panel', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		const txt = container.textContent ?? '';
		for (const c of TODAY_CLASSES) expect(txt).toContain(c.name);
	});

	it('renders the KPI values from the payload, not the old hardcoded strings', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE.pendingClasses);
		expect(txt).toContain(FIXTURE.attendanceRate);
		expect(txt).toContain(FIXTURE.pendingReplies);
	});

	it('橫幅與優先排序 chips 的待點名/待回覆跟著 payload 走(審查回修:單一來源)', async () => {
		const { getByText, container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		const txt = container.textContent ?? '';
		// 歡迎橫幅:今天有 N 堂課，{pendingClasses}待點名。
		expect(txt).toContain(`今天有 ${TODAY_CLASSES.length} 堂課，${FIXTURE.pendingClasses}待點名`);
		// 優先排序 chips:待點名/待回覆由 payload 插值組字。
		expect(getByText(`待點名 ${FIXTURE.pendingClasses}`)).toBeInTheDocument();
		expect(getByText(`待回覆 ${FIXTURE.pendingReplies}`)).toBeInTheDocument();
		// 舊硬編字串('2 班'/'3 則' 版本)不得殘留。
		expect(txt).not.toContain('待點名 2 班');
		expect(txt).not.toContain('待回覆 3 則');
	});

	it('renders the first 3 conversations in 最新訊息', async () => {
		const { container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		const txt = container.textContent ?? '';
		for (const m of CONVERSATIONS.slice(0, 3)) expect(txt).toContain(m.name);
		// the 4th+ conversation should not appear in the 最新訊息 panel.
		if (CONVERSATIONS.length > 3) expect(txt).not.toContain(CONVERSATIONS[3].preview);
	});

	it('the 本週待辦 checklist toggles a todo item', async () => {
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
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

	it('myCoachProfile 找不到教練檔案時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		vi.mocked(getDashboard).mockReset();
		const notFound = new Error('此帳號未綁定教練檔案');
		notFound.name = 'CoachNotFoundError';
		vi.mocked(getDashboard).mockRejectedValue(notFound);
		const { findByText, queryByText } = render(CoachHomePage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getDashboard).mockReset();
		vi.mocked(getDashboard).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CoachHomePage);
		expect(getByTestId('coach-home-skeleton')).toBeTruthy();
	});
});

describe('/coach — 上班/下班打卡', () => {
	it('點擊「上班打卡」呼叫 clockIn(coach.id)，成功後切換為「下班打卡」', async () => {
		vi.mocked(clockIn).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: null, note: null, created_at: '' });
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);

		await fireEvent.click(getByText('上班打卡'));

		expect(clockIn).toHaveBeenCalledWith(FIXTURE.coach.id);
		expect(await findByText('下班打卡')).toBeInTheDocument();
	});

	it('已在上班中(後端 409)時顯示「已在上班中」toast，並將按鈕視為已上班', async () => {
		vi.mocked(clockIn).mockRejectedValue(new ApiError(409, 'already clocked in'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);

		await fireEvent.click(getByText('上班打卡'));

		expect(await findByText('下班打卡')).toBeInTheDocument(); // 本地狀態用回應校正
		expect(notifySpy).toHaveBeenCalledWith('error', '已在上班中', expect.any(String));
	});

	it('點擊「下班打卡」呼叫 clockOut(coach.id)，成功後切換回「上班打卡」', async () => {
		vi.mocked(clockIn).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: null, note: null, created_at: '' });
		vi.mocked(clockOut).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: '', note: null, created_at: '' });
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		await fireEvent.click(getByText('上班打卡'));
		await findByText('下班打卡');

		await fireEvent.click(getByText('下班打卡'));

		expect(clockOut).toHaveBeenCalledWith(FIXTURE.coach.id);
		expect(await findByText('上班打卡')).toBeInTheDocument();
	});
});
