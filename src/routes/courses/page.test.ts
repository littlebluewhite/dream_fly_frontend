import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart } from '$lib/member/stores';
import { marketingCourseId } from '$lib/member/data';
import { toasts } from '$lib/stores/marketingToasts';

function resetState() {
	localStorage.clear();
	cart.clear();
	cart.waitlist.set([]);
	// marketingToasts is a module singleton; dismiss any leftover toasts so a
	// stale entry from a prior test can't satisfy the toast assertion (vacuous pass).
	get(toasts).forEach((t) => toasts.dismiss(t.id));
}
beforeEach(resetState);
afterEach(resetState);

describe('課程介紹 (marketing) — 加入購物車 unifies onto the member cart', () => {
	it('adds the marketing course to the member cart under its namespaced id', async () => {
		const { getAllByRole } = render(Page);
		// First course card (id 1 幼兒體操) → cart id marketingCourseId(1) = 2001.
		await fireEvent.click(getAllByRole('button', { name: '加入購物車' })[0]);

		const items = get(cart);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe(marketingCourseId(1));
		expect(items[0].type).toBe('course');
		expect(items[0].name).toBe('幼兒體操');
		expect(items[0].price).toBe(3200); // parsed from "NT$ 3,200/月 (4堂)"
		expect(items[0].qty).toBe(1);
	});

	it('shows a marketing toast on add', async () => {
		const { getAllByRole } = render(Page);
		// Baseline: no toasts before the click, so the assertion below proves THIS
		// click created the toast (not a leftover from a prior test).
		expect(get(toasts)).toHaveLength(0);
		await fireEvent.click(getAllByRole('button', { name: '加入購物車' })[0]);

		expect(get(toasts).some((t) => t.title === '已將 幼兒體操 加入購物車')).toBe(true);
	});

	it('flips the added card to the disabled 已在購物車 state (CourseCard isInCart)', async () => {
		const { getAllByRole, getByRole } = render(Page);
		await fireEvent.click(getAllByRole('button', { name: '加入購物車' })[0]);

		// CourseCard recomputes isInCart from $cart against marketingCourseId(course.id).
		expect(getByRole('button', { name: '已在購物車' })).toBeDisabled();
	});
});
