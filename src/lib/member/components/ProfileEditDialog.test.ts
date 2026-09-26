import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ProfileEditDialog from './ProfileEditDialog.svelte';
import type { MemberProfile, Prefs } from '$lib/member/stores';

/* 編輯個人資料 — local editable copy `f` of the `profile` prop, reset each time
 * the dialog transitions to open (FE#19 scan target: found with the same
 * two-statement `wasOpen` bug as PasswordDialog). */

const PROFILE: MemberProfile = {
	name: '陳小美',
	initial: '陳',
	email: 'mama@example.com',
	phone: '0912345678',
	birth: '2015-06-12',
	since: '2024/01'
};
const PREFS: Prefs = { classReminder: true, coachMsg: true, promo: false, dark: false };

describe('ProfileEditDialog', () => {
	it('renders nothing when closed', () => {
		const { queryByText } = render(ProfileEditDialog, { open: false, profile: PROFILE, prefs: PREFS });
		expect(queryByText('編輯個人資料')).toBeNull();
	});

	it('renders the profile fields when open', () => {
		const { getByDisplayValue } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS });
		expect(getByDisplayValue(PROFILE.name)).toBeInTheDocument();
	});

	// R13 Task 3(D2):後端沒有的欄位拿掉輸入;email 只讀。
	it('沒有家長聯絡人欄位;Email 只讀', () => {
		const { queryByLabelText, getByLabelText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS });
		expect(queryByLabelText('家長 / 緊急聯絡人')).toBeNull();
		expect((getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
	});

	it('儲存 → onSave 收到姓名/電話/生日 + 課前提醒/活動與優惠(接真的 classReminder/promo)', async () => {
		const onSave = vi.fn();
		const { getAllByRole, getByText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS, onSave });

		await fireEvent.click(getAllByRole('switch')[0]); // 課前提醒 true→false
		await fireEvent.click(getByText('儲存資料'));

		expect(onSave).toHaveBeenCalledWith({
			name: '陳小美', phone: '0912345678', birth: '2015-06-12', prefs: { classReminder: false, promo: false }
		});
	});

	it('原本有電話卻清空 → 顯示原因、儲存鈕停用(後端無法清空電話)', async () => {
		const { getByLabelText, getByRole, getByText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS });

		await fireEvent.input(getByLabelText('聯絡電話'), { target: { value: '' } });

		expect(getByRole('alert').textContent).toContain('無法清空');
		expect((getByText('儲存資料').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});

	it('saving 時儲存鈕停用(防連點)', () => {
		const { getByText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS, saving: true });
		expect((getByText('儲存資料').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});

	// 生日（Round 4 Task P4-F4）——date input，顯示既有值；清空後 onSave 收到的
	// edit 帶空字串（會員資料 module 的 saveProfile 負責轉成顯式 null 清除）。
	it('生日欄位是 <input type="date">，顯示既有值', () => {
		const { getByLabelText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS });
		const birthInput = getByLabelText('生日') as HTMLInputElement;
		expect(birthInput.type).toBe('date');
		expect(birthInput.value).toBe(PROFILE.birth);
	});

	it('清空生日並儲存 → onSave 收到的副本 birth 為空字串', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(ProfileEditDialog, { open: true, profile: PROFILE, prefs: PREFS, onSave });

		await fireEvent.input(getByLabelText('生日'), { target: { value: '' } });
		await fireEvent.click(getByText('儲存資料'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0].birth).toBe('');
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
			profile: PROFILE,
			prefs: PREFS
		});

		await rerender({ open: true, profile: PROFILE, prefs: PREFS });
		await fireEvent.input(getByDisplayValue(PROFILE.name), { target: { value: '髒草稿' } });
		expect(getByDisplayValue('髒草稿')).toBeInTheDocument();

		await rerender({ open: false, profile: PROFILE, prefs: PREFS }); // 關閉
		await rerender({ open: true, profile: PROFILE, prefs: PREFS }); // 重新開啟同一個 instance

		expect(getByDisplayValue(PROFILE.name)).toBeInTheDocument();
		expect(queryByDisplayValue('髒草稿')).toBeNull();
	});
});
