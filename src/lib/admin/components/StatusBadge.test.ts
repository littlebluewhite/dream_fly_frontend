import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';
import type { TicketType } from '$lib/admin/data';

/* StatusBadge maps a (kind, value) pair onto the shared Badge, resolving tone +
 * label from the frozen $lib/admin/data status maps and applying the per-kind
 * dot/solid the admin prototype uses. Badge renders the dot as a `.dot` span and
 * a solid pill as a `.solid` class on the `.badge` span — assertions target both. */
describe('StatusBadge', () => {
	const dot = (c: HTMLElement) => c.querySelector('.badge .dot');
	const isSolid = (c: HTMLElement) => c.querySelector('.badge')?.classList.contains('solid');

	it('member/active → 在學中 with a leading dot', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'member', value: 'active' });
		expect(getByText('在學中')).toBeInTheDocument();
		expect(dot(container)).not.toBeNull();
		expect(isSolid(container)).toBe(false);
	});

	it('pay/paid → 已繳清, no dot, not solid', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'pay', value: 'paid' });
		expect(getByText('已繳清')).toBeInTheDocument();
		expect(dot(container)).toBeNull();
		expect(isSolid(container)).toBe(false);
	});

	it('order/refunded → 已退款 with a dot', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'order', value: 'refunded' });
		expect(getByText('已退款')).toBeInTheDocument();
		expect(dot(container)).not.toBeNull();
	});

	it('classLevel/進階 → 進階, plain (no dot, not solid)', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'classLevel', value: '進階' });
		expect(getByText('進階')).toBeInTheDocument();
		expect(dot(container)).toBeNull();
		expect(isSolid(container)).toBe(false);
	});

	it('classStatus/額滿 → 額滿, IS solid (no dot)', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'classStatus', value: '額滿' });
		expect(getByText('額滿')).toBeInTheDocument();
		expect(isSolid(container)).toBe(true);
		expect(dot(container)).toBeNull();
	});

	it('classStatus/招生中 → 招生中, NOT solid', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'classStatus', value: '招生中' });
		expect(getByText('招生中')).toBeInTheDocument();
		expect(isSolid(container)).toBe(false);
	});

	it('venue/available → 可預約 with a dot', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'venue', value: 'available' });
		expect(getByText('可預約')).toBeInTheDocument();
		expect(dot(container)).not.toBeNull();
	});

	it('memberAccount/active → 啟用中 with a leading dot (Task 5: real GET /users is_active)', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'memberAccount', value: 'active' });
		expect(getByText('啟用中')).toBeInTheDocument();
		expect(dot(container)).not.toBeNull();
	});

	it('memberAccount/inactive → 已停用', () => {
		const { getByText } = render(StatusBadge, { kind: 'memberAccount', value: 'inactive' });
		expect(getByText('已停用')).toBeInTheDocument();
	});

	it('ticket/membership → 月票方案, plain', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'ticket', value: 'membership' });
		expect(getByText('月票方案')).toBeInTheDocument();
		expect(dot(container)).toBeNull();
		expect(isSolid(container)).toBe(false);
	});

	/* Important #2(a)(終審)：product_type 契約若擴出第 4 值(admin/api.ts mapProduct
	 * 的 `p.product_type as TicketType` 目前無法在編譯期擋下)，TICKET_TYPE 查表查無
	 * 對應 key——降級為 neutral tone + 原字串標籤，不會 destructure 到 undefined 而
	 * 讓整頁 crash。 */
	it('ticket/未知值(契約若擴集) → 降級為 neutral tone + 原字串標籤，不會炸掉', () => {
		const { container, getByText } = render(StatusBadge, {
			kind: 'ticket',
			value: 'gift_card' as TicketType
		});
		expect(getByText('gift_card')).toBeInTheDocument();
		expect(dot(container)).toBeNull();
	});
});
