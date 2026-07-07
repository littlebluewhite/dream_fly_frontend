import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MemberCreateDialog from './MemberCreateDialog.svelte';

/* MemberCreateDialog — create-only form inside the shared EditModal (Task 16).
 * 契約 §3.2 POST /users：email/name/password 必填，phone 選填。密碼 8-128 字，前端
 * 同步擋 < 8 碼（送出前，不打後端）；空白 phone 省略（undefined），不做 email 格式
 * 驗證——交由後端 422 判斷。不打 API、不丟 toast（同 CouponCreateDialog），成功/失敗
 * 一律由呼叫端（members/+page.svelte）依 API 結果處理。 */
describe('MemberCreateDialog', () => {
	it('renders open with the 4 field labels and the 建立學員 primary', () => {
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true });
		expect(getByLabelText('Email')).toBeInTheDocument();
		expect(getByLabelText('姓名')).toBeInTheDocument();
		expect(getByLabelText('聯絡電話（選填）')).toBeInTheDocument();
		expect(getByLabelText('初始密碼')).toBeInTheDocument();
		expect(getByText('建立學員')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberCreateDialog, { open: false });
		expect(queryByText('建立學員')).toBeNull();
	});

	it('fires onSave with { email, name, phone, password } — payload 釘住', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('聯絡電話（選填）'), { target: { value: '0911222333' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('建立學員'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toEqual({
			email: 'new@example.com',
			name: '新學員',
			phone: '0911222333',
			password: 'abcd1234'
		});
	});

	it('omits phone from the payload when left blank (optional field)', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('建立學員'));

		expect(onSave.mock.calls[0][0]).toEqual({
			email: 'new@example.com',
			name: '新學員',
			password: 'abcd1234'
		});
		expect(onSave.mock.calls[0][0].phone).toBeUndefined();
	});

	it('trims email/name/phone before sending', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: '  new@example.com  ' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '  新學員  ' } });
		await fireEvent.input(getByLabelText('聯絡電話（選填）'), { target: { value: '  0911222333  ' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('建立學員'));

		expect(onSave.mock.calls[0][0]).toEqual({
			email: 'new@example.com',
			name: '新學員',
			phone: '0911222333',
			password: 'abcd1234'
		});
	});

	it('密碼過短前端擋：< 8 碼時顯示錯誤、不呼叫 onSave', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText, container } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: '1234567' } }); // 7 碼
		await fireEvent.click(getByText('建立學員'));

		expect(onSave).not.toHaveBeenCalled();
		expect(container.querySelector('.hint.err')?.textContent).toBeTruthy();
	});

	it('恰好 8 碼視為合法密碼，會呼叫 onSave（邊界值）', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: '12345678' } }); // 恰好 8 碼
		await fireEvent.click(getByText('建立學員'));

		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(MemberCreateDialog, { open: true, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	it('resets all fields (including the password error) when the dialog re-opens', async () => {
		const { getByLabelText, getByText, rerender, container } = render(MemberCreateDialog, { open: true });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'stale@example.com' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'short' } });
		await fireEvent.click(getByText('建立學員')); // triggers the inline password error
		expect(container.querySelector('.hint.err')?.textContent).toBeTruthy();

		await rerender({ open: false });
		await rerender({ open: true });

		expect((getByLabelText('Email') as HTMLInputElement).value).toBe('');
		expect((getByLabelText('初始密碼') as HTMLInputElement).value).toBe('');
		expect(container.querySelector('.hint.err')).toBeNull();
	});
});
