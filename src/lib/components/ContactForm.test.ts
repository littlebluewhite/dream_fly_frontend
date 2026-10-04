import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ContactForm from './ContactForm.svelte';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { apiBody, apiCalls } from '$lib/testing/admin-routes';
import { toasts } from '$lib/stores/marketingToasts';
import { inquiryResponse } from '$lib/testing/wire-fixtures';

// 只假造 HTTP 層：真的 sendContactInquiry 會跑，POST /contact 的 body 由 apiBody 取出斷言
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const route = (value: unknown) => vi.mocked(api).mockImplementation(fakeRouter({ 'POST /contact': value }));

function fillValidForm(getByLabelText: (text: string) => HTMLElement) {
	fireEvent.input(getByLabelText('姓名 *'), { target: { value: '王小明' } });
	fireEvent.input(getByLabelText('電子郵件 *'), { target: { value: 'a@b.com' } });
	fireEvent.input(getByLabelText('訊息內容 *'), { target: { value: '想詢問課程時間' } });
}

function resetToasts() {
	get(toasts).forEach((t) => toasts.dismiss(t.id));
}

beforeEach(() => {
	vi.mocked(api).mockReset();
	resetToasts();
});
afterEach(resetToasts);

describe('ContactForm — 送出 POST /contact', () => {
	it('submits the validated fields via sendContactInquiry and shows the success message + toast', async () => {
		route(inquiryResponse());

		const { getByLabelText, findByText } = render(ContactForm);
		fillValidForm(getByLabelText);

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		await findByText('訊息已送出！我們會盡快與您聯繫。');
		expect(apiBody('POST /contact')).toEqual({
			name: '王小明',
			email: 'a@b.com',
			subject: '一般諮詢',
			message: '想詢問課程時間'
		});
		expect(get(toasts).some((t) => t.title === '訊息已送出，我們會盡快與您聯繫')).toBe(true);
	});

	it('omits phone from the payload when left blank', async () => {
		route(inquiryResponse());
		const { getByLabelText } = render(ContactForm);
		fillValidForm(getByLabelText);

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		const payload = apiBody('POST /contact');
		expect(payload).not.toHaveProperty('phone');
	});

	it('shows the ApiError message and an error toast when the request fails', async () => {
		route(new ApiError(422, '欄位格式錯誤'));

		const { getByLabelText, findByText } = render(ContactForm);
		fillValidForm(getByLabelText);

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		await findByText('欄位格式錯誤');
		expect(get(toasts).some((t) => t.title === '欄位格式錯誤')).toBe(true);
	});

	it('never calls the API when client-side validation fails (empty name)', async () => {
		const { getByLabelText } = render(ContactForm);
		fireEvent.input(getByLabelText('電子郵件 *'), { target: { value: 'a@b.com' } });
		fireEvent.input(getByLabelText('訊息內容 *'), { target: { value: '想詢問課程時間' } });

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		expect(apiCalls('POST /contact')).toHaveLength(0);
	});
});
