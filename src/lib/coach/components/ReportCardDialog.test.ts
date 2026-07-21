import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ReportCardDialog from './ReportCardDialog.svelte';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import type { Student } from '$lib/coach/data';
import { fakeRouter } from '$lib/testing/fake-router';

/* 寫評語 dialog（Task 13 續；POST /report-cards，見 integration-contract.md §3.22）——
 * 只 mock $lib/api/client 的 api()，讓 $lib/coach/api 的 createReportCard 走真實
 * 實作(同 CertificateDialog.test.ts 慣例)；toasts 用真實 store 斷言(vi.spyOn)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/** 單堂課學員——enrolment 自動帶入，不顯示課程選擇。 */
const ONE_COURSE: Student = {
  user_id: 'su01', name: '王宥蓁', initial: '王', color: '#0066CC',
  cls: '兒童體操初階 B 班',
  courses: [{ course_id: 'c-jr-b', course_name: '兒童體操初階 B 班', enrolment_id: 'en-su01' }],
  level: '初階', skill: '前滾翻', pct: 80, att: 98
};

/** 多堂課學員——需先選課程（即選 enrolment）。 */
const TWO_COURSES: Student = {
  user_id: 'su02', name: '陳柏睿', initial: '陳', color: '#EC4899',
  cls: '兒童體操中階 A 班、競技選手培訓班',
  courses: [
    { course_id: 'c-mid-a', course_name: '兒童體操中階 A 班', enrolment_id: 'en-a' },
    { course_id: 'c-elite', course_name: '競技選手培訓班', enrolment_id: 'en-b' }
  ],
  level: '中階', skill: '後空翻', pct: 72, att: 95
};

const CREATED = {
  id: 'rc1', course_id: 'c-jr-b', course_name: '兒童體操初階 B 班',
  term_label: '2026 夏季', comment: '進步很多', rating: null,
  created_by_name: '林雅婷', created_at: '2026-07-07T00:00:00Z'
};

/** 填妥期別+評語（必填兩欄）。 */
async function fillRequired(term = '2026 夏季', text = '進步很多') {
  await fireEvent.input(screen.getByLabelText('期別', { exact: false }), { target: { value: term } });
  await fireEvent.input(screen.getByLabelText('評語', { exact: false }), { target: { value: text } });
}

const submitButton = () => screen.getByText('建立成績單').closest('button') as HTMLButtonElement;

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('ReportCardDialog — 開啟狀態與欄位', () => {
  it('renders open with 評語對象與欄位；單堂課學員顯示課名文字、不顯示課程選擇', () => {
    render(ReportCardDialog, { open: true, student: ONE_COURSE });
    expect(screen.getByText(`評語對象：${ONE_COURSE.name}`)).toBeInTheDocument();
    expect(screen.getByText('課程：兒童體操初階 B 班')).toBeInTheDocument();
    expect(screen.queryByLabelText('課程', { exact: false })).toBeNull(); // 無 Select
    expect(screen.getByLabelText('期別', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('評語', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('評分（選填）')).toBeInTheDocument();
  });

  it('多堂課學員顯示課程 Select，選項為兩堂課名', () => {
    render(ReportCardDialog, { open: true, student: TWO_COURSES });
    const sel = screen.getByLabelText('課程', { exact: false }) as HTMLSelectElement;
    const labels = Array.from(sel.options).map((o) => o.textContent);
    expect(labels).toContain('兒童體操中階 A 班');
    expect(labels).toContain('競技選手培訓班');
  });

  it('renders nothing when student is null even if open=true', () => {
    render(ReportCardDialog, { open: true, student: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when closed', () => {
    render(ReportCardDialog, { open: false, student: ONE_COURSE });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ReportCardDialog — 必填檢核（期別/評語/課程）', () => {
  it('期別與評語未填前送出鈕停用；填妥後啟用', async () => {
    render(ReportCardDialog, { open: true, student: ONE_COURSE });
    expect(submitButton()).toBeDisabled();
    await fillRequired();
    expect(submitButton()).not.toBeDisabled();
  });

  it('多堂課學員未選課程時即使期別/評語已填仍停用；選課程後啟用', async () => {
    render(ReportCardDialog, { open: true, student: TWO_COURSES });
    await fillRequired();
    expect(submitButton()).toBeDisabled();
    await fireEvent.change(screen.getByLabelText('課程', { exact: false }), { target: { value: 'en-b' } });
    expect(submitButton()).not.toBeDisabled();
  });
});

describe('ReportCardDialog — 送出（POST /report-cards）', () => {
  it('單堂課自動帶入 enrolment_id；送出 { enrolment_id, term_label, comment }（trim；不評分時省略 rating）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': CREATED }));
    const onClose = vi.fn();
    render(ReportCardDialog, { open: true, student: ONE_COURSE, onClose });

    await fillRequired('  2026 夏季  ', '  進步很多  ');
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/report-cards', {
      method: 'POST',
      body: JSON.stringify({ enrolment_id: 'en-su01', term_label: '2026 夏季', comment: '進步很多' })
    });
  });

  it('選了評分時 body 帶 rating（number）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': { ...CREATED, rating: 4 } }));
    render(ReportCardDialog, { open: true, student: ONE_COURSE });

    await fillRequired();
    await fireEvent.change(screen.getByLabelText('評分（選填）'), { target: { value: '4' } });
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/report-cards', {
        method: 'POST',
        body: JSON.stringify({ enrolment_id: 'en-su01', term_label: '2026 夏季', comment: '進步很多', rating: 4 })
      });
    });
  });

  it('多堂課選定課程後送出該課的 enrolment_id', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': CREATED }));
    render(ReportCardDialog, { open: true, student: TWO_COURSES });

    await fireEvent.change(screen.getByLabelText('課程', { exact: false }), { target: { value: 'en-b' } });
    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      const body = JSON.parse(vi.mocked(api).mock.calls[0][1]?.body as string);
      expect(body.enrolment_id).toBe('en-b');
    });
  });

  it('成功時顯示成功 toast 並呼叫 onClose', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': CREATED }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    const onClose = vi.fn();
    render(ReportCardDialog, { open: true, student: ONE_COURSE, onClose });

    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('success', '已建立成績單', '王宥蓁 · 2026 夏季');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('409（此期別已建立過成績單）→ 顯示對應繁中錯誤 toast，dialog 不關閉', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /report-cards': new ApiError(409, '此期別已建立過成績單') })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    const onClose = vi.fn();
    render(ReportCardDialog, { open: true, student: ONE_COURSE, onClose });

    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '成績單建立失敗', '此期別已建立過成績單');
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('建立成績單')).toBeInTheDocument(); // 表單仍在，可改期別重試
  });

  it('403（非本課教練）→ 直通繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': new ApiError(403, '非本課教練') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(ReportCardDialog, { open: true, student: ONE_COURSE });

    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '成績單建立失敗', '非本課教練');
    });
  });

  it('422（rating/term_label 驗證）→ 直通繁中錯誤 toast', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': new ApiError(422, '輸入資料不符規則') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(ReportCardDialog, { open: true, student: ONE_COURSE });

    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '成績單建立失敗', '輸入資料不符規則');
    });
  });

  it('非 ApiError 的失敗（例如網路錯誤）→ 顯示通用錯誤訊息', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': new Error('network down') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(ReportCardDialog, { open: true, student: ONE_COURSE });

    await fillRequired();
    await fireEvent.click(screen.getByText('建立成績單'));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '成績單建立失敗', '連線發生問題，請稍後再試。');
    });
  });
});

describe('ReportCardDialog — 取消 + 重置', () => {
  it('點擊「取消」呼叫 onClose', async () => {
    const onClose = vi.fn();
    render(ReportCardDialog, { open: true, student: ONE_COURSE, onClose });
    await fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('重新開啟時重置期別/評語/評分', async () => {
    const { rerender } = render(ReportCardDialog, { open: true, student: ONE_COURSE });
    await fillRequired('STALE 期別', 'STALE 評語');
    await fireEvent.change(screen.getByLabelText('評分（選填）'), { target: { value: '5' } });

    await rerender({ open: false, student: ONE_COURSE });
    await rerender({ open: true, student: ONE_COURSE });

    expect((screen.getByLabelText('期別', { exact: false }) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('評語', { exact: false }) as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByLabelText('評分（選填）') as HTMLSelectElement).value).toBe('');
  });

  it('重新開啟多堂課學員時課程選擇重置為未選', async () => {
    const { rerender } = render(ReportCardDialog, { open: true, student: TWO_COURSES });
    await fireEvent.change(screen.getByLabelText('課程', { exact: false }), { target: { value: 'en-a' } });

    await rerender({ open: false, student: TWO_COURSES });
    await rerender({ open: true, student: TWO_COURSES });

    expect((screen.getByLabelText('課程', { exact: false }) as HTMLSelectElement).value).toBe('');
  });
});
