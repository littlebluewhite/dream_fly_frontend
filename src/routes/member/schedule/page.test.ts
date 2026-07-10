import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getSchedule } from '$lib/member/api';
import type { ScheduleBlock } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/member/api', () => ({ getSchedule: vi.fn() }));

// Task 1(C2 死種子退役):member/data.ts 的 SCHEDULE(值)已退役——改為檔內 inline
// fixture(2 筆,沿用真實種子前兩列的欄位值)。
const SCHEDULE: ScheduleBlock[] = [
  { day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' },
  { day: 3, start: '17:00', end: '19:00', name: '競技體操 選手班', room: 'A 訓練館', coach: '林雅婷', color: '#F59E0B', tone: 'accent' }
];
const SEED = { schedule: SCHEDULE };

beforeEach(() => {
  vi.mocked(getSchedule).mockReset();
});

describe('member/schedule 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getSchedule).mockResolvedValue(SEED);
    render(Page);
    // 課程名稱尚未出現
    expect(screen.queryByText('競技啦啦隊 進階班')).toBeNull();
    // 載入後出現
    expect(await screen.findByText('競技啦啦隊 進階班')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getSchedule).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  // 迴歸:schedule 清單若以顯示文字為 key,同名 block 時 Svelte 擲 each_key_duplicate。
  // 改用 index key 後即使有同名 block 也不崩潰。
  it('同名同時段 block 時仍正常渲染(index-key 迴歸)', async () => {
    const dup: ScheduleBlock = { day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' };
    vi.mocked(getSchedule).mockResolvedValue({ schedule: [dup, dup] });
    render(Page);
    // 有重複 key 時 Svelte 會崩潰,斷言名稱出現即可
    const els = await screen.findAllByText('競技啦啦隊 進階班');
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it('沒有任何排課時顯示「尚未報名任何課程」空狀態', async () => {
    vi.mocked(getSchedule).mockResolvedValue({ schedule: [] });
    render(Page);
    expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(getSchedule).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="schedule-skeleton"]')).not.toBeNull();
  });
});
