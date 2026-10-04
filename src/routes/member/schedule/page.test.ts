import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { myScheduleEntry } from '$lib/testing/wire-fixtures';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
// 只假造 HTTP 層：真的 getSchedule + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

// 原 ScheduleBlock fixture 改為 wire 輸入(day 1 = day_of_week 2、day 3 = day_of_week 4)。
const ENTRIES = [
  myScheduleEntry({ course_name: '競技啦啦隊 進階班', day_of_week: 2, start_time: '19:00:00', end_time: '20:30:00', venue: 'A 訓練館', coach_name: '林雅婷' }),
  myScheduleEntry({ course_name: '競技體操 選手班', day_of_week: 4, start_time: '17:00:00', end_time: '19:00:00', venue: 'A 訓練館', coach_name: '林雅婷' })
];

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('member/schedule 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': ENTRIES }));
    render(Page);
    // 課程名稱尚未出現
    expect(screen.queryByText('競技啦啦隊 進階班')).toBeNull();
    // 載入後出現
    expect(await screen.findByText('競技啦啦隊 進階班')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': new Error('boom') }));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  // 迴歸:schedule 清單若以顯示文字為 key,同名 block 時 Svelte 擲 each_key_duplicate。
  // 改用 index key 後即使有同名 block 也不崩潰。
  it('同名同時段 block 時仍正常渲染(index-key 迴歸)', async () => {
    const dup = ENTRIES[0];
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': [dup, dup] }));
    render(Page);
    // 有重複 key 時 Svelte 會崩潰,斷言名稱出現即可
    const els = await screen.findAllByText('競技啦啦隊 進階班');
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it('沒有任何排課時顯示「尚未報名任何課程」空狀態', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': [] }));
    render(Page);
    expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(api).mockImplementation(() => new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="schedule-skeleton"]')).not.toBeNull();
  });
});
