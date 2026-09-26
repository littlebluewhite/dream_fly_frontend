import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MemberCreateDialog from './MemberCreateDialog.svelte';
import { MEMBER_PASSWORD_ERROR } from './member-request';

/* MemberCreateDialog — create-only form inside the shared EditModal (Task 16).
 * R13 Task 4：規則與 body(trim、選填欄位省略、長度上下限)住 member-request.ts，
 * 由 member-request.test.ts 覆蓋；這裡只剩接線——欄位、onSave 收到 checkNewMember 的
 * body、不合法時顯示錯誤不送出、reset。不打 API、不丟 toast（同 CouponCreateDialog）。 */
describe('MemberCreateDialog', () => {
	it('renders open with the 5 field labels and the 建立學員 primary', () => {
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true });
		expect(getByLabelText('Email')).toBeInTheDocument();
		expect(getByLabelText('姓名')).toBeInTheDocument();
		expect(getByLabelText('聯絡電話（選填）')).toBeInTheDocument();
		expect(getByLabelText('生日（選填）')).toBeInTheDocument();
		expect(getByLabelText('初始密碼')).toBeInTheDocument();
		expect(getByText('建立學員')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberCreateDialog, { open: false });
		expect(queryByText('建立學員')).toBeNull();
	});

	it('fires onSave with checkNewMember’s body — payload 釘住', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('聯絡電話（選填）'), { target: { value: '0911222333' } });
		await fireEvent.input(getByLabelText('生日（選填）'), { target: { value: '2015-06-12' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('建立學員'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toEqual({
			email: 'new@example.com',
			name: '新學員',
			phone: '0911222333',
			password: 'abcd1234',
			birth_date: '2015-06-12'
		});
	});

	it('不合法時(密碼 7 碼)顯示 module 的錯誤、不呼叫 onSave', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(MemberCreateDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: '1234567' } }); // 7 碼
		await fireEvent.click(getByText('建立學員'));

		expect(onSave).not.toHaveBeenCalled();
		expect(getByText(MEMBER_PASSWORD_ERROR)).toBeInTheDocument();
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
		await fireEvent.input(getByLabelText('生日（選填）'), { target: { value: '2015-06-12' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'short' } });
		await fireEvent.click(getByText('建立學員')); // triggers the inline password error
		expect(container.querySelector('.hint.err')?.textContent).toBeTruthy();

		await rerender({ open: false });
		await rerender({ open: true });

		expect((getByLabelText('Email') as HTMLInputElement).value).toBe('');
		expect((getByLabelText('生日（選填）') as HTMLInputElement).value).toBe('');
		expect((getByLabelText('初始密碼') as HTMLInputElement).value).toBe('');
		expect(container.querySelector('.hint.err')).toBeNull();
	});
});
