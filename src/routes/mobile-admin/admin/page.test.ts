import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AdminHomePage from './+page.svelte';
import { getAdminHome } from '$lib/mobile-admin/api';
import type { Profile, MemberRow, TodayRow, ActivityRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getAdminHome: vi.fn() }));

const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '測試教練', initial: '測', role: '測試教練職稱', desc: '', color: '#000', id: 'T-2' }
};
const mkMember = (over: Partial<MemberRow>): MemberRow => ({
	id: 'X', name: 'X', initial: 'X', color: '#000', course: '測試課程', coach: '測試教練',
	att: 90, status: 'active', age: 10, parent: '', phone: '', joined: '', points: 0,
	pay: 'paid', remain: 1, lastSeen: '', recent: [], emName: '', emPhone: '', campus: '',
	source: '', birthday: '', tier: '', tierColor: '', renewDue: '', lineId: '', ...over
});
// 3 位學員、2 位出席偏低(att<80)— 與 seed(11 位偏低)相異,證明「出席偏低」KPI
// 讀 payload 動態算出。
const FIXTURE_MEMBERS: MemberRow[] = [
	mkMember({ id: 'M1', name: '測試學員一', att: 60 }),
	mkMember({ id: 'M2', name: '測試學員二', att: 65 }),
	mkMember({ id: 'M3', name: '測試學員三', att: 95 })
];
const FIXTURE_TODAY: TodayRow[] = [
	{ time: '08:00', name: '測試進行中班', coach: '測試教練甲', room: '測試教室', count: 5, tone: 'success', label: '進行中' },
	{ time: '10:00', name: '測試備課班', coach: '測試教練乙', room: '測試教室2', count: 3, tone: 'info', label: '備課中' }
];
const FIXTURE_ACTIVITY: ActivityRow[] = [
	{ icon: 'user-plus', tone: '#000', bg: '#fff', text: '測試動態一', time: '剛剛' },
	{ icon: 'credit-card', tone: '#000', bg: '#fff', text: '測試動態二', time: '5 分鐘前' }
];
// Hero 日期 + KPI 帶(dateLabel/enrolledValue/classesWeekValue/revenueMonthValue)刻意
// 與 seed 相異,證明頁面讀 payload,而非殘留的舊硬編字面(2026 年 6 月 10 日 / 248 /
// 64 / NT$182K)。
const FIXTURE = {
	profiles: FIXTURE_PROFILES,
	members: FIXTURE_MEMBERS,
	today: FIXTURE_TODAY,
	activity: FIXTURE_ACTIVITY,
	dateLabel: '2099 年 1 月 1 日',
	enrolledValue: '999',
	enrolledDelta: '+1',
	classesWeekValue: '111',
	classesWeekDelta: '+2',
	revenueMonthValue: 'NT$999K',
	revenueMonthDelta: '+3%'
};

beforeEach(() => {
	vi.mocked(getAdminHome).mockReset();
	vi.mocked(getAdminHome).mockResolvedValue(FIXTURE);
});

describe('mobile-admin/admin 頁(總覽首頁)', () => {
	it('loading 分支顯示骨架(data-testid="madmin-home-skeleton")', () => {
		vi.mocked(getAdminHome).mockReturnValue(new Promise(() => {}));
		const { container } = render(AdminHomePage);
		expect(container.querySelector('[data-testid="madmin-home-skeleton"]')).not.toBeNull();
	});

	it('async 載入後「出席偏低」KPI 讀 payload 動態算出(相異 fixture:2 位,非 seed 的 11 位)', async () => {
		const { findByText } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText('2')).toBeInTheDocument();
	});

	it('Hero 日期與在學學員/本週課堂/本月營收 KPI 讀 payload(相異 fixture,非殘留 seed 硬編)', async () => {
		const { findByText, container } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText(/2099 年 1 月 1 日/)).toBeInTheDocument();
		expect(await findByText('999')).toBeInTheDocument();
		expect(await findByText('111')).toBeInTheDocument();
		expect(await findByText('NT$999K')).toBeInTheDocument();
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('2026 年 6 月 10 日');
		expect(txt).not.toContain('248');
		expect(txt).not.toContain('NT$182K');
	});

	it('render 今日課表與進行中課堂橫幅(皆讀 payload 的 today)', async () => {
		const { findAllByText, findByText } = render(AdminHomePage);
		// 進行中的班級同時出現在「進行中課堂」橫幅與「今日課表」清單。
		expect((await findAllByText('測試進行中班')).length).toBeGreaterThan(0);
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
		vi.mocked(getAdminHome).mockResolvedValue({ ...FIXTURE, members: [], today: [], activity: [] });
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('營運總覽');
		expect(queryByText('進行中課堂')).toBeNull();
	});
});
