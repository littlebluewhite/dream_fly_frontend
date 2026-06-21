import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts } from '$lib/member/stores';
import { CATALOG } from '$lib/member/data';
import { getCourses } from '$lib/member/api';

vi.mock('$lib/member/api', () => ({ getCourses: vi.fn() }));

const FULL = CATALOG.find((c) => c.spots === 0)!; // id 5 跑酷入門班 (spots: 0)
const OPEN = CATALOG.find((c) => c.spots > 0)!; // id 1 幼兒體操 啟蒙班 (spots > 0)

// The catalog must contain exactly one full course for the 候補-button lookup
// below to be unambiguous; assert that here so the fixture can't drift silently.
const fullCount = CATALOG.filter((c) => c.spots === 0).length;

beforeEach(() => {
	vi.mocked(getCourses).mockReset();
	vi.mocked(getCourses).mockResolvedValue({ catalog: CATALOG });
});

afterEach(() => {
	cart.clear();
	cart.waitlist.set([]); // singleton waitlist isn't cleared by cart.clear(); reset it so ids don't leak across tests
});

describe('課程介紹 — addToCart branches on the store AddResult (waitlist guard)', () => {
	it('a full course shows a waitlist toast and never enters the paid cart', async () => {
		cart.clear();
		expect(fullCount).toBe(1); // only the full course renders a 候補 button
		expect(FULL.id).toBe(5);

		const { container } = render(Page);
		// Wait for the ready branch — the full course renders a 候補 button once loaded.
		const btn = await findByRole(container, 'button', { name: '候補' });
		await fireEvent.click(btn);

		expect(get(cart)).toHaveLength(0); // full course did NOT enter the paid cart
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a normal course (spots > 0) enters the cart and shows 已加入購物車', async () => {
		cart.clear();
		// isolation guard: the prior full-course test's waitlist id must have been
		// reset by afterEach — otherwise singleton waitlist state leaks across tests.
		expect(get(cart.waitlist)).toEqual([]);
		expect(OPEN.spots).toBeGreaterThan(0);

		const { container } = render(Page);
		// Open courses render an 加入 button; wait for ready then click the first one.
		const btns = await findAllByRole(container, 'button', { name: '加入' });
		await fireEvent.click(btns[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
	});
});

describe('課程介紹 — 三態', () => {
	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(getCourses).mockReset();
		vi.mocked(getCourses).mockRejectedValue(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示課程骨架', async () => {
		vi.mocked(getCourses).mockReset();
		vi.mocked(getCourses).mockReturnValue(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('courses-skeleton')).toBeTruthy();
	});
});
