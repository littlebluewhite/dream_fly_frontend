import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import MobileTabBar from './TabBar.svelte';
import { TABS, mobilePath } from '$lib/mobile/nav';
import { notifs, notifsHydrated, unread } from '$lib/mobile/stores';
import { NOTIFS_SEED } from '$lib/mobile/data';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile') })
}));

afterEach(() => {
	vi.restoreAllMocks();
	// notifs 現在起始為空陣列,由 notifications 頁的 getNotifications() 接縫水合
	// (見 stores.ts)。重置回空,避免本檔測試之間互相污染。
	notifs.set([]);
	notifsHydrated.set(false);
});

describe('mobile TabBar adapter — smoke tests', () => {
	it('renders all 5 TABS with correct labels', () => {
		render(MobileTabBar);

		expect(screen.getByText('首頁')).toBeInTheDocument();
		expect(screen.getByText('課程')).toBeInTheDocument();
		expect(screen.getByText('我的課程')).toBeInTheDocument();
		expect(screen.getByText('通知')).toBeInTheDocument();
		expect(screen.getByText('帳戶')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('each link href matches mobilePath(id) for every tab in TABS', () => {
		render(MobileTabBar);

		const links = screen.getAllByRole('link');

		// For every tab, find the link that contains its label and verify the href.
		for (const t of TABS) {
			const link = links.find((l) => l.textContent?.includes(t.label));
			expect(link).toBeTruthy();
			expect(link?.getAttribute('href')).toBe(mobilePath(t.id));
		}
	});

	it('notifications badge shows the unread count when unread > 0', () => {
		// notifs 起始為空(水合前);比照 notifications 頁 load() 水合後的狀態,
		// 用 NOTIFS_SEED 寫回 store 再驗證徽章數字。
		notifs.set(NOTIFS_SEED.map((n) => ({ ...n })));
		const currentUnread = get(unread);
		expect(currentUnread).toBeGreaterThan(0); // precondition: seed has unread items

		render(MobileTabBar);

		const links = screen.getAllByRole('link');
		const notifLink = links.find((l) => l.textContent?.includes('通知'))!;
		expect(notifLink).toBeTruthy();

		// Badge span must live inside the notifications link with the exact count.
		const badgeSpan = notifLink.querySelector('span');
		expect(badgeSpan).not.toBeNull();
		expect(badgeSpan?.textContent).toBe(String(currentUnread));

		// No other tab should carry a badge span.
		for (const link of links) {
			if (link === notifLink) continue;
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

	it('notifications badge is absent when unread = 0 (adapter wires badges correctly)', () => {
		// 先水合(比照 notifications 頁),再全部標為已讀,讓 derived `unread` 歸零。
		notifs.set(NOTIFS_SEED.map((n) => ({ ...n })));
		notifs.markAllRead();
		expect(get(unread)).toBe(0); // verify precondition

		render(MobileTabBar);

		const links = screen.getAllByRole('link');
		const notifLink = links.find((l) => l.textContent?.includes('通知'))!;
		// Gate {#if b > 0} must be false — no badge span.
		expect(notifLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});
});
