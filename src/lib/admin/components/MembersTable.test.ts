import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersTable from './MembersTable.svelte';
import type { Member, MemberAccount } from '$lib/admin/data';
import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

/* MembersTable — the shared learner table (admin.jsx MembersTable).
 *
 * compact (dashboard preview, `rows` prop): untouched mock Member[] behaviour —
 * out of scope for Task 5 (getMembers() wiring is 學員管理-page-only, see issue #8).
 * Shows 學員/課程/出席率/狀態, capped at 6 rows, and keeps its own mock-only 新增/編輯
 * flow (MemberEditDialog on local state — never was backend-wired).
 *
 * full/honest (學員管理 page, `members` prop): Task 5. Real GET /users data
 * (MemberAccount: id/name/initial/phone/joined/status/points — the only 7 fields
 * the backend returns). Every column/action tied to a no-backend-source field
 * (代表色/課程/分校/授課教練/出席率/近況/繳費/剩餘堂數/續費/生日/分級/緊急聯絡人) is hidden, and
 * 新增/編輯 are hidden too (no admin create-or-edit-another-user endpoint — contract
 * §3.2 only has GET /users, GET /users/{id}, PATCH /users/me). */

const row: Member = {
	id: 'GY2099001',
	name: '測試員',
	initial: '測',
	color: '#0066CC',
	course: '競技啦啦隊 進階班',
	coach: '林雅婷',
	att: 87,
	status: 'active',
	age: 12,
	parent: '測太太',
	phone: '0900-000-000',
	joined: '2024/01',
	points: 300,
	pay: 'paid',
	remain: 11,
	lastSeen: '06/10',
	recent: ['p', 'a', 'l', 'v', 'p', 'p'],
	emName: '測先生',
	emPhone: '0900-000-009',
	campus: '美村本館',
	source: '官網預約表單',
	birthday: '2014/01/01',
	tier: '銀卡會員',
	tierColor: '#94A3B8',
	renewDue: '2026/09/15',
	lineId: '@df9001'
};

describe('MembersTable (compact)', () => {
	it('drops 分校/授課教練/繳費 columns and the 近況 strip', () => {
		const { container, queryByText } = render(MembersTable, { rows: [row], compact: true });
		expect(queryByText('已繳清')).toBeNull(); // pay column gone
		expect(container.querySelectorAll('.att-dot')).toHaveLength(0); // strip gone
		expect(container.textContent).not.toContain('美村本館'); // 分校 gone
	});

	it('still renders the name, att% and status badge', () => {
		const { getByText, container } = render(MembersTable, { rows: [row], compact: true });
		expect(getByText('測試員')).toBeInTheDocument();
		expect(container.textContent).toContain('87%');
		expect(getByText('在學中')).toBeInTheDocument();
	});

	it('omits the status tabs in compact mode', () => {
		const { queryByRole } = render(MembersTable, { rows: [row], compact: true });
		expect(queryByRole('tab', { name: /全部/ })).toBeNull();
	});
});

describe('MembersTable — compact preview is capped', () => {
	it('caps the compact preview at 6 rows and labels it 最近活躍 6 位', () => {
		const many = Array.from({ length: 9 }, (_, i) => ({ ...row, id: `GY2099${100 + i}`, name: `學員${i}` }));
		const { container } = render(MembersTable, { rows: many, compact: true });
		expect(container.querySelectorAll('.row')).toHaveLength(6); // pins the slice
		expect(container.textContent).toContain('最近活躍 6 位'); // pins the label + DRY
	});
});

/* P2 regression (codex round 1): the 新增學員 header button had no on:click and
 * did nothing. The table now owns the add flow (compact/dashboard preview only —
 * mock-only, never backend-wired), so clicking it opens the blank-member edit
 * dialog. */
describe('MembersTable add flow (compact preview)', () => {
	it('opens the add dialog when 新增學員 is clicked (previously a dead button)', async () => {
		const { getByRole, getByText, queryByText } = render(MembersTable, {
			rows: [row],
			compact: true
		});
		expect(queryByText('編輯學員資料')).toBeNull();
		await fireEvent.click(getByRole('button', { name: /新增學員/ }));
		expect(getByText('編輯學員資料')).toBeInTheDocument();
	});
});

/* ─────────────────────── Task 5: full/honest variant (學員管理頁, getMembers()) ─────────────────────── */

const acc: MemberAccount = {
	id: 'u-001',
	name: '測試員',
	initial: '測',
	phone: '0900-000-000',
	joined: '2026-01-15',
	status: 'active',
	points: 300
};

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
