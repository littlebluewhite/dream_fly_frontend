import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { getReports } from '$lib/member/api';
import type { ReportsData } from '$lib/member/api';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/member/api', () => ({ getReports: vi.fn() }));

const SEED: ReportsData = {
  reportCards: [
    {
      id: 'rc1',
      courseName: '競技啦啦隊 進階班',
      termLabel: '2026 夏季',
      comment: '本季在後手翻的落地控制上進步很多。',
      rating: 5,
      issuerName: '林雅婷',
      createdAt: '2026-07-01T00:00:00Z'
    }
  ],
  certificates: [
    {
      id: 'ct1',
      title: '競技啦啦隊 進階班 結業證書',
      level: '結業',
      courseName: '競技啦啦隊 進階班',
      issuedOn: '2026-06-20',
      note: null,
      createdAt: '2026-06-20T00:00:00Z'
    }
  ]
};

beforeEach(() => {
  vi.mocked(getReports).mockReset();
});

describe('member/reports 頁', () => {
  it('先骨架,async 載入後顯示成績單資料', async () => {
    vi.mocked(getReports).mockResolvedValue(SEED);
    render(Page);
    expect(screen.queryByText('本季在後手翻的落地控制上進步很多。')).toBeNull();
    expect(await screen.findByText('本季在後手翻的落地控制上進步很多。')).toBeInTheDocument();
    expect(screen.getByText('競技啦啦隊 進階班')).toBeInTheDocument();
    expect(screen.getByText('2026 夏季')).toBeInTheDocument();
    expect(screen.getByText('林雅婷 教練 · 2026-07-01')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getReports).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="reports-skeleton"]')).not.toBeNull();
  });

  it('rating 為 null 時顯示「尚未評分」而非星等；comment 為 null 時顯示預設文案', async () => {
    vi.mocked(getReports).mockResolvedValue({
      reportCards: [
        {
          id: 'rc2', courseName: '幼兒體操 啟蒙班', termLabel: '2026 春季',
          comment: null, rating: null, issuerName: '陳冠宇', createdAt: '2026-03-01T00:00:00Z'
        }
      ],
      certificates: []
    });
    render(Page);
    expect(await screen.findByText('尚未評分')).toBeInTheDocument();
    expect(screen.getByText('教練尚未留下評語。')).toBeInTheDocument();
  });

  // 迴歸:新會員 reportCards 為空時,成功 resolve 不應落入 catch → error state。
  it('reportCards 為空陣列時成功載入並顯示空狀態(不進 error state)', async () => {
    vi.mocked(getReports).mockResolvedValue({ reportCards: [], certificates: [] });
    render(Page);
    expect(await screen.findByText('尚無成績單')).toBeInTheDocument();
    expect(screen.queryByText('載入失敗')).toBeNull();
  });

  it('切換至「我的證書」tab 顯示證書卡片;沒有 courseName/level 時對應區塊不顯示', async () => {
    vi.mocked(getReports).mockResolvedValue({
      reportCards: [],
      certificates: [
        {
          id: 'ct2', title: '2026 台中市體操錦標賽 · 團體第三名', level: null,
          courseName: null, issuedOn: '2026-05-01', note: '恭喜獲獎', createdAt: '2026-05-01T00:00:00Z'
        }
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
    vi.mocked(getReports).mockResolvedValue({ reportCards: SEED.reportCards, certificates: [] });
    render(Page);
    await screen.findByText('競技啦啦隊 進階班');
    await fireEvent.click(screen.getByText('我的證書'));
    expect(await screen.findByText('尚無證書')).toBeInTheDocument();
    expect(screen.queryByText('載入失敗')).toBeNull();
  });

  it('不再渲染下載/檢視證書按鈕(v1 純 metadata,無 PDF/檔案,見契約 §3.22)', async () => {
    vi.mocked(getReports).mockResolvedValue(SEED);
    render(Page);
    await screen.findByText('競技啦啦隊 進階班');
    await fireEvent.click(screen.getByText('我的證書'));
    await screen.findByText('競技啦啦隊 進階班 結業證書');
    expect(screen.queryByText('下載')).toBeNull();
    expect(screen.queryByText('檢視')).toBeNull();
  });
});
