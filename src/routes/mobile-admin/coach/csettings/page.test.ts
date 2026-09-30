import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CsettingsPage from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { ApiCoach } from '$lib/public/api';

/* R15 Task 3a(候選 轉手退役)：getCsettings/saveSettings/CoachNotFoundError 原經
 * mobile-admin/api.ts 零映射 re-export，已退役，改 mock $lib/api/client 的 api()，走真實
 * fetch adapter；教練身分真經 loginAs() 驅動(同 coach/page.test.ts 慣例)。改用真
 * authStore(不再 module mock 它)——本頁的「登出」本就是要驗證真 authStore.logout()
 * 有被呼叫，mock 掉它反而測不到接線本身。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// 與桌面 PROFILES.coach mock(林雅婷)刻意不同的真實教練 fixture，證明頁面讀
// getCsettings() 的真 Coach 物件(經真 mapCoach() 映射)，而非殘留的 mock 對照。
const ME: TestUser = { id: 'u-c1', email: 'test.coach@dreamfly.tw', name: '測試教練', phone: '0900-000-000', last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: ApiCoach = {
	id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試特級教練', bio: '測試簡介', experience: null,
	specialties: [], certifications: ['測試專長'], is_active: true, display_order: 1, slug: null, photo_url: null,
	created_at: '2020-01-01T00:00:00Z'
};

const settingsRoutes = () => ({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH] });

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(ME);
	vi.mocked(api).mockImplementation(fakeRouter(settingsRoutes()));
});

describe('mobile-admin/coach/csettings 頁', () => {
	it('loading 分支顯示骨架(data-testid="csettings-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(CsettingsPage);
		expect(container.querySelector('[data-testid="csettings-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示真實教練資料(相異 fixture，非殘留 PROFILES.coach/COACHES mock)', async () => {
		const { findAllByText, findByText } = render(CsettingsPage);
		// 「測試特級教練」同時出現在 HeroHeader(p.role) 與個人資料卡自己的職稱列。
		expect((await findAllByText('測試特級教練')).length).toBeGreaterThan(0);
		expect(await findByText('測試教練 教練')).toBeInTheDocument();
	});

	it('姓名/聯絡電話欄位帶入真值，職稱/Email 唯讀顯示(契約不支援寫入)', async () => {
		render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');
		expect(screen.getByDisplayValue('測試教練')).not.toBeDisabled();
		expect(screen.getByDisplayValue('0900-000-000')).not.toBeDisabled();
		expect(screen.getByDisplayValue('測試特級教練')).toBeDisabled();
		expect(screen.getByDisplayValue('test.coach@dreamfly.tw')).toBeDisabled();
	});

	it('簡介唯讀顯示;寫死的授課時數/學員數/年資統計拿掉;通知文案改「學員訊息通知」(R16 Task 2a)', async () => {
		const { container } = render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');
		expect(screen.getByDisplayValue('測試簡介')).toBeDisabled();
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('312 hr');
		expect(txt).not.toContain('授課時數');
		expect(txt).not.toContain('家長訊息通知');
		expect(txt).toContain('學員訊息通知');
	});

	it('儲存變更真打 PATCH /users/me(saveSettings)，只送改過的欄位', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...settingsRoutes(), 'PATCH /users/me': { ...ME, name: '改名教練' } })
		);
		const { findByText, getByText } = render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');

		const nameInput = screen.getByDisplayValue('測試教練');
		await fireEvent.input(nameInput, { target: { value: '改名教練' } });
		await fireEvent.click(getByText('儲存變更'));

		expect(api).toHaveBeenCalledWith('/users/me', { method: 'PATCH', body: JSON.stringify({ name: '改名教練' }) });
		expect(await findByText('改名教練 教練')).toBeInTheDocument();
	});

	it('姓名只輸入 1 個字 → 顯示驗證錯誤、儲存鈕停用、不送出', async () => {
		render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');

		await fireEvent.input(screen.getByDisplayValue('測試教練'), { target: { value: '改' } });

		expect(await screen.findByText('姓名需為 2–100 個字')).toBeInTheDocument();
		const btn = screen.getByText('儲存變更').closest('button')!;
		expect(btn).toBeDisabled();
		await fireEvent.click(btn);
		expect(vi.mocked(api).mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
	});

	it('登出真呼叫 authStore.logout()（不再是 localStorage 旗標清除）', async () => {
		const logoutSpy = vi.spyOn(authStore, 'logout');
		const { getByText } = render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');

		await fireEvent.click(getByText('登出'));
		expect(logoutSpy).toHaveBeenCalled();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...settingsRoutes(), 'GET /coaches': new Error('boom') }));
		const { findByText } = render(CsettingsPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('找不到教練檔案(CoachNotFoundError)顯示對應錯誤，不當機', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [] }));
		const { findByText } = render(CsettingsPage);
		expect(await findByText('此帳號未綁定教練檔案')).toBeInTheDocument();
	});
});
