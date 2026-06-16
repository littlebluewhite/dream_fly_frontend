import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TicketEditDialog from './TicketEditDialog.svelte';
import { TICKETS, type Ticket } from '$lib/admin/data';

/* TicketEditDialog — edit form in the shared EditModal (clone of
 * ClassEditDialog). Holds a local copy of the ticket; 儲存 fires onSave(updated)
 * + a success toast. We assert the fields render, the onSave wiring carries the
 * edit, numeric fields coerce back to numbers, and the quota clamp protects the
 * ProgressBar from a NaN% fill. */
const base: Ticket = TICKETS[0]; // 月票 · 自由練習

describe('TicketEditDialog', () => {
	it('renders open with the ticket name field and the 儲存票券 primary', () => {
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存票券')).toBeInTheDocument();
	});

	it('renders the editable field labels', () => {
		const { getByText } = render(TicketEditDialog, { open: true, ticket: base });
		for (const lbl of ['票券名稱', '票券類型', '票價 (NT$)', '配額', '已售張數']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(TicketEditDialog, { open: false, ticket: base });
		expect(queryByText('儲存票券')).toBeNull();
	});

	it('fires onSave with the edited name when 儲存票券 is clicked', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base,
			onSave
		});

		const nameInput = getByDisplayValue(base.name) as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '測試票券' } });
		await fireEvent.click(getByText('儲存票券'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const updated = onSave.mock.calls[0][0] as Ticket;
		expect(updated.name).toBe('測試票券');
		expect(updated.id).toBe(base.id); // identity preserved
	});

	it('coerces edited numeric fields (price/quota/sold) back to numbers on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.price)), { target: { value: '3000' } });
		await fireEvent.input(getByDisplayValue(String(base.quota)), { target: { value: '250' } });
		await fireEvent.input(getByDisplayValue(String(base.sold)), { target: { value: '90' } });
		await fireEvent.click(getByText('儲存票券'));
		const updated = onSave.mock.calls[0][0] as Ticket;
		expect(updated.price).toBe(3000);
		expect(updated.quota).toBe(250);
		expect(updated.sold).toBe(90);
	});

	/* P1 (plan B1): an empty/0 quota becomes max=0 in the ticket ProgressBar and
	 * renders NaN% (ProgressBar.svelte:15 divides by max). Saving must clamp quota
	 * to ≥ 1 so the bar stays honest. */
	it('clamps a blank quota to ≥ 1 on save (guards the ProgressBar NaN%)', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.quota)), { target: { value: '' } });
		await fireEvent.click(getByText('儲存票券'));
		expect(onSave.mock.calls[0][0].quota).toBeGreaterThanOrEqual(1);
	});

	it('clamps a 0 quota to ≥ 1 on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.quota)), { target: { value: '0' } });
		await fireEvent.click(getByText('儲存票券'));
		expect(onSave.mock.calls[0][0].quota).toBeGreaterThanOrEqual(1);
	});

	it('uses the 建立票券 primary and 新增票券 title in new mode', () => {
		const { getByText } = render(TicketEditDialog, { open: true, ticket: base, isNew: true });
		expect(getByText('建立票券')).toBeInTheDocument();
		expect(getByText('新增票券')).toBeInTheDocument();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(TicketEditDialog, { open: true, ticket: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});
});
