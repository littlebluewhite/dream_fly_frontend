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

describe('SettingsScreen — 寫入失敗改整包 resync + 錯誤提示', () => {
	it('savePreferences 失敗:改呼叫 getPreferences() 整包 resync 覆蓋 store(不是單鍵回滾)，顯示錯誤 toast', async () => {
		vi.mocked(savePreferences).mockRejectedValue(new Error('network'));
		// resync 回傳的伺服器真值刻意讓 4 個 key 都跟「切換前」的本地值不同，
		// 證明整包蓋掉的是 getPreferences() 的回應，不是巧合對到單鍵回滾的舊值。
		const serverTruthAfterFailure = { classReminder: false, coachMsg: false, promo: true, dark: true };
		vi.mocked(getPreferences)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }) // onMount 背景水合
			.mockResolvedValueOnce(serverTruthAfterFailure); // 失敗後的整包 resync
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[1]); // 教練訊息 coachMsg true→false，送出失敗

		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(2)); // 失敗後觸發 resync
		await waitFor(() => expect(get(prefs)).toEqual(serverTruthAfterFailure)); // 整包換成伺服器真值
		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', expect.any(String));
		notifySpy.mockRestore();
	});

	it('savePreferences 與 resync 都失敗:退回單鍵回滾(讀切換前的舊值) + 錯誤 toast', async () => {
		vi.mocked(savePreferences).mockRejectedValue(new Error('network'));
		vi.mocked(getPreferences)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }) // onMount 背景水合(成功)
			.mockRejectedValueOnce(new Error('offline')); // 失敗後的 resync 也失敗(雙重離線)
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[1]); // 教練訊息 coachMsg true→false，送出失敗

		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(2)); // 嘗試過 resync
		await waitFor(() => expect(get(prefs)).toEqual(DEFAULT_PREFS)); // resync 也失敗，退回單鍵回滾(只還原 coachMsg，其餘不受影響)
		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', expect.any(String));
		notifySpy.mockRestore();
	});

	it('交錯情境(review finding):切 A 送出中又切 B → 序列化下 call2 不會搶在 call1 結算前送出；A 失敗 resync 後，call2 才輪到送出，其 body 已反映 resync 後的狀態，不會再把「已被更正的 A 舊值」寫回後端', async () => {
		// 對照原本的 bug:切 A(call1 帶 A=新值)→ 未回應時切 B(call2 若在排隊當下就
		// 固定快照，仍會帶著 A=新值)→ call1 失敗回滾 A → call2 成功，把「已回滾的
		// A=新值」寫回後端，本地顯示跟伺服器真值悄悄分歧。序列化 + 整包 resync 後:
		// call2 要等 call1(含它的 resync)完全結算，才會從 store 重新取快照送出。
		let rejectClassReminderSave!: (e: unknown) => void;
		const classReminderSave = new Promise<void>((_, reject) => {
			rejectClassReminderSave = reject;
		});
		vi.mocked(savePreferences)
			.mockImplementationOnce(() => classReminderSave) // call1:課程提醒切換，稍後失敗
			.mockImplementationOnce(() => Promise.resolve()); // call2:活動公告切換，成功

		vi.mocked(getPreferences)
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }) // onMount 背景水合
			.mockResolvedValueOnce({ ...DEFAULT_PREFS }); // call1 失敗後的整包 resync(伺服器從未收到 call1 的變更，仍是預設值)

		const notifySpy = vi.spyOn(toasts, 'notify');
		render(SettingsScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(1));

		const switches = screen.getAllByRole('switch');
		await fireEvent.click(switches[0]); // 課程提醒 true→false(call1 送出中，尚未回應)
		await fireEvent.click(switches[2]); // 活動公告 false→true(本地樂觀更新立即生效，call2 排隊等候)

		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false }); // 兩個樂觀更新都已即時反映在畫面上
		await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(1)); // 序列化:call2 尚未送出，不是排隊當下就跟 call1 同時飛行

		rejectClassReminderSave(new Error('network')); // call1 失敗
		await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(2)); // 觸發整包 resync
		await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(2)); // resync 結束、call2 才輪到送出

		// call2 的 body:classReminder 已是 resync 後的正確值(true)，不是原本交錯情境
		// 下「已回滾卻被 call2 用舊快照寫回 false」的競態；promo 因為整包 resync 覆寫
		// (伺服器當時還沒收到 call2 的變更)一併回到伺服器真值 false——這是刻意的
		// 設計取捨(見 SettingsScreen.svelte 的 sendPref 實作註解):寧可讓尚未送出的
		// 樂觀值被伺服器真值蓋過、需要使用者重新切一次，也不讓本地顯示跟伺服器真值
		// 悄悄分歧。
		expect(savePreferences).toHaveBeenLastCalledWith({ classReminder: true, coachMsg: true, promo: false, dark: false });
		await waitFor(() => expect(get(prefs)).toEqual({ classReminder: true, coachMsg: true, promo: false, dark: false }));

		expect(notifySpy).toHaveBeenCalledWith('error', '儲存失敗', expect.any(String));
		notifySpy.mockRestore();
	});
});
