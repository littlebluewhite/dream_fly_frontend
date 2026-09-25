import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { api } from '$lib/api/client';
import { notifications, notificationsHydrated } from '$lib/mobile/stores';
import { toasts } from '$lib/mobile/stores';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { NOTIFS_SEED } from '$lib/domain/member-app';
// notifications store 現在是 member 的 Notification(tone: Tone 窄型別)——sentinel fixture
// 寫入 store 需要窄型別,不能用 domain 的寬鬆型別(tone: string)註記(合一後單向可指派:
// member → domain,反過來不行,見 task-5-report.md)。
import type { ApiNotification, Notification as NotifItem } from '$lib/member/data';
import Page from './+page.svelte';

// Task 5(架構深化 R12):mobile 專屬的 $lib/mobile/notifications.ts 已併入
// member 模組(唯一通知 module),消費端改經 $lib/mobile/stores 轉出同一顆
// createSessionGate。fetch 因此不再是 $lib/mobile/api 的 getNotifications,而是
// 閘門內部的 api('/notifications') + mapNotification——mock 點隨之下移到
// $lib/api/client,以路徑分流 GET /notifications 與已讀 PATCH(同 member 側
// routes/member/notifications/page.test.ts 的既有慣例)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** GET /notifications 的後端形狀(ApiNotification),只填 mapNotification 會讀到的欄位。
 *  title/message 預設可覆寫——多數測試需要渲染出 NOTIFS_SEED 的真實文案(如「明日課程
 *  提醒」)才斷得到畫面,不能一律硬編佔位字串。 */
function apiNotif(id: string, read: boolean, title = '系統公告', message = '內容') {
	return {
		id, type: 'system', title, message,
		is_read: read, metadata: null, created_at: '2026-01-01T00:00:00Z'
	};
}

/** 把 domain NOTIFS_SEED 的一筆轉成對應的後端 wire 形(type 一律 'system'——本頁測試
 *  不驗證 cat/icon/tone 的映射表,那是 member/notifications.test.ts 的 mapNotification
 *  覆蓋範圍;這裡只需要標題/內文/已讀狀態能在畫面上被斷言到)。 */
const seedToWire = (n: (typeof NOTIFS_SEED)[number]) => apiNotif(n.id, n.read, n.title, n.body);

/** GET /notifications 的回應由各測試自行指定;未指定即拋錯(漏設會紅,不靜默放行)。 */
let feed: () => Promise<ApiNotification[]>;
const FEED_UNSET = () => Promise.reject(new Error('測試未指定 GET /notifications 回應'));
/** 本頁只有兩種 api 呼叫:GET /notifications(路徑相等)與 /notifications/{id}/read。 */
const feedCalls = () => vi.mocked(api).mock.calls.filter(([path]) => path === '/notifications').length;

beforeEach(() => {
	vi.mocked(api).mockReset();
	feed = FEED_UNSET;
	vi.mocked(api).mockImplementation(async (path: string) => (path === '/notifications' ? feed() : undefined));
	// toasts 是自動過期的 singleton — 前一個測試的 toast 會殘留到下一個測試,
	// 清掉才能對「某 toast 不得出現」做可靠斷言(同 member 前例)。
	get(toasts).forEach((t) => toasts.dismiss(t.id));
	// 重設 load-once 守衛,讓每個測試都從「尚未水合」開始。
	notificationsHydrated.set(false);
	// 重新 seed 共享 feed(store 同步 seed 起始,比照 member 前例),避免前一
	// 測試的 set()/markAllRead 滲漏到下一個測試。
	notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
});

afterEach(() => {
	// 確保共享 store 在每個測試後都還原為 seed。
	notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
	notificationsHydrated.set(false);
});

describe('mobile/notifications 頁', () => {
	it('先骨架,async 載入後顯示通知', async () => {
		feed = async () => NOTIFS_SEED.map(seedToWire);
		render(Page);
		expect(screen.queryByText('明日課程提醒')).toBeNull();
		expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
	});

	it('loading 分支有可辨識骨架標記(data-testid="notifications-skeleton")', () => {
		feed = () => new Promise(() => {});
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="notifications-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		feed = () => Promise.reject(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('load-once 守衛:已 hydrate 則重訪不再 fetch、直接 ready', async () => {
		// 模擬「先前已成功載入」:守衛為 true(store 已由 beforeEach seed)。
		notificationsHydrated.set(true);
		render(Page);
		// 直接 ready(store 已有資料),且未再呼叫接縫 → 不覆寫已讀狀態。
		expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
		expect(feedCalls()).toBe(0);
	});

	it('首次成功載入會把守衛設為 true', async () => {
		feed = async () => NOTIFS_SEED.map(seedToWire);
		render(Page);
		await screen.findByText('明日課程提醒');
		expect(get(notificationsHydrated)).toBe(true);
	});

	it('refresh 失敗後重試必須真正重新 fetch 而非被 hydration 守衛短路', async () => {
		// Step 1: 初次載入成功 → hydration 守衛設為 true
		feed = async () => NOTIFS_SEED.map(seedToWire);
		render(Page);
		await screen.findByText('明日課程提醒');

		// Step 2: 使用者點「重新整理」，但這次 fetch 失敗
		feed = () => Promise.reject(new Error('network error'));
		await fireEvent.click(screen.getByRole('button', { name: /重新整理/ }));
		await screen.findByText('載入失敗');

		// Step 3: 使用者點 ErrorState 的「重新載入」重試
		// Bug: onRetry={load} 被 hydration 守衛短路，不會再呼叫接縫
		// Fix: onRetry={refresh} 確保一定重新 fetch
		feed = async () => NOTIFS_SEED.map(seedToWire);
		await fireEvent.click(screen.getByRole('button', { name: /重新載入/ }));
		await screen.findByText('明日課程提醒');

		// 應呼叫 3 次: 初次載入 + 失敗的 refresh + 重試的 refresh
		expect(feedCalls()).toBe(3);
	});

	it('unmount 後解析的 in-flight fetch 不應覆寫 shared notifications store', async () => {
		// Arrange: deferred promise so we can control when promise A resolves.
		let resolveA!: (value: ApiNotification[]) => void;
		feed = () => new Promise<ApiNotification[]>((r) => { resolveA = r; });

		// Mount: load() fires on mount; promise A is pending (phase=loading).
		const { unmount } = render(Page);

		// Simulate post-remount state: user already marked items read in the store.
		const sentinel: NotifItem[] = [
			{ id: 'sentinel', cat: 'system', icon: 'bell', tone: 'info', title: '哨兵', body: '已讀哨兵', time: '剛才', read: true }
		];
		notifications.set(sentinel);

		// Unmount the component (simulates navigating away).
		unmount();

		// Now the stale promise A resolves with fresh seed data.
		resolveA(NOTIFS_SEED.map(seedToWire));
		// Flush microtasks so the .then() callback runs.
		await Promise.resolve();
		await tick();

		// The shared store must NOT have been clobbered — sentinel must still be there.
		expect(get(notifications)).toEqual(sentinel);
	});

	// C3 在飛換帳釘(關閉 ADR 0017 的 epoch 殘窗):頁面改吃 notificationsPageEntry 之前,
	// load-gate 的 fetch 繞過 epoch 核對——跨登出的在飛回應會被無條件寫進共享
	// notifications store(B 帳號直接看到 A 的通知)並收斂為 ready。現在 fetch 帶
	// epoch 核對,過期即 throw,頁面落 error 態、store 不被覆寫。
	it('在飛換帳釘:pending fetch 期間登出 → 舊帳號回應作廢(頁面轉 ErrorState),共享 notifications store 不被 stale 資料覆寫', async () => {
		const AUTH_RES = {
			access_token: 'at-p', refresh_token: 'rt-p',
			user: { id: 'u-p1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false, avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member'] }
		};
		let resolveA!: (value: ApiNotification[]) => void;
		const pending = new Promise<ApiNotification[]>((r) => { resolveA = r; });
		vi.mocked(api).mockImplementation(fakeRouter({
			'POST /auth/login': AUTH_RES,
			'POST /auth/logout': undefined,
			'GET /notifications': () => pending
		}));

		await authStore.login('a@dreamfly.test', 'pw');
		render(Page); // A 的 fetch 掛起中(phase=loading)

		await authStore.logout(); // 在飛期間登出 → 閘門 epoch+1、reset 把 store 歸 boot seed

		resolveA([apiNotif('a-only', true, 'A 帳號的通知')]);

		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
		expect(screen.queryByText('A 帳號的通知')).toBeNull();
		expect(get(notifications)).toEqual(NOTIFS_SEED); // 舊帳號資料沒有寫進共享 store
	});

	it('分類清單為空時顯示 MEmpty,不留白', async () => {
		feed = async () => [];
		render(Page);
		expect(await screen.findByText('沒有通知')).toBeInTheDocument();
	});

	// 回歸主測(W1):seed 預設 3 筆未讀,點其中 1 筆後 header 仍是「2 則未讀」,
	// 斷不出「已讀有沒有真的落庫、重新整理會不會回退」的乾淨信號——改用只有
	// 1 筆未讀的 fixture,點過之後 header 會轉成極端值「全部已讀」，才是可靠訊號。
	it('點通知標記已讀送出 PATCH，重新整理後已讀不回退、header 轉為「全部已讀」', async () => {
		feed = async () => [apiNotif('w1', false)];
		render(Page);
		await screen.findByText('系統公告');
		expect(screen.getByText('1 則未讀')).toBeInTheDocument();

		await fireEvent.click(screen.getByText('系統公告'));
		expect(api).toHaveBeenCalledWith('/notifications/w1/read', { method: 'PATCH' });

		// 模擬後端已落庫:「重新整理」重新 fetch 到的這筆資料已是 read:true。
		feed = async () => [apiNotif('w1', true)];
		await fireEvent.click(screen.getByRole('button', { name: /重新整理/ }));

		await screen.findByText('全部已讀');
	});

	it('全部已讀成功 → success toast', async () => {
		feed = async () => NOTIFS_SEED.map(seedToWire);
		render(Page);
		await screen.findByText('明日課程提醒');

		await fireEvent.click(screen.getByRole('button', { name: '全部已讀' }));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.title === '已全部標示為已讀')).toBe(true);
		});
	});

	it('任一已讀 PATCH 失敗 → error toast「部分通知標記失敗」', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		feed = async () => NOTIFS_SEED.map(seedToWire);
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/notifications') return feed();
			if (path === '/notifications/n2/read') throw new Error('network error');
			return undefined;
		});
		render(Page);
		await screen.findByText('明日課程提醒');

		await fireEvent.click(screen.getByRole('button', { name: '全部已讀' }));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.title === '部分通知標記失敗')).toBe(true);
		});
	});
});
