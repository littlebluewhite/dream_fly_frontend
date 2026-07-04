import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { listCourses, listCoaches } from '$lib/public/api';
import type { ApiCourse, ApiCoach } from '$lib/public/api';
import { cart } from '$lib/member/stores';

vi.mock('$lib/public/api', () => ({ listCourses: vi.fn(), listCoaches: vi.fn() }));

const COURSE: ApiCourse = {
	id: 'course-uuid-1',
	name: '幼兒體操 啟蒙班',
	slug: 'kids-gym-intro',
	level: 'beginner',
	description: '透過遊戲建立基礎動作能力',
	duration_minutes: 60,
	price_cents: 320000,
	max_students: 10,
	min_age: 3,
	max_age: 6,
	features: [],
	is_active: true,
	coach_id: 'coach-uuid-1',
	category: '幼兒體操',
	schedule_text: '週六 10:00',
	is_highlighted: true,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z',
	enrolled_count: 8,
	waitlist_count: 0
};

const COACH: ApiCoach = {
	id: 'coach-uuid-1',
	user_id: 'user-uuid-1',
	// name 未在此頁使用 —— routes/courses/+page.svelte 自己的 coachNameById 目前仍讀
	// title(見 src/lib/member/api.ts getCourses 上方註解：同類殘留，非本次任務範圍)。
	name: '黃小姐',
	title: '黃教練',
	bio: null,
	experience: null,
	specialties: [],
	certifications: [],
	is_active: true,
	display_order: 1,
	slug: 'huang',
	photo_url: null,
	created_at: '2026-01-01T00:00:00Z'
};

beforeEach(() => {
	vi.mocked(listCourses).mockReset();
	vi.mocked(listCoaches).mockReset();
	vi.mocked(listCourses).mockResolvedValue([COURSE]);
	vi.mocked(listCoaches).mockResolvedValue([COACH]);
	localStorage.clear();
	cart.clear();
});

describe('課程介紹 (marketing) — 接真 API', () => {
	it('renders the adapted catalog course (level label, price/100, coach name resolved from coach_id)', async () => {
		const { container, findByText } = render(Page);

		await findByText('幼兒體操 啟蒙班');
		expect(container.textContent).toContain('初級'); // LEVEL_LABEL[beginner]
		expect(container.textContent).toContain('NT$ 3,200'); // ntd(320000)
		expect(container.textContent).toContain('黃教練');
	});

	it('加入購物車 is enabled (cart v3: uuid ids) and adds the course to the cart on click', async () => {
		const { container } = render(Page);

		const btn = await findByRole(container, 'button', { name: '加入購物車' });
		expect(btn).not.toBeDisabled();

		await fireEvent.click(btn);

		const items = get(cart);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe('course-uuid-1');
		expect(items[0].type).toBe('course');
		expect(items[0].qty).toBe(1);
	});

	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(listCourses).mockReset();
		vi.mocked(listCourses).mockRejectedValue(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示課程骨架', async () => {
		vi.mocked(listCourses).mockReset();
		vi.mocked(listCourses).mockReturnValue(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('courses-skeleton')).toBeTruthy();
	});

	it('renders one card per fetched course', async () => {
		vi.mocked(listCourses).mockResolvedValue([
			COURSE,
			{ ...COURSE, id: 'course-uuid-2', name: '競技啦啦隊 進階班', coach_id: null }
		]);

		const { container, findAllByText } = render(Page);
		await findAllByText(/幼兒體操 啟蒙班|競技啦啦隊 進階班/);

		const btns = await findAllByRole(container, 'button', { name: '加入購物車' });
		expect(btns).toHaveLength(2);
		expect(btns.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
	});
});
