import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MessagesPage from './+page.svelte';
import { messages, hydrateMessages, coachMsgUnread, markMessageRead } from '$lib/mobile-admin/stores';
import { resetSessionStores } from '$lib/testing/session-reset';
import { MESSAGES } from '$lib/testing/seed-fixtures';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getMessages()(轉呼叫
 * 桌面 coach/api.ts 的真 getConversations()，GET /conversations/me)走真實 fetch adapter。
 * getConversations() 不經教練身分閘門(不呼叫 requireCoach())，不需要 loginAs()。真映射的
 * time 欄位是絕對時間字串(或空字串)，不會產出「剛剛/5 分鐘前」這類相對時間標籤——本檔
 * 不斷言 time 文字內容，僅相異 fixture 用來證明頁面讀真 payload。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

interface WireConversation { id: string; peer_id: string; peer_name: string; last_message_body: string | null; last_message_at: string | null; unread_count: number }

// 與種子夾具 MESSAGES 相異的 fixture(家長姓名、預覽內容皆改過),證明頁面讀 hydrateMessages()
// 水合後的 $messages store,而非殘留的夾具巧合通過。
const WIRE_MESSAGES: WireConversation[] = [
	{ id: 'zz1', peer_id: 'p1', peer_name: '測試家長甲', last_message_body: '測試預覽甲', last_message_at: '2026-01-01T00:00:00Z', unread_count: 3 },
	{ id: 'zz2', peer_id: 'p2', peer_name: '測試家長乙', last_message_body: '測試預覽乙', last_message_at: '2026-01-01T00:00:00Z', unread_count: 0 }
];

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': WIRE_MESSAGES }));
	await resetSessionStores();
	messages.set(MESSAGES.map((m) => ({ ...m })));
});

afterEach(async () => {
	await resetSessionStores();
	messages.set(MESSAGES.map((m) => ({ ...m })));
});

describe('mobile-admin/coach/messages 頁', () => {
	it('loading 分支顯示骨架(data-testid="messages-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(MessagesPage);
		expect(container.querySelector('[data-testid="messages-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $messages store 的訊息(相異 fixture)', async () => {
		const { findByText } = render(MessagesPage);
		expect(await findByText('測試家長甲')).toBeInTheDocument();
		expect(await findByText('測試家長乙')).toBeInTheDocument();
	});

	it('點擊訊息不樂觀清未讀(R14 候選 F5：已讀改由 MessageThread.svelte 等後端 markRead ack 才清)', async () => {
		const { findByText } = render(MessagesPage);
		const firstUnread = '測試家長甲'; // WIRE_MESSAGES[0].unread_count > 0
		await findByText(firstUnread);
		const before = get(coachMsgUnread);

		await fireEvent.click(await findByText(firstUnread));

		expect(get(coachMsgUnread)).toBe(before);
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': new Error('boom') }));
		const { findByText } = render(MessagesPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('訊息空集合不當機,顯示既有的空狀態', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': [] }));
		const { findByText } = render(MessagesPage);
		expect(await findByText('沒有符合的訊息')).toBeInTheDocument();
	});

	it('hydrated 守衛:已水合則重訪不再 fetch,既有 markMessageRead 結果不被覆寫', async () => {
		// 模擬「先前已成功載入且使用者已讀過一則」。
		await hydrateMessages(); // fetch 替身回 WIRE_MESSAGES(旗標唯讀,經真水合翻 true)
		vi.mocked(api).mockClear();
		const firstUnreadId = WIRE_MESSAGES[0].id;
		await markMessageRead(firstUnreadId, Promise.resolve(true));

		render(MessagesPage);
		await new Promise((r) => setTimeout(r, 0));
		expect(api).not.toHaveBeenCalled();
		expect(get(messages).find((m) => m.id === firstUnreadId)?.unread).toBe(false);
	});
});
