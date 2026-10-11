import { describe, it, expect, vi, afterEach, onTestFinished } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import AdminTabBar from './TabBar.svelte';
import { ADMIN_TABS, COACH_TABS, adminPath } from '$lib/mobile-admin/nav';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { conversationSummary } from '$lib/testing/wire-fixtures';
import { unreadConversationCount, hydrateConversations, markConversationRead } from '$lib/coach/conversations';

/* 教練分頁的訊息角標讀 $lib/coach/conversations 的 unreadConversationCount(有未讀的對話數);
 * 列表唯讀,夾具一律經 GET /conversations/me 水合(只替換 api())。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** 三筆對話,其中兩筆有未讀。 */
const LIST = [
	conversationSummary({ id: 'c1', unread_count: 2 }),
	conversationSummary({ id: 'c2', unread_count: 0 }),
	conversationSummary({ id: 'c3', unread_count: 1 })
];
const hydrate = async () => {
	vi.mocked(api).mockImplementation(fakeRouter({}, { 'GET /conversations/me': LIST }));
	await hydrateConversations();
};

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile-admin/admin') })
}));

afterEach(async () => {
	vi.restoreAllMocks();
	await resetSessionStores();
});

describe('m-admin TabBar adapter — smoke tests', () => {
	// R14(候選 F3)誠實開機:對話列表開機為 `[]` → unreadConversationCount 0 → 教練分頁沒有角標。
	// 重新載入模組才照得到開機那一刻(本檔其他 it 會水合列表),不依賴執行順序。
	it('開機沒有角標(role=coach,對話列表開機為空)', async () => {
		vi.resetModules();
		const fresh = await import('$lib/coach/conversations');
		const { default: FreshTabBar } = await import('./TabBar.svelte');
		// 元件與 render 須出自同一份 svelte runtime(重置後的新模組圖),掛載也由它自己清。
		const tl = await import('@testing-library/svelte');
		onTestFinished(tl.cleanup);
		expect(get(fresh.unreadConversationCount)).toBe(0);

		tl.render(FreshTabBar, { role: 'coach' });

		for (const link of screen.getAllByRole('link')) {
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

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

	it('role=coach: messages badge shows unreadConversationCount when > 0', async () => {
		// 夾具有 2 筆未讀對話(開機是空的,先水合)——verify adapter wires the badge.
		await hydrate();
		const currentUnread = get(unreadConversationCount);
		expect(currentUnread).toBe(2); // precondition: fixture has unread conversations

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

	it('role=admin: no messages badge regardless of unreadConversationCount (admin badges={} by design)', async () => {
		// Even if messages exist, admin role injects badges={} — no badge should appear.
		await hydrate();
		const currentUnread = get(unreadConversationCount);
		expect(currentUnread).toBeGreaterThan(0); // precondition: there ARE unread messages

		render(AdminTabBar, { role: 'admin' });

		const links = screen.getAllByRole('link');
		for (const link of links) {
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

	it('role=coach: messages badge absent when unreadConversationCount = 0', async () => {
		// Mark all conversations read so derived unreadConversationCount emits 0.
		await hydrate();
		for (const c of LIST) await markConversationRead(c.id, Promise.resolve(true));
		expect(get(unreadConversationCount)).toBe(0); // verify precondition

		render(AdminTabBar, { role: 'coach' });

		const links = screen.getAllByRole('link');
		const msgLink = links.find((l) => l.textContent?.includes('訊息'))!;
		// Gate {#if b > 0} must be false when count = 0.
		expect(msgLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});
});
