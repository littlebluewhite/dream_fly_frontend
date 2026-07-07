import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CsettingsPage from './+page.svelte';
import { getCsettings, saveSettings, CoachNotFoundError } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getCsettings: vi.fn(), saveSettings: vi.fn() };
});
vi.mock('$lib/stores/authStore', () => ({ authStore: { logout: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

// 與桌面 PROFILES.coach mock(林雅婷)刻意不同的真實教練 fixture，證明頁面讀
// getCsettings() 的真 Coach 物件，而非殘留的 mock 對照。
const FIXTURE_COACH = {
	name: '測試教練',
	display: '測教練',
	full: '測試教練 教練',
	en: '',
	initial: '測',
	role: '測試特級教練',
	id: 'coach-1',
	email: 'test.coach@dreamfly.tw',
	phone: '0900-000-000',
	gender: '',
	birth: '',
	emergency: '',
	bio: '測試簡介',
	chips: ['測試專長'],
	registered: '2020-01-01',
	lastLogin: ''
};

beforeEach(() => {
	vi.mocked(getCsettings).mockReset();
	vi.mocked(getCsettings).mockResolvedValue({ coach: FIXTURE_COACH });
	vi.mocked(saveSettings).mockReset();
});

describe('mobile-admin/coach/csettings 頁', () => {
	it('loading 分支顯示骨架(data-testid="csettings-skeleton")', () => {
		vi.mocked(getCsettings).mockReturnValue(new Promise(() => {}));
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

	it('儲存變更真打 PATCH /users/me(saveSettings)，只送 name/phone', async () => {
		vi.mocked(saveSettings).mockResolvedValue({ coach: { ...FIXTURE_COACH, name: '改名教練', full: '改名教練 教練' } });
		const { findByText, getByText } = render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');

		const nameInput = screen.getByDisplayValue('測試教練');
		await fireEvent.input(nameInput, { target: { value: '改名教練' } });
		await fireEvent.click(getByText('儲存變更'));

		expect(saveSettings).toHaveBeenCalledWith({ name: '改名教練', phone: '0900-000-000' });
		expect(await findByText('改名教練 教練')).toBeInTheDocument();
	});

	it('登出真呼叫 authStore.logout()（不再是 localStorage 旗標清除）', async () => {
		const { getByText } = render(CsettingsPage);
		await screen.findByDisplayValue('測試教練');

		const { authStore } = await import('$lib/stores/authStore');
		await fireEvent.click(getByText('登出'));
		expect(authStore.logout).toHaveBeenCalled();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCsettings).mockRejectedValue(new Error('boom'));
		const { findByText } = render(CsettingsPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('找不到教練檔案(CoachNotFoundError)顯示對應錯誤，不當機', async () => {
		vi.mocked(getCsettings).mockRejectedValue(new CoachNotFoundError());
		const { findByText } = render(CsettingsPage);
		expect(await findByText('此帳號未綁定教練檔案')).toBeInTheDocument();
	});
});
