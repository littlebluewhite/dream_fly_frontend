import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { toasts } from '$lib/mobile/stores';
import EditProfileSheet from './EditProfileSheet.svelte';

/* EditProfileSheet(R13 Task 3·C1):存檔一次 saveProfile(PATCH /users/me),只送改過的
 * 欄位;偏好送整包(後端原始物件 + 4 鍵)。改走 $lib/api/client + fakeRouter(ADR-0022
 * 通知合一的前例)、真 authStore 登入、真會員資料 module。從帳號頁情境開啟(Settings
 * 未掛載),水合只靠本 sheet 自己觸發。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const USER = {
	id: 'u-eps', email: 'mama@example.com', name: '陳小美', phone: '0912345678', phone_verified: false,
	avatar_url: null, is_active: true, created_at: '2024-01-01T00:00:00Z', roles: ['member']
};
const SERVER_PREFS = { class_reminder: false, coach_msg: true, promo: true, dark: false, legacy_key: 'x' };
const ME = { ...USER, birth_date: '2015-06-12', preferences: SERVER_PREFS };

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => (resolve = res));
	return { promise, resolve };
}

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
	await authStore.logout(); // identity 重置:會員資料 module 每個 it 重新水合
	await authStore.login(USER.email, 'pw');
});

async function openHydrated(onClose = vi.fn()) {
	render(EditProfileSheet, { props: { onClose } });
	await waitFor(() => expect(screen.getByText('儲存資料').closest('button')).not.toBeDisabled());
	return onClose;
}

describe('EditProfileSheet — 一次 saveProfile', () => {
	it('水合後顯示真值;只切一個偏好 → PATCH 只帶 preferences 整包(伺服器值 + 那一個改動,未知鍵保住)', async () => {
		const onClose = await openHydrated();

		// PREF_ROWS 順序：0=課前提醒(classReminder) 1=教練訊息(coachMsg) 2=活動與優惠(promo)。
		const switches = screen.getAllByRole('switch');
		expect(switches).toHaveLength(3);
		expect(switches[0]).toHaveAttribute('aria-checked', 'false'); // 伺服器值
		expect(switches[2]).toHaveAttribute('aria-checked', 'true');
		expect((screen.getByLabelText('學員姓名') as HTMLInputElement).value).toBe('陳小美');

		await fireEvent.click(switches[2]); // 只切 promo
		await fireEvent.click(screen.getByText('儲存資料'));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(patchBodies()).toEqual([{ preferences: { ...SERVER_PREFS, promo: false } }]);
	});

	it('改姓名與電話 → 同一筆 PATCH 只送這兩欄;authStore 名字同步', async () => {
		const onClose = await openHydrated();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '陳大美' } });
		await fireEvent.input(screen.getByLabelText('聯絡電話'), { target: { value: '0987654321' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(patchBodies()).toEqual([{ name: '陳大美', phone: '0987654321' }]);
		expect(get(authStore).member?.name).toBe('陳大美');
	});

	it('沒有任何改動時存檔,不發 PATCH、照樣關閉', async () => {
		const onClose = await openHydrated();

		await fireEvent.click(screen.getByText('儲存資料'));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(patchBodies()).toEqual([]);
	});

	it('沒有會員編號、家長聯絡人、大頭照底色;Email 只讀', async () => {
		await openHydrated();

		expect(screen.queryByText(/會員編號/)).toBeNull();
		expect(screen.queryByLabelText('家長 / 緊急聯絡人')).toBeNull();
		expect(screen.queryByText('大頭照底色')).toBeNull();
		expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
	});

	it('原本有電話卻清空 → 顯示原因、儲存鈕停用', async () => {
		await openHydrated();

		await fireEvent.input(screen.getByLabelText('聯絡電話'), { target: { value: '' } });

		expect(screen.getByRole('alert').textContent).toContain('無法清空');
		expect(screen.getByText('儲存資料').closest('button')).toBeDisabled();
	});

	it('PATCH 失敗 → 錯誤 toast,sheet 不關', async () => {
		route({ 'PATCH /users/me': new Error('network') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		const onClose = await openHydrated();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '陳大美' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await waitFor(() => expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', '連線發生問題，請稍後再試。'));
		expect(onClose).not.toHaveBeenCalled();
		notifySpy.mockRestore();
	});
});

describe('EditProfileSheet — 鎖', () => {
	it('水合尚未落地時,Switch 與「儲存資料」都是 disabled,點擊不送出也不關閉', async () => {
		const getMe = deferred<unknown>();
		route({ 'GET /users/me': () => getMe.promise });
		const onClose = vi.fn();
		render(EditProfileSheet, { props: { onClose } });

		const switches = screen.getAllByRole('switch');
		for (const sw of switches) expect(sw).toHaveAttribute('disabled');
		const saveBtn = screen.getByText('儲存資料').closest('button')!;
		expect(saveBtn).toBeDisabled();
		await fireEvent.click(saveBtn);
		expect(patchBodies()).toEqual([]);
		expect(onClose).not.toHaveBeenCalled();

		getMe.resolve(ME);
		await waitFor(() => expect(screen.getAllByRole('switch')[0]).not.toHaveAttribute('disabled'));
		expect(screen.getByText('儲存資料').closest('button')).not.toBeDisabled();
	});

	it('busy 鎖:儲存飛行中連點兩下只送一筆 PATCH(ADR-0022 遞延的防連點項)', async () => {
		const patch = deferred<unknown>();
		route({ 'PATCH /users/me': () => patch.promise });
		const onClose = await openHydrated();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '陳大美' } });
		const saveBtn = screen.getByText('儲存資料').closest('button')!;
		saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 合成 click 不受 disabled 限制
		saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await waitFor(() => expect(patchBodies()).toHaveLength(1));
		await waitFor(() => expect(saveBtn).toBeDisabled());

		patch.resolve({ ...ME, name: '陳大美' });
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(patchBodies()).toHaveLength(1);
	});
});
