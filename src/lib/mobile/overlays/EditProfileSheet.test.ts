import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { prefs } from '$lib/mobile/stores';
import { getPreferences, savePreferences } from '$lib/mobile/api';
import EditProfileSheet from './EditProfileSheet.svelte';

/* Task 1(1.3)：EditProfileSheet 過去存檔時直接 `prefs.set(p)`，從沒經過
 * $lib/mobile/pref-sync，PATCH /users/me 永遠不會發生；本地副本 p 若在 hydrate
 * 水合完成前就從 store 取快照，還可能用預設值蓋掉伺服器真值。這裡驗證修好後
 * 的行為：從帳號頁情境開啟(SettingsScreen 未掛載，prefSync 的 hydrate 只靠
 * EditProfileSheet 自己觸發)，只改一個偏好存檔 → savePreferences 真的被呼叫，
 * 且收到的是「hydrate 後的伺服器值 + 那一個改動」，不是存檔前的本地舊快取。
 *
 * 只 mock $lib/mobile/api 的 getPreferences/savePreferences，同
 * SettingsScreen.test.ts 既有慣例；prefSync 是 module 層單例，兩個測試檔共用
 * 同一份實作(不 mock $lib/mobile/pref-sync 本身)。 */
vi.mock('$lib/mobile/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile/api')>();
	return { ...actual, getPreferences: vi.fn(), savePreferences: vi.fn() };
});

const STALE_LOCAL_PREFS = { classReminder: true, coachMsg: true, promo: false, dark: false };
const SERVER_PREFS = { classReminder: false, coachMsg: true, promo: true, dark: false };

beforeEach(() => {
	// 開啟前的本地快取跟伺服器值刻意不同，證明存檔送出的是 hydrate 後的伺服器值,
	// 不是這份舊快取。
	prefs.set({ ...STALE_LOCAL_PREFS });
	vi.mocked(getPreferences).mockReset().mockResolvedValue({ ...SERVER_PREFS });
	vi.mocked(savePreferences).mockReset().mockResolvedValue(undefined);
});

describe('EditProfileSheet — prefs 存檔改經 pref-sync(不再繞過 prefs.set 直寫)', () => {
	it('從帳號頁情境開啟(Settings 未掛載)，hydrate 落地後只改一個偏好存檔 → savePreferences 收到伺服器值 + 那一個改動', async () => {
		const onClose = vi.fn();
		render(EditProfileSheet, { props: { onClose } });

		// mount 的 onMount(async () => { await prefSync.hydrate(); ... }) 落地。
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));
		await Promise.resolve(); // 讓 hydrate() 之後重建 p/initial 的那一步跑完

		// PREF_ROWS 順序：0=課前提醒(classReminder) 1=教練訊息(coachMsg) 2=活動與優惠(promo)。
		const switches = screen.getAllByRole('switch');
		expect(switches).toHaveLength(3);
		// hydrate 後應顯示伺服器值，不是開場的本地舊快取。
		expect(switches[0]).toHaveAttribute('aria-checked', 'false'); // classReminder=false(伺服器值)
		expect(switches[2]).toHaveAttribute('aria-checked', 'true'); // promo=true(伺服器值)

		await fireEvent.click(switches[2]); // 只切 promo 這一個

		await fireEvent.click(screen.getByText('儲存資料'));

		await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(1));
		expect(savePreferences).toHaveBeenCalledWith({ ...SERVER_PREFS, promo: false });
		expect(onClose).toHaveBeenCalled();
	});

	it('沒有任何偏好被改動時存檔，savePreferences 不會被呼叫(只送真的變動)', async () => {
		const onClose = vi.fn();
		render(EditProfileSheet, { props: { onClose } });

		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));
		await Promise.resolve();

		await fireEvent.click(screen.getByText('儲存資料'));

		expect(savePreferences).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});
});
