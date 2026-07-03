import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SettingsPage from './+page.svelte';
import type { Coach } from '$lib/coach/data';
import { getSettings } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getSettings: vi.fn() }));

/* 刻意與真 seed COACH 相異的 fixture — ProfileTab/CredentialsTab/SecurityTab 三個
 * 分頁元件原本各自 module-scope import COACH(元件樹檢查揪出的問題);現在改由此頁
 * 以 required prop 下傳。fixture 值需與 seed 不同,證明頁面/元件是讀 getSettings()
 * payload,而非退回舊有的 import 預設值。 */
const FIXTURE_COACH: Coach = {
	name: '測試教練',
	display: '測試教練',
	full: '測試教練 教練',
	en: 'Test Coach',
	initial: '測',
	role: '測試職稱',
	id: 'DF-TEST-000',
	email: 'test.coach@example.com',
	phone: '0900-000-000',
	gender: '不透露',
	birth: '2000-01-01',
	emergency: '測試聯絡人 / 0900-000-001',
	bio: '測試用個人簡介文字。',
	chips: ['測試標籤一', '測試標籤二'],
	registered: '2020-01-01',
	lastLogin: '測試最後登入時間戳記'
};

beforeEach(() => {
	vi.mocked(getSettings).mockReset();
	vi.mocked(getSettings).mockResolvedValue({ coach: FIXTURE_COACH });
});

describe('/coach/settings (+page)', () => {
	it('renders the profile header from the getSettings payload', async () => {
		const { container, findByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.full);
		expect(txt).toContain(FIXTURE_COACH.role);
		expect(txt).toContain(FIXTURE_COACH.id);
		expect(txt).toContain(FIXTURE_COACH.chips[0]);
	});

	it('passes coach through to ProfileTab (預覽卡顯示 fixture 的 email/簡介)', async () => {
		const { container, findByText } = render(SettingsPage);
		await findByText(FIXTURE_COACH.full);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE_COACH.email);
		expect(txt).toContain(FIXTURE_COACH.bio);
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

describe('/coach/settings — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getSettings).mockReset();
		vi.mocked(getSettings).mockRejectedValue(new Error('network'));
		const { findByText } = render(SettingsPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getSettings).mockReset();
		vi.mocked(getSettings).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(SettingsPage);
		expect(getByTestId('settings-skeleton')).toBeTruthy();
	});
});
