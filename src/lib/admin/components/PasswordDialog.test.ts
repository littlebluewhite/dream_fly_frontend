import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PasswordDialog from './PasswordDialog.svelte';

/* 變更密碼 dialog (admin.jsx SettingsView password EditModal). On 更新密碼 it
 * validates new===confirm (both non-empty); a mismatch shows an inline error and
 * does NOT call onSave, a match calls onSave. Open/close handled by EditModal. */
describe('PasswordDialog', () => {
	it('renders the three password fields and the 更新密碼 primary when open', () => {
		const { getByLabelText, getByText } = render(PasswordDialog, { open: true });
		expect(getByLabelText('目前密碼')).toBeTruthy();
		expect(getByLabelText('新密碼')).toBeTruthy();
		expect(getByLabelText('確認新密碼')).toBeTruthy();
		expect(getByText('更新密碼')).toBeTruthy();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(PasswordDialog, { open: false });
		expect(queryByText('更新密碼')).toBeNull();
	});

	it('on mismatch: shows an error and does NOT call onSave', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText, container } = render(PasswordDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('新密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.input(getByLabelText('確認新密碼'), { target: { value: 'nope9999' } });
		await fireEvent.click(getByText('更新密碼'));

		expect(onSave).not.toHaveBeenCalled();
		// the error surfaces as the 確認新密碼 field's hint text
		expect(container.querySelector('.hint.err')?.textContent).toBeTruthy();
	});

	it('on empty new password: shows an error and does NOT call onSave', async () => {
		const onSave = vi.fn();
		const { getByText, container } = render(PasswordDialog, { open: true, onSave });
		await fireEvent.click(getByText('更新密碼'));
		expect(onSave).not.toHaveBeenCalled();
		expect(container.querySelector('.hint.err')?.textContent).toBeTruthy();
	});

	it('on matching non-empty passwords: calls onSave', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(PasswordDialog, { open: true, onSave });

		await fireEvent.input(getByLabelText('新密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.input(getByLabelText('確認新密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('更新密碼'));

		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(PasswordDialog, { open: true, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	// Regression (FE#19): the dialog is mounted once and toggles `open` on the
	// same instance (EditModal stays in the tree; only `open` flips). A
	// two-stage `wasOpen` reactive pair (`$: if (open && !wasOpen) {…}` then a
	// SEPARATE trailing `$: wasOpen = open;`) never resets: Svelte topologically
	// orders reactive statements by dependency, so the `wasOpen` writer runs
	// BEFORE the reader in the same flush, making `!wasOpen` always false — the
	// reset block never fires, so a dirty draft survives close → reopen.
	it('re-opening after 取消 discards an abandoned dirty draft (not a fresh mount)', async () => {
		const { rerender, getByLabelText, queryByDisplayValue } = render(PasswordDialog, {
			open: false
		});

		await rerender({ open: true });
		await fireEvent.input(getByLabelText('新密碼'), { target: { value: '髒草稿' } });
		expect(getByLabelText('新密碼')).toHaveValue('髒草稿');

		await rerender({ open: false }); // 取消／關閉
		await rerender({ open: true }); // 重新開啟同一個 instance

		expect(getByLabelText('新密碼')).toHaveValue('');
		expect(queryByDisplayValue('髒草稿')).toBeNull();
	});
});
