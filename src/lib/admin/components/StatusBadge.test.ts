import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

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

	it('ticket/pass → 通行票, plain', () => {
		const { container, getByText } = render(StatusBadge, { kind: 'ticket', value: 'pass' });
		expect(getByText('通行票')).toBeInTheDocument();
		expect(dot(container)).toBeNull();
		expect(isSolid(container)).toBe(false);
	});
});
