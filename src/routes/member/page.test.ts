import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getDashboard } from '$lib/member/api';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/member/api', () => ({ getDashboard: vi.fn() }));

const SEED = {
  me: ME, stats: STATS, skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
  nextClass: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館', track: '競技啦啦隊'
};
beforeEach(() => { vi.mocked(getDashboard).mockReset(); });

describe('member 儀表板', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getDashboard).mockResolvedValue(SEED);
    render(Page);
    expect(screen.queryByText('報名課程數')).toBeNull();
    expect(await screen.findByText('報名課程數')).toBeInTheDocument();
  });
  it('載入失敗顯示 ErrorState(未來換 fetch 會 reject 的路徑)', async () => {
    vi.mocked(getDashboard).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  // 迴歸:技巧清單若用顯示文字當 keyed-each 的 key,後端回傳同名項目時
  // Svelte 會擲 each_key_duplicate、整個 ready 分支 render 失敗。改用 index key 後不再崩潰。
  it('技巧名稱重複時仍正常渲染(keyed each 不可用顯示文字當 key)', async () => {
    vi.mocked(getDashboard).mockResolvedValue({
      ...SEED,
      skills: [['後手翻', 80], ['後手翻', 60]] as [string, number][]
    });
    render(Page);
    // 「場館公告」在 markup 中位於技巧清單之後;技巧若崩潰,此標題不會出現。
    expect(await screen.findByText('場館公告')).toBeInTheDocument();
  });

  // 迴歸:同理,統計卡清單也不可用顯示文字(label)當 key。兩張同 label 的卡
  // 會讓以 label 為 key 的 keyed each 擲 each_key_duplicate。
  it('統計卡標籤重複時仍正常渲染(keyed each 不可用顯示文字當 key)', async () => {
    vi.mocked(getDashboard).mockResolvedValue({
      ...SEED,
      stats: [STATS[0], STATS[0]]
    });
    render(Page);
    expect(await screen.findByText('場館公告')).toBeInTheDocument();
  });
});
