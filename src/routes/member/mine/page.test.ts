import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getMine } from '$lib/member/api';
import { MY_COURSES, ATT_HISTORY } from '$lib/member/data';
import type { AttRecord } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getMine: vi.fn() }));

const SEED = { courses: MY_COURSES, attendance: ATT_HISTORY };

beforeEach(() => {
  vi.mocked(getMine).mockReset();
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
