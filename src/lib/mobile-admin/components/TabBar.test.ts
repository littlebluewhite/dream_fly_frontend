import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import AdminTabBar from './TabBar.svelte';
import { ADMIN_TABS, COACH_TABS, adminPath } from '$lib/mobile-admin/nav';
import { messages, coachMsgUnread } from '$lib/mobile-admin/stores';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile-admin/admin') })
}));

afterEach(() => {
	vi.restoreAllMocks();
});

describe('m-admin TabBar adapter — smoke tests', () => {
	it('role=admin renders admin tab set (5 tabs: 總覽/學員/課程/訂單/更多)', () => {
		render(AdminTabBar, { role: 'admin' });

		expect(screen.getByText('總覽')).toBeInTheDocument();
		expect(screen.getByText('學員')).toBeInTheDocument();
		expect(screen.getByText('課程')).toBeInTheDocument();
		expect(screen.getByText('訂單')).toBeInTheDocument();
		expect(screen.getByText('更多')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('role=coach renders coach tab set (5 tabs: 工作台/點名/學員/訊息/設定)', () => {
		render(AdminTabBar, { role: 'coach' });

		expect(screen.getByText('工作台')).toBeInTheDocument();
		expect(screen.getByText('點名')).toBeInTheDocument();
		expect(screen.getByText('學員')).toBeInTheDocument();
		expect(screen.getByText('訊息')).toBeInTheDocument();
		expect(screen.getByText('設定')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('admin and coach tab sets are different (不同 role → 不同 tabs)', () => {
		const { unmount } = render(AdminTabBar, { role: 'admin' });
		const adminLabels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
		unmount();

		render(AdminTabBar, { role: 'coach' });
		const coachLabels = screen.getAllByRole('link').map((l) => l.textContent?.trim());

		expect(adminLabels).not.toEqual(coachLabels);
	});

	it('each role=admin link href matches adminPath(admin, id) for every ADMIN_TAB', () => {
		render(AdminTabBar, { role: 'admin' });

		const links = screen.getAllByRole('link');

		for (const t of ADMIN_TABS) {
			const link = links.find((l) => l.textContent?.includes(t.label));
			expect(link).toBeTruthy();
			expect(link?.getAttribute('href')).toBe(adminPath('admin', t.id));
		}
	});

	it('each role=coach link href matches adminPath(coach, id) for every COACH_TAB', () => {
		render(AdminTabBar, { role: 'coach' });

		const links = screen.getAllByRole('link');

		for (const t of COACH_TABS) {
			const link = links.find((l) => l.textContent?.includes(t.label));
			expect(link).toBeTruthy();
			expect(link?.getAttribute('href')).toBe(adminPath('coach', t.id));
		}
	});

	it('role=coach: messages badge shows coachMsgUnread count when > 0', () => {
		// MESSAGES seed has 3 unread items — verify adapter wires the badge.
		const currentUnread = get(coachMsgUnread);
		expect(currentUnread).toBeGreaterThan(0); // precondition: seed has unread messages

		render(AdminTabBar, { role: 'coach' });

		const links = screen.getAllByRole('link');
		const msgLink = links.find((l) => l.textContent?.includes('訊息'))!;
		expect(msgLink).toBeTruthy();

		// Badge span must be inside the 訊息 link with the exact count.
		const badgeSpan = msgLink.querySelector('span');
		expect(badgeSpan).not.toBeNull();
		expect(badgeSpan?.textContent).toBe(String(currentUnread));

		// No other coach tab should carry a badge.
		for (const link of links) {
			if (link === msgLink) continue;
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

	it('role=admin: no messages badge regardless of coachMsgUnread (admin badges={} by design)', () => {
		// Even if messages exist, admin role injects badges={} — no badge should appear.
		const currentUnread = get(coachMsgUnread);
		expect(currentUnread).toBeGreaterThan(0); // precondition: there ARE unread messages

		render(AdminTabBar, { role: 'admin' });

		const links = screen.getAllByRole('link');
		for (const link of links) {
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

	it('role=coach: messages badge absent when coachMsgUnread = 0', () => {
		// Mark all messages read so derived coachMsgUnread emits 0.
		messages.update(($m) => $m.map((m) => ({ ...m, unread: false })));
		expect(get(coachMsgUnread)).toBe(0); // verify precondition

		render(AdminTabBar, { role: 'coach' });

		const links = screen.getAllByRole('link');
		const msgLink = links.find((l) => l.textContent?.includes('訊息'))!;
		// Gate {#if b > 0} must be false when count = 0.
		expect(msgLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});
});
