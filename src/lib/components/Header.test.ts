import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import Header from './Header.svelte';
import { authStore } from '$lib/stores/authStore';
import { cart } from '$lib/member/stores';
import { courseToCartItem } from '$lib/member/data';
import type { CatalogCourse } from '$lib/public/adapters';

// Header reads $page.url.pathname (Navigation active state). Stub a static page.
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/') })
}));

// authStore is API-backed (real network calls); this file only cares about
// the logged-in/out UI state, so mock it with a tiny local store — auth
// mechanics themselves are covered in src/lib/stores/authStore.test.ts.
vi.mock('$lib/stores/authStore', async () => {
  const { writable, derived } = await import('svelte/store');
  const state = writable({ loggedIn: false, member: null, roles: [] as string[] });
  return {
    authStore: {
      subscribe: state.subscribe,
      login: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
      register: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
      logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
      hydrate: vi.fn(async () => {})
    },
    isLoggedIn: derived(state, ($s) => $s.loggedIn)
  };
});

// Two distinct in-stock catalog courses (uuid ids, spots > 0).
const courseA: CatalogCourse = {
  id: 'course-uuid-a', name: 'A', level: '', cat: '', age: '', days: '',
  price: 100, hot: false, coach: '', desc: '', spots: 9
};
const courseB: CatalogCourse = {
  id: 'course-uuid-b', name: 'B', level: '', cat: '', age: '', days: '',
  price: 100, hot: false, coach: '', desc: '', spots: 9
};

beforeEach(() => {
  localStorage.clear();
  authStore.logout();
  cart.clear();
  cart.waitlist.set([]);
});
afterEach(() => vi.restoreAllMocks());

describe('marketing Header — auth-aware controls', () => {
  it('logged out: shows 登入 entry, hides the member-only notifications bell', () => {
    render(Header);
    expect(screen.getByLabelText('登入')).toBeInTheDocument();
    expect(screen.queryByLabelText('會員中心')).toBeNull();
    // bell button is gated behind login
    expect(screen.queryByLabelText('通知')).toBeNull();
  });

  it('logged in: swaps 登入 → 會員中心 (→ /member) and reveals the bell', () => {
    authStore.login('member@test.com', 'password123');
    render(Header);
    const entry = screen.getByLabelText('會員中心');
    expect(entry.getAttribute('href')).toBe('/member');
    expect(screen.queryByLabelText('登入')).toBeNull();
    expect(screen.getByLabelText('通知')).toBeInTheDocument();
  });

  it('logged-out member entry links to /member/login', () => {
    render(Header);
    expect(screen.getByLabelText('登入').getAttribute('href')).toBe('/member/login');
  });

  it('cart badge reflects the unified member cart qty sum, not the line count', () => {
    // Two lines but qty 3 total → badge shows 3 (qty sum), proving it reads cartCount.
    cart.addItem(courseToCartItem(courseA));
    cart.updateQty(courseA.id, 1); // line A qty → 2
    cart.addItem(courseToCartItem(courseB)); // line B qty 1  → sum = 3 across 2 lines
    render(Header);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
