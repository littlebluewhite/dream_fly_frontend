import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AdminHomePage from './+page.svelte';
import { getAdminHome, createMember, getOpsCollections } from '$lib/mobile-admin/api';
import { overlay, toasts, members, opsHydrated } from '$lib/mobile-admin/stores';
import { MEMBERS, CLASSES, ORDERS, type Profile, type TodayRow } from '$lib/mobile-admin/data';
import { COACHES } from '$lib/domain/coaches';
import type { Activity as ActivityRow } from '$lib/domain/activity';
import type { CreateMemberBody } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', () => ({ getAdminHome: vi.fn(), createMember: vi.fn(), getOpsCollections: vi.fn() }));

const FIXTURE_PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '測試管理員', initial: '測', role: '測試角色', desc: '', color: '#000', id: 'T-1' },
	coach: { name: '測試教練', initial: '測', role: '測試教練職稱', desc: '', color: '#000', id: 'T-2' }
};
// C5：liveNow 改比對 state(TodayStatus 窄型別)，不再比對 label 字面——fixture 的
// label 因此刻意跟 state 脫鉤(見下方「state/label 脫鉤」兩則回歸測試)，證明橫幅
// 真的是看 state，不是巧合地看到某個字面。
const FIXTURE_TODAY: TodayRow[] = [
	{ time: '08:00', name: '測試進行中班', coach: '測試教練甲', room: '測試教室', count: 5, state: 'live', tone: 'success', label: '上課中' },
	{ time: '10:00', name: '測試備課班', coach: '測試教練乙', room: '測試教室2', count: 3, state: 'wait', tone: 'info', label: '備課中' }
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

/** getOpsCollections 回傳(新增學員走 store 的 addMember,寫入成功後會重抓 ops 集合)。 */
const opsWith = (memberRows: typeof MEMBERS) => ({
	members: memberRows,
	classes: CLASSES,
	coaches: COACHES,
	orders: ORDERS,
	pages: {
		members: { total: memberRows.length, perPage: 20 },
		classes: { total: CLASSES.length, perPage: 20 },
		orders: { total: ORDERS.length, perPage: 20 }
	}
});

beforeEach(() => {
	vi.mocked(getAdminHome).mockReset();
	vi.mocked(getAdminHome).mockResolvedValue(FIXTURE);
	vi.mocked(createMember).mockReset();
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(opsWith(MEMBERS));
	members.set(MEMBERS);
	opsHydrated.set(false);
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

	it('opsHydrated 未落地時，待付款橫幅不出現，即使 $orders 仍是同步 seed(有 pending 訂單)', async () => {
		// getOpsCollections 故意 pending 不 resolve，模擬 hydrateOps() 還在飛行中——
		// orders store 的同步 seed 本身就有 pending 訂單，舊碼不呼叫 hydrateOps()、
		// 直接讀 $orders，會在真正水合前就顯示一個假的「N 筆訂單待付款」橫幅。
		let release!: (e: Error) => void;
		vi.mocked(getOpsCollections).mockReturnValue(new Promise((_, rej) => (release = rej)));
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('測試動態一'); // 等 getAdminHome 的 ready(與 ops 水合是獨立的兩支請求)
		expect(queryByText('筆訂單', { exact: false })).toBeNull();
		release(new Error('測試收尾')); // R14 F2:合併的在飛 GET 必須 settle,否則下一個測試的 load 會併入這支永不落地的 GET
	});

	it('opsHydrated 落地後，待付款橫幅依 $orders 的 pending 數顯示', async () => {
		const { findByText } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText('筆訂單', { exact: false })).toBeInTheDocument(); // onMount 的 hydrateOps() 落地後才出現
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

	/* C5 回歸(pin-first)：liveNow 改比對 state，不再比對 label 字面——以下兩則證明
	 * label 的字面內容跟橫幅是否出現無關，只有 state === 'live' 才算數。 */
	it('state=live 但 label 隨便填任意字面時，橫幅仍出現', async () => {
		vi.mocked(getAdminHome).mockResolvedValue({
			...FIXTURE,
			today: [{ time: '08:00', name: '測試任意標籤班', coach: '測試教練甲', room: '測試教室', count: 5, state: 'live', tone: 'success', label: '隨便亂填的字面' }]
		});
		const { findByText } = render(AdminHomePage);
		expect(await findByText('● 進行中課堂')).toBeInTheDocument();
	});

	it('label 寫「上課中」但 state=wait 時，橫幅不出現', async () => {
		vi.mocked(getAdminHome).mockResolvedValue({
			...FIXTURE,
			today: [{ time: '08:00', name: '測試尚未開始班', coach: '測試教練甲', room: '測試教室', count: 5, state: 'wait', tone: 'success', label: '上課中' }]
		});
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('測試尚未開始班'); // 等今日課表清單渲染完成
		expect(queryByText('● 進行中課堂')).toBeNull();
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

	/* R12 Task 3 回歸:快速新增學員原本只打 createMember、不重抓——$members 維持舊清單,
	 * 使用者轉到學員管理頁看不到剛建的學員(hydrateOps 已水合則被 guard 短路)。改走
	 * store 的 addMember() 後,寫入成功即 await refreshOps()。 */
	it('快速新增學員後重抓 ops 集合($members 含新學員),並顯示成功 toast', async () => {
		const created = { ...MEMBERS[0], id: 'zz-quick', name: '快速新增的學員' };
		vi.mocked(createMember).mockResolvedValue({} as never);
		vi.mocked(getOpsCollections).mockResolvedValue(opsWith([...MEMBERS, created]));
		opsHydrated.set(true); // 已水合:舊碼下 hydrateOps 會被 guard 短路,列表永遠看不到新學員
		const { findByText } = render(AdminHomePage);
		await fireEvent.click(await findByText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (body: CreateMemberBody) => Promise<void> };

		await sheetProps.onSave({ email: 'q@test.com', name: '快速新增的學員', password: 'password123' });

		expect(getOpsCollections).toHaveBeenCalledTimes(1);
		expect(get(members).some((m) => m.id === 'zz-quick')).toBe(true);
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});
});
