import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MembersPage from './+page.svelte';
import { getOpsCollections, createMember, updateMember } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, overlay, opsHydrated, toasts } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, COACHES, ORDERS } from '$lib/mobile-admin/data';
import type { MemberRow } from '$lib/mobile-admin/data';
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
const OPS_FIXTURE = { members: FIXTURE_MEMBERS, classes: CLASSES, coaches: COACHES, orders: ORDERS };

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

	it('members 空集合不當機,顯示找不到符合的學員', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: [], classes: CLASSES, coaches: COACHES, orders: ORDERS });
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
});
