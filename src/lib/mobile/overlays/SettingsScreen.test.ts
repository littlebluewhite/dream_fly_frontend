import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { toasts } from '$lib/mobile/stores';
import { prefs } from '$lib/member/profile';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import SettingsScreen from './SettingsScreen.svelte';

/* SettingsScreen 偏好持久化(users.preferences，PATCH /users/me 整包覆寫)。
 *
 * R13 Task 3(C1):偏好同步機改由會員資料 module($lib/member/profile)持有,原
 * $lib/mobile/pref-sync 退役;機制本身(三種 outcome、交錯競態、水合前切換)的單元測試
 * 在 member/profile.test.ts。本檔改走 $lib/api/client + fakeRouter(ADR-0022 通知合一的
 * 前例)、真 authStore 登入,只留 markup 綁定、PATCH body 與 outcome→toast 佈線。
 * 4 個 Switch 依 DOM 順序索引:0=課程提醒 1=教練訊息 2=活動公告 3=深色模式。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const USER = {
	id: 'u-set', email: 'a@dreamfly.test', name: '王小明', phone: '0912345678', phone_verified: false,
	avatar_url: null, is_active: true, created_at: '2024-03-15T00:00:00Z', roles: ['member']
};
const ME = { ...USER, birth_date: '2013-05-18', preferences: null };

let routes: Record<string, unknown>;
function route(extra: Record<string, unknown>) {
	routes = { ...routes, ...extra };
}
function patchBodies(): unknown[] {
	return vi.mocked(api).mock.calls
		.filter(([path, init]) => path === '/users/me' && init?.method === 'PATCH')
		.map(([, init]) => JSON.parse(String(init!.body)));
}

beforeEach(async () => {
	vi.mocked(api).mockReset();
	routes = {
		'POST /auth/logout': undefined,
		'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user: USER },
		'GET /users/me': ME,
		'PATCH /users/me': (init: RequestInit) => ({ ...ME, ...JSON.parse(String(init.body)) })
	};
	vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
	await authStore.logout(); // identity 重置:prefs 回預設、每個 it 重新水合
	await authStore.login(USER.email, 'pw');
});

describe('SettingsScreen — 開啟時背景水合(GET /users/me)', () => {
	it('個人資料列顯示後端真值;沒有「會員編號」列與假的「儲存變更」按鈕', async () => {
		const { container } = render(SettingsScreen, { props: { onBack: () => {} } });

		await screen.findByText('2013-05-18');
		expect(container.textContent).toContain('0912345678');
		expect(container.textContent).not.toContain('會員編號');
		expect(screen.queryByText('儲存變更')).toBeNull();
	});

	it('水合後偏好開關反映後端值', async () => {
		route({ 'GET /users/me': { ...ME, preferences: { class_reminder: false, promo: true } } });
		render(SettingsScreen, { props: { onBack: () => {} } });

		await waitFor(() => expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false'));
		expect(screen.getAllByRole('switch')[2]).toHaveAttribute('aria-checked', 'true');
	});

	it('載入失敗時沿用目前值，不拋出、不顯示錯誤 toast', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		route({ 'GET /users/me': new Error('offline') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });

		await waitFor(() => expect(console.error).toHaveBeenCalled());
		expect(get(prefs)).toEqual({ classReminder: true, coachMsg: true, promo: false, dark: false });
		expect(notifySpy).not.toHaveBeenCalled();
		notifySpy.mockRestore();
	});
});

describe('SettingsScreen — 切換開關即時 PATCH /users/me(整包覆寫)', () => {
	it('切換課程提醒:樂觀更新 + PATCH 帶切換後的整包 4 key', async () => {
		render(SettingsScreen, { props: { onBack: () => {} } });
		await screen.findByText('2013-05-18');

		await fireEvent.click(screen.getAllByRole('switch')[0]); // 課程提醒 true→false

		expect(get(prefs).classReminder).toBe(false); // 樂觀更新立即生效
		await waitFor(() =>
			expect(patchBodies()).toEqual([{ preferences: { class_reminder: false, coach_msg: true, promo: false, dark: false } }])
		);
	});
});

describe("SettingsScreen — 送出失敗時的 toast 佈線(outcome.kind !== 'saved')", () => {
	it('PATCH 失敗:呼叫端依 outcome 映射恰一次錯誤 toast', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		route({ 'PATCH /users/me': new Error('network') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await screen.findByText('2013-05-18');

		await fireEvent.click(screen.getAllByRole('switch')[1]); // 教練訊息 true→false，送出失敗

		await waitFor(() => expect(notifySpy).toHaveBeenCalledTimes(1)); // 恰一次，非重複發送
		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', '連線發生問題，請稍後再試。');
		notifySpy.mockRestore();
	});
});
