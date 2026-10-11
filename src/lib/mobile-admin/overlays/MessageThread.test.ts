import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import MessageThread from './MessageThread.svelte';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_USER } from '$lib/testing/coach-routes';
import { conversationSummary } from '$lib/testing/wire-fixtures';
import { conversations, hydrateConversations } from '$lib/coach/conversations';
import type { Conversation } from '$lib/coach/data';

/* Task 20：前身是本地 echo 假聊天室(送出只是把文字塞進本地陣列，"家長" 泡泡永遠
 * 是同一句 m.preview)——改讀真 GET /conversations/{id}/messages、真打 POST
 * /conversations/{id}/messages(coach/api.ts，Task 12，§3.21)。
 *
 * R14(候選 F5)：本頁改接 $lib/coach/messages-controller，已讀角標改成「等後端
 * markRead ack 才清」——下方新增 3 支釘住這個時序(ack 之前/之後、reject 時維持
 * 未讀)，以及 1 支載入失敗→重試成功。
 *
 * R17：ack(badgeCleared)原樣交給已讀 mutator，由閘門的 write() 等 ack、核對擁有者(換身分
 * 即作廢)——換身分作廢釘在 coach/conversations.test.ts。
 *
 * R20(候選 02)：本頁改讀 $lib/coach/conversations(教練對話列表)，不再 partial mock 舊
 * stores 模組——已讀與送出都從 HTTP 縫進去，斷言落在 `conversations` store 上：ack 之後才
 * 歸零未讀(失敗維持未讀)，回覆成功後列表的預覽與時間跟著更新。
 *
 * R15 Task 3a(候選 轉手退役)：getThread/sendMessage/markRead(畫面直取
 * $lib/coach/api)改走真實呼叫，同其餘 fakeRouter 化的測試檔慣例。 */

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const M: Conversation = { id: 'conv-1', name: '王媽媽', initial: '王', color: '#000', preview: '哈囉', time: '09:10', badge: 2 };
const LIST = [conversationSummary({ id: 'conv-1', peer_name: '王媽媽', last_message_body: '哈囉', last_message_at: '2026-07-04T09:10:00Z', unread_count: 2 })];
const row = () => get(conversations).find((c) => c.id === 'conv-1')!;

const THREAD_PATH = 'GET /conversations/conv-1/messages?per_page=100';
const READ_PATH = 'PATCH /conversations/conv-1/read';
const SEND_PATH = 'POST /conversations/conv-1/messages';

const msg = (sender_id: string, body: string, created_at = '2026-07-04T09:00:00Z') => ({
	id: `m-${body}`, sender_id, body, created_at, read_at: null
});

/** 列表先水合(開機是 []),頁面才有東西可以更新;thread/read/send 的路由由各 it 補。 */
async function hydrateList(routes: Record<string, unknown>) {
	vi.mocked(api).mockImplementation(fakeRouter(routes, { 'GET /conversations/me': LIST }));
	await hydrateConversations();
}

beforeEach(async () => {
	vi.mocked(api).mockReset();
	await resetSessionStores();
	await loginAs(COACH_USER);
});

describe('MessageThread — 真對話串', () => {
	it('載入時打 getThread(conversationId) 並顯示真實訊息(不是 m.preview 的固定假泡泡)', async () => {
		// 後端依 created_at DESC 回，getThread() 內部反轉為舊到新——這裡故意用反序 wire。
		vi.mocked(api).mockImplementation(
			fakeRouter({
				[THREAD_PATH]: { messages: [msg('them', '進步很多喔', '2026-07-04T09:05:00Z'), msg('them', '教練好，想請問進度', '2026-07-04T09:00:00Z')], total: 2 },
				[READ_PATH]: { updated: 1 }
			})
		);
		render(MessageThread, { props: { onBack: () => {}, m: M } });

		await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/conversations/conv-1/messages?per_page=100'));
		expect(await screen.findByText('教練好，想請問進度')).toBeInTheDocument();
		expect(await screen.findByText('進步很多喔')).toBeInTheDocument();
	});

	it('送出真打 sendMessage(conversationId, body) 並把回應接到訊息串尾端', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				[THREAD_PATH]: { messages: [], total: 0 },
				[READ_PATH]: { updated: 0 },
				[SEND_PATH]: msg('me', '收到，謝謝', '2026-07-04T10:00:00Z')
			})
		);
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await fireEvent.input(screen.getByPlaceholderText('輸入回覆…'), { target: { value: '收到，謝謝' } });
		await fireEvent.click(screen.getByLabelText('送出'));

		await vi.waitFor(() =>
			expect(api).toHaveBeenCalledWith('/conversations/conv-1/messages', {
				method: 'POST',
				body: JSON.stringify({ body: '收到，謝謝' })
			})
		);
		expect(await screen.findByText('收到，謝謝')).toBeInTheDocument();
		// 輸入框在列表寫回之後才清(recordSent resolve 才有 outcome)
		await vi.waitFor(() => expect(screen.getByPlaceholderText('輸入回覆…')).toHaveValue(''));
	});

	it('載入失敗顯示 ErrorState，重試後成功', async () => {
		let call = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				[THREAD_PATH]: () => {
					call += 1;
					if (call === 1) throw new Error('boom');
					return { messages: [msg('them', '重試後的訊息', '2026-07-04T09:00:00Z')], total: 1 };
				},
				[READ_PATH]: { updated: 0 }
			})
		);
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();

		await fireEvent.click(screen.getByText('重新載入'));

		expect(await screen.findByText('重試後的訊息')).toBeInTheDocument();
		expect(call).toBe(2);
	});

	it('開啟即呼叫 markRead(id)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: { updated: 1 } })
		);
		render(MessageThread, { props: { onBack: () => {}, m: M } });

		await screen.findByPlaceholderText('輸入回覆…');
		await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/conversations/conv-1/read', { method: 'PATCH' }));
	});

	it('回覆成功後,列表該筆的預覽與時間跟著更新', async () => {
		await hydrateList({
			[THREAD_PATH]: { messages: [], total: 0 },
			[READ_PATH]: { updated: 0 },
			[SEND_PATH]: msg('me', '收到，謝謝', '2026-07-04T10:00:00Z')
		});
		const before = row();
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await fireEvent.input(screen.getByPlaceholderText('輸入回覆…'), { target: { value: '收到，謝謝' } });
		await fireEvent.click(screen.getByLabelText('送出'));

		await vi.waitFor(() => expect(row().preview).toBe('收到，謝謝'));
		expect(row().time).not.toBe(before.time);
	});

	it('回覆失敗:列表預覽與時間維持原樣', async () => {
		await hydrateList({
			[THREAD_PATH]: { messages: [], total: 0 },
			[READ_PATH]: { updated: 0 },
			[SEND_PATH]: new Error('network')
		});
		const { preview, time } = row();
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await fireEvent.input(screen.getByPlaceholderText('輸入回覆…'), { target: { value: '收到，謝謝' } });
		await fireEvent.click(screen.getByLabelText('送出'));

		await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/conversations/conv-1/messages', expect.objectContaining({ method: 'POST' })));
		await new Promise((r) => setTimeout(r, 0));
		expect(row()).toMatchObject({ preview, time });
	});

	it('已讀:後端 ack 之前列表仍是未讀,ack 之後未讀歸零', async () => {
		let resolveAck!: (v: { updated: number }) => void;
		const ack = new Promise<{ updated: number }>((res) => (resolveAck = res));
		await hydrateList({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: () => ack });
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await new Promise((r) => setTimeout(r, 0));
		expect(row().badge).toBe(2); // ack 之前不清

		resolveAck({ updated: 1 });
		await vi.waitFor(() => expect(row().badge).toBe(0));
	});

	it('markRead 失敗:列表維持未讀', async () => {
		await hydrateList({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: new Error('network') });
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		await new Promise((r) => setTimeout(r, 0));
		expect(row().badge).toBe(2);
	});
});
