import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachHomePage from './+page.svelte';
import { COACH, TODAY_LABEL } from '$lib/coach/data';
import type { TodayClass, Conversation } from '$lib/coach/data';
import { getDashboard } from '$lib/coach/api';
import { clockIn, clockOut, isClockedIn } from '$lib/coach/clock';
import { toasts } from '$lib/coach/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/coach/api', () => ({ getDashboard: vi.fn() }));
vi.mock('$lib/coach/clock', () => ({ clockIn: vi.fn(), clockOut: vi.fn(), isClockedIn: vi.fn() }));

/* 儀表板(index)— welcome hero + next-class command bar + 4 欄 KpiCard + 今日課程表
 * /最新訊息/本週待辦。資料改由 getDashboard() 接縫載入,三態閘門(loading/error/
 * ready)。KPI 卡「待點名/學員出席率/待回覆訊息」原為頁面硬編字串,一併移入
 * payload — fixture 刻意用與 seed 不同的數字/日期標籤,證明頁面讀 payload 而非
 * 殘留硬編(todayLabel 也相異化,審查回修 Minor)。
 *
 * Task 1(C2 死種子退役):coach/data.ts 的 TODAY_CLASSES/CONVERSATIONS(值)已退役——
 * 改為檔內 inline fixture(今日課程 3 筆、對話 4 筆;對話用真接縫 mapConversation 形狀
 * ——kind「會員」,證明頁面讀 payload 而非殘留 seed)。 */
const TODAY_CLASSES: TodayClass[] = [
	{ id: 'tc1', start: '09:00', end: '10:00', name: '兒童體操初級班', room: '主場館 A 教室', count: 12, level: '入門', cat: '體操', status: 'done' },
	{ id: 'tc2', start: '10:30', end: '11:30', name: '青少年體操中級班', room: '主場館 B 教室', count: 8, level: '基礎', cat: '體操', status: 'live' },
	{ id: 'tc3', start: '11:45', end: '12:45', name: '幼兒體操啟蒙班', room: '主場館 A 教室', count: 10, level: '啟蒙', cat: '體操', status: 'soon' }
];
const CONVERSATIONS: Conversation[] = [
	{ id: 'cv1', name: '張大文', initial: '張', color: '#0066CC', kind: '會員', time: '2026-07-05 09:42', badge: 3, preview: '教練這週六可以加練嗎？', sla: '', slaTone: 'muted' },
	{ id: 'cv2', name: '劉品妍', initial: '劉', color: '#0066CC', kind: '會員', time: '2026-07-05 09:20', badge: 0, preview: '謝謝老師的指導！', sla: '', slaTone: 'muted' },
	{ id: 'cv3', name: '周宜蓁', initial: '周', color: '#0066CC', kind: '會員', time: '2026-07-04 18:05', badge: 1, preview: '想請問補課的時間', sla: '', slaTone: 'muted' },
	{ id: 'cv4', name: '鄭凱文', initial: '鄭', color: '#0066CC', kind: '會員', time: '2026-07-04 12:30', badge: 0, preview: '孩子明天想請假一次', sla: '', slaTone: 'muted' }
];
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
	vi.mocked(isClockedIn).mockReset();
	vi.mocked(isClockedIn).mockResolvedValue(false);
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
		expect(txt).not.toContain('（李教練）');
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

	it('沒有對話時,最新訊息面板顯示「尚無訊息」空狀態', async () => {
		vi.mocked(getDashboard).mockResolvedValue({ ...FIXTURE, conversations: [] });
		const { container, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		expect(container.textContent ?? '').toContain('尚無訊息');
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
	it('進頁面時查詢開機狀態：最新打卡紀錄未結束 → 直接顯示「下班打卡」(重新整理不再誤顯示尚未打卡)', async () => {
		vi.mocked(isClockedIn).mockResolvedValue(true);
		const { findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);

		expect(await findByText('下班打卡')).toBeInTheDocument();
		expect(isClockedIn).toHaveBeenCalledWith(FIXTURE.coach.id);
	});

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

	it('尚未上班(後端 404)時顯示「尚未上班」toast，並將按鈕視為已下班', async () => {
		vi.mocked(isClockedIn).mockResolvedValue(true);
		vi.mocked(clockOut).mockRejectedValue(new ApiError(404, 'no active clock-in record found'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { getByText, findByText } = render(CoachHomePage);
		await findByText(FIXTURE.todayLabel);
		expect(await findByText('下班打卡')).toBeInTheDocument();

		await fireEvent.click(getByText('下班打卡'));

		expect(await findByText('上班打卡')).toBeInTheDocument();
		expect(notifySpy).toHaveBeenCalledWith('error', '尚未上班', expect.any(String));
	});
});
