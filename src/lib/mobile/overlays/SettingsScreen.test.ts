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
 * 2=活動公告 3=深色模式。
 *
 * R11 Task 2：偏好同步機(水合/樂觀更新/序列鏈/resync/回滾)下沉為
 * $lib/mobile/pref-sync.ts(ADR 0012 第九例)，該機制本身的單元測試(交錯競態、
 * 三種 outcome、hydrate 細節)移至 pref-sync.test.ts；本檔僅留 markup 綁定與
 * outcome→toast 呼叫端佈線(ADR 0011 慣例)。 */
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
});

describe('SettingsScreen — 送出失敗時的 toast 佈線(outcome.kind !== \'saved\')', () => {
	it('savePreferences 失敗:呼叫端依 outcome 映射恰一次錯誤 toast(resync/單鍵回滾等內部機制細節見 pref-sync.test.ts)', async () => {
		vi.mocked(savePreferences).mockRejectedValue(new Error('network'));
		vi.mocked(getPreferences)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }) // onMount 背景水合
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }); // 失敗後的整包 resync
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[1]); // 教練訊息 coachMsg true→false，送出失敗

		await waitFor(() => expect(notifySpy).toHaveBeenCalledTimes(1)); // 恰一次，非重複發送
		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', '連線發生問題，請稍後再試。');
		notifySpy.mockRestore();
	});
});
