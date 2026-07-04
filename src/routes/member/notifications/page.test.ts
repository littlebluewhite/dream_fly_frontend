import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { getNotifications } from '$lib/member/api';
import { api } from '$lib/api/client';
import { notifications, notificationsHydrated } from '$lib/member/stores';
import { NOTIFS_SEED } from '$lib/member/data';
import type { Notification } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getNotifications: vi.fn() }));
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(() => {
  vi.mocked(getNotifications).mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
  // Reset the load-once guard so each test starts un-hydrated. A store (not a
  // module boolean) so test order can't leak a prior successful hydrate.
  notificationsHydrated.set(false);
  // Re-seed the feed so a prior test's set() doesn't bleed through.
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
});

afterEach(() => {
  // Ensure shared store is always restored to seed after each test.
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
  notificationsHydrated.set(false);
});

describe('member/notifications 頁', () => {
  it('先骨架,async 載入後顯示通知', async () => {
    vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
    render(Page);
    expect(screen.queryByText('明日課程提醒')).toBeNull();
    expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
  });

  it('點擊通知(標為已讀)會呼叫 PATCH /notifications/{id}/read(Task 17)', async () => {
    notificationsHydrated.set(true); // 直接用 store 裡已有的 seed,略過 load()
    render(Page);
    const row = (await screen.findByText('明日課程提醒')).closest('button')!;

    await fireEvent.click(row);

    expect(api).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  it('PATCH 失敗時只記錄錯誤,樂觀更新的已讀狀態不還原', async () => {
    notificationsHydrated.set(true);
    vi.mocked(api).mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(Page);
    const row = (await screen.findByText('明日課程提醒')).closest('button')!;

    await fireEvent.click(row);
    await tick();

    // 樂觀更新已經套用 —— 該通知的未讀圓點消失(見 notif-row 樣板:!n.read 才畫點)。
    expect(row.querySelector('span[style*="border-radius:50%"]')).toBeNull();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getNotifications).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記(data-testid="notifs-skeleton")', () => {
    vi.mocked(getNotifications).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="notifs-skeleton"]')).not.toBeNull();
  });

  it('load-once 守衛:已 hydrate 則重訪不再 fetch、直接 ready', async () => {
    // 模擬「先前已成功載入」:守衛為 true、store 已有資料。
    notificationsHydrated.set(true);
    render(Page);
    // 直接 ready(seed 已在 store),且未再呼叫接縫 → 不覆寫已讀狀態。
    expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
    expect(vi.mocked(getNotifications)).not.toHaveBeenCalled();
  });

  it('首次成功載入會把守衛設為 true', async () => {
    vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
    render(Page);
    await screen.findByText('明日課程提醒');
    const { get } = await import('svelte/store');
    expect(get(notificationsHydrated)).toBe(true);
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

  it('unmount 後解析的 in-flight fetch 不應覆寫 shared notifications store', async () => {
    // Arrange: deferred promise so we can control when promise A resolves.
    let resolveA!: (value: Notification[]) => void;
    vi.mocked(getNotifications).mockReturnValueOnce(
      new Promise<Notification[]>((r) => { resolveA = r; })
    );

    // Mount: load() fires on mount; promise A is pending (phase=loading).
    const { unmount } = render(Page);

    // Simulate post-remount state: user already marked items read in the store.
    const sentinel: Notification[] = [
      { id: 'sentinel', cat: 'system', icon: 'bell', tone: 'info', title: '哨兵', body: '已讀哨兵', time: '剛才', read: true }
    ];
    notifications.set(sentinel);

    // Unmount the component (simulates navigating away).
    unmount();

    // Now the stale promise A resolves with fresh seed data.
    resolveA(NOTIFS_SEED.map((n) => ({ ...n })));
    // Flush microtasks so the .then() callback runs.
    await Promise.resolve();
    await tick();

    // The shared store must NOT have been clobbered — sentinel must still be there.
    expect(get(notifications)).toEqual(sentinel);
  });
});
