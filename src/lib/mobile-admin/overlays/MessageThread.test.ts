import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import MessageThread from './MessageThread.svelte';
import { markMessageRead } from '$lib/mobile-admin/stores';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { authStore } from '$lib/stores/authStore';
import type { MessageRow } from '$lib/mobile-admin/data';

/* Task 20：前身是本地 echo 假聊天室(送出只是把文字塞進本地陣列，"家長" 泡泡永遠
 * 是同一句 m.preview)——改讀真 GET /conversations/{id}/messages、真打 POST
 * /conversations/{id}/messages(coach/api.ts，Task 12，§3.21)。
 *
 * R14(候選 F5)：本頁改接 $lib/coach/messages-controller，已讀角標改成「等後端
 * markRead ack 才清」——下方新增 3 支釘住這個時序(ack 之前/之後、reject 時維持
 * 未讀)，以及 1 支載入失敗→重試成功。
 *
 * R14 終審修波：badgeCleared.then 落在 await 之後、原無身分核對——下方「身分切換
 * guard」describe 釘住 load() 捕捉的身分與 ack 落地時的身分不同即不呼叫
 * markMessageRead(同 session-gate.ts / messagesGate 的 identity 源：authStore 的
 * loggedIn/member.id)。用真 authStore.login 驅動 identity(同 session-gate.test.ts
 * 慣用式)，只替換 $lib/api/client 的 api()。
 *
 * R15 Task 3a(候選 轉手退役)：getThread/sendMessage/markRead(畫面直取
 * $lib/coach/api)改走真實呼叫，同其餘 fakeRouter 化的測試檔慣例。 */

vi.mock('$lib/mobile-admin/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/stores')>();
	return { ...actual, markMessageRead: vi.fn() };
});

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** authStore.login() 走真實 applySession(setTokens + 登入態)，身分切換才有得測。 */
const AUTH_RES_A = {
	access_token: 'at-a',
	refresh_token: 'rt-a',
	user: {
		id: 'u-a', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false,
		avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['coach']
	}
};
const AUTH_RES_B = {
	access_token: 'at-b',
	refresh_token: 'rt-b',
	user: { ...AUTH_RES_A.user, id: 'u-b', email: 'b@dreamfly.test', name: '乙' }
};

const M: MessageRow = { id: 'conv-1', from: '王媽媽', initial: '王', color: '#000', preview: '哈囉', time: '09:10', unread: false };

const THREAD_PATH = 'GET /conversations/conv-1/messages?per_page=100';
const READ_PATH = 'PATCH /conversations/conv-1/read';
const SEND_PATH = 'POST /conversations/conv-1/messages';

const msg = (sender_id: string, body: string, created_at = '2026-07-04T09:00:00Z') => ({
	id: `m-${body}`, sender_id, body, created_at, read_at: null
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(markMessageRead).mockReset();
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
		expect(screen.getByPlaceholderText('輸入回覆…')).toHaveValue('');
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

	it('ack 之前仍是未讀，ack 之後才清(用 deferred 控時序)', async () => {
		let resolveAck!: (v: { updated: number }) => void;
		const ack = new Promise<{ updated: number }>((res) => (resolveAck = res));
		vi.mocked(api).mockImplementation(fakeRouter({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: () => ack }));
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		expect(markMessageRead).not.toHaveBeenCalled();

		resolveAck({ updated: 1 });
		await new Promise((r) => setTimeout(r, 0));

		expect(markMessageRead).toHaveBeenCalledWith('conv-1');
	});

	it('reject 時維持未讀', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: new Error('network') })
		);
		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');
		await new Promise((r) => setTimeout(r, 0));

		expect(markMessageRead).not.toHaveBeenCalled();
	});
});

describe('MessageThread — 身分切換 guard(R14 終審修波)', () => {
	beforeEach(async () => {
		vi.mocked(api).mockReset();
		vi.mocked(api).mockResolvedValue(undefined); // logout 的 best-effort revoke .catch 安全
		await authStore.logout();
	});

	afterEach(async () => {
		vi.mocked(api).mockReset();
		vi.mocked(api).mockResolvedValue(undefined);
		await authStore.logout();
	});

	it('ack 落地前身分已切換：markMessageRead 不呼叫', async () => {
		let resolveAck!: (v: { updated: number }) => void;
		const ack = new Promise<{ updated: number }>((res) => (resolveAck = res));
		vi.mocked(api).mockImplementation(
			fakeRouter({ [THREAD_PATH]: { messages: [], total: 0 }, [READ_PATH]: () => ack })
		);
		vi.mocked(api).mockResolvedValueOnce(AUTH_RES_A);
		await authStore.login('a@dreamfly.test', 'pw'); // load() 捕捉這個身分

		render(MessageThread, { props: { onBack: () => {}, m: M } });
		await screen.findByPlaceholderText('輸入回覆…');

		vi.mocked(api).mockResolvedValueOnce(AUTH_RES_B);
		await authStore.login('b@dreamfly.test', 'pw'); // 身分切換，ack 尚未落地

		resolveAck({ updated: 1 });
		await new Promise((r) => setTimeout(r, 0));

		expect(markMessageRead).not.toHaveBeenCalled();
	});
});
