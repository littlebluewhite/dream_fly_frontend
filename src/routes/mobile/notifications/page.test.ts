import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { getNotifications } from '$lib/mobile/api';
import { api } from '$lib/api/client';
import { notifs, notifsHydrated, toasts } from '$lib/mobile/stores';
import { NOTIFS_SEED } from '$lib/mobile/data';
import type { NotifItem } from '$lib/mobile/data';
import Page from './+page.svelte';

vi.mock('$lib/mobile/api', () => ({ getNotifications: vi.fn() }));
// W1:notifs.markRead/markAllRead 現在會送 PATCH 落庫(見 $lib/mobile/stores.ts)——
// 只替換 $lib/api/client 的 api(),spread 保留其餘 export(同 member 前例)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

beforeEach(() => {
	vi.mocked(getNotifications).mockReset();
	vi.mocked(api).mockReset();
	vi.mocked(api).mockResolvedValue(undefined);
	// toasts 是自動過期的 singleton — 前一個測試的 toast 會殘留到下一個測試,
	// 清掉才能對「某 toast 不得出現」做可靠斷言(同 member 前例)。
	get(toasts).forEach((t) => toasts.dismiss(t.id));
	// 重設 load-once 守衛,讓每個測試都從「尚未水合」開始。
	notifsHydrated.set(false);
	// 重新 seed 共享 feed(store 同步 seed 起始,比照 member 前例),避免前一
	// 測試的 set()/markAllRead 滲漏到下一個測試。
	notifs.set(NOTIFS_SEED.map((n) => ({ ...n })));
});

afterEach(() => {
	// 確保共享 store 在每個測試後都還原為 seed。
	notifs.set(NOTIFS_SEED.map((n) => ({ ...n })));
	notifsHydrated.set(false);
});

describe('mobile/notifications 頁', () => {
	it('先骨架,async 載入後顯示通知', async () => {
		vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
		render(Page);
		expect(screen.queryByText('明日課程提醒')).toBeNull();
		expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
	});

	it('loading 分支有可辨識骨架標記(data-testid="notifications-skeleton")', () => {
		vi.mocked(getNotifications).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="notifications-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getNotifications).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('load-once 守衛:已 hydrate 則重訪不再 fetch、直接 ready', async () => {
		// 模擬「先前已成功載入」:守衛為 true(store 已由 beforeEach seed)。
		notifsHydrated.set(true);
		render(Page);
		// 直接 ready(store 已有資料),且未再呼叫接縫 → 不覆寫已讀狀態。
		expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
		expect(vi.mocked(getNotifications)).not.toHaveBeenCalled();
	});

	it('首次成功載入會把守衛設為 true', async () => {
		vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
		render(Page);
		await screen.findByText('明日課程提醒');
		expect(get(notifsHydrated)).toBe(true);
	});

	it('refresh 失敗後重試必須真正重新 fetch 而非被 hydration 守衛短路', async () => {
		// Step 1: 初次載入成功 → hydration 守衛設為 true
		vi.mocked(getNotifications).mockResolvedValueOnce(NOTIFS_SEED.map((n) => ({ ...n })));
		render(Page);
		await screen.findByText('明日課程提醒');

		// Step 2: 使用者點「重新整理」，但這次 fetch 失敗
		vi.mocked(getNotifications).mockRejectedValueOnce(new Error('network error'));
		await fireEvent.click(screen.getByRole('button', { name: /重新整理/ }));
		await screen.findByText('載入失敗');

		// Step 3: 使用者點 ErrorState 的「重新載入」重試
		// Bug: onRetry={load} 被 hydration 守衛短路，不會再呼叫 getNotifications
		// Fix: onRetry={refresh} 確保一定重新 fetch
		vi.mocked(getNotifications).mockResolvedValueOnce(NOTIFS_SEED.map((n) => ({ ...n })));
		await fireEvent.click(screen.getByRole('button', { name: /重新載入/ }));
		await screen.findByText('明日課程提醒');

		// 應呼叫 3 次: 初次載入 + 失敗的 refresh + 重試的 refresh
		expect(vi.mocked(getNotifications)).toHaveBeenCalledTimes(3);
	});

	it('unmount 後解析的 in-flight fetch 不應覆寫 shared notifs store', async () => {
		// Arrange: deferred promise so we can control when promise A resolves.
		let resolveA!: (value: NotifItem[]) => void;
		vi.mocked(getNotifications).mockReturnValueOnce(
			new Promise<NotifItem[]>((r) => { resolveA = r; })
		);

		// Mount: load() fires on mount; promise A is pending (phase=loading).
		const { unmount } = render(Page);

		// Simulate post-remount state: user already marked items read in the store.
		const sentinel: NotifItem[] = [
			{ id: 'sentinel', cat: 'system', icon: 'bell', tone: 'info', title: '哨兵', body: '已讀哨兵', time: '剛才', read: true }
		];
		notifs.set(sentinel);

		// Unmount the component (simulates navigating away).
		unmount();

		// Now the stale promise A resolves with fresh seed data.
		resolveA(NOTIFS_SEED.map((n) => ({ ...n })));
		// Flush microtasks so the .then() callback runs.
		await Promise.resolve();
		await tick();

		// The shared store must NOT have been clobbered — sentinel must still be there.
		expect(get(notifs)).toEqual(sentinel);
	});

	it('分類清單為空時顯示 MEmpty,不留白', async () => {
		vi.mocked(getNotifications).mockResolvedValue([]);
		render(Page);
		expect(await screen.findByText('沒有通知')).toBeInTheDocument();
	});

	// 回歸主測(W1):seed 預設 3 筆未讀,點其中 1 筆後 header 仍是「2 則未讀」,
	// 斷不出「已讀有沒有真的落庫、重新整理會不會回退」的乾淨信號——改用只有
	// 1 筆未讀的 fixture,點過之後 header 會轉成極端值「全部已讀」，才是可靠訊號。
	it('點通知標記已讀送出 PATCH，重新整理後已讀不回退、header 轉為「全部已讀」', async () => {
		const SINGLE_UNREAD: NotifItem[] = [
			{ id: 'w1', cat: 'system', icon: 'bell', tone: 'info', title: '單筆未讀通知', body: '內容', time: '剛才', read: false }
		];
		vi.mocked(getNotifications).mockResolvedValueOnce(SINGLE_UNREAD.map((n) => ({ ...n })));
		render(Page);
		await screen.findByText('單筆未讀通知');
		expect(screen.getByText('1 則未讀')).toBeInTheDocument();

		await fireEvent.click(screen.getByText('單筆未讀通知'));
		expect(api).toHaveBeenCalledWith('/notifications/w1/read', { method: 'PATCH' });

		// 模擬後端已落庫:「重新整理」重新 fetch 到的這筆資料已是 read:true。
		vi.mocked(getNotifications).mockResolvedValueOnce([{ ...SINGLE_UNREAD[0], read: true }]);
		await fireEvent.click(screen.getByRole('button', { name: /重新整理/ }));

		await screen.findByText('全部已讀');
	});

	it('全部已讀成功 → success toast', async () => {
		vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
		render(Page);
		await screen.findByText('明日課程提醒');

		await fireEvent.click(screen.getByRole('button', { name: '全部已讀' }));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.title === '已全部標示為已讀')).toBe(true);
		});
	});

	it('任一已讀 PATCH 失敗 → error toast「部分通知標記失敗」', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
		vi.mocked(api).mockImplementation(async (path: string) => {
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
