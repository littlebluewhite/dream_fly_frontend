import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import Sidebar from './Sidebar.svelte';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';

// Sidebar links use $page.url.pathname for active state; logout() calls goto().
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/member') })
}));

// authStore is real: only api() is swapped for the HTTP fake, and tests log in
// through loginRoutes() — auth mechanics themselves are covered in
// src/lib/stores/authStore.test.ts.
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(async () => {
  localStorage.clear();
  await resetSessionStores();
  vi.mocked(api).mockImplementation(fakeRouter(loginRoutes()));
});
afterEach(() => vi.clearAllMocks());

describe('member Sidebar — logout clears the session', () => {
  it('logout() ends the auth session and routes to /member/login', async () => {
    await authStore.login('member@test.com', 'password123');
    expect(get(isLoggedIn)).toBe(true);

    render(Sidebar);
    await fireEvent.click(screen.getByLabelText('登出'));

    expect(get(isLoggedIn)).toBe(false); // authStore.logout() ran
    expect(goto).toHaveBeenCalledWith('/member/login');
  });
});
