import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { getMine } from '$lib/member/api';
import { MY_COURSES, ATT_HISTORY } from '$lib/member/data';
import type { AttRecord } from '$lib/member/data';
import { get } from 'svelte/store';
import { waitlist, leaveRequests, toasts } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getMine: vi.fn() }));
// 只替換 api()，ApiError 用回真實類別。候補清單卡片打真實 GET /waitlist/me
// （水合）與 DELETE /waitlist/{id}（取消）；「我的請假」卡片（Task 11）打真實
// GET /leave-requests/me 等端點——不關心候補/請假的既有測試不配置這個 mock
// 也能過 —— 未配置時 vi.fn() 回 undefined，refreshWaitlist()/refreshLeaveRequests()
// 內部會擲錯,但頁面的 load() 用 .catch(() => {}) 吞掉（best-effort hydrate），
// 不影響主要的 getMine() 資料流程與既有斷言。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/** 依 "METHOD path" 路由回應的 fake router（同 leave-requests-api.test.ts 慣例）。
 *  未覆寫的路徑一律丟錯——呼叫到沒被交代的端點應該讓測試失敗，而不是悄悄回傳
 *  undefined 蓋掉斷言。 */
function fakeRouter(overrides: Record<string, unknown>) {
  return vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toString().toUpperCase();
    const key = `${method} ${path}`;
    if (key in overrides) {
      const value = overrides[key];
      if (value instanceof Error) throw value;
      return value;
    }
    throw new Error(`unexpected api call: ${key}`);
  });
}

const SEED = { courses: MY_COURSES, attendance: ATT_HISTORY };

beforeEach(() => {
  vi.mocked(getMine).mockReset();
  vi.mocked(api).mockReset();
  waitlist.set([]);
  leaveRequests.set([]);
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
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /waitlist/me': [
          { id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X', status: 'waiting', created_at: '2026-07-01T00:00:00Z' },
          { id: 'wl-2', course_id: 'course-y', course_name: '候補課程 Y（已取消）', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
        ],
        'GET /leave-requests/me': []
      })
    );

    render(Page);

    expect(await screen.findByText('候補課程 X')).toBeInTheDocument();
    expect(screen.queryByText('候補課程 Y（已取消）')).toBeNull();
  });

  it('沒有候補中的課程時顯示空狀態', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] }));

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

describe('member/mine 頁 — 請假入口（Task 11：每門課「請假」按鈕開啟 LeaveDialog）', () => {
  it('課程詳情動作列只有「請假」與「聯絡教練」（不再有課程層級的「預約補課」——補課現在是「我的請假」清單裡逐筆的動作）', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] }));
    render(Page);
    await screen.findByText('出席紀錄');
    // 出席紀錄裡也有一筆「請假」狀態 badge（非按鈕）——用 role 精準鎖定動作列按鈕。
    expect(screen.getByRole('button', { name: '請假' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '聯絡教練' })).toBeInTheDocument();
  });

  it('點擊「請假」開啟請假申請 dialog', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] }));
    render(Page);
    await screen.findByText('出席紀錄');
    await fireEvent.click(screen.getByRole('button', { name: '請假' }));
    expect(await screen.findByText('請假申請')).toBeInTheDocument();
  });
});

describe('member/mine 頁 — 我的請假（Task 11：GET /leave-requests/me 水合 + 取消/預約補課）', () => {
  const LR_PENDING = {
    id: 'lr-1', course_id: 'c1', course_name: '請假課程 A', session_id: 's1',
    session_date: '2026-07-10', start_time: '19:00:00', reason: '生病',
    status: 'pending', makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
    decided_at: null, created_at: '2026-07-01T00:00:00Z'
  };
  const LR_APPROVED_UNBOOKED = { ...LR_PENDING, id: 'lr-2', course_name: '請假課程 B', status: 'approved', reason: null };
  const LR_APPROVED_BOOKED = {
    ...LR_PENDING, id: 'lr-3', course_name: '請假課程 C', status: 'approved',
    makeup_session_id: 'sess-9', makeup_session_date: '2026-07-20', makeup_start_time: '18:00:00'
  };
  const LR_REJECTED = { ...LR_PENDING, id: 'lr-4', course_name: '請假課程 D', status: 'rejected' };
  const LR_CANCELLED = { ...LR_PENDING, id: 'lr-5', course_name: '請假課程 E', status: 'cancelled' };

  it('沒有請假紀錄時顯示空狀態', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] }));
    render(Page);
    await screen.findByText('出席紀錄');
    expect(await screen.findByText('目前沒有請假紀錄')).toBeInTheDocument();
  });

  it('GET /leave-requests/me 失敗時「我的請假」顯示空狀態，不影響頁面其餘資料（best-effort hydrate）', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': new Error('network') }));
    render(Page);
    await screen.findByText('出席紀錄'); // 頁面仍正常進 ready，不是 error state
    expect(await screen.findByText('目前沒有請假紀錄')).toBeInTheDocument();
  });

  it('pending → 顯示待審核 badge 與「取消」按鈕', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_PENDING] }));
    render(Page);
    await screen.findByText('請假課程 A');
    expect(screen.getByText('待審核')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('approved 且未補課 → 顯示已核准 badge 與「預約補課」按鈕（不顯示取消）', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_APPROVED_UNBOOKED] }));
    render(Page);
    await screen.findByText('請假課程 B');
    expect(screen.getByText('已核准')).toBeInTheDocument();
    expect(screen.getByText('預約補課')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
  });

  it('approved 且已補課 → 顯示補課場次資訊，不顯示「預約補課」按鈕', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_APPROVED_BOOKED] }));
    render(Page);
    await screen.findByText('請假課程 C');
    expect(screen.getByText('已核准')).toBeInTheDocument();
    expect(screen.getByText(/已預約補課/)).toBeInTheDocument();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('rejected → 顯示已婉拒 badge，不顯示任何動作按鈕', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_REJECTED] }));
    render(Page);
    await screen.findByText('請假課程 D');
    expect(screen.getByText('已婉拒')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('cancelled → 顯示已取消 badge，不顯示任何動作按鈕', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_CANCELLED] }));
    render(Page);
    await screen.findByText('請假課程 E');
    expect(screen.getByText('已取消')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('點擊「取消」→ DELETE /leave-requests/{id} 成功後狀態原地變為已取消（清單不移除該筆）', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [LR_PENDING], 'DELETE /leave-requests/lr-1': undefined })
    );
    render(Page);
    const btn = await screen.findByRole('button', { name: '取消' });
    await fireEvent.click(btn);

    await vi.waitFor(() => expect(screen.getByText('已取消')).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith('/leave-requests/lr-1', { method: 'DELETE' });
    expect(screen.getByText('請假課程 A')).toBeInTheDocument(); // 仍在清單中，只是狀態改變
  });

  it('取消失敗 → 顯示錯誤 toast，狀態不變', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /waitlist/me': [],
        'GET /leave-requests/me': [LR_PENDING],
        'DELETE /leave-requests/lr-1': new ApiError(409, '僅待審核假單可取消')
      })
    );
    render(Page);
    const btn = await screen.findByRole('button', { name: '取消' });
    await fireEvent.click(btn);

    await vi.waitFor(() => {
      expect(get(toasts).some((t) => t.tone === 'error' && t.title === '取消請假失敗')).toBe(true);
    });
    expect(screen.getByText('待審核')).toBeInTheDocument(); // 狀態未變
  });

  it('點擊「預約補課」開啟補課 dialog，並用該假單的 course_id（而非目前選取課程）查詢場次', async () => {
    vi.mocked(getMine).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /waitlist/me': [],
        'GET /leave-requests/me': [LR_APPROVED_UNBOOKED],
        'GET /courses/c1/sessions': [
          { id: 'sess-9', course_id: 'c1', session_date: '2026-07-20', start_time: '18:00:00', end_time: '19:00:00' }
        ]
      })
    );
    render(Page);
    await screen.findByText('預約補課');
    await fireEvent.click(screen.getByText('預約補課'));

    expect(await screen.findByText('確認預約')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/courses/c1/sessions');
  });
});
