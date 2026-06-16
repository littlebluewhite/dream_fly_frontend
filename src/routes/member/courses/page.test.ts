import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts } from '$lib/member/stores';
import { CATALOG } from '$lib/member/data';

const FULL = CATALOG.find((c) => c.spots === 0)!; // id 5 跑酷入門班 (spots: 0)
const OPEN = CATALOG.find((c) => c.spots > 0)!; // id 1 幼兒體操 啟蒙班 (spots > 0)

// The catalog must contain exactly one full course for the 候補-button lookup
// below to be unambiguous; assert that here so the fixture can't drift silently.
const fullCount = CATALOG.filter((c) => c.spots === 0).length;

afterEach(() => {
	cart.clear();
	cart.waitlist.set([]); // singleton waitlist isn't cleared by cart.clear(); reset it so ids don't leak across tests
});

describe('課程介紹 — addToCart branches on the store AddResult (waitlist guard)', () => {
	it('a full course shows a waitlist toast and never enters the paid cart', async () => {
		cart.clear();
		expect(fullCount).toBe(1); // only the full course renders a 候補 button
		expect(FULL.id).toBe(5);

		const { getByRole } = render(Page);
		// The full course is the only card whose add BUTTON reads 候補 (open cards
		// read 加入). Scope to role=button so the 候補 Badge span doesn't also match.
		await fireEvent.click(getByRole('button', { name: '候補' }));

		expect(get(cart)).toHaveLength(0); // full course did NOT enter the paid cart
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a normal course (spots > 0) enters the cart and shows 已加入購物車', async () => {
		cart.clear();
		// isolation guard: the prior full-course test's waitlist id must have been
		// reset by afterEach — otherwise singleton waitlist state leaks across tests.
		expect(get(cart.waitlist)).toEqual([]);
		expect(OPEN.spots).toBeGreaterThan(0);

		const { getAllByRole } = render(Page);
		// Open courses render an 加入 button; click the first one.
		await fireEvent.click(getAllByRole('button', { name: '加入' })[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
	});
});
