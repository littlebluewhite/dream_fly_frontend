import { describe, it, expect, vi, beforeEach, afterEach, onTestFinished } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import MobileTabBar from './TabBar.svelte';
import { TABS, mobilePath } from '$lib/mobile/nav';
import { api } from '$lib/api/client';
import { hydrateNotifications, markAllRead, unreadCount } from '$lib/member/notifications';
import { NOTIFS_SEED } from '$lib/testing/seed-fixtures';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { notificationResponse } from '$lib/testing/wire-fixtures';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile') })
}));
// 通知內容經閘門水合(GET /notifications);markAllRead() 會送 PATCH 落庫——這裡只隔離掉
// 真正的 fetch,不驗證落庫本身。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

beforeEach(async () => {
	await resetSessionStores(); // 通知閘門回開機態(內容 []、未水合)
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** 經閘門水合夾具 NOTIFS_SEED(3 則未讀),PATCH 一律成功,再清掉呼叫紀錄。 */
async function hydrateSeed(): Promise<void> {
	const routes: Record<string, unknown> = {
		'GET /notifications': NOTIFS_SEED.map((n) => notificationResponse({ id: n.id, is_read: n.read }))
	};
	for (const n of NOTIFS_SEED) routes[`PATCH /notifications/${n.id}/read`] = undefined;
	vi.mocked(api).mockImplementation(fakeRouter(routes));
	await hydrateNotifications();
	vi.mocked(api).mockClear();
}

describe('mobile TabBar adapter — smoke tests', () => {
	// R14(候選 F3)誠實開機:通知 store 開機為 `[]` → 未讀 0 → 沒有角標(不再顯示種子的假 3 則)。
	// 重新載入模組才照得到開機那一刻(本檔其他 it 會水合通知),不依賴執行順序。
	it('開機沒有角標(通知 store 開機為空)', async () => {
		vi.resetModules();
		const fresh = await import('$lib/member/notifications');
		const { default: FreshTabBar } = await import('./TabBar.svelte');
		// 元件與 render 須出自同一份 svelte runtime(重置後的新模組圖),掛載也由它自己清。
		const tl = await import('@testing-library/svelte');
		onTestFinished(tl.cleanup);
		expect(get(fresh.unreadCount)).toBe(0);

		tl.render(FreshTabBar);

		for (const link of screen.getAllByRole('link')) {
			expect(link.querySelector('span[style*="border-radius:999px"]')).toBeNull();
		}
	});

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

	it('notifications badge shows the unread count when unread > 0', async () => {
		// 夾具 NOTIFS_SEED 有 3 則未讀(開機是空的,先水合)。
		await hydrateSeed();
		const currentUnread = get(unreadCount);
		expect(currentUnread).toBeGreaterThan(0); // precondition: fixture has unread items

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

	it('notifications badge is absent when unread = 0 (adapter wires badges correctly)', async () => {
		// Mark all notifications read so the derived `unreadCount` store emits 0.
		await hydrateSeed();
		await markAllRead();
		expect(get(unreadCount)).toBe(0); // verify precondition

		render(MobileTabBar);

		const links = screen.getAllByRole('link');
		const notifLink = links.find((l) => l.textContent?.includes('通知'))!;
		// Gate {#if b > 0} must be false — no badge span.
		expect(notifLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});
});
