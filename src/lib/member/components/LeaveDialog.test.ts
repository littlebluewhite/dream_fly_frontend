import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LeaveDialog from './LeaveDialog.svelte';
import { toasts, leaveRequests } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import type { EnrolledCourse } from '$lib/member/data';
import { fakeRouter } from '$lib/testing/fake-router';

/* 請假申請 dialog（Task 11；integration-contract.md §3.20 + §3.18）—— 開啟時打
 * GET /courses/{course_id}/sessions 列出未來場次；選場次 + 選填事由 → 送出打
 * POST /leave-requests。只替換 $lib/api/client 的 api()，ApiError 用回真實類別
 * （同 CheckoutDialog.test.ts 慣例）；toasts/leaveRequests 用真實 store 斷言。
 * 卡 2：表單機制（三態/trim/防雙送）的單元覆蓋移至 $lib/member/leave-form.test.ts；
 * 這裡保留元件端佈線——渲染/空狀態/retry/disabled/取消/重開重置/成功畫面 + toast，
 * 以及 409/404/422 錯誤路徑（驗留在元件的 leaveRequestErrorMessage 映射 + toast
 * 佈線 + 不進完成狀態）。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const COURSE: EnrolledCourse = {
  id: 'enrol-1',
  course_id: 'course-1',
  name: '競技啦啦隊 進階班',
  cat: '',
  level: '進階',
  coach: '林雅婷',
  icon: 'sparkles',
  color: '#0066CC',
  schedule: '',
  room: '',
  att: 0,
  attended: 0,
  total: 0,
  next: '',
  term: '',
  remain: 0
};

const SESSIONS = [
  { id: 'sess-1', course_id: 'course-1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' },
  { id: 'sess-2', course_id: 'course-1', session_date: '2026-07-12', start_time: '19:00:00', end_time: '20:30:00' }
];

beforeEach(() => {
  vi.mocked(api).mockReset();
  leaveRequests.set([]);
});

describe('LeaveDialog — 開啟時載入場次（GET /courses/{id}/sessions）', () => {
  it('renders nothing when closed', () => {
    const { container } = render(LeaveDialog, { open: false, course: COURSE });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('fetches sessions for the course and lists them once loaded', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    render(LeaveDialog, { open: true, course: COURSE });

    expect(api).toHaveBeenCalledWith('/courses/course-1/sessions');
    expect(await screen.findByText('2026-07-10 (五) 19:00–20:30')).toBeInTheDocument();
  });

  it('shows an empty state when the course has no future sessions', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': [] }));
    render(LeaveDialog, { open: true, course: COURSE });
    expect(await screen.findByText('沒有可請假的未來場次')).toBeInTheDocument();
  });

  it('shows a retry affordance when the session list fails to load', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': new Error('network') }));
    render(LeaveDialog, { open: true, course: COURSE });
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });
});

describe('LeaveDialog — 送出申請（POST /leave-requests）', () => {
  it('送出按鈕在未選場次前停用', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');
    expect(screen.getByText('送出申請').closest('button')).toBeDisabled();
  });

  it('選擇場次 + 事由後送出 → POST /leave-requests { session_id, reason }，成功顯示完成畫面與 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests': {
          id: 'lr-1', course_id: 'course-1', course_name: COURSE.name,
          session_id: 'sess-1', session_date: '2026-07-10', start_time: '19:00:00',
          reason: '身體不適', status: 'pending',
          makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
          decided_at: null, created_at: '2026-07-01T00:00:00Z'
        }
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');

    await fireEvent.change(screen.getByLabelText('請假場次', { exact: false }), { target: { value: 'sess-1' } });
    await fireEvent.input(screen.getByLabelText('請假事由（選填）'), { target: { value: '身體不適' } });
    await fireEvent.click(screen.getByText('送出申請'));

    expect(await screen.findByText('請假申請已送出')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', reason: '身體不適' })
    });
    expect(notifySpy).toHaveBeenCalledWith('success', '請假申請已送出', expect.any(String));
    expect(get(leaveRequests)[0].id).toBe('lr-1');
  });

  it('422（場次已開始，無法請假）→ 顯示對應繁中錯誤 toast，畫面不進完成狀態', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests': new ApiError(422, '場次已開始，無法請假')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');

    await fireEvent.change(screen.getByLabelText('請假場次', { exact: false }), { target: { value: 'sess-1' } });
    await fireEvent.click(screen.getByText('送出申請'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', '場次已開始，無法請假');
    });
    expect(screen.queryByText('請假申請已送出')).toBeNull();
    expect(screen.getByText('送出申請')).toBeInTheDocument(); // 表單仍在，可重試
  });

  it('409（此場次已有請假紀錄）→ 顯示對應繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests': new ApiError(409, '此場次已有請假紀錄')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');

    await fireEvent.change(screen.getByLabelText('請假場次', { exact: false }), { target: { value: 'sess-1' } });
    await fireEvent.click(screen.getByText('送出申請'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', '此場次已有請假紀錄');
    });
  });

  it('404（未報名此課程）→ 顯示對應繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': SESSIONS,
        'POST /leave-requests': new ApiError(404, '未報名此課程')
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');

    await fireEvent.change(screen.getByLabelText('請假場次', { exact: false }), { target: { value: 'sess-1' } });
    await fireEvent.click(screen.getByText('送出申請'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', '未報名此課程');
    });
  });
});

describe('LeaveDialog — 取消 + 重置', () => {
  it('點擊「取消」呼叫 onClose', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    const onClose = vi.fn();
    render(LeaveDialog, { open: true, course: COURSE, onClose });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');
    await fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('重新開啟時重置場次選擇與事由欄位', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses/course-1/sessions': SESSIONS }));
    const { rerender } = render(LeaveDialog, { open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');
    await fireEvent.input(screen.getByLabelText('請假事由（選填）'), { target: { value: '殘留文字' } });

    await rerender({ open: false, course: COURSE });
    await rerender({ open: true, course: COURSE });
    await screen.findByText('2026-07-10 (五) 19:00–20:30');

    expect((screen.getByLabelText('請假事由（選填）') as HTMLTextAreaElement).value).toBe('');
  });
});
