import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { CATALOG } from '$lib/mobile/data';

afterEach(() => {
	cart.clear();
	cart.waitlist.set([]); // singleton waitlist isn't cleared by cart.clear(); reset it so ids don't leak across tests
});

describe('課程介紹 — 候補守門（codex P2 regression）', () => {
	it('adding a full course shows a waitlist toast and keeps it out of the paid cart', async () => {
		cart.clear();
		// CATALOG 內唯一額滿（spots 0）課程 → 課程卡的加入鈕顯示「候補」。
		const full = CATALOG.find((c) => c.spots === 0);
		expect(full).toBeDefined();

		const { getByText } = render(Page);
		await fireEvent.click(getByText('候補'));

		// 額滿課程不進付費購物車,且彈出「已加入候補」toast。
		expect(get(cart)).toHaveLength(0);
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a course with spots enters the paid cart and leaves no waitlist residue from the prior test', async () => {
		// isolation guard: prior full-course test's waitlist id must be reset by afterEach.
		expect(get(cart.waitlist)).toEqual([]);
		const open = CATALOG.find((c) => c.spots > 0);
		expect(open).toBeDefined();

		const { getAllByRole } = render(Page);
		await fireEvent.click(getAllByRole('button', { name: '加入' })[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
	});
});
