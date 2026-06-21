import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { getNotifications } from '$lib/member/api';
import { notifications, notificationsHydrated } from '$lib/member/stores';
import { NOTIFS_SEED } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getNotifications: vi.fn() }));

beforeEach(() => {
  vi.mocked(getNotifications).mockReset();
  // Reset the load-once guard so each test starts un-hydrated. A store (not a
  // module boolean) so test order can't leak a prior successful hydrate.
  notificationsHydrated.set(false);
  // Re-seed the feed so a prior test's set() doesn't bleed through.
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
});

describe('member/notifications 頁', () => {
  it('先骨架,async 載入後顯示通知', async () => {
    vi.mocked(getNotifications).mockResolvedValue(NOTIFS_SEED.map((n) => ({ ...n })));
    render(Page);
    expect(screen.queryByText('明日課程提醒')).toBeNull();
    expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
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
});
