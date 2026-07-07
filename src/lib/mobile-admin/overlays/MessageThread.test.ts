import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import MessageThread from './MessageThread.svelte';
import { getThread, sendMessage } from '$lib/mobile-admin/api';
import type { MessageRow } from '$lib/mobile-admin/data';

/* Task 20：前身是本地 echo 假聊天室(送出只是把文字塞進本地陣列，"家長" 泡泡永遠
 * 是同一句 m.preview)——改讀真 GET /conversations/{id}/messages、真打 POST
 * /conversations/{id}/messages(coach/api.ts，Task 12，§3.21)。 */

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getThread: vi.fn(), sendMessage: vi.fn() };
});

const M: MessageRow = { id: 'conv-1', from: '王媽媽', initial: '王', color: '#000', preview: '哈囉', time: '09:10', unread: false };

beforeEach(() => {
	vi.mocked(getThread).mockReset();
	vi.mocked(sendMessage).mockReset();
});

describe('MessageThread — 真對話串', () => {
	it('載入時打 getThread(conversationId) 並顯示真實訊息(不是 m.preview 的固定假泡泡)', async () => {
		vi.mocked(getThread).mockResolvedValue({
			messages: [
				{ who: 'them', text: '教練好，想請問進度', time: '09:00' },
				{ who: 'me', text: '進步很多喔', time: '09:05' }
			],
			total: 2
		});
		render(MessageThread, { props: { onBack: () => {}, m: M } });

		expect(getThread).toHaveBeenCalledWith('conv-1');
		expect(await screen.findByText('教練好，想請問進度')).toBeInTheDocument();
		expect(await screen.findByText('進步很多喔')).toBeInTheDocument();
	});

	it('送出真打 sendMessage(conversationId, body) 並把回應接到訊息串尾端', async () => {
		vi.mocked(getThread).mockResolvedValue({ messages: [], total: 0 });
		vi.mocked(sendMessage).mockResolvedValue({ who: 'me', text: '收到，謝謝', time: '10:00' });
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await fireEvent.input(screen.getByPlaceholderText('輸入回覆…'), { target: { value: '收到，謝謝' } });
		await fireEvent.click(screen.getByLabelText('送出'));

		expect(sendMessage).toHaveBeenCalledWith('conv-1', '收到，謝謝');
		expect(await screen.findByText('收到，謝謝')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('輸入回覆…')).toHaveValue('');
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getThread).mockRejectedValue(new Error('boom'));
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});
