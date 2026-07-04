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

	/* 空白 配額 = 不限（null，見 ProductResponse.quota null=無限）。ProductResponse.quota
	 * 對非 merchandise 票券幾乎恆為 null，會經 getTickets() 進到這個對話框；空白存檔必須
	 * 保留 null，不可硬轉成 1（否則把「不限」悄悄改成「配額 1」，票券卡進度條瞬間爆到近 ∞%）。 */
	it('treats a blank 配額 as 不限 (null) on save — an unlimited ticket, not a coerced 1', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(TicketEditDialog, {
			open: true,
			ticket: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.quota)), { target: { value: '' } });
		await fireEvent.click(getByText('儲存票券'));
		expect(onSave.mock.calls[0][0].quota).toBeNull();
	});

	/* A typed 0 is still floored to ≥ 1 (a 0 quota would make max=0 in the ticket
	 * ProgressBar and render NaN% — ProgressBar.svelte:15 divides by max). Only a *blank*
	 * field means 不限; an explicit 0 is a bad limited value, not "unlimited". */
	it('clamps a typed 0 quota to ≥ 1 on save (guards the ProgressBar NaN%)', async () => {
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

	/* Regression (Task 4): quota went from a hardcoded 0 to the real ProductResponse.quota,
	 * which is null (不限) for every non-merchandise ticket. String(null) rendered the literal
	 * "null" in the 配額 field, and 儲存 ran parseInt("null")||1 → silently flipped 不限 to 1. */
	it('renders a null quota (不限) as an empty 配額 field, not the literal "null"', () => {
		const nullQuota: Ticket = { ...TICKETS[0], quota: null };
		const { getByLabelText } = render(TicketEditDialog, { open: true, ticket: nullQuota });
		const quotaInput = getByLabelText('配額') as HTMLInputElement;
		expect(quotaInput.value).toBe('');
		expect(quotaInput.value).not.toBe('null');
	});

	it('keeps a 不限 (null) quota null on save when the field is left untouched — no null→1 corruption', async () => {
		const onSave = vi.fn();
		const nullQuota: Ticket = { ...TICKETS[0], quota: null };
		const { getByText } = render(TicketEditDialog, { open: true, ticket: nullQuota, onSave });
		await fireEvent.click(getByText('儲存票券'));
		expect(onSave.mock.calls[0][0].quota).toBeNull();
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
