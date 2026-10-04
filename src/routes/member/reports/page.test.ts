import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import { certificate, memberReport, reportCard } from '$lib/testing/wire-fixtures';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
// 只假造 HTTP 層：真的 getReports + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

// 畫面形狀 STATS 改為 wire 輸入(attendanceRate 0.9 → '90%')。
const REPORT = memberReport({
  attended_total: 18,
  attendance_rate: 0.9,
  points_balance: 1250,
  active_enrolments: 2,
  upcoming_sessions_7d: 3
});

const CARDS = [
  reportCard({
    id: 'rc1',
    course_name: '競技啦啦隊 進階班',
    term_label: '2026 夏季',
    comment: '本季在後手翻的落地控制上進步很多。',
    rating: 5,
    created_by_name: '林雅婷',
    created_at: '2026-07-01T00:00:00Z'
  })
];

const CERTS = [
  certificate({
    id: 'ct1',
    title: '競技啦啦隊 進階班 結業證書',
    level: '結業',
    course_name: '競技啦啦隊 進階班',
    issued_on: '2026-06-20',
    note: null,
    created_at: '2026-06-20T00:00:00Z'
  })
];

/** 預設灌滿 SEED(成績單 + 證書 + 統計)，各測試只覆寫自己關心的端點。 */
const route = (over: Record<string, unknown> = {}) =>
  vi.mocked(api).mockImplementation(
    fakeRouter(
      { 'GET /report-cards/me': CARDS, 'GET /certificates/me': CERTS, 'GET /reports/me': REPORT, ...over },
      MEMBER_ROUTES
    )
  );

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('member/reports 頁', () => {
  it('先骨架,async 載入後顯示成績單資料', async () => {
    route();
    render(Page);
    expect(screen.queryByText('本季在後手翻的落地控制上進步很多。')).toBeNull();
    expect(await screen.findByText('本季在後手翻的落地控制上進步很多。')).toBeInTheDocument();
    expect(screen.getByText('競技啦啦隊 進階班')).toBeInTheDocument();
    expect(screen.getByText('2026 夏季')).toBeInTheDocument();
    expect(screen.getByText('林雅婷 教練 · 2026-07-01')).toBeInTheDocument();
  });

  it('顯示 GET /reports/me 統計欄位（累計出席/出席率/點數餘額/有效報名/未來 7 天課程）', async () => {
    route();
    render(Page);
    expect(await screen.findByText('18')).toBeInTheDocument(); // attendedTotal
    expect(screen.getByText('90%')).toBeInTheDocument(); // attendanceRate
    expect(screen.getByText('1250')).toBeInTheDocument(); // pointsBalance
    expect(screen.getByText('2')).toBeInTheDocument(); // activeEnrolments
    expect(screen.getByText('3')).toBeInTheDocument(); // upcomingSessions7d
  });

  it('attendanceRate 為 null(無出勤資料)時顯示「尚無資料」而非 0%', async () => {
    route({ 'GET /reports/me': { ...REPORT, attendance_rate: null } });
    render(Page);
    expect(await screen.findByText('尚無資料')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    route({ 'GET /report-cards/me': new Error('boom') });
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(api).mockImplementation(() => new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="reports-skeleton"]')).not.toBeNull();
  });

  it('rating 為 null 時顯示「尚未評分」而非星等；comment 為 null 時顯示預設文案', async () => {
    route({
      'GET /report-cards/me': [
        reportCard({
          id: 'rc2', course_name: '幼兒體操 啟蒙班', term_label: '2026 春季',
          comment: null, rating: null, created_by_name: '陳冠宇', created_at: '2026-03-01T00:00:00Z'
        })
      ],
      'GET /certificates/me': []
    });
    render(Page);
    expect(await screen.findByText('尚未評分')).toBeInTheDocument();
    expect(screen.getByText('教練尚未留下評語。')).toBeInTheDocument();
  });

  // 迴歸:新會員 reportCards 為空時,成功 resolve 不應落入 catch → error state。
  it('reportCards 為空陣列時成功載入並顯示空狀態(不進 error state)', async () => {
    route({ 'GET /report-cards/me': [], 'GET /certificates/me': [] });
    render(Page);
    expect(await screen.findByText('尚無成績單')).toBeInTheDocument();
    expect(screen.queryByText('載入失敗')).toBeNull();
  });

  it('切換至「我的證書」tab 顯示證書卡片;沒有 courseName/level 時對應區塊不顯示', async () => {
    route({
      'GET /report-cards/me': [],
      'GET /certificates/me': [
        certificate({
          id: 'ct2', title: '2026 台中市體操錦標賽 · 團體第三名', level: null,
          course_name: null, issued_on: '2026-05-01', note: '恭喜獲獎', created_at: '2026-05-01T00:00:00Z'
        })
      ]
    });
    render(Page);
    await screen.findByText('尚無成績單'); // reportCards 空狀態,確認已到 ready
    await fireEvent.click(screen.getByText('我的證書'));
    expect(await screen.findByText('2026 台中市體操錦標賽 · 團體第三名')).toBeInTheDocument();
    expect(screen.getByText('核發日 2026-05-01')).toBeInTheDocument();
    expect(screen.getByText('恭喜獲獎')).toBeInTheDocument();
  });

  it('certificates 為空時「我的證書」tab 顯示空狀態(不進 error state)', async () => {
    route({ 'GET /certificates/me': [] });
    render(Page);
    await screen.findByText('競技啦啦隊 進階班');
    await fireEvent.click(screen.getByText('我的證書'));
    expect(await screen.findByText('尚無證書')).toBeInTheDocument();
    expect(screen.queryByText('載入失敗')).toBeNull();
  });

  it('不再渲染下載/檢視證書按鈕(v1 純 metadata,無 PDF/檔案,見契約 §3.22)', async () => {
    route();
    render(Page);
    await screen.findByText('競技啦啦隊 進階班');
    await fireEvent.click(screen.getByText('我的證書'));
    await screen.findByText('競技啦啦隊 進階班 結業證書');
    expect(screen.queryByText('下載')).toBeNull();
    expect(screen.queryByText('檢視')).toBeNull();
  });
});
