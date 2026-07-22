import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TrialScreen from './TrialScreen.svelte';
import { submitTrialInquiry } from '$lib/mobile/api';
import { toasts } from '$lib/mobile/stores';
import { ApiError } from '$lib/api/client';

/* Task F8：TrialScreen 送出改打真 submitTrialInquiry()（$lib/mobile/api，POST
 * /contact, inquiry_type='trial'）。這裡只 mock `$lib/mobile/api` 的
 * submitTrialInquiry(已在 api.test.ts 端測過 TrialInquiryInput → ContactPayload
 * 映射)——驗證元件本身「呼叫時機 + 目前表單狀態映射 + 成功/失敗 UI 三態」，不
 * 重新測一次已測過的 body 形狀映射邏輯。 */
vi.mock('$lib/mobile/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile/api')>();
	return { ...actual, submitTrialInquiry: vi.fn() };
});
vi.mock('$lib/mobile/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile/stores')>();
	return { ...actual, toasts: { ...actual.toasts, notify: vi.fn() } };
});

beforeEach(() => {
	vi.mocked(submitTrialInquiry).mockReset();
	vi.mocked(toasts.notify).mockReset();
});

// TrialScreen 的 TRIAL_DAYS 改為動態產生（維持「六/日/三」節奏，見
// TrialScreen.svelte）——這裡把「今日」釘死在一個已知的週一（2026/07/20），
// 相對這個固定基準推算出的第一個日期是 2026/07/25(六)，斷言相對這個固定基準，
// 不再釘絕對字面。
const TRIAL_TODAY = new Date(2026, 6, 20, 9, 0, 0);
const TRIAL_FIRST_DAY = { d: '07/25', full: '2026/07/25 (六)' };

/** 走完 step 0(課程+年齡)、step 1(日期+時段)，停在 step 2(聯絡資料)。render()
 *  前用 vi.setSystemTime 固定「今日」，讓元件內動態產生的 TRIAL_DAYS 可預期——
 *  只釘 Date，不呼叫 useFakeTimers()，setTimeout 仍走真實時鐘，才不會跟下面
 *  waitFor/findByText 這類仰賴真實計時器 polling 的斷言打架。TRIAL_DAYS 在
 *  render 當下就已算好，之後立刻 useRealTimers() 還原不影響後續流程。 */
async function goToContactStep() {
	vi.setSystemTime(TRIAL_TODAY);
	try {
		render(TrialScreen, { props: { onBack: () => {} } });
	} finally {
		vi.useRealTimers();
	}
	await fireEvent.click(screen.getByText('幼兒體操'));
	await fireEvent.click(screen.getByRole('button', { name: '3–5 歲' }));
	await fireEvent.click(screen.getByText('下一步'));
	await fireEvent.click(screen.getByText(TRIAL_FIRST_DAY.d));
	await fireEvent.click(screen.getByText('10:00–11:15'));
	await fireEvent.click(screen.getByText('下一步'));
}

describe('TrialScreen — 送出預約(POST /contact, inquiry_type=trial，Task F8)', () => {
	it('驗證未通過(學員姓名未填)時送出按鈕停用，點擊不呼叫 submitTrialInquiry', async () => {
		await goToContactStep();

		const btn = screen.getByText('送出預約').closest('button')!;
		expect(btn).toBeDisabled();

		await fireEvent.click(btn);
		expect(submitTrialInquiry).not.toHaveBeenCalled();
	});

	it('成功：以目前表單狀態呼叫 submitTrialInquiry，前進 step 3 並顯示 accent toast', async () => {
		vi.mocked(submitTrialInquiry).mockResolvedValue({} as never);
		await goToContactStep();

		await fireEvent.input(screen.getByPlaceholderText('請輸入姓名'), { target: { value: '王先生' } });
		await fireEvent.input(screen.getByPlaceholderText('0912-345-678'), { target: { value: '0987-654-321' } });
		await fireEvent.input(screen.getByPlaceholderText('孩子的姓名或暱稱'), { target: { value: '小恩' } });
		await fireEvent.input(screen.getByPlaceholderText('例如：孩子曾學過舞蹈、希望加強柔軟度…'), {
			target: { value: '曾學過舞蹈' }
		});

		await fireEvent.click(screen.getByText('送出預約').closest('button')!);

		expect(submitTrialInquiry).toHaveBeenCalledWith({
			category: '幼兒體操',
			studentAge: '3–5 歲',
			preferredDay: TRIAL_FIRST_DAY.full,
			preferredSlot: '10:00–11:15',
			parentName: '王先生',
			parentPhone: '0987-654-321',
			studentName: '小恩',
			note: '曾學過舞蹈'
		});
		expect(await screen.findByText('試上預約已送出！')).toBeInTheDocument();
		expect(toasts.notify).toHaveBeenCalledWith('accent', '試上預約已送出', expect.any(String));
	});

	it('失敗：停留 step 2(不顯示完成畫面)、顯示 error toast(帶 ApiError 訊息)，按鈕解除鎖定可重試', async () => {
		vi.mocked(submitTrialInquiry).mockRejectedValue(new ApiError(500, '連線逾時'));
		await goToContactStep();

		await fireEvent.input(screen.getByPlaceholderText('請輸入姓名'), { target: { value: '王先生' } });
		await fireEvent.input(screen.getByPlaceholderText('0912-345-678'), { target: { value: '0987-654-321' } });
		await fireEvent.input(screen.getByPlaceholderText('孩子的姓名或暱稱'), { target: { value: '小恩' } });

		const btn = screen.getByText('送出預約').closest('button')!;
		await fireEvent.click(btn);

		await vi.waitFor(() => expect(toasts.notify).toHaveBeenCalledWith('error', '送出失敗', '連線逾時'));
		expect(screen.queryByText('試上預約已送出！')).toBeNull();
		expect(btn).not.toBeDisabled();
	});

	it('今日恰為週六時首日跳到下週六(嚴格未來語意)', async () => {
		// 2026/07/25 為週六(getDay()===6)。TrialScreen.svelte 的 nextSat 計算式
		// `((6 - today.getDay() + 7) % 7) || 7` 在今日恰為週六時餘數算出 0,
		// 需靠 `|| 7` 落回下週六——若日後誤刪/誤改 `|| 7`,今日會被誤判為首個
		// 可選週六,首日會少跳一週。
		vi.setSystemTime(new Date(2026, 6, 25, 9, 0, 0));
		try {
			render(TrialScreen, { props: { onBack: () => {} } });
		} finally {
			vi.useRealTimers();
		}

		await fireEvent.click(screen.getByText('幼兒體操'));
		await fireEvent.click(screen.getByRole('button', { name: '3–5 歲' }));
		await fireEvent.click(screen.getByText('下一步'));

		expect(screen.getByText('08/01')).toBeInTheDocument();
		expect(screen.queryByText('07/25')).toBeNull();

		await fireEvent.click(screen.getByText('08/01'));
		await fireEvent.click(screen.getByText('10:00–11:15'));
		await fireEvent.click(screen.getByText('下一步'));

		expect(screen.getByText(/2026\/08\/01 \(六\)/)).toBeInTheDocument();
		expect(screen.queryByText(/2026\/07\/25 \(六\)/)).toBeNull();
	});

	it('step 3 預約單號 TR- 前綴跟隨固定「今日」年度後 2 碼(動態年，防回退硬編字面)', async () => {
		vi.mocked(submitTrialInquiry).mockResolvedValue({} as never);
		await goToContactStep();

		await fireEvent.input(screen.getByPlaceholderText('請輸入姓名'), { target: { value: '王先生' } });
		await fireEvent.input(screen.getByPlaceholderText('0912-345-678'), { target: { value: '0987-654-321' } });
		await fireEvent.input(screen.getByPlaceholderText('孩子的姓名或暱稱'), { target: { value: '小恩' } });
		await fireEvent.click(screen.getByText('送出預約').closest('button')!);
		await screen.findByText('試上預約已送出！');

		// ticket 於 render 當下生成，goToContactStep 已把「今日」釘在 2026 →
		// 單號恆為 TR-26 + 3 碼亂數。若 TrialScreen.svelte 的 ticket 生成回退成
		// 硬編年份字面(如 'TR-25…')，此釘立即變紅。
		expect(screen.getByText(/TR-26\d{3}/)).toBeInTheDocument();
	});
});
