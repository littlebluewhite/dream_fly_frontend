import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { cart, checkoutOpen } from '$lib/member/stores';
import { authStore } from '$lib/stores/authStore';
import { checkoutTarget } from '$lib/checkout-gate';

// Topbar calls goto() — for the bell nav and the guest checkout bounce. Mock nav.
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import { goto } from '$app/navigation';

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

// Task 17: cart.add() now takes the public-seam CatalogCourse (uuid id).
const courseA = { id: 'course-a', name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', age: '3–5 歲', days: '週六 10:00', price: 2800, hot: false, coach: '黃詩涵', desc: '', spots: 9 };
const courseB = { id: 'course-b', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', age: '7–9 歲', days: '週一 17:30', price: 3200, hot: true, coach: '陳冠宇', desc: '', spots: 9 };

beforeEach(() => {
  localStorage.clear();
  cart.clear();
  authStore.logout();
  checkoutOpen.set(false);
});
afterEach(() => vi.clearAllMocks());

describe('member Topbar — cart badge is the qty sum', () => {
  // The cart badge lives in the same .iconwrap as the 購物車 button; scope the
  // badge lookup there so the bell's unread-count dot can't be mistaken for it.
  const cartBadge = () =>
    screen.getByLabelText('購物車').closest('.iconwrap')!.querySelector('.dot');

  it('sums line qty — a course updateQty attempt is a no-op and can never inflate the badge', () => {
    cart.add(courseA);
    cart.updateQty(String(courseA.id), 2); // no-op：課程是報名，qty 鎖 1
    cart.add(courseB); // line B qty 1 → sum = 2 over 2 lines
    render(Topbar);
    expect(cartBadge()?.textContent).toBe('2');
  });

  it('renders no cart badge when the cart is empty', () => {
    render(Topbar);
    expect(cartBadge()).toBeNull();
  });
});

describe('member Topbar — cart button gates checkout on login', () => {
  it('a logged-in member opens the checkout dialog directly', async () => {
    authStore.login('member@test.com', 'password123');
    render(Topbar);
    await fireEvent.click(screen.getByLabelText('購物車'));
    expect(get(checkoutOpen)).toBe(true);
    expect(goto).not.toHaveBeenCalled();
  });

  it('a guest is bounced to login instead of opening checkout (no auth bypass via /member)', async () => {
    // not logged in (beforeEach logged out)
    render(Topbar);
    await fireEvent.click(screen.getByLabelText('購物車'));
    expect(get(checkoutOpen)).toBe(false); // dialog never opens for a guest
    expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
  });
});
