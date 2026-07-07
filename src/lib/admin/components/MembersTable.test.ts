import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersTable from './MembersTable.svelte';
import type { MemberAccount } from '$lib/admin/data';
import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

/* MembersTable — the shared learner table (admin.jsx MembersTable).
 *
 * compact (dashboard preview, `members` prop) — Task 15: now shares the exact same
 * real GET /users data (MemberAccount) and honest column set as the full table,
 * just capped at 6 rows with no status tabs and no 新增/編輯 (never backend-wired —
 * same P2 reasoning as the full variant below, contract §3.2 has no admin
 * create-or-edit-another-user endpoint).
 *
 * full/honest (學員管理 page, `members` prop): Task 5. Real GET /users data
 * (MemberAccount: id/name/initial/phone/joined/status/points — the only 7 fields
 * the backend returns). Every column/action tied to a no-backend-source field
 * (代表色/課程/分校/授課教練/出席率/近況/繳費/剩餘堂數/續費/生日/分級/緊急聯絡人) is hidden, and
 * 新增/編輯 are hidden too (no admin create-or-edit-another-user endpoint — contract
 * §3.2 only has GET /users, GET /users/{id}, PATCH /users/me). */

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

	it('hides the 新增學員 button (no admin create-user endpoint, same as the full table)', () => {
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

	/* P2 (issue #8): no admin create-user endpoint (contract §3.2 has no POST
	 * /users), so a working 新增學員 form here would silently fail to persist. */
	it('hides the 新增學員 button (no admin create-user endpoint)', () => {
		const { queryByText } = render(MembersTable, { members: [acc] });
		expect(queryByText('新增學員')).toBeNull();
	});

	/* P2 (issue #8): no admin edit-another-user endpoint (contract §3.2 only has
	 * PATCH /users/me), so row click opens a read-only detail view with no 編輯資料
	 * button — never a fake-working edit form. */
	it('opens a read-only MemberDialog on row click, with no 編輯資料 button', async () => {
		const { getByText, queryByText } = render(MembersTable, { members: [acc] });
		await fireEvent.click(getByText('測試員'));
		expect(getByText('學員資料')).toBeInTheDocument();
		expect(queryByText('編輯資料')).toBeNull();
		expect(getByText('關閉')).toBeInTheDocument();
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
