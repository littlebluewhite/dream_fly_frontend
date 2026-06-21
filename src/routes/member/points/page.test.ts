import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getPoints } from '$lib/member/api';
import { REWARDS } from '$lib/member/data';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getPoints: vi.fn() }));

const SEED = { rewards: REWARDS, expiring: '360 點', expiryDate: '2026/12/31' };

beforeEach(() => {
  vi.mocked(getPoints).mockReset();
});

describe('member/points 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    expect(screen.queryByText('點數兌換')).toBeNull();
    expect(await screen.findByText('點數兌換')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getPoints).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記(data-testid="points-skeleton")', () => {
    vi.mocked(getPoints).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="points-skeleton"]')).not.toBeNull();
  });

  it('ready 後顯示硬編到期資料(由 getPoints 接縫提供)', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    expect(await screen.findByText('360 點')).toBeInTheDocument();
    expect(screen.getByText('2026/12/31')).toBeInTheDocument();
  });
});
