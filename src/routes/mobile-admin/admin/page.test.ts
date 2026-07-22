import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AdminHomePage from './+page.svelte';
import { getAdminHome, createMember } from '$lib/mobile-admin/api';
import { overlay, toasts } from '$lib/mobile-admin/stores';
import type { Profile, TodayRow, ActivityRow } from '$lib/mobile-admin/data';
import type { CreateMemberBody } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', () => ({ getAdminHome: vi.fn(), createMember: vi.fn() }));

const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '測試教練', initial: '測', role: '測試教練職稱', desc: '', color: '#000', id: 'T-2' }
};
// label 用 C4 正字「上課中」(SESSION_STATUS.live[1])——舊字面「進行中」是 admin 桌面
// 已淘汰的舊值，fixture 沿用舊字面會遮蔽 +page.svelte 的 liveNow 比對回歸(該比對值
// 若跟著改回硬編舊字面，這裡改用舊 fixture 也測不出來，見下方「進行中課堂橫幅」測試
// 的斷言強化)。
const FIXTURE_TODAY: TodayRow[] = [
	{ time: '08:00', name: '測試進行中班', coach: '測試教練甲', room: '測試教室', count: 5, tone: 'success', label: '上課中' },
	{ time: '10:00', name: '測試備課班', coach: '測試教練乙', room: '測試教室2', count: 3, tone: 'info', label: '備課中' }
];
const FIXTURE_ACTIVITY: ActivityRow[] = [
	{ icon: 'user-plus', tone: '#000', bg: '#fff', text: '測試動態一', time: '剛剛' },
	{ icon: 'credit-card', tone: '#000', bg: '#fff', text: '測試動態二', time: '5 分鐘前' }
];
// enrolledValue/revenueMonthValue 刻意與 seed 相異，證明頁面讀 payload（真
// GET /reports/admin），不是殘留的舊硬編字面(248 / NT$182K)。
const FIXTURE = {
	profiles: FIXTURE_PROFILES,
	today: FIXTURE_TODAY,
	activity: FIXTURE_ACTIVITY,
	enrolledValue: '999',
	revenueMonthValue: 'NT$999,000'
};

beforeEach(() => {
	vi.mocked(getAdminHome).mockReset();
	vi.mocked(getAdminHome).mockResolvedValue(FIXTURE);
	vi.mocked(createMember).mockReset();
	overlay.closeAll();
});

describe('mobile-admin/admin 頁(總覽首頁)', () => {
	it('loading 分支顯示骨架(data-testid="madmin-home-skeleton")', () => {
		vi.mocked(getAdminHome).mockReturnValue(new Promise(() => {}));
		const { container } = render(AdminHomePage);
		expect(container.querySelector('[data-testid="madmin-home-skeleton"]')).not.toBeNull();
	});

	it('Hero KPI(在學學員/本月營收)讀 payload(真 GET /reports/admin，相異 fixture)', async () => {
		const { findByText, container } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText('999')).toBeInTheDocument();
		expect(await findByText('NT$999,000')).toBeInTheDocument();
		const txt = container.textContent ?? '';
		// 已移除的兩張 KPI 卡(本週課堂/出席偏低)與硬編日期字面不應殘留。
		expect(txt).not.toContain('本週課堂');
		expect(txt).not.toContain('出席偏低');
		expect(txt).not.toContain('2026 年 6 月 10 日');
	});

	it('render 今日課表與進行中課堂橫幅(皆讀 payload 的 today)', async () => {
		const { findAllByText, findByText } = render(AdminHomePage);
		// 進行中的班級同時出現在「進行中課堂」橫幅與「今日課表」清單——但班名本身在
		// 「今日課表」清單一律會出現(不論是否 live)，只斷言班名出現無法證明橫幅真的
		// 渲染了；改斷言橫幅自己的靜態標題文字「● 進行中課堂」(只在 {#if liveNow} 為
		// true 時才會出現)，這才是可證偽的橫幅渲染檢查。
		expect((await findAllByText('測試進行中班')).length).toBeGreaterThan(0);
		expect(await findByText('● 進行中課堂')).toBeInTheDocument();
		expect(await findByText('測試備課班')).toBeInTheDocument();
	});

	it('render 最新動態(讀 payload 的 activity)', async () => {
		const { findByText } = render(AdminHomePage);
		expect(await findByText('測試動態一')).toBeInTheDocument();
		expect(await findByText('測試動態二')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getAdminHome).mockRejectedValue(new Error('boom'));
		const { findByText } = render(AdminHomePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('today/activity 空集合不當機,且沒有進行中課堂橫幅', async () => {
		vi.mocked(getAdminHome).mockResolvedValue({ ...FIXTURE, today: [], activity: [] });
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('營運總覽');
		expect(queryByText('進行中課堂')).toBeNull();
	});

	/* Task 20 — 快速操作「新增學員」改開真表單並接 createMember，不再是本地假寫入。 */
	it('快速操作「新增學員」開出的 sheet 帶入真正呼叫 createMember 的 onSave', async () => {
		vi.mocked(createMember).mockResolvedValue({} as never);
		const { findByText } = render(AdminHomePage);
		await findByText('新增學員');

		await fireEvent.click(await findByText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (body: CreateMemberBody) => Promise<void> };
		expect(sheetProps).toBeTruthy();

		await sheetProps.onSave({ email: 'a@test.com', name: '新學員', password: 'password123' });

		expect(createMember).toHaveBeenCalledWith({ email: 'a@test.com', name: '新學員', password: 'password123' });
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});
});
