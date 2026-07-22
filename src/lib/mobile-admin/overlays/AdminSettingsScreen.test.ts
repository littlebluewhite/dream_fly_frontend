import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AdminSettingsScreen from './AdminSettingsScreen.svelte';
import { getSettings, putSettings } from '$lib/mobile-admin/api';
import { toasts } from '$lib/mobile-admin/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getSettings: vi.fn(), putSettings: vi.fn() };
});

/* 系統設定 push screen — Task F9：GET/PUT /settings 接真(復用桌面 admin/api.ts，見
 * $lib/mobile-admin/api 零映射 re-export)。刻意與前端預設值相異的 fixture，證明畫面
 * 讀的是 getSettings() payload 而非退回本地預設(同桌面 page.test.ts 慣例)。
 * 卡 C2：草稿狀態機的單元覆蓋移至 $lib/admin/settings-form.test.ts；這裡保留畫面端
 * 佈線證明——三態、PUT 全量送出、403 錯誤 toast 映射、成功 toast + 靜默刷新。
 * createSettingsForm 經 $lib/mobile-admin/api 零映射 re-export 取用，下方既有的
 * importOriginal+spread vi.mock 寫法會自動吃到，不需為它另外客製 mock。 */
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

describe('AdminSettingsScreen — 載入(GET /settings)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(getSettings).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		expect(getByTestId('settings-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」', async () => {
		vi.mocked(getSettings).mockRejectedValue(new Error('network'));
		const { findByText } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});

	it('ready：欄位顯示 getSettings() 回傳值（非本地預設）', async () => {
		const { findByDisplayValue } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByDisplayValue(FIXTURE.studioProfile.name);
		expect(await findByDisplayValue(FIXTURE.studioProfile.phone)).toBeTruthy();
		expect(await findByDisplayValue(FIXTURE.studioProfile.address)).toBeTruthy();
	});
});

describe('AdminSettingsScreen — 儲存變更（PUT /settings）', () => {
	it('點擊儲存變更：全量送出三組 key，成功後 toast 並靜默刷新', async () => {
		vi.mocked(putSettings).mockResolvedValue(FIXTURE);
		const { getByText, getByDisplayValue, findByDisplayValue } = render(AdminSettingsScreen, {
			props: { onBack: () => {} }
		});
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

		const { getByText, findByDisplayValue } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByDisplayValue(FIXTURE.studioProfile.name);
		await fireEvent.click(getByText('儲存變更'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('權限');
		expect(getSettings).toHaveBeenCalledTimes(1); // 失敗不 silentRefresh
	});
});
