import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ProfileEditDialog from './ProfileEditDialog.svelte';

/* 編輯個人資料 — local editable copy `f` of the `profile` prop, reset each time
 * the dialog transitions to open (FE#19 scan target: found with the same
 * two-statement `wasOpen` bug as PasswordDialog). */

const PROFILE = {
	id: 'GY2024001',
	name: '陳小美',
	initial: '陳',
	color: '#0066CC',
	birth: '2015/06/12',
	phone: '0912-345-678',
	email: 'mama@example.com',
	guardian: '陳媽媽',
	remind: true,
	promo: false
};

describe('ProfileEditDialog', () => {
	it('renders nothing when closed', () => {
		const { queryByText } = render(ProfileEditDialog, { open: false, profile: PROFILE });
		expect(queryByText('編輯個人資料')).toBeNull();
	});

	it('renders the profile fields when open', () => {
		const { getByDisplayValue } = render(ProfileEditDialog, { open: true, profile: PROFILE });
		expect(getByDisplayValue(PROFILE.name)).toBeInTheDocument();
	});

	// Regression (FE#19): the dialog is mounted once and toggles `open` on the
	// same instance. A two-stage `wasOpen` reactive pair (`$: if (open &&
	// !wasOpen) f = {...profile};` then a SEPARATE trailing `$: wasOpen =
	// open;`) never resets: Svelte topologically orders reactive statements by
	// dependency, so the `wasOpen` writer runs BEFORE the reader in the same
	// flush, making `!wasOpen` always false — an unsaved edit could survive a
	// close → reopen on the same mounted instance instead of reverting to the
	// real profile.
	it('re-opening after close discards an abandoned dirty draft (not a fresh mount)', async () => {
		const { rerender, getByDisplayValue, queryByDisplayValue } = render(ProfileEditDialog, {
			open: false,
			profile: PROFILE
		});

		await rerender({ open: true, profile: PROFILE });
		await fireEvent.input(getByDisplayValue(PROFILE.name), { target: { value: '髒草稿' } });
		expect(getByDisplayValue('髒草稿')).toBeInTheDocument();

		await rerender({ open: false, profile: PROFILE }); // 關閉
		await rerender({ open: true, profile: PROFILE }); // 重新開啟同一個 instance

		expect(getByDisplayValue(PROFILE.name)).toBeInTheDocument();
		expect(queryByDisplayValue('髒草稿')).toBeNull();
	});
});
