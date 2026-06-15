import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersTable from './MembersTable.svelte';
import type { Member } from '$lib/admin/data';

/* MembersTable — the shared learner table (admin.jsx MembersTable). Full variant
 * shows 學員/課程/分校/授課教練/近況(6 dots)/出席率/繳費/狀態/剩餘堂數; compact drops
 * 分校/授課教練/繳費/剩餘堂數 and the 近況 strip and caps at 6 rows. We render with a
 * single hand-built row so assertions are deterministic. */

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

describe('MembersTable (full)', () => {
	it("renders a row's name, id and att%", () => {
		const { getByText, container } = render(MembersTable, { rows: [row] });
		expect(getByText('測試員')).toBeInTheDocument();
		expect(getByText('GY2099001')).toBeInTheDocument();
		expect(container.textContent).toContain('87%');
	});

	it('renders both the pay badge (已繳清) and the status badge (在學中)', () => {
		const { getByText, container } = render(MembersTable, { rows: [row] });
		expect(getByText('已繳清')).toBeInTheDocument(); // pay=paid
		// "在學中" is also a tab label, so scope to the row's status Badge span.
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('在學中'); // status=active
	});

	it('renders 6 attendance dots coloured from ATT_MARK', () => {
		const { container } = render(MembersTable, { rows: [row] });
		const dots = container.querySelectorAll('.att-dot');
		expect(dots).toHaveLength(6);
		// first mark is 'p' → #10B981
		expect((dots[0] as HTMLElement).style.background).toContain('rgb(16, 185, 129)');
	});

	it('renders the 剩餘堂數 value and the 分校/教練 columns', () => {
		const { container } = render(MembersTable, { rows: [row] });
		expect(container.textContent).toContain('美村本館'); // 分校
		expect(container.textContent).toContain('林雅婷'); // 教練
		expect(container.textContent).toContain('11'); // 剩餘堂數
	});

	it('shows the status tabs in the full variant', () => {
		const { getByRole } = render(MembersTable, { rows: [row] });
		expect(getByRole('tab', { name: /全部/ })).toBeInTheDocument();
	});
});

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

/* P2 regression (codex round 1): the 新增學員 header button had no on:click and
 * did nothing. The table now owns the add flow, so clicking it opens the
 * blank-member edit dialog. */
describe('MembersTable add flow', () => {
	it('opens the add dialog when 新增學員 is clicked (previously a dead button)', async () => {
		const { getByRole, getByText, queryByText } = render(MembersTable, { rows: [row] });
		expect(queryByText('編輯學員資料')).toBeNull();
		await fireEvent.click(getByRole('button', { name: /新增學員/ }));
		expect(getByText('編輯學員資料')).toBeInTheDocument();
	});
});
