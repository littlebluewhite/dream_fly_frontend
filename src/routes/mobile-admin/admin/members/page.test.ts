import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MembersPage from './+page.svelte';
import { getOpsCollections, createMember, updateMember } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, overlay, opsHydrated, toasts } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, ORDERS } from '$lib/mobile-admin/data';
import type { MemberRow } from '$lib/mobile-admin/data';
import { COACHES } from '$lib/domain/coaches';
import type { CreateMemberBody, UpdateMemberBody } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', () => ({
	getOpsCollections: vi.fn(),
	createMember: vi.fn(),
	updateMember: vi.fn()
}));

const mkMember = (over: Partial<MemberRow>): MemberRow => ({
	id: 'X',
	name: 'X',
	initial: 'X',
	phone: '',
	joined: '2026/01/01',
	status: 'active',
	points: 0,
	...over
});
// 與 seed 相異的 fixture(人名、狀態組成皆改過),證明頁面讀 hydrateOps() 水合後
// 的 $members store。
const FIXTURE_MEMBERS: MemberRow[] = [
	mkMember({ id: 'zz1', name: '測試學員甲', status: 'active' }),
	mkMember({ id: 'zz2', name: '測試學員乙', status: 'inactive' })
];
/** getOpsCollections 的分頁 meta(R12 Task 3:header 顯示 total、total > perPage 出搜尋提示)。 */
const pagesOf = (members: number, classes: number, orders: number) => ({
	members: { total: members, perPage: 20 },
	classes: { total: classes, perPage: 20 },
	orders: { total: orders, perPage: 20 }
});
const OPS_FIXTURE = { members: FIXTURE_MEMBERS, classes: CLASSES, coaches: COACHES, orders: ORDERS, pages: pagesOf(2, CLASSES.length, ORDERS.length) };

beforeEach(() => {
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(OPS_FIXTURE);
	vi.mocked(createMember).mockReset();
	vi.mocked(updateMember).mockReset();
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
	overlay.closeAll();
});

afterEach(() => {
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

describe('mobile-admin/admin/members 頁', () => {
	it('loading 分支顯示骨架(data-testid="members-skeleton")', () => {
		vi.mocked(getOpsCollections).mockReturnValue(new Promise(() => {}));
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
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');

		vi.mocked(getOpsCollections).mockResolvedValueOnce(OPS_FIXTURE);
		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試學員甲')).toBeInTheDocument();
	});

	it('首次載入失敗 → 重試在飛時卸載 → $members 不被改寫(R14 F1:寫入交給 load-gate,卸載後的回應不落地)', async () => {
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText, unmount } = render(MembersPage);
		await findByText('載入失敗');

		let resolveRetry!: (v: typeof OPS_FIXTURE) => void;
		vi.mocked(getOpsCollections).mockReturnValueOnce(new Promise((r) => (resolveRetry = r)));
		await fireEvent.click(await findByText('重新載入'));
		expect(getOpsCollections).toHaveBeenCalledTimes(2); // 重試真的出發了

		unmount();
		resolveRetry(OPS_FIXTURE);
		await new Promise<void>((r) => setTimeout(r, 0));

		expect(get(members)).toEqual(MEMBERS); // 已卸載頁面的重試回應不寫共享 store
		expect(get(opsHydrated)).toBe(false);
	});

	it('members 空集合不當機,顯示找不到符合的學員', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: [], classes: CLASSES, coaches: COACHES, orders: ORDERS, pages: pagesOf(0, CLASSES.length, ORDERS.length) });
		const { findByText } = render(MembersPage);
		expect(await findByText('找不到符合的學員')).toBeInTheDocument();
	});

	/* Task 20 — 新增/編輯改接真 POST /users、PATCH /users/{id}，不再是本地假寫入。
	 * mobile 的 overlay 是全域 store，MemberForm 由另一個 OverlayHost 渲染——這裡
	 * 直接呼叫「新增學員」/「編輯」開出的 sheet 帶入的 onSave（頁面自己的閉包），
	 * 驗證它真的打 createMember/updateMember，同 ClassesPage 的驗證慣例。 */
	it('「新增學員」開出的 sheet 帶入真正呼叫 createMember 的 onSave', async () => {
		vi.mocked(createMember).mockResolvedValue({} as never);
		const { findByText, getByLabelText } = render(MembersPage);
		await findByText('測試學員甲');

		await fireEvent.click(getByLabelText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as {
			onSave: (body: CreateMemberBody | UpdateMemberBody) => Promise<void>;
		};
		expect(sheetProps).toBeTruthy();

		const body: CreateMemberBody = { email: 'a@test.com', name: '新學員', password: 'password123' };
		await sheetProps.onSave(body);

		expect(createMember).toHaveBeenCalledWith(body);
		expect(updateMember).not.toHaveBeenCalled();
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});

	it('點學員卡片 → 編輯 開出的 sheet 帶入呼叫 updateMember(id, …) 的 onSave', async () => {
		vi.mocked(updateMember).mockResolvedValue({} as never);
		const { findByText } = render(MembersPage);
		await findByText('測試學員甲');

		// 點卡片開出「學員詳情」sheet(MemberSheet 由另一個 OverlayHost 渲染，這裡
		// 不重新渲染它)；帶入的 onEdit 就是頁面自己的 openEdit——直接呼叫它，模擬
		// MemberSheet 內「編輯資料」按鈕的效果。
		await fireEvent.click(await findByText('測試學員甲'));
		const detailProps = get(overlay).sheet?.props as { onEdit: (m: MemberRow) => void };
		expect(detailProps).toBeTruthy();
		detailProps.onEdit(FIXTURE_MEMBERS[0]);

		const sheetProps = get(overlay).sheet?.props as {
			onSave: (body: CreateMemberBody | UpdateMemberBody) => Promise<void>;
		};
		expect(sheetProps).toBeTruthy();

		const body: UpdateMemberBody = { name: '改名後', is_active: true };
		await sheetProps.onSave(body);

		expect(updateMember).toHaveBeenCalledWith('zz1', body);
		expect(createMember).not.toHaveBeenCalled();
	});

	it('新增失敗顯示錯誤 toast（透傳後端訊息）', async () => {
		vi.mocked(createMember).mockRejectedValue(new Error('Email 已被使用'));
		const { findByText, getByLabelText } = render(MembersPage);
		await findByText('測試學員甲');

		await fireEvent.click(getByLabelText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as {
			onSave: (body: CreateMemberBody | UpdateMemberBody) => Promise<void>;
		};
		await sheetProps.onSave({ email: 'a@test.com', name: '新學員', password: 'password123' });

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
		vi.mocked(getOpsCollections).mockResolvedValue({ ...OPS_FIXTURE, pages: pagesOf(57, CLASSES.length, ORDERS.length) });
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
