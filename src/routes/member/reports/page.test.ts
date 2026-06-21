import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getReports } from '$lib/member/api';
import { MY_COURSES, REPORTS, CERTS } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/member/api', () => ({ getReports: vi.fn() }));

const SEED = { courses: MY_COURSES, reports: REPORTS, certs: CERTS };

beforeEach(() => {
  vi.mocked(getReports).mockReset();
});

describe('member/reports 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getReports).mockResolvedValue(SEED);
    render(Page);
    expect(screen.queryByText('技巧評量')).toBeNull();
    expect(await screen.findByText('技巧評量')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getReports).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  // 迴歸:skills/attrs 若以 label 為 key,同名 label 時 Svelte 擲 each_key_duplicate。
  // 改用 index key 後即使有同名 label 也不崩潰。
  it('skills 同名 label 時仍正常渲染(index-key 迴歸)', async () => {
    vi.mocked(getReports).mockResolvedValue({
      ...SEED,
      courses: [MY_COURSES[0]],
      reports: {
        [MY_COURSES[0].id]: {
          ...REPORTS[MY_COURSES[0].id],
          skills: [['協調性', 80], ['協調性', 60]] as [string, number][]
        }
      }
    });
    render(Page);
    // 「教練評語」位於 skills/attrs 清單之後;若 each_key_duplicate 崩潰,它不會出現。
    expect(await screen.findByText('教練評語')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    // skeleton 分支帶 data-testid;用它確認 loading 分支(非 ready/error 共用的 .df-view)
    expect(container.querySelector('[data-testid="reports-skeleton"]')).not.toBeNull();
  });
});
