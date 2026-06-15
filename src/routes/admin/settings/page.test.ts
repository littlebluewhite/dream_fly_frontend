import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SettingsView from './+page.svelte';
import { toasts } from '$lib/admin/stores';

/* 系統設定 page (admin.jsx SettingsView): 場館資訊 / 通知與自動化 / 帳號與安全 cards.
 * The notification switches and the 2FA switch each push a toast on change. */
describe('settings (+page)', () => {
	it('renders the three section headers', () => {
		const { container } = render(SettingsView);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館資訊');
		expect(txt).toContain('通知與自動化');
		expect(txt).toContain('帳號與安全');
	});

	it('renders the venue info fields and the login-device list', () => {
		const { container } = render(SettingsView);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館名稱');
		expect(txt).toContain('登入裝置');
		expect(txt).toContain('MacBook · Chrome'); // monitor device row
		expect(txt).toContain('iPhone · Dream Fly App'); // smartphone device row
		expect(txt).toContain('iPad · Safari'); // tablet device row
	});

	it('toggling a notification switch fires a toast', async () => {
		const spy = vi.spyOn(toasts, 'notify');
		const { getAllByRole } = render(SettingsView);
		const switches = getAllByRole('switch');
		expect(switches.length).toBeGreaterThan(0);
		await fireEvent.click(switches[0]); // Email 通知
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it('opening 變更密碼 mounts the PasswordDialog', async () => {
		const { getByText, queryByLabelText, getAllByText } = render(SettingsView);
		// closed initially — no password fields
		expect(queryByLabelText('新密碼')).toBeNull();
		// the 變更密碼 row button (there are two "變更密碼" texts: header label + button)
		const buttons = getAllByText('變更密碼');
		await fireEvent.click(buttons[buttons.length - 1]);
		expect(getByText('更新密碼')).toBeTruthy();
	});
});
