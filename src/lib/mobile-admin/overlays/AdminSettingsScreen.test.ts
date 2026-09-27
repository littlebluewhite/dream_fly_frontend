import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AdminSettingsScreen from './AdminSettingsScreen.svelte';
import { toasts } from '$lib/mobile-admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 系統設定 push screen — Task F9：GET/PUT /settings 接真(復用桌面 admin/api.ts，見
 * $lib/mobile-admin/api 零映射 re-export)。刻意與前端預設值相異的 fixture，證明畫面
 * 讀的是 getSettings() payload 而非退回本地預設(同桌面 page.test.ts 慣例)。
 * 卡 C2：草稿狀態機的單元覆蓋移至 $lib/admin/settings-form.test.ts；這裡保留畫面端
 * 佈線證明——三態、PUT 全量送出、403 錯誤 toast 映射、成功 toast + 靜默刷新。
 * R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，走真實 getSettings/
 * putSettings(GET/PUT /settings)實作，fixture 改為 wire 形狀(snake_case)。 */
const FIXTURE = {
	settings: {
		studio_profile: {
			name: '測試體操館',
			phone: '04-9999-8888',
			address: '測試市測試路 1 號',
			default_ratio: '1:4',
			max_class_size: 8
		},
		notification_flags: { email: false, sms: true, lowAtt: false, autoWait: false },
		security: { twoFA: false }
	}
};

function callCount(method: string, path: string): number {
	return vi.mocked(api).mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method).length;
}

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': FIXTURE }));
});

describe('AdminSettingsScreen — 載入(GET /settings)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		expect(getByTestId('settings-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': new Error('network') }));
		const { findByText } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});

	it('ready：欄位顯示 getSettings() 回傳值（非本地預設）', async () => {
		const { findByDisplayValue } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByDisplayValue(FIXTURE.settings.studio_profile.name);
		expect(await findByDisplayValue(FIXTURE.settings.studio_profile.phone)).toBeTruthy();
		expect(await findByDisplayValue(FIXTURE.settings.studio_profile.address)).toBeTruthy();
	});
});

describe('AdminSettingsScreen — 儲存變更（PUT /settings）', () => {
	it('點擊儲存變更：全量送出三組 key，成功後 toast 並靜默刷新', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': FIXTURE, 'PUT /settings': FIXTURE }));
		const { getByText, getByDisplayValue, findByDisplayValue } = render(AdminSettingsScreen, {
			props: { onBack: () => {} }
		});
		await findByDisplayValue(FIXTURE.settings.studio_profile.name);

		await fireEvent.input(getByDisplayValue(FIXTURE.settings.studio_profile.name), { target: { value: '改名體操館' } });
		await fireEvent.click(getByText('儲存變更'));

		await vi.waitFor(() => expect(callCount('PUT', '/settings')).toBe(1));
		const body = JSON.parse(vi.mocked(api).mock.calls.find(([p, init]) => p === '/settings' && init?.method === 'PUT')![1]!.body as string).settings;
		expect(body.studio_profile).toEqual({
			name: '改名體操館',
			phone: FIXTURE.settings.studio_profile.phone,
			address: FIXTURE.settings.studio_profile.address,
			default_ratio: FIXTURE.settings.studio_profile.default_ratio,
			max_class_size: FIXTURE.settings.studio_profile.max_class_size
		});
		expect(body.notification_flags).toEqual(FIXTURE.settings.notification_flags);
		expect(body.security).toEqual(FIXTURE.settings.security);

		await vi.waitFor(() => expect(callCount('GET', '/settings')).toBe(2)); // 初次載入 + 儲存成功後 silentRefresh
	});

	it('儲存失敗（403 無權限）→ 顯示繁中錯誤 toast，不靜默刷新', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /settings': FIXTURE, 'PUT /settings': new ApiError(403, 'forbidden') })
		);
		const before = get(toasts).length;

		const { getByText, findByDisplayValue } = render(AdminSettingsScreen, { props: { onBack: () => {} } });
		await findByDisplayValue(FIXTURE.settings.studio_profile.name);
		await fireEvent.click(getByText('儲存變更'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('權限');
		expect(callCount('GET', '/settings')).toBe(1); // 失敗不 silentRefresh
	});
});
