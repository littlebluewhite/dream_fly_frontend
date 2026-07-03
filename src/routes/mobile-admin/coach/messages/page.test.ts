import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MessagesPage from './+page.svelte';
import { getMessages } from '$lib/mobile-admin/api';
import { messages, messagesHydrated, coachMsgUnread, markMessageRead } from '$lib/mobile-admin/stores';
import { MESSAGES } from '$lib/mobile-admin/data';
import type { MessageRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getMessages: vi.fn() }));

// 與 seed 相異的 fixture(家長姓名、預覽內容皆改過),證明頁面讀 hydrateMessages()
// 水合後的 $messages store,而非殘留的同步 seed 巧合通過。
const FIXTURE_MESSAGES: MessageRow[] = [
	{ id: 'zz1', from: '測試家長甲', initial: '甲', color: '#000', preview: '測試預覽甲', time: '剛剛', unread: true },
	{ id: 'zz2', from: '測試家長乙', initial: '乙', color: '#000', preview: '測試預覽乙', time: '5 分鐘前', unread: false }
];

beforeEach(() => {
	vi.mocked(getMessages).mockReset();
	vi.mocked(getMessages).mockResolvedValue(FIXTURE_MESSAGES.map((m) => ({ ...m })));
	messagesHydrated.set(false);
	messages.set(MESSAGES.map((m) => ({ ...m })));
});

afterEach(() => {
	messagesHydrated.set(false);
	messages.set(MESSAGES.map((m) => ({ ...m })));
});

describe('mobile-admin/coach/messages 頁', () => {
	it('loading 分支顯示骨架(data-testid="messages-skeleton")', () => {
		vi.mocked(getMessages).mockReturnValue(new Promise(() => {}));
		const { container } = render(MessagesPage);
		expect(container.querySelector('[data-testid="messages-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $messages store 的訊息(相異 fixture)', async () => {
		const { findByText } = render(MessagesPage);
		expect(await findByText('測試家長甲')).toBeInTheDocument();
		expect(await findByText('測試家長乙')).toBeInTheDocument();
	});

	it('點擊未讀訊息會標記已讀並降低教練端未讀徽章(codex P2 regression,適配非同步水合)', async () => {
		const { findByText } = render(MessagesPage);
		const firstUnread = FIXTURE_MESSAGES.find((m) => m.unread)!;
		await findByText(firstUnread.from);
		const before = get(coachMsgUnread);

		await fireEvent.click(await findByText(firstUnread.from));

		expect(get(coachMsgUnread)).toBe(before - 1);
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getMessages).mockRejectedValue(new Error('boom'));
		const { findByText } = render(MessagesPage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('訊息空集合不當機,顯示既有的空狀態', async () => {
		vi.mocked(getMessages).mockResolvedValue([]);
		const { findByText } = render(MessagesPage);
		expect(await findByText('沒有符合的訊息')).toBeInTheDocument();
	});

	it('hydrated 守衛:已水合則重訪不再 fetch,既有 markMessageRead 結果不被覆寫', async () => {
		// 模擬「先前已成功載入且使用者已讀過一則」。
		messages.set(FIXTURE_MESSAGES.map((m) => ({ ...m })));
		messagesHydrated.set(true);
		const firstUnread = FIXTURE_MESSAGES.find((m) => m.unread)!;
		markMessageRead(firstUnread.id);

		render(MessagesPage);
		await new Promise((r) => setTimeout(r, 0));
		expect(vi.mocked(getMessages)).not.toHaveBeenCalled();
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
	});
});
