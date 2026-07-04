import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { cart, checkoutOpen } from '$lib/member/stores';
import { CATALOG } from '$lib/member/data';
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

const courseA = { ...CATALOG.find((c) => c.id === 1)!, spots: 9 };
const courseB = { ...CATALOG.find((c) => c.id === 2)!, spots: 9 };

beforeEach(() => {
  localStorage.clear();
  cart.clear();
  cart.waitlist.set([]);
  authStore.logout();
  checkoutOpen.set(false);
});
afterEach(() => vi.clearAllMocks());

describe('member Topbar — cart badge is the qty sum', () => {
  // The cart badge lives in the same .iconwrap as the 購物車 button; scope the
  // badge lookup there so the bell's unread-count dot can't be mistaken for it.
  const cartBadge = () =>
    screen.getByLabelText('購物車').closest('.iconwrap')!.querySelector('.dot');

  it('shows total quantity across lines, not the number of lines', () => {
    cart.add(courseA);
    cart.updateQty(String(courseA.id), 2); // line A qty → 3 (cart v3: CartItem.id is a uuid string)
    cart.add(courseB); // line B qty 1 → sum = 4 over 2 lines
    render(Topbar);
    expect(cartBadge()?.textContent).toBe('4');
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
