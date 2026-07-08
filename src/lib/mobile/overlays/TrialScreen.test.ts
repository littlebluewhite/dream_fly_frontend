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

/** 走完 step 0(課程+年齡)、step 1(日期+時段)，停在 step 2(聯絡資料)。 */
async function goToContactStep() {
	render(TrialScreen, { props: { onBack: () => {} } });
	await fireEvent.click(screen.getByText('幼兒體操'));
	await fireEvent.click(screen.getByRole('button', { name: '3–5 歲' }));
	await fireEvent.click(screen.getByText('下一步'));
	await fireEvent.click(screen.getByText('06/14'));
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
			preferredDay: '2026/06/14 (六)',
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
});
