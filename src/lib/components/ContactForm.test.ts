import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ContactForm from './ContactForm.svelte';
import { sendContactInquiry } from '$lib/public/api';
import { ApiError } from '$lib/api/client';
import { toasts } from '$lib/stores/marketingToasts';

vi.mock('$lib/public/api', () => ({ sendContactInquiry: vi.fn() }));

function fillValidForm(getByLabelText: (text: string) => HTMLElement) {
	fireEvent.input(getByLabelText('姓名 *'), { target: { value: '王小明' } });
	fireEvent.input(getByLabelText('電子郵件 *'), { target: { value: 'a@b.com' } });
	fireEvent.input(getByLabelText('訊息內容 *'), { target: { value: '想詢問課程時間' } });
}

function resetToasts() {
	get(toasts).forEach((t) => toasts.dismiss(t.id));
}

beforeEach(() => {
	vi.mocked(sendContactInquiry).mockReset();
	resetToasts();
});
afterEach(resetToasts);

describe('ContactForm — 送出 POST /contact', () => {
	it('submits the validated fields via sendContactInquiry and shows the success message + toast', async () => {
		vi.mocked(sendContactInquiry).mockResolvedValue({
			id: 'inq-1',
			name: '王小明',
			email: 'a@b.com',
			phone: null,
			subject: '一般諮詢',
			message: '想詢問課程時間',
			status: 'new',
			assigned_to: null,
			created_at: '',
			updated_at: ''
		});

		const { getByLabelText, findByText } = render(ContactForm);
		fillValidForm(getByLabelText);

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		await findByText('訊息已送出！我們會盡快與您聯繫。');
		expect(sendContactInquiry).toHaveBeenCalledWith({
			name: '王小明',
			email: 'a@b.com',
			subject: '一般諮詢',
			message: '想詢問課程時間'
		});
		expect(get(toasts).some((t) => t.title === '訊息已送出，我們會盡快與您聯繫')).toBe(true);
	});

	it('omits phone from the payload when left blank', async () => {
		vi.mocked(sendContactInquiry).mockResolvedValue({
			id: 'inq-1',
			name: '王小明',
			email: 'a@b.com',
			phone: null,
			subject: '一般諮詢',
			message: '想詢問課程時間',
			status: 'new',
			assigned_to: null,
			created_at: '',
			updated_at: ''
		});
		const { getByLabelText } = render(ContactForm);
		fillValidForm(getByLabelText);

		await fireEvent.click(getByLabelText('訊息內容 *').closest('form')!.querySelector('button[type="submit"]')!);

		const payload = vi.mocked(sendContactInquiry).mock.calls[0][0];
		expect(payload).not.toHaveProperty('phone');
	});

	it('shows the ApiError message and an error toast when the request fails', async () => {
		vi.mocked(sendContactInquiry).mockRejectedValue(new ApiError(422, '欄位格式錯誤'));

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

		expect(sendContactInquiry).not.toHaveBeenCalled();
	});
});
