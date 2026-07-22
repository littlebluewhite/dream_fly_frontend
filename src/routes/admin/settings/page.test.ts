import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import SettingsView from './+page.svelte';
import { getSettings, putSettings } from '$lib/admin/api';
import { toasts } from '$lib/admin/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({ getSettings: vi.fn(), putSettings: vi.fn() }));

/* 系統設定 page (admin.jsx SettingsView): 場館資訊 / 通知與自動化 / 帳號與安全 cards.
 * Task F9：GET/PUT /settings 接真——刻意與前端預設值相異的 fixture，證明頁面讀的是
 * getSettings() payload 而非退回本地預設(同 coach/settings 頁 FIXTURE_COACH 慣例)。
 * 卡 C2：草稿狀態機（applyData 攤平/save 的三組 key 組裝/saving 守衛）的單元覆蓋
 * 移至 $lib/admin/settings-form.test.ts；這裡保留頁面端佈線證明——三態、PUT 全量
 * 送出、403 錯誤 toast 映射、成功 toast + 靜默刷新。 */
const FIXTURE = {
	studioProfile: {
		name: '測試體操館',
		phone: '04-9999-8888',
		address: '測試市測試路 1 號',
		defaultRatio: '1:4',
		maxClassSize: 8
	},
	notificationFlags: { email: false, sms: true, lowAtt: false, autoWait: false },
	security: { twoFA: false }
};

beforeEach(() => {
	vi.mocked(getSettings).mockReset();
	vi.mocked(getSettings).mockResolvedValue(FIXTURE);
	vi.mocked(putSettings).mockReset();
});

describe('settings (+page)', () => {
	it('renders the three section headers', async () => {
		const { container, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館資訊');
		expect(txt).toContain('通知與自動化');
		expect(txt).toContain('帳號與安全');
	});

	it('renders the venue info fields from getSettings() (not the local defaults) and the login-device list', async () => {
		const { container, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);
		expect(await findByDisplayValue(FIXTURE.studioProfile.phone)).toBeTruthy();
		expect(await findByDisplayValue(FIXTURE.studioProfile.address)).toBeTruthy();
		const txt = container.textContent ?? '';
		expect(txt).toContain('登入裝置');
		expect(txt).toContain('MacBook · Chrome'); // monitor device row
		expect(txt).toContain('iPhone · Dream Fly App'); // smartphone device row
		expect(txt).toContain('iPad · Safari'); // tablet device row
	});

	it('toggling a notification switch only updates the local draft — no toast, no putSettings call until 儲存變更 is clicked', async () => {
		const { getAllByRole, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);
		const spy = vi.spyOn(toasts, 'notify');
		const switches = getAllByRole('switch');
		expect(switches.length).toBeGreaterThan(0);
		await fireEvent.click(switches[0]); // Email 通知
		expect(spy).not.toHaveBeenCalled();
		expect(putSettings).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it('opening 變更密碼 mounts the PasswordDialog', async () => {
		const { getByText, queryByLabelText, getAllByText, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);
		// closed initially — no password fields
		expect(queryByLabelText('新密碼')).toBeNull();
		// the 變更密碼 row button (there are two "變更密碼" texts: header label + button)
		const buttons = getAllByText('變更密碼');
		await fireEvent.click(buttons[buttons.length - 1]);
		expect(getByText('更新密碼')).toBeTruthy();
	});
});

describe('settings — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getSettings).mockReset();
		vi.mocked(getSettings).mockRejectedValue(new Error('network'));
		const { findByText } = render(SettingsView);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getSettings).mockReset();
		vi.mocked(getSettings).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(SettingsView);
		expect(getByTestId('settings-skeleton')).toBeTruthy();
	});
});

describe('settings — 儲存變更接真 API（Task F9：PUT /settings）', () => {
	it('點擊儲存變更：全量送出三組 key（含編輯後的欄位），成功後顯示 toast 並靜默刷新', async () => {
		vi.mocked(putSettings).mockResolvedValue(FIXTURE);
		const { getByText, getByDisplayValue, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);

		await fireEvent.input(getByDisplayValue(FIXTURE.studioProfile.name), { target: { value: '改名體操館' } });
		await fireEvent.click(getByText('儲存變更'));

		await vi.waitFor(() => expect(putSettings).toHaveBeenCalledTimes(1));
		const body = vi.mocked(putSettings).mock.calls[0][0];
		expect(body.studio_profile).toEqual({
			name: '改名體操館',
			phone: FIXTURE.studioProfile.phone,
			address: FIXTURE.studioProfile.address,
			default_ratio: FIXTURE.studioProfile.defaultRatio,
			max_class_size: FIXTURE.studioProfile.maxClassSize
		});
		expect(body.notification_flags).toEqual(FIXTURE.notificationFlags);
		expect(body.security).toEqual(FIXTURE.security);

		await vi.waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2)); // 初次載入 + 儲存成功後 silentRefresh
	});

	it('儲存失敗（403 無權限）→ 顯示繁中錯誤 toast，不靜默刷新', async () => {
		vi.mocked(putSettings).mockRejectedValue(new ApiError(403, 'forbidden'));
		const before = get(toasts).length;

		const { getByText, findByDisplayValue } = render(SettingsView);
		await findByDisplayValue(FIXTURE.studioProfile.name);
		await fireEvent.click(getByText('儲存變更'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('權限');
		expect(getSettings).toHaveBeenCalledTimes(1); // 失敗不 silentRefresh
	});
});
