import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { FIXTURE_MEMBER, type TestAuthStore } from '$lib/testing/auth-mock';
import { fakeRouter } from '$lib/testing/fake-router';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
// 只假造 HTTP 層：真的 getDashboard + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});
// R13 Task 3:問候改讀 authStore 的真名字(mock 會員 ME 退役)——家族 B 直接灌登入態。
vi.mock('$lib/stores/authStore', async () => (await import('$lib/testing/auth-mock')).makeAuthMockB());

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(fakeRouter({}, MEMBER_ROUTES));
  (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['member'] });
});

describe('member 儀表板', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    render(Page);
    expect(screen.queryByText('報名課程數')).toBeNull();
    expect(await screen.findByText('報名課程數')).toBeInTheDocument();
  });
  it('問候顯示 authStore 的會員名字(改名經 syncUser 同步,不再是 mock ME)', async () => {
    render(Page);
    expect(await screen.findByText(`${FIXTURE_MEMBER.name} 👋`)).toBeInTheDocument();
  });
  it('載入失敗顯示 ErrorState(未來換 fetch 會 reject 的路徑)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /reports/me': new Error('boom') }, MEMBER_ROUTES));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });
});
