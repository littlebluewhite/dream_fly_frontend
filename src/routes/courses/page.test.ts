import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { listCourses, listCoaches } from '$lib/public/api';
import type { ApiCourse, ApiCoach } from '$lib/public/api';
import { cart, joinWaitlist } from '$lib/member/stores';
import { toasts } from '$lib/stores/marketingToasts';
import { authStore } from '$lib/stores/authStore';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/public/api', () => ({ listCourses: vi.fn(), listCoaches: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import { goto } from '$app/navigation';

// FE#14: joinWaitlist hits the real network (api()); mock only that export,
// keep cart/joinWaitlistErrorMessage/toasts real (same partial-mock idiom as
// admin/api.test.ts's fakeRouter-backed suites).
vi.mock('$lib/member/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/stores')>();
	return { ...actual, joinWaitlist: vi.fn() };
});

// authStore is API-backed (real network calls); this file only cares about the
// logged-in/out UI state (same fake as CartDropdown.test.ts — auth mechanics
// themselves are covered in src/lib/stores/authStore.test.ts).
vi.mock('$lib/stores/authStore', async () => {
	const { writable, derived } = await import('svelte/store');
	const state = writable({ loggedIn: false, member: null, roles: [] as string[] });
	return {
		authStore: {
			subscribe: state.subscribe,
			login: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
			register: vi.fn(async () => {}),
			logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
			hydrate: vi.fn(async () => {})
		},
		isLoggedIn: derived(state, ($s) => $s.loggedIn)
	};
});

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
	// name(教練真實姓名)與 title(職稱)不同字 —— 課程卡的授課教練應顯示 name，
	// 若回歸到 title 則 name 消失、title 現形，下方兩條斷言會同時失敗。
	name: '黃詩涵',
	title: '資深體操教練',
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

// spots = max_students(8) - enrolled_count(8) = 0 → 額滿，加入購物車走候補分支。
const FULL_COURSE: ApiCourse = { ...COURSE, id: 'course-uuid-full', max_students: 8, enrolled_count: 8 };

beforeEach(() => {
	vi.mocked(listCourses).mockReset();
	vi.mocked(listCoaches).mockReset();
	vi.mocked(listCourses).mockResolvedValue([COURSE]);
	vi.mocked(listCoaches).mockResolvedValue([COACH]);
	vi.mocked(joinWaitlist).mockReset();
	vi.mocked(goto).mockClear();
	localStorage.clear();
	cart.clear();
	authStore.logout();
});

describe('課程介紹 (marketing) — 接真 API', () => {
	it('renders the adapted catalog course (level label, price/100, coach name resolved from coach_id — the real name, not the job title)', async () => {
		const { container, findByText } = render(Page);

		await findByText('幼兒體操 啟蒙班');
		expect(container.textContent).toContain('初級'); // LEVEL_LABEL[beginner]
		expect(container.textContent).toContain('NT$ 3,200'); // ntd(320000)
		expect(container.textContent).toContain('黃詩涵'); // CoachResponse.name（真實姓名）
		expect(container.textContent).not.toContain('資深體操教練'); // 不是職稱 title — 回歸 .title 會踩到這條
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

/* FE#14: 候補動作必須是真的（不是只丟 toast、不打 API）——precedent 是
 * routes/member/courses/+page.svelte 的 addToCart：'waitlisted' 時已登入才呼叫
 * 真實 joinWaitlist()（409 已候補繁中提示；成功才顯示已候補），未登入則導向
 * /member/login、不嘗試呼叫 API。 */
describe('候補 (FE#14) — 公開 /courses 頁的額滿課程', () => {
	it('已登入時點擊加入購物車 → 呼叫真實 joinWaitlist()，成功後才顯示已加入候補 toast', async () => {
		authStore.login('member@test.com', 'password123');
		vi.mocked(listCourses).mockResolvedValue([FULL_COURSE]);
		vi.mocked(joinWaitlist).mockResolvedValue({
			id: 'wl-1',
			course_id: FULL_COURSE.id,
			course_name: FULL_COURSE.name
		});

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '加入購物車' });
		const before = get(toasts).length;
		await fireEvent.click(btn);

		await vi.waitFor(() => expect(joinWaitlist).toHaveBeenCalledWith(FULL_COURSE.id));
		expect(get(cart)).toHaveLength(0); // 額滿課程不進付費購物車
		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.title).toBe('已加入候補');
	});

	it('已登入但後端回 409（已候補）→ 顯示已候補的友善提示，不是通用錯誤訊息', async () => {
		authStore.login('member@test.com', 'password123');
		vi.mocked(listCourses).mockResolvedValue([FULL_COURSE]);
		vi.mocked(joinWaitlist).mockRejectedValue(new ApiError(409, 'already on waitlist'));

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '加入購物車' });
		await fireEvent.click(btn);

		await vi.waitFor(() => expect(joinWaitlist).toHaveBeenCalledWith(FULL_COURSE.id));
		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toBe('你已經在候補名單中了'));
	});

	it('未登入時點擊加入購物車 → 顯示請先登入會員 toast 並導向 /member/login，不呼叫 joinWaitlist', async () => {
		vi.mocked(listCourses).mockResolvedValue([FULL_COURSE]);

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '加入購物車' });
		await fireEvent.click(btn);

		expect(joinWaitlist).not.toHaveBeenCalled();
		expect(get(toasts).at(-1)?.title).toBe('請先登入會員');
		// 裁決 10：不自動導回——單純導向登入頁，不帶 ?redirect= 回跳參數。
		expect(goto).toHaveBeenCalledWith('/member/login');
	});
});
