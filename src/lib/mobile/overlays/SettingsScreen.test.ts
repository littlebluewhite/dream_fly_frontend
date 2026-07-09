import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { prefs, toasts } from '$lib/mobile/stores';
import { getPreferences, savePreferences } from '$lib/mobile/api';
import SettingsScreen from './SettingsScreen.svelte';

/* Task F10：SettingsScreen 偏好持久化(users.preferences，PATCH /users/me 整包
 * 覆寫)。只 mock $lib/mobile/api 的 getPreferences/savePreferences(HTTP 映射
 * 已在 api.test.ts 端對端測過)，同 PointsScreen.test.ts/routes/admin/settings
 * /page.test.ts 的既有慣例。畫面上 4 個 Switch 沒有各自獨立的 aria-label(見
 * Switch.svelte：不帶 label prop 時一律是 'toggle'，帶 label 又會多渲染一顆
 * 目前不需要的可見文字——非本任務範圍)，因此依既有慣例(admin settings page
 * test)用 getAllByRole('switch') 的 DOM 順序索引：0=課程提醒 1=教練訊息
 * 2=活動公告 3=深色模式。 */
vi.mock('$lib/mobile/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile/api')>();
	return { ...actual, getPreferences: vi.fn(), savePreferences: vi.fn() };
});

const DEFAULT_PREFS = { classReminder: true, coachMsg: true, promo: false, dark: false };

beforeEach(() => {
	prefs.set({ ...DEFAULT_PREFS });
	vi.mocked(getPreferences).mockReset().mockResolvedValue({ ...DEFAULT_PREFS });
	vi.mocked(savePreferences).mockReset().mockResolvedValue(undefined);
});

describe('SettingsScreen — 開啟時背景水合真偏好(GET /users/me，覆蓋本地 prefs 快取)', () => {
	it('載入前先顯示本地快取值(cache-first，不是空白/骨架)', () => {
		prefs.set({ classReminder: false, coachMsg: true, promo: true, dark: false });
		vi.mocked(getPreferences).mockReturnValue(new Promise(() => {})); // 掛住不 resolve
		render(SettingsScreen, { props: { onBack: () => {} } });
		const switches = screen.getAllByRole('switch');
		expect(switches[0]).toHaveAttribute('aria-checked', 'false'); // classReminder(本地快取值)
		expect(switches[2]).toHaveAttribute('aria-checked', 'true'); // promo(本地快取值)
	});

	it('載入成功後覆蓋本地 prefs store', async () => {
		vi.mocked(getPreferences).mockResolvedValue({ classReminder: false, coachMsg: false, promo: true, dark: true });
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() =>
			expect(get(prefs)).toEqual({ classReminder: false, coachMsg: false, promo: true, dark: true })
		);
	});

	it('載入失敗時沿用本地快取，不拋出、不顯示錯誤 toast', async () => {
		vi.mocked(getPreferences).mockRejectedValue(new Error('offline'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalled());
		expect(get(prefs)).toEqual(DEFAULT_PREFS);
		expect(notifySpy).not.toHaveBeenCalled();
		notifySpy.mockRestore();
	});
});

describe('SettingsScreen — 切換開關即時 PATCH /users/me(savePreferences 整包覆寫)', () => {
	it('切換課程提醒:樂觀更新 store + 呼叫 savePreferences 帶入切換後的整包 4 key', async () => {
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalled());

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[0]); // 課程提醒 classReminder true→false

		expect(get(prefs).classReminder).toBe(false); // 樂觀更新立即生效
		await waitFor(() =>
			expect(savePreferences).toHaveBeenCalledWith({ classReminder: false, coachMsg: true, promo: false, dark: false })
		);
	});

	it('切換深色模式:同樣送出整包(含其餘三個既有值)', async () => {
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalled());

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[3]); // 深色模式 dark false→true

		await waitFor(() =>
			expect(savePreferences).toHaveBeenCalledWith({ classReminder: true, coachMsg: true, promo: false, dark: true })
		);
	});
});

describe('SettingsScreen — 寫入失敗回滾 + 錯誤提示', () => {
	it('savePreferences 失敗:開關回滾為切換前的值，顯示錯誤 toast', async () => {
		vi.mocked(savePreferences).mockRejectedValue(new Error('network'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalled());

		const switches = screen.getAllByRole('switch');
		// fireEvent.click 內部會 await tick()，已讓 mockRejectedValue 的（已 reject）
		// promise 走完 catch 回滾——不斷言「樂觀更新後、回滾前」這個必然競態的中間態，
		// 只斷言最終落地的行為契約:失敗後開關回到切換前的值 + 顯示錯誤 toast。
		await fireEvent.click(switches[1]); // 教練訊息 coachMsg true→false，隨即因送出失敗回滾

		await waitFor(() => expect(get(prefs).coachMsg).toBe(true)); // 回滾回原值
		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', expect.any(String));
		notifySpy.mockRestore();
	});

	it('回滾只還原「這一顆」開關，不會波及仍在飛行中的其他開關樂觀更新', async () => {
		// 情境:課程提醒切換送出中尚未回應時，使用者又切換了活動公告(也送出中)；
		// 課程提醒那次送出稍後失敗——回滾不應該把活動公告的樂觀值也一併蓋掉。
		let rejectClassReminderSave!: (e: unknown) => void;
		let resolvePromoSave!: () => void;
		const classReminderSave = new Promise<void>((_, reject) => {
			rejectClassReminderSave = reject;
		});
		const promoSave = new Promise<void>((resolve) => {
			resolvePromoSave = resolve;
		});
		vi.mocked(savePreferences)
			.mockImplementationOnce(() => classReminderSave) // 第一次呼叫:課程提醒切換
			.mockImplementationOnce(() => promoSave); // 第二次呼叫:活動公告切換

		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalled());

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[0]); // 課程提醒 true→false(送出中)
		await fireEvent.click(switches[2]); // 活動公告 false→true(送出中，課程提醒尚未 resolve)

		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });

		rejectClassReminderSave(new Error('network')); // 課程提醒送出失敗
		await waitFor(() => expect(get(prefs).classReminder).toBe(true)); // 只回滾這一顆

		expect(get(prefs).promo).toBe(true); // 活動公告的樂觀值不受牽連

		resolvePromoSave(); // 收尾，避免懸置的 pending promise
		await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(2));
	});
});
