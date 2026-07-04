import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { getMine } from '$lib/member/api';
import { MY_COURSES, ATT_HISTORY } from '$lib/member/data';
import type { AttRecord } from '$lib/member/data';
import { get } from 'svelte/store';
import { waitlist, toasts } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getMine: vi.fn() }));
// 只替換 api()，ApiError 用回真實類別。候補清單卡片現在打真實 GET /waitlist/me
// （水合）與 DELETE /waitlist/{id}（取消）；不關心候補的既有測試不配置這個
// mock 也能過 —— 未配置時 vi.fn() 回 undefined，refreshWaitlist() 內部會擲錯,
// 但頁面的 load() 用 .catch(() => {}) 吞掉（best-effort hydrate），不影響主要
// 的 getMine() 資料流程與既有斷言。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const SEED = { courses: MY_COURSES, attendance: ATT_HISTORY };

beforeEach(() => {
  vi.mocked(getMine).mockReset();
  vi.mocked(api).mockReset();
  waitlist.set([]);
});

describe('member/mine 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    render(Page);
    // 出席紀錄(ready 專屬內容)尚未出現
    expect(screen.queryByText('出席紀錄')).toBeNull();
    // 載入後出現
    expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getMine).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  // 迴歸:出席紀錄若以顯示文字/日期為 key,同日同狀態時 Svelte 擲 each_key_duplicate。
  // 改用 index key 後即使有同日同狀態項目也不崩潰。
  it('出席紀錄含同日同狀態項目時仍正常渲染(index-key 迴歸)', async () => {
    const dupRec: AttRecord = { date: '06/06', state: 'present' };
    vi.mocked(getMine).mockResolvedValue({ courses: MY_COURSES, attendance: [dupRec, dupRec] });
    render(Page);
    // 出席紀錄標題出現即代表清單正常渲染,未因重複 key 崩潰
    expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(getMine).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="mine-skeleton"]')).not.toBeNull();
  });

  // 迴歸:新會員 courses:[] 時,成功 resolve 不應落入 catch → error state。
  // 修正前:d.courses[0].id 擲 TypeError → .catch → 顯示「載入失敗」
  it('courses 為空陣列時成功載入並顯示空狀態(不進 error state)', async () => {
    vi.mocked(getMine).mockResolvedValue({ courses: [], attendance: [] });
    render(Page);
    // 空狀態訊息出現代表頁面到達 ready
    expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
    // 不得顯示錯誤狀態
    expect(screen.queryByText('載入失敗')).toBeNull();
  });
});

describe('member/mine 頁 — 候補中課程（Task 3：GET /waitlist/me 水合 + DELETE 取消）', () => {
  it('顯示 GET /waitlist/me 水合的候補清單（只留 status=waiting）', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X', status: 'waiting', created_at: '2026-07-01T00:00:00Z' },
      { id: 'wl-2', course_id: 'course-y', course_name: '候補課程 Y（已取消）', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
    ]);

    render(Page);

    expect(await screen.findByText('候補課程 X')).toBeInTheDocument();
    expect(screen.queryByText('候補課程 Y（已取消）')).toBeNull();
  });

  it('沒有候補中的課程時顯示空狀態', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockResolvedValue([]);

    render(Page);

    await screen.findByText('出席紀錄'); // 等頁面進 ready
    expect(await screen.findByText('目前沒有候補中的課程')).toBeInTheDocument();
  });

  it('點擊「取消候補」→ DELETE /waitlist/{id} 成功後從清單移除', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/waitlist/me') {
        return [{ id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }];
      }
      if (path === '/waitlist/wl-1' && method === 'DELETE') return undefined;
      throw new Error(`unexpected api call: ${method} ${path}`);
    });

    render(Page);
    const btn = await screen.findByRole('button', { name: '取消候補' });
    await fireEvent.click(btn);

    await vi.waitFor(() => expect(screen.queryByText('候補課程 X')).toBeNull());
    expect(api).toHaveBeenCalledWith('/waitlist/wl-1', { method: 'DELETE' });
    expect(await screen.findByText('目前沒有候補中的課程')).toBeInTheDocument();
  });

  it('取消候補失敗 → 顯示錯誤 toast，清單不變', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/waitlist/me') {
        return [{ id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }];
      }
      if (path === '/waitlist/wl-1' && method === 'DELETE') throw new ApiError(404, 'waitlist entry not found');
      throw new Error(`unexpected api call: ${method} ${path}`);
    });

    render(Page);
    const btn = await screen.findByRole('button', { name: '取消候補' });
    await fireEvent.click(btn);

    await vi.waitFor(() => {
      expect(get(toasts).some((t) => t.tone === 'error' && t.title === '取消候補失敗')).toBe(true);
    });
    expect(screen.getByText('候補課程 X')).toBeInTheDocument(); // 未從清單移除
  });
});
