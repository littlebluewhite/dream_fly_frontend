import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CertificateDialog from './CertificateDialog.svelte';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import type { Student } from '$lib/coach/data';

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
  cls: '兒童體操初階 B 班', level: '初階', skill: '前滾翻', pct: 80, att: 98
};

/** 同元件的 today()：本地日期，非 toISOString()(避免 UTC 位移，見元件註解)。 */
function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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

  it('核發日期預設為今天', () => {
    render(CertificateDialog, { open: true, student: STUDENT });
    const today = localToday();
    expect((screen.getByLabelText('核發日期', { exact: false }) as HTMLInputElement).value).toBe(today);
  });
});

describe('CertificateDialog — 送出（POST /certificates）', () => {
  it('送出 { user_id, title, issued_on }，level/note 留白時省略欄位', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': CREATED }));
    const onClose = vi.fn();
    render(CertificateDialog, { open: true, student: STUDENT, onClose });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const today = localToday();
    expect(api).toHaveBeenCalledWith('/certificates', {
      method: 'POST',
      body: JSON.stringify({ user_id: 'su01', title: '結業證書', issued_on: today })
    });
  });

  it('level/note 有填寫時一併帶入 body', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': CREATED }));
    render(CertificateDialog, { open: true, student: STUDENT });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.input(screen.getByLabelText('等級（選填）'), { target: { value: '結業' } });
    await fireEvent.input(screen.getByLabelText('備註（選填）'), { target: { value: '表現優異' } });
    await fireEvent.click(screen.getByText('發放證書'));

    const today = localToday();
    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/certificates', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'su01', title: '結業證書', issued_on: today, level: '結業', note: '表現優異' })
      });
    });
  });

  it('證書名稱前後留白會 trim 再送出', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': CREATED }));
    render(CertificateDialog, { open: true, student: STUDENT });
    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '  結業證書  ' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => {
      const body = JSON.parse(vi.mocked(api).mock.calls[0][1]?.body as string);
      expect(body.title).toBe('結業證書');
    });
  });

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

  it('422（輸入資料不符規則）→ 顯示對應繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': new ApiError(422, '輸入資料不符規則') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(CertificateDialog, { open: true, student: STUDENT });

    await fireEvent.input(screen.getByLabelText('證書名稱', { exact: false }), { target: { value: '結業證書' } });
    await fireEvent.click(screen.getByText('發放證書'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '發放失敗', '輸入資料不符規則');
    });
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
