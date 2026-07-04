import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersPage from './+page.svelte';
import type { MemberAccount } from '$lib/admin/data';
import { getMembers } from '$lib/admin/api';

/* 學員管理 (+page): Task 5 — wires the real getMembers() seam (GET /users, admin).
 * PageHead (進階篩選 toggle) over MembersTable's honest, slimmed table (name/phone/
 * joined/status/points — the only 7 fields GET /users returns). Data now arrives
 * async via getMembers(): onMount loads it into a three-state gate
 * (loading/error/ready), matching the orders/tickets/classes/coaches admin pages
 * wired in Task 18. */

const FIXTURE: MemberAccount[] = [
	{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250 },
	{ id: 'u2', name: '陳小華', initial: '陳', phone: '', joined: '2026-02-01', status: 'inactive', points: 0 }
];

vi.mock('$lib/admin/api', () => ({ getMembers: vi.fn() }));

beforeEach(() => {
	vi.mocked(getMembers).mockReset();
	vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE });
});

describe('學員管理 (+page)', () => {
	it('renders the PageHead title and the 進階篩選 toggle once loaded', async () => {
		const { container, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('學員管理');
		expect(txt).toContain('進階篩選');
	});

	it('toggles the MemberFilterPanel (套用/重設) when 進階篩選 is clicked', async () => {
		const { getByRole, getByText, queryByText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		// collapsed by default — the panel actions are not shown
		expect(queryByText('套用')).toBeNull();
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(getByText('套用')).toBeInTheDocument();
		expect(getByText('重設')).toBeInTheDocument();
		// clicking again collapses it
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(queryByText('套用')).toBeNull();
	});

	it('calls getMembers() on mount and renders the real fields', async () => {
		const { findByText, container } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getMembers).toHaveBeenCalledTimes(1);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE[0].id);
		expect(txt).toContain(FIXTURE[0].phone);
		expect(txt).toContain(FIXTURE[0].joined);
		expect(txt).toContain(String(FIXTURE[0].points));
		expect(txt).toContain(FIXTURE[1].name);
	});

	it('does not render columns/filters with no backend data source, and hides the 新增學員 affordance', async () => {
		const { findByText, container, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		const txt = container.textContent ?? '';
		for (const label of ['課程', '分校', '授課教練', '出席率', '繳費', '剩餘堂數', '近況']) {
			expect(txt).not.toContain(label);
		}
		expect(container.querySelectorAll('.att-dot')).toHaveLength(0);
		expect(queryByText('新增學員')).toBeNull();
	});

	it('進階篩選 panel only offers 最低點數 (course/pay/attendance filters removed — no backend data)', async () => {
		const { getByRole, getByLabelText, queryByText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(getByLabelText('最低點數')).toBeInTheDocument();
		expect(queryByText('報名課程')).toBeNull();
		expect(queryByText('繳費狀態')).toBeNull();
		expect(queryByText('出席率區間')).toBeNull();
	});
});

describe('學員管理 (+page) — 三態', () => {
	it('error：顯示「載入失敗」', async () => {
		vi.mocked(getMembers).mockReset();
		vi.mocked(getMembers).mockRejectedValue(new Error('network'));
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');
	});

	it('loading：顯示骨架', () => {
		vi.mocked(getMembers).mockReset();
		vi.mocked(getMembers).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(MembersPage);
		expect(getByTestId('members-skeleton')).toBeTruthy();
	});
});
