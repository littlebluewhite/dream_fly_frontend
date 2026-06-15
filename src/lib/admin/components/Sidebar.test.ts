import { describe, it, expect } from 'vitest';
import { isActive } from './Sidebar.svelte';

/* The active-state rule is the one piece of real branching in the sidebar, so
 * it is extracted as a pure function and unit-tested directly — no $page mock
 * needed. The dashboard (/admin) must be active ONLY on the exact root path,
 * or it would light up on every nested admin route. */
describe('admin Sidebar isActive', () => {
  it('dashboard (/admin) is active only on the exact root path', () => {
    expect(isActive('/admin', '/admin')).toBe(true);
  });

  it('dashboard (/admin) is NOT active on a deeper admin route', () => {
    expect(isActive('/admin', '/admin/members')).toBe(false);
    expect(isActive('/admin', '/admin/settings')).toBe(false);
  });

  it('a module item is active on its own exact path', () => {
    expect(isActive('/admin/members', '/admin/members')).toBe(true);
  });

  it('a module item is active on a nested child path (prefix match)', () => {
    expect(isActive('/admin/members', '/admin/members/42')).toBe(true);
  });

  it('a module item is NOT active on a sibling module', () => {
    expect(isActive('/admin/members', '/admin/coaches')).toBe(false);
    expect(isActive('/admin/orders', '/admin')).toBe(false);
  });
});
