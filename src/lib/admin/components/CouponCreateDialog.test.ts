import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CouponCreateDialog from './CouponCreateDialog.svelte';

/* CouponCreateDialog — create-only form inside the shared EditModal (Task 8
 * piece 3). No isNew/edit branch: 後端只有 POST /coupons，沒有 update，只有這一種
 * 模式。折扣金額 (NT$) 經 toCents 換算；到期日留白＝永久有效（省略 expires_at）；
 * 填了日期則轉成當日結束的 UTC 時間戳，讓「到期日當天仍可使用」符合直覺。 */
describe('CouponCreateDialog', () => {
	it('renders open with the 3 field labels and the 建立優惠碼 primary', () => {
		const { getByText, getByLabelText } = render(CouponCreateDialog, { open: true });
		expect(getByLabelText('優惠碼代碼')).toBeInTheDocument();
		expect(getByLabelText('折扣金額 (NT$)')).toBeInTheDocument();
		expect(getByLabelText('到期日（選填，留白為永久有效）')).toBeInTheDocument();
		expect(getByText('建立優惠碼')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(CouponCreateDialog, { open: false });
		expect(queryByText('建立優惠碼')).toBeNull();
	});

	it('fires onSave with { code, discount_cents } (toCents converted), omitting expires_at when left blank', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'SPRING10' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '300' } });
		await fireEvent.click(getByText('建立優惠碼'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toEqual({ code: 'SPRING10', discount_cents: 30000 });
	});

	it('includes expires_at as an end-of-day UTC timestamp when a date is filled in', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'WINTER50' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '500' } });
		await fireEvent.input(getByLabelText('到期日（選填，留白為永久有效）'), {
			target: { value: '2026-12-31' }
		});
		await fireEvent.click(getByText('建立優惠碼'));

		expect(onSave.mock.calls[0][0]).toEqual({
			code: 'WINTER50',
			discount_cents: 50000,
			expires_at: '2026-12-31T23:59:59Z'
		});
	});

	it('trims the code before sending', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: '  PADDED  ' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '100' } });
		await fireEvent.click(getByText('建立優惠碼'));

		expect(onSave.mock.calls[0][0].code).toBe('PADDED');
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(CouponCreateDialog, { open: true, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	it('resets all fields when the dialog re-opens', async () => {
		const { getByLabelText, rerender } = render(CouponCreateDialog, { open: true });
		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'STALE' } });

		await rerender({ open: false });
		await rerender({ open: true });

		expect((getByLabelText('優惠碼代碼') as HTMLInputElement).value).toBe('');
	});
});
