import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CouponCreateDialog from './CouponCreateDialog.svelte';
import type { Coupon } from '$lib/admin/api';

/* CouponCreateDialog — 新增/編輯優惠碼表單 inside the shared EditModal. Task F6：
 * 比照 TicketEditDialog（Task F1）擴出 isNew 分支，取代原本的 create-only 表單。
 * onSave 現在 emit 編輯後的 domain Coupon（不是 wire body——create/update 的 wire
 * body 形狀不同：code 只在 create、is_active 只在 update，不是可共用的寬鬆型別），
 * 由呼叫端 coupons/+page.svelte 決定怎麼組出 CreateCouponBody/UpdateCouponBody。
 * 到期日留白＝永久有效，emit 為 '—' 哨兵（同 admin/api.ts mapCoupon 的顯示慣例）。 */

const blank = (): Coupon => ({ id: '', code: '', discount: 0, active: true, expiresAt: '—' });
const BASE: Coupon = { id: 'cp1', code: 'SPRING10', discount: 300, active: true, expiresAt: '2026-12-31' };

describe('CouponCreateDialog — 新增模式 (isNew=true)', () => {
	it('renders open with the 3 field labels, 建立優惠碼 primary, 新增優惠碼 title, code editable', () => {
		const { getByText, getByLabelText } = render(CouponCreateDialog, { open: true, isNew: true, coupon: blank() });
		expect(getByLabelText('優惠碼代碼')).toBeInTheDocument();
		expect((getByLabelText('優惠碼代碼') as HTMLInputElement).disabled).toBe(false);
		expect(getByLabelText('折扣金額 (NT$)')).toBeInTheDocument();
		expect(getByLabelText('到期日（選填，留白為永久有效）')).toBeInTheDocument();
		expect(getByText('新增優惠碼')).toBeInTheDocument();
		expect(getByText('建立優惠碼')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(CouponCreateDialog, { open: false, isNew: true, coupon: blank() });
		expect(queryByText('建立優惠碼')).toBeNull();
	});

	it('renders no 優惠碼啟用 switch and no 危險區 delete button in new mode', () => {
		const { queryByText, queryByRole } = render(CouponCreateDialog, {
			open: true,
			isNew: true,
			coupon: blank()
		});
		expect(queryByText('優惠碼啟用')).toBeNull();
		expect(queryByText('刪除優惠碼')).toBeNull();
		expect(queryByRole('switch')).toBeNull();
	});

	it('fires onSave with the trimmed code + parsed discount, expiresAt staying "—" when left blank', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, {
			open: true,
			isNew: true,
			coupon: blank(),
			onSave
		});

		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: '  SPRING10  ' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '300' } });
		await fireEvent.click(getByText('建立優惠碼'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const saved = onSave.mock.calls[0][0] as Coupon;
		expect(saved.code).toBe('SPRING10'); // trimmed
		expect(saved.discount).toBe(300);
		expect(saved.expiresAt).toBe('—');
	});

	it('fires onSave with a yyyy-mm-dd expiresAt when a date is filled in', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, {
			open: true,
			isNew: true,
			coupon: blank(),
			onSave
		});

		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'WINTER50' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '500' } });
		await fireEvent.input(getByLabelText('到期日（選填，留白為永久有效）'), {
			target: { value: '2026-12-31' }
		});
		await fireEvent.click(getByText('建立優惠碼'));

		expect(onSave.mock.calls[0][0].expiresAt).toBe('2026-12-31');
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(CouponCreateDialog, { open: true, isNew: true, coupon: blank(), onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	it('resets all fields when a fresh blank coupon is passed in on re-open', async () => {
		const { getByLabelText, rerender } = render(CouponCreateDialog, { open: true, isNew: true, coupon: blank() });
		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'STALE' } });

		await rerender({ open: false, isNew: true, coupon: null });
		await rerender({ open: true, isNew: true, coupon: blank() });

		expect((getByLabelText('優惠碼代碼') as HTMLInputElement).value).toBe('');
	});
});

describe('CouponCreateDialog — 編輯模式 (isNew=false，Task F6)', () => {
	it('renders open with 編輯優惠碼 title, 儲存優惠碼 primary, and a read-only code (契約：PATCH 不可改 code)', () => {
		const { getByText, getByLabelText } = render(CouponCreateDialog, { open: true, coupon: BASE });
		expect(getByText('編輯優惠碼')).toBeInTheDocument();
		expect(getByText('優惠碼 SPRING10')).toBeInTheDocument();
		expect(getByText('儲存優惠碼')).toBeInTheDocument();
		const codeInput = getByLabelText('優惠碼代碼') as HTMLInputElement;
		expect(codeInput.value).toBe('SPRING10');
		expect(codeInput.disabled).toBe(true);
	});

	it('pre-fills discount/到期日 from the coupon prop and shows the 優惠碼啟用 switch ON', () => {
		const { getByLabelText, getByRole } = render(CouponCreateDialog, { open: true, coupon: BASE });
		expect((getByLabelText('折扣金額 (NT$)') as HTMLInputElement).value).toBe('300');
		expect((getByLabelText('到期日（選填，留白為永久有效）') as HTMLInputElement).value).toBe('2026-12-31');
		expect(getByRole('switch').getAttribute('aria-checked')).toBe('true');
	});

	it('renders the switch OFF for an inactive coupon', () => {
		const inactive: Coupon = { ...BASE, active: false };
		const { getByRole } = render(CouponCreateDialog, { open: true, coupon: inactive });
		expect(getByRole('switch').getAttribute('aria-checked')).toBe('false');
	});

	it('renders a blank 到期日 field for a permanently-valid coupon (expiresAt === "—")', () => {
		const permanent: Coupon = { ...BASE, expiresAt: '—' };
		const { getByLabelText } = render(CouponCreateDialog, { open: true, coupon: permanent });
		expect((getByLabelText('到期日（選填，留白為永久有效）') as HTMLInputElement).value).toBe('');
	});

	it('fires onSave with the edited discount, code left untouched (readonly)', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, { open: true, coupon: BASE, onSave });

		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '450' } });
		await fireEvent.click(getByText('儲存優惠碼'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const saved = onSave.mock.calls[0][0] as Coupon;
		expect(saved.id).toBe('cp1');
		expect(saved.code).toBe('SPRING10');
		expect(saved.discount).toBe(450);
		expect(saved.active).toBe(true);
		expect(saved.expiresAt).toBe('2026-12-31');
	});

	it('toggling 優惠碼啟用 off and saving emits active:false', async () => {
		const onSave = vi.fn();
		const { getByRole, getByText } = render(CouponCreateDialog, { open: true, coupon: BASE, onSave });

		await fireEvent.click(getByRole('switch'));
		await fireEvent.click(getByText('儲存優惠碼'));

		expect(onSave.mock.calls[0][0].active).toBe(false);
	});

	it('clearing 到期日 to blank emits expiresAt "—" (清成永久有效)', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(CouponCreateDialog, { open: true, coupon: BASE, onSave });

		await fireEvent.input(getByLabelText('到期日（選填，留白為永久有效）'), { target: { value: '' } });
		await fireEvent.click(getByText('儲存優惠碼'));

		expect(onSave.mock.calls[0][0].expiresAt).toBe('—');
	});

	it('renders a 危險區 with a 刪除 button that fires onDelete (not onSave) when clicked', async () => {
		const onDelete = vi.fn();
		const onSave = vi.fn();
		const { getByText } = render(CouponCreateDialog, { open: true, coupon: BASE, onDelete, onSave });

		expect(getByText('刪除優惠碼')).toBeInTheDocument();
		await fireEvent.click(getByText('刪除'));

		expect(onDelete).toHaveBeenCalledTimes(1);
		expect(onSave).not.toHaveBeenCalled();
	});

	it('resets fields when the coupon prop changes to a different coupon (no stale data)', async () => {
		const other: Coupon = { id: 'cp2', code: 'WELCOME50', discount: 50, active: false, expiresAt: '—' };
		const { getByLabelText, rerender } = render(CouponCreateDialog, { open: true, coupon: BASE });
		expect((getByLabelText('優惠碼代碼') as HTMLInputElement).value).toBe('SPRING10');

		await rerender({ open: true, coupon: other });

		expect((getByLabelText('優惠碼代碼') as HTMLInputElement).value).toBe('WELCOME50');
		expect((getByLabelText('折扣金額 (NT$)') as HTMLInputElement).value).toBe('50');
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(CouponCreateDialog, { open: true, coupon: BASE, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});
});
