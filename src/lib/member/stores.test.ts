import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createCart } from './stores';
import { CATALOG } from './data';

// A full course is any catalog course with no remaining spots.
const full = { ...CATALOG[0], spots: 0 };

describe('cart waitlist guard', () => {
  it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
    const c = createCart();
    const r = c.add(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0); // never enters the paid cart
    expect(get(c.waitlist)).toContain(full.id); // registered for waitlist
  });

  it('adds a course that still has spots to the paid cart and returns "added"', () => {
    const c = createCart();
    const normal = { ...CATALOG[0], spots: 3 };
    const r = c.add(normal);
    expect(r).toBe('added');
    expect(get(c)).toHaveLength(1);
    expect(get(c.waitlist)).toHaveLength(0);
  });

  it('keeps the waitlist idempotent when the same full course is added twice', () => {
    const c = createCart();
    c.add(full);
    c.add(full);
    expect(get(c.waitlist)).toEqual([full.id]); // recorded once
    expect(get(c)).toHaveLength(0); // still never in the paid cart
  });

  it('still bumps qty (not waitlist) when a course with spots is added twice', () => {
    const c = createCart();
    const normal = { ...CATALOG[0], spots: 3 };
    expect(c.add(normal)).toBe('added');
    expect(c.add(normal)).toBe('bumped');
    expect(get(c)[0].qty).toBe(2);
  });
});
