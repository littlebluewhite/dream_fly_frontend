import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { CATALOG } from '$lib/mobile/data';
import { getCourses } from '$lib/mobile/api';

vi.mock('$lib/mobile/api', () => ({ getCourses: vi.fn() }));

beforeEach(() => {
	vi.mocked(getCourses).mockReset();
	vi.mocked(getCourses).mockResolvedValue({ catalog: CATALOG });
});

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

		render(Page);
		await fireEvent.click(await screen.findByText('候補'));

		// 額滿課程不進付費購物車,且彈出「已加入候補」toast。
		expect(get(cart)).toHaveLength(0);
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a course with spots enters the paid cart and leaves no waitlist residue from the prior test', async () => {
		// isolation guard: prior full-course test's waitlist id must be reset by afterEach.
		expect(get(cart.waitlist)).toEqual([]);
		const open = CATALOG.find((c) => c.spots > 0);
		expect(open).toBeDefined();

		render(Page);
		await fireEvent.click((await screen.findAllByRole('button', { name: '加入' }))[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
	});
});

describe('課程介紹 — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記(data-testid="courses-skeleton")', () => {
		vi.mocked(getCourses).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="courses-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCourses).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('渲染的課程來自 getCourses 接縫回傳值,而非直接 import 的 seed(相異 fixture)', async () => {
		const fixture = {
			catalog: [
				{
					id: 9001,
					name: '接縫測試專用課程',
					level: '入門',
					cat: '幼兒體操',
					age: '3-5 歲',
					icon: 'baby',
					days: '週一 10:00–11:00',
					price: 999,
					hot: false,
					coach: '測試教練',
					desc: '僅供接縫測試',
					spots: 5
				}
			]
		};
		vi.mocked(getCourses).mockResolvedValue(fixture);

		render(Page);

		expect(await screen.findByText('接縫測試專用課程')).toBeInTheDocument();
		expect(screen.getByText('共 1 門課程')).toBeInTheDocument();
	});
});
