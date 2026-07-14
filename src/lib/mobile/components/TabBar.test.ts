import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import MobileTabBar from './TabBar.svelte';
import { TABS, mobilePath } from '$lib/mobile/nav';
import { notifs, unread } from '$lib/mobile/stores';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile') })
}));
// W1:notifs.markAllRead()(見下方 :72)現在會送 PATCH 落庫(見 $lib/mobile/
// stores.ts)——這裡純粹隔離掉真正的 fetch,不驗證落庫本身,斷言零變更。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

afterEach(() => {
	vi.restoreAllMocks();
	// Reset notifs to ensure unread count is back to the seeded value for other tests.
	// createNotifs DOES expose set() (added for hydration), but we leave the store
	// as-is here — each test controls it as needed for its assertions.
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
		// NOTIFS_SEED has 3 unread items out of the box, so get() should be > 0.
		// If a previous test called markAllRead() we need at least one unread item.
		// Use the current live value — whatever the seed gives us.
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
		// Mark all notifications read so the derived `unread` store emits 0.
		notifs.markAllRead();
		expect(get(unread)).toBe(0); // verify precondition

		render(MobileTabBar);

		const links = screen.getAllByRole('link');
		const notifLink = links.find((l) => l.textContent?.includes('通知'))!;
		// Gate {#if b > 0} must be false — no badge span.
		expect(notifLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});
});
