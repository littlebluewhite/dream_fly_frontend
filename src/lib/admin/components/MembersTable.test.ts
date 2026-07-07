import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersTable from './MembersTable.svelte';
import type { MemberAccount } from '$lib/admin/data';
import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

/* MembersTable — the shared learner table (admin.jsx MembersTable).
 *
 * compact (dashboard preview, `members` prop) — Task 15: now shares the exact same
 * real GET /users data (MemberAccount) and honest column set as the full table,
 * just capped at 6 rows with no status tabs and no 新增/編輯 — Task 16 wires those
 * into the full variant only; compact stays a preview surface, not a management
 * one.
 *
 * full/honest (學員管理 page, `members` prop) — Task 5: real GET /users data
 * (MemberAccount: id/name/initial/phone/joined/status/points — the only 7 fields
 * the backend returns). Every column tied to a no-backend-source field (代表色/課程/
 * 分校/授課教練/出席率/近況/繳費/剩餘堂數/續費/生日/分級/緊急聯絡人) is hidden (P2, issue #8,
 * unchanged). 新增/編輯 (Task 16): now wired for real — contract §3.2 gained POST
 * /users and PATCH /users/{id}. MembersTable itself owns no dialog/API state —
 * it just fires the `onNew`/`onEdit` callback props; members/+page.svelte owns
 * the actual create/edit dialogs and API calls (same split as classes/venues/
 * coupons +page.svelte). */

const acc: MemberAccount = {
	id: 'u-001',
	name: '測試員',
	initial: '測',
	phone: '0900-000-000',
	joined: '2026-01-15',
	status: 'active',
	points: 300
};

describe('MembersTable (compact)', () => {
	it('renders the honest 5-field column set (學員/電話/加入日/狀態/點數) — identical to the full page, no 課程/出席率/分校/繳費', () => {
		const { container, getByText, queryByText } = render(MembersTable, { members: [acc], compact: true });
		expect(getByText('測試員')).toBeInTheDocument();
		expect(container.textContent).toContain('0900-000-000');
		expect(container.textContent).toContain('2026-01-15');
		expect(container.textContent).toContain('300'); // 點數 — 與全頁一致
		expect(getByText('啟用中')).toBeInTheDocument();
		for (const label of ['課程', '出席率', '分校', '授課教練', '繳費', '剩餘堂數', '近況']) {
			expect(queryByText(label)).toBeNull();
		}
		expect(container.querySelectorAll('.att-dot')).toHaveLength(0);
	});

	it('omits the status tabs in compact mode', () => {
		const { queryByRole } = render(MembersTable, { members: [acc], compact: true });
		expect(queryByRole('tab', { name: /全部/ })).toBeNull();
	});

	it('hides the 新增學員 button (dashboard preview, not the management page — Task 16 wires it into the full variant only)', () => {
		const { queryByText } = render(MembersTable, { members: [acc], compact: true });
		expect(queryByText('新增學員')).toBeNull();
	});

	it('opens a read-only MemberDialog on row click, with no 編輯資料 button', async () => {
		const { getByText, queryByText } = render(MembersTable, { members: [acc], compact: true });
		await fireEvent.click(getByText('測試員'));
		expect(getByText('學員資料')).toBeInTheDocument();
		expect(queryByText('編輯資料')).toBeNull();
	});

	it('shows the empty state when no accounts match', () => {
		const { getByText } = render(MembersTable, { members: [], compact: true });
		expect(getByText('找不到符合的學員')).toBeInTheDocument();
	});
});

describe('MembersTable — compact preview is capped', () => {
	it('caps the compact preview at 6 rows and labels it 最近活躍 6 位', () => {
		const many = Array.from({ length: 9 }, (_, i) => ({ ...acc, id: `u-${100 + i}`, name: `學員${i}` }));
		const { container } = render(MembersTable, { members: many, compact: true });
		expect(container.querySelectorAll('.row')).toHaveLength(6); // pins the slice
		expect(container.textContent).toContain('最近活躍 6 位'); // pins the label + DRY
	});

	it('filters the compact preview by the shared 搜尋 store, same as the full table', () => {
		const other: MemberAccount = { ...acc, id: 'u-002', name: '另一位學員' };
		memberFilter.set({ ...MEMBER_FILTER_DEFAULT });
		const { container } = render(MembersTable, { members: [acc, other], compact: true });
		expect(container.textContent).toContain('測試員');
		expect(container.textContent).toContain('另一位學員');
	});
});

/* ─────────────────────── Task 5: full/honest variant (學員管理頁, getMembers()) ─────────────────────── */

describe('MembersTable (full/honest — real getMembers() data)', () => {
	it("renders a row's name, id, phone, joined date and points", () => {
		const { getByText, container } = render(MembersTable, { members: [acc] });
		expect(getByText('測試員')).toBeInTheDocument();
		expect(getByText('u-001')).toBeInTheDocument();
		expect(container.textContent).toContain('0900-000-000');
		expect(container.textContent).toContain('2026-01-15');
		expect(container.textContent).toContain('300');
	});

	it('renders the honest status badge (啟用中 for active)', () => {
		const { container } = render(MembersTable, { members: [acc] });
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('啟用中');
	});

	it('does NOT render any column/field with no backend data source (課程/分校/教練/出席率/繳費/剩餘堂數/近況)', () => {
		const { container } = render(MembersTable, { members: [acc] });
		const txt = container.textContent ?? '';
		for (const label of ['課程', '分校', '授課教練', '出席率', '繳費', '剩餘堂數', '近況']) {
			expect(txt).not.toContain(label);
		}
		expect(container.querySelectorAll('.att-dot')).toHaveLength(0);
	});

	it('shows the 全部/啟用中/已停用 status tabs', () => {
		const { getByRole } = render(MembersTable, { members: [acc] });
		expect(getByRole('tab', { name: /全部/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /啟用中/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /已停用/ })).toBeInTheDocument();
	});

	it('narrows to inactive accounts when the 已停用 tab is selected', async () => {
		const inactiveAcc: MemberAccount = { ...acc, id: 'u-002', name: '停用員', status: 'inactive' };
		const { getByRole, container } = render(MembersTable, { members: [acc, inactiveAcc] });
		await fireEvent.click(getByRole('tab', { name: /已停用/ }));
		expect(container.textContent).toContain('停用員');
		expect(container.textContent).not.toContain('測試員');
	});

	it('shows the empty state when no accounts match', () => {
		const { getByText } = render(MembersTable, { members: [] });
		expect(getByText('找不到符合的學員')).toBeInTheDocument();
	});

	/* Task 16: contract §3.2 gained POST /users (admin) — the button is back,
	 * wired to the `onNew` callback prop (members/+page.svelte owns the actual
	 * MemberCreateDialog + createMember() call). */
	it('shows the 新增學員 button and fires onNew when clicked', async () => {
		const onNew = vi.fn();
		const { getByText } = render(MembersTable, { members: [acc], onNew });
		await fireEvent.click(getByText('新增學員'));
		expect(onNew).toHaveBeenCalledTimes(1);
	});

	/* Task 16: contract §3.2 gained PATCH /users/{id} (admin) — a per-row 編輯 icon
	 * fires the `onEdit` callback prop with that row's account (members/+page.svelte
	 * owns the actual MemberEditDialog + updateMember() call). It opens the edit
	 * form directly, without going through the read-only MemberDialog. */
	it('fires onEdit(account) when the row 編輯 icon is clicked, without opening the read-only dialog', async () => {
		const onEdit = vi.fn();
		const { getByLabelText, queryByText } = render(MembersTable, { members: [acc], onEdit });
		await fireEvent.click(getByLabelText('編輯'));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit).toHaveBeenCalledWith(acc);
		expect(queryByText('學員資料')).toBeNull(); // stopPropagation — row click (檢視) did not also fire
	});

	/* P2 (issue #8): the read-only detail view itself still offers no 編輯資料 button
	 * inside it — editing now happens via the separate row-level 編輯 icon above,
	 * not by drilling into the detail view first. */
	it('opens a read-only MemberDialog on row click, with no 編輯資料 button', async () => {
		const { getByText, queryByText } = render(MembersTable, { members: [acc] });
		await fireEvent.click(getByText('測試員'));
		expect(getByText('學員資料')).toBeInTheDocument();
		expect(queryByText('編輯資料')).toBeNull();
		expect(getByText('關閉')).toBeInTheDocument();
	});
});

describe('MembersTable — 複審修復（Finding 2）：「N 位學員」headline 改用 total prop', () => {
	it('total=57 時標題顯示「57 位學員」，即使 members 陣列只有 1 筆（分頁後目前頁筆數 ≠ 總數）', () => {
		const { getByText } = render(MembersTable, { members: [acc], total: 57 });
		expect(getByText('57 位學員')).toBeInTheDocument();
	});

	it('未提供 total 時退回 members.length（相容未傳入 total 的既有呼叫端）', () => {
		const other: MemberAccount = { ...acc, id: 'u-002', name: '第二位' };
		const { getByText } = render(MembersTable, { members: [acc, other] });
		expect(getByText('2 位學員')).toBeInTheDocument();
	});
});

describe('MembersTable memberFilter folding (honest full variant — 最低點數)', () => {
	afterEach(() => memberFilter.set({ ...MEMBER_FILTER_DEFAULT }));

	const high: MemberAccount = { ...acc, id: 'u-high', name: '高點數', points: 900 };
	const low: MemberAccount = { ...acc, id: 'u-low', name: '低點數', points: 10 };

	it('hides rows below the store pointsMin; keeps matching ones', async () => {
		memberFilter.set({ pointsMin: 500 });
		const { container } = render(MembersTable, { members: [high, low] });
		expect(container.textContent).toContain('高點數');
		expect(container.textContent).not.toContain('低點數');
	});
});
