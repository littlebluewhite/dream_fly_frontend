import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MembersPage from './+page.svelte';
import { members, overlay, opsHydrated, resetOpsForTests, toasts } from '$lib/mobile-admin/stores';
import { mapMemberAccount, type MemberAccount as MemberRow, type ApiUserAccount } from '$lib/admin/data';
import type { CreateMemberBody, UpdateMemberBody } from '$lib/admin/api';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getOpsCollections/
 * createMember/updateMember(stores.ts 直取 $lib/admin/api)走真實
 * fetch adapter。FIXTURE_MEMBERS 改為 wire 形狀(ApiUserAccount)，經真實
 * mapMemberAccount() 映射，而非手造已映射的 MemberRow。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const mkWireUser = (over: Partial<ApiUserAccount>): ApiUserAccount => ({
	id: 'X', name: 'X', phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: 0,
	...over
});
// 與 seed 相異的 fixture(人名、狀態組成皆改過),證明頁面讀 hydrateOps() 水合後
// 的 $members store。
const WIRE_MEMBERS: ApiUserAccount[] = [
	mkWireUser({ id: 'zz1', name: '測試學員甲', is_active: true }),
	mkWireUser({ id: 'zz2', name: '測試學員乙', is_active: false })
];
const FIXTURE_MEMBERS: MemberRow[] = WIRE_MEMBERS.map(mapMemberAccount);

const opsRoutes = (wireMembers: ApiUserAccount[], total = wireMembers.length) => ({
	...OPS_ROUTES,
	'GET /users?page=1': { users: wireMembers, total, page: 1, per_page: 20 }
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter(opsRoutes(WIRE_MEMBERS)));
	resetOpsForTests();
	overlay.closeAll();
});

afterEach(() => {
	resetOpsForTests();
});

describe('mobile-admin/admin/members 頁', () => {
	it('loading 分支顯示骨架(data-testid="members-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(MembersPage);
		expect(container.querySelector('[data-testid="members-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $members store 的學員(相異 fixture)與統計筆數', async () => {
		const { findByText } = render(MembersPage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		expect(await findByText('2 位學員')).toBeInTheDocument();
	});

	it('狀態篩選為真後端的二元旗標（啟用中/已停用），不是舊 3 態出席率標籤', async () => {
		const { findByText, getAllByText, queryByText } = render(MembersPage);
		await findByText('測試學員甲');
		// 「啟用中」同時出現在 FilterChips 標籤與該學員列自己的 StatusBadgeM，故用 getAllByText。
		expect(getAllByText('啟用中').length).toBeGreaterThan(0);
		expect(getAllByText('已停用').length).toBeGreaterThan(0);
		expect(queryByText('出席偏低')).toBeNull();
		expect(queryByText('暫停中')).toBeNull();
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		let call = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...opsRoutes(WIRE_MEMBERS),
				'GET /users?page=1': () => {
					call += 1;
					if (call === 1) throw new Error('boom');
					return { users: WIRE_MEMBERS, total: WIRE_MEMBERS.length, page: 1, per_page: 20 };
				}
			})
		);
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');

		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試學員甲')).toBeInTheDocument();
	});

	it('首次載入失敗 → 重試在飛時卸載 → $members 不被改寫(R14 F1:寫入交給 load-gate,卸載後的回應不落地)', async () => {
		let call = 0;
		let resolveRetry!: (v: unknown) => void;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...opsRoutes(WIRE_MEMBERS),
				'GET /users?page=1': () => {
					call += 1;
					if (call === 1) throw new Error('boom');
					return new Promise((r) => (resolveRetry = r));
				}
			})
		);
		const { findByText, unmount } = render(MembersPage);
		await findByText('載入失敗');

		await fireEvent.click(await findByText('重新載入'));
		expect(call).toBe(2); // 重試真的出發了

		unmount();
		resolveRetry({ users: WIRE_MEMBERS, total: WIRE_MEMBERS.length, page: 1, per_page: 20 });
		await new Promise<void>((r) => setTimeout(r, 0));

		expect(get(members)).toEqual([]); // 已卸載頁面的重試回應不寫共享 store(誠實開機:未曾成功水合過就仍是 `[]`)
		expect(get(opsHydrated)).toBe(false);
	});

	it('members 空集合不當機,顯示找不到符合的學員', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([], 0)));
		const { findByText } = render(MembersPage);
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
	});

	/* Task 20 — 新增/編輯改接真 POST /users、PATCH /users/{id}，不再是本地假寫入。
	 * mobile 的 overlay 是全域 store，MemberForm 由另一個 OverlayHost 渲染——這裡
	 * 直接呼叫「新增學員」/「編輯」開出的 sheet 帶入的 onCreate/onUpdate（頁面自己的閉包），
	 * 驗證它真的打 createMember/updateMember，同 ClassesPage 的驗證慣例。 */
	function callCount(method: string, path: string): number {
		return vi.mocked(api).mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method).length;
	}

	it('「新增學員」開出的 sheet 帶入真正呼叫 createMember 的 onCreate', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes(WIRE_MEMBERS), 'POST /users': mkWireUser({ id: 'u-new', name: '新學員' }) }));
		const { findByText, getByLabelText } = render(MembersPage);
		await findByText('測試學員甲');

		await fireEvent.click(getByLabelText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onCreate: (body: CreateMemberBody) => Promise<boolean> };
		expect(sheetProps).toBeTruthy();

		const body: CreateMemberBody = { email: 'a@test.com', name: '新學員', password: 'password123' };
		expect(await sheetProps.onCreate(body)).toBe(true);

		expect(api).toHaveBeenCalledWith('/users', { method: 'POST', body: JSON.stringify(body) });
		expect(callCount('PATCH', '/users/zz1')).toBe(0);
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});

	it('點學員卡片 → 編輯 開出的 sheet 帶入呼叫 updateMember(id, …) 的 onUpdate', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes(WIRE_MEMBERS), 'PATCH /users/zz1': mkWireUser({ id: 'zz1', name: '改名後' }) }));
		const { findByText } = render(MembersPage);
		await findByText('測試學員甲');

		// 點卡片開出「學員詳情」sheet(MemberSheet 由另一個 OverlayHost 渲染，這裡
		// 不重新渲染它)；帶入的 onEdit 就是頁面自己的 openEdit——直接呼叫它，模擬
		// MemberSheet 內「編輯資料」按鈕的效果。
		await fireEvent.click(await findByText('測試學員甲'));
		const detailProps = get(overlay).sheet?.props as { onEdit: (m: MemberRow) => void };
		expect(detailProps).toBeTruthy();
		detailProps.onEdit(FIXTURE_MEMBERS[0]);

		const sheetProps = get(overlay).sheet?.props as { onUpdate: (body: UpdateMemberBody) => Promise<boolean> };
		expect(sheetProps).toBeTruthy();

		const body: UpdateMemberBody = { name: '改名後', is_active: true };
		expect(await sheetProps.onUpdate(body)).toBe(true);

		expect(api).toHaveBeenCalledWith('/users/zz1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(callCount('POST', '/users')).toBe(0);
	});

	it('新增失敗顯示錯誤 toast（透傳後端訊息）', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes(WIRE_MEMBERS), 'POST /users': new Error('Email 已被使用') }));
		const { findByText, getByLabelText } = render(MembersPage);
		await findByText('測試學員甲');

		await fireEvent.click(getByLabelText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onCreate: (body: CreateMemberBody) => Promise<boolean> };
		expect(await sheetProps.onCreate({ email: 'a@test.com', name: '新學員', password: 'password123' })).toBe(false);

		expect(get(toasts).some((t) => t.title === '新增失敗')).toBe(true);
	});

	/* trim 回歸釘子若只釘桌面 filter 純函式層,頁面斷開共用 filter 退回舊 inline
	 * 不 trim 邏輯時仍會全綠——這筆測「頁面已接線」本身(同 orders 頁的釘法)。 */
	it('搜尋框退化查詢走桌面 filterMemberAccounts 的 trim 語意:padded 命中、純空白回全部', async () => {
		const { findByText, queryByText, getByPlaceholderText } = render(MembersPage);
		await findByText('測試學員甲');

		const input = getByPlaceholderText('搜尋學員姓名、電話、編號…');
		await fireEvent.input(input, { target: { value: ' 測試學員甲 ' } });
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(queryByText('測試學員乙')).toBeNull();

		await fireEvent.input(input, { target: { value: '   ' } });
		expect(await findByText('測試學員乙')).toBeInTheDocument();
	});
});

describe('mobile-admin/admin/members 頁 — 分頁誠實(R12 Task 3)', () => {
	it('header 顯示後端 total(非已抓筆數);total > perPage 時搜尋區提示僅搜尋前 N 筆', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes(WIRE_MEMBERS, 57)));
		const { findByText } = render(MembersPage);
		expect(await findByText('57 位學員')).toBeInTheDocument();
		expect(await findByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeInTheDocument();
	});
	it('total <= perPage 時不顯示提示', async () => {
		const { findByText, queryByText } = render(MembersPage);
		await findByText('2 位學員');
		expect(queryByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeNull();
	});
});
