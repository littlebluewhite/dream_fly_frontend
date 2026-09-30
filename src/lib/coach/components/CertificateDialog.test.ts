import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CertificateDialog from './CertificateDialog.svelte';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import type { Student } from '$lib/coach/data';
import { fakeRouter } from '$lib/testing/fake-router';

/* 發證書 dialog（Task 13；POST /certificates，見 integration-contract.md §3.22）——
 * 只 mock $lib/api/client 的 api()，讓 $lib/coach/api 的 createCertificate 走真實
 * 實作(同 LeaveDialog.test.ts 慣例：後端形狀進、UI 形狀出的端對端斷言)；toasts 用
 * 真實 store 斷言(vi.spyOn)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const STUDENT: Student = {
  user_id: 'su01', name: '王宥蓁', initial: '王', color: '#0066CC',
  cls: '兒童體操初階 B 班',
  courses: [{ course_id: 'c-jr-b', course_name: '兒童體操初階 B 班', enrolment_id: 'en-su01' }]
};

const CREATED = {
  id: 'ct1', course_id: null, course_name: null, title: '結業證書',
  level: null, issued_on: '', note: null, created_at: '2026-07-06T00:00:00Z'
};

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('CertificateDialog — 開啟狀態與欄位', () => {
  it('renders open with the field labels and 頒發對象', () => {
    render(CertificateDialog, { open: true, student: STUDENT });
    expect(screen.getByText(`頒發對象：${STUDENT.name}`)).toBeInTheDocument();
    expect(screen.getByLabelText('證書名稱', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('等級（選填）')).toBeInTheDocument();
    expect(screen.getByLabelText('核發日期', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('備註（選填）')).toBeInTheDocument();
  });

  it('renders nothing when student is null even if open=true', () => {
    render(CertificateDialog, { open: true, student: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when closed', () => {
    render(CertificateDialog, { open: false, student: STUDENT });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

});

describe('CertificateDialog — 送出（POST /certificates）', () => {
  it('成功時顯示成功 toast 並呼叫 onClose', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': CREATED }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    const onClose = vi.fn();
    render(CertificateDialog, { open: true, student: STUDENT, onClose });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('success', '已發放證書', '王宥蓁 · 結業證書');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('403（僅能發給自己課程的學員）→ 顯示對應繁中錯誤 toast，dialog 不關閉', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': new ApiError(403, '僅能發給自己課程的學員') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    const onClose = vi.fn();
    render(CertificateDialog, { open: true, student: STUDENT, onClose });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '發放失敗', '僅能發給自己課程的學員');
    });
    expect(onClose).not.toHaveBeenCalled();
    // 表單仍在，可重試
    expect(screen.getByText('發放證書')).toBeInTheDocument();
  });

  it('非 ApiError 的失敗（例如網路錯誤）→ 顯示通用錯誤訊息', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': new Error('network down') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(CertificateDialog, { open: true, student: STUDENT });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '發放失敗', '連線發生問題，請稍後再試。');
    });
  });
});

describe('CertificateDialog — 取消 + 重置', () => {
  it('點擊「取消」呼叫 onClose', async () => {
    const onClose = vi.fn();
    render(CertificateDialog, { open: true, student: STUDENT, onClose });
    await fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('重新開啟時重置所有欄位', async () => {
    const { rerender } = render(CertificateDialog, { open: true, student: STUDENT });
    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: 'STALE' } });
    await fireEvent.input(screen.getByLabelText('等級（選填）'), { target: { value: 'STALE-LEVEL' } });

    await rerender({ open: false, student: STUDENT });
    await rerender({ open: true, student: STUDENT });

    expect((screen.getByLabelText('證書名稱', { exact: false }) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('等級（選填）') as HTMLInputElement).value).toBe('');
  });
});
