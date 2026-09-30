import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import SettingsPage from './+page.svelte';
import { toasts } from '$lib/coach/stores';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs, asLoginUser } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER, COACH_FIXTURE } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getSettings()/saveSettings() 走
 * 真實 fetch adapter(本人帳號資料 GET/PATCH /users/me + GET /coaches)；教練身分經
 * loginAs() 驅動，每個測試先登出再登入避免 session 閘門快取跨測試殘留(同
 * mobile-admin/coach/page.test.ts 慣例)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 刻意與真 seed COACH 相異的 fixture(COACH_ROUTES 的 wire 值經 getSettings 映射後的
 * 顯示值) — ProfileTab/CredentialsTab/SecurityTab 三個分頁元件原本各自 module-scope
 * import COACH(元件樹檢查揪出的問題);現在改由此頁以 required prop 下傳。fixture 值需
 * 與 seed 不同,證明頁面/元件是讀 getSettings() payload,而非退回舊有的 import 預設值。 */
const FIXTURE_COACH = {
	name: COACH_USER.name,
	full: `${COACH_USER.name} 教練`,
	initial: '林',
	role: COACH_FIXTURE.title,
	id: COACH_FIXTURE.id,
	email: COACH_USER.email,
	phone: COACH_USER.phone,
	birth: COACH_USER.birth_date,
	bio: COACH_FIXTURE.bio!,
	chips: COACH_FIXTURE.certifications,
	lastLogin: '2026-07-04 09:17'
};

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(overrides, COACH_ROUTES));

const patchCalls = () => vi.mocked(api).mock.calls.filter(([p, init]) => p === '/users/me' && init?.method === 'PATCH');

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

describe('/coach/settings (+page)', () => {
	it('renders the profile header from the getSettings payload', async () => {
		const { container, findByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.full);
		expect(txt).toContain(FIXTURE_COACH.role);
		expect(txt).toContain(FIXTURE_COACH.chips[0]);
	});

	it('頁首職銜列只顯示 role(不再接「 · 教練 uuid」);寫死的授課時數/學員數/年資統計拿掉(R16 Task 2a)', async () => {
		const { container, findByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		const txt = container.textContent ?? '';
		expect(txt).not.toContain(FIXTURE_COACH.id);
		expect(txt).not.toContain('312 hr');
		expect(txt).not.toContain('授課時數');
		expect(txt).not.toContain('年資');
	});

	it('passes coach through to ProfileTab (預覽卡顯示 fixture 的 email/簡介)', async () => {
		const { container, findByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.email);
		expect(txt).toContain(FIXTURE_COACH.bio);
	});

	it('ProfileTab:email/生日唯讀(生日讀 payload 的真值),性別/緊急聯絡人/簡介輸入框拿掉(R16 Task 2a)', async () => {
		const { findByText, getByDisplayValue, queryByLabelText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		expect(getByDisplayValue(FIXTURE_COACH.email)).toBeDisabled();
		expect(getByDisplayValue(FIXTURE_COACH.birth)).toBeDisabled();
		expect(getByDisplayValue(FIXTURE_COACH.name)).not.toBeDisabled();
		expect(queryByLabelText('性別')).toBeNull();
		expect(queryByLabelText('緊急聯絡人')).toBeNull();
		expect(queryByLabelText('個人簡介')).toBeNull();
	});

	it('CoachAvatar 顯示 payload 的 initial,而非退回 seed 預設值(審查回修)', async () => {
		// 頁首(size 88)與 ProfileTab 預覽卡(size 72)兩顆頭像都應顯示 fixture 的
		// 「林」;若任一處漏傳 initial prop,元件會退回 seed COACH.initial「李」,
		// 此斷言必紅 — 可證偽。fixture 其他欄位刻意不含「李」字。
		const { container, findByText, getAllByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		expect(getAllByText(FIXTURE_COACH.initial).length).toBeGreaterThanOrEqual(2);
		expect(container.textContent ?? '').not.toContain('李');
	});

	it('passes coach through to CredentialsTab (帳號憑證 tab 顯示 fixture chips)', async () => {
		const { container, findByText, getByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		await fireEvent.click(getByText('帳號憑證'));
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.chips[0]);
	});

	it('passes coach through to SecurityTab (帳號安全 tab 顯示 fixture lastLogin)', async () => {
		const { container, findByText, getByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		await fireEvent.click(getByText('帳號安全'));
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.lastLogin);
	});
});

describe('/coach/settings — 儲存個人資料(C6)', () => {
	it('儲存成功後頁首跟著顯示新姓名;成功 toast 不再宣稱「下次登入時生效」', async () => {
		route({ 'PATCH /users/me': { ...asLoginUser(COACH_USER), birth_date: COACH_USER.birth_date, preferences: null, name: '改名教練' } });
		const { findByText, getByText, getByDisplayValue } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);

		await fireEvent.input(getByDisplayValue(FIXTURE_COACH.name), { target: { value: '改名教練' } });
		await fireEvent.click(getByText('儲存變更'));

		expect(await findByText('改名教練 教練')).toBeInTheDocument();
		// 只送改過的欄位(R16 Task 1b):電話沒動就不送。
		expect(JSON.parse(patchCalls()[0][1]!.body as string)).toEqual({ name: '改名教練' });
		const toast = get(toasts).find((t) => t.title === '個人資料已儲存');
		expect(toast).toBeDefined();
		expect(JSON.stringify(toast)).not.toContain('下次登入');
	});
});

describe('/coach/settings — 個人資料 inline 驗證(R16 Task 1b)', () => {
	it('姓名只輸入 1 個字 → 顯示驗證錯誤、儲存鈕停用、不送 PATCH /users/me', async () => {
		const { findByText, getByDisplayValue, getByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);

		await fireEvent.input(getByDisplayValue(FIXTURE_COACH.name), { target: { value: '改' } });

		expect(await findByText('姓名需為 2–100 個字')).toBeInTheDocument();
		const btn = getByText('儲存變更').closest('button')!;
		expect(btn).toBeDisabled();
		await fireEvent.click(btn);
		expect(patchCalls()).toHaveLength(0);
	});

	it('原本有電話的教練清空電話 → 顯示「聯絡電話無法清空」、儲存鈕停用', async () => {
		const { findByText, getByDisplayValue, getByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);

		await fireEvent.input(getByDisplayValue(FIXTURE_COACH.phone), { target: { value: '' } });

		expect(await findByText('聯絡電話無法清空')).toBeInTheDocument();
		expect(getByText('儲存變更').closest('button')!).toBeDisabled();
	});
});

describe('/coach/settings — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /coaches': new Error('network') });
		const { findByText } = render(SettingsPage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError（查無教練檔案）時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		route({ 'GET /coaches': [] }); // 查無本人教練檔案 → 真 CoachNotFoundError
		const { findByText, queryByText } = render(SettingsPage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		// getSettings 只打身分端點——讓 GET /coaches 卡住。本測試是檔內最後一支，且下一個
		// 測試檔有獨立的模組實例，在飛的 hydrate 不會拖累其他測試。
		route({ 'GET /coaches': () => new Promise(() => {}) });
		const { getByTestId } = render(SettingsPage);
		expect(getByTestId('settings-skeleton')).toBeTruthy();
	});
});
