import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MakeupDialog from './MakeupDialog.svelte';
import { toasts, leaveRequests, type LeaveRequest } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';

/* 預約補課 dialog（Task 11；integration-contract.md §3.20 + §3.18）—— 現在是針對
 * 「一張已核准且尚未補課的請假申請」開啟的動作（不再是課程層級的一般動作），
 * 所以吃 leaveRequest prop 而非 course。開啟時打 GET /courses/{course_id}/sessions
 * 列出（同課程）未來場次；選場次 → 送出打 POST /leave-requests/{id}/makeup。
 * 只替換 $lib/api/client 的 api()，ApiError 用回真實類別。
 * 卡 2：表單機制的單元覆蓋在 $lib/member/leave-form.test.ts；這裡保留元件端佈線
 * （渲染/空狀態/retry/disabled/取消/成功畫面 + toast、409/422 錯誤映射），並釘住
 * 桌面版成功 toast body 字面（與 mobile MakeupSheet 分歧）。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const LEAVE_REQUEST: LeaveRequest = {
  id: 'lr-2',
  course_id: 'course-1',
  course_name: '競技啦啦隊 進階班',
  session_id: 'sess-1',
  session_date: '2026-07-01',
  start_time: '19:00:00',
  reason: '生病',
  status: 'approved',
  makeup_session_id: null,
  makeup_session_date: null,
  makeup_start_time: null,
  created_at: '2026-06-25T00:00:00Z'
};

const SESSIONS = [
  { id: 'sess-9', course_id: 'course-1', session_date: '2026-07-20', start_time: '18:00:00', end_time: '19:00:00' }
];

/** POST .../makeup 成功回應（已補上 makeup_* 欄位）。 */
const UPDATED = {
  id: 'lr-2', course_id: 'course-1', course_name: '競技啦啦隊 進階班',
  session_id: 'sess-1', session_date: '2026-07-01', start_time: '19:00:00',
  reason: '生病', status: 'approved',
  makeup_session_id: 'sess-9', makeup_session_date: '2026-07-20', makeup_start_time: '18:00:00',
  decided_at: '2026-06-26T00:00:00Z', created_at: '2026-06-25T00:00:00Z'
};

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

beforeEach(() => {
  vi.mocked(api).mockReset();
  leaveRequests.set([]);
});

describe('MakeupDialog — 開啟時載入同課程未來場次（GET /courses/{id}/sessions）', () => {
  it('renders nothing when closed', () => {
    const { container } = render(MakeupDialog, { open: false, leaveRequest: LEAVE_REQUEST });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('fetches sessions for the leave request\'s course_id (not any other course)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    expect(api).toHaveBeenCalledWith('/courses/course-1/sessions');
    expect(await screen.findByText('2026-07-20 (一) 18:00–19:00')).toBeInTheDocument();
  });

  it('shows an empty state when there are no future sessions to book', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': [] }));
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    expect(await screen.findByText('目前沒有可預約的補課場次')).toBeInTheDocument();
  });

  it('shows a retry affordance when the session list fails to load', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': new Error('network') }));
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });
});

describe('MakeupDialog — 確認預約（POST /leave-requests/{id}/makeup）', () => {
  it('確認預約按鈕在未選場次前停用', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');
    expect(screen.getByText('確認預約').closest('button')).toBeDisabled();
  });

  it('選擇場次後確認 → POST /leave-requests/{id}/makeup { session_id }，成功顯示完成畫面、更新 store 與 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS, 'POST /leave-requests/lr-2/makeup': UPDATED })
    );
    leaveRequests.set([LEAVE_REQUEST]);
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');

    await fireEvent.change(screen.getByLabelText('補課場次', { exact: false }), { target: { value: 'sess-9' } });
    await fireEvent.click(screen.getByText('確認預約'));

    expect(await screen.findByText('補課預約成功')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/leave-requests/lr-2/makeup', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-9' })
    });
    expect(notifySpy).toHaveBeenCalledWith('success', '補課預約成功', expect.any(String));
    expect(get(leaveRequests)[0].makeup_session_id).toBe('sess-9');
  });

  it('成功 toast body 的桌面字面釘：course_name 前綴 + 補課時間 +「已加入你的日程表」（與 mobile MakeupSheet 的 body 分歧，兩面各釘各的）', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS, 'POST /leave-requests/lr-2/makeup': UPDATED })
    );
    // mockClear：toasts.notify 的 spy 跨 it 不重置，前一個成功 it 會留下同字面的呼叫
    // 紀錄——先清空，這條釘才可證偽。
    const notifySpy = vi.spyOn(toasts, 'notify').mockClear();
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');

    await fireEvent.change(screen.getByLabelText('補課場次', { exact: false }), { target: { value: 'sess-9' } });
    await fireEvent.click(screen.getByText('確認預約'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('success', '補課預約成功', '競技啦啦隊 進階班 · 2026-07-20 (一) 18:00，已加入你的日程表。');
    });
  });

  it('409（該場次名額已滿）→ 顯示對應繁中錯誤 toast，畫面不進完成狀態', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests/lr-2/makeup': new ApiError(409, '該場次名額已滿')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');

    await fireEvent.change(screen.getByLabelText('補課場次', { exact: false }), { target: { value: 'sess-9' } });
    await fireEvent.click(screen.getByText('確認預約'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '預約補課失敗', '該場次名額已滿');
    });
    expect(screen.queryByText('補課預約成功')).toBeNull();
  });

  it('409（此假單已預約過補課）→ 顯示對應繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests/lr-2/makeup': new ApiError(409, '此假單已預約過補課')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');

    await fireEvent.change(screen.getByLabelText('補課場次', { exact: false }), { target: { value: 'sess-9' } });
    await fireEvent.click(screen.getByText('確認預約'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '預約補課失敗', '此假單已預約過補課');
    });
  });

  it('422（補課場次已開始）→ 顯示對應繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests/lr-2/makeup': new ApiError(422, '補課場次已開始')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');

    await fireEvent.change(screen.getByLabelText('補課場次', { exact: false }), { target: { value: 'sess-9' } });
    await fireEvent.click(screen.getByText('確認預約'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '預約補課失敗', '補課場次已開始');
    });
  });
});

describe('MakeupDialog — 取消', () => {
  it('點擊「取消」呼叫 onClose', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    const onClose = vi.fn();
    render(MakeupDialog, { open: true, leaveRequest: LEAVE_REQUEST, onClose });
    await screen.findByText('2026-07-20 (一) 18:00–19:00');
    await fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
