import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts, waitlist } from '$lib/member/stores';
import { resetSessionStores } from '$lib/testing/session-reset';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import { coachResponse, courseResponse } from '$lib/testing/wire-fixtures';

// 只替換 api()，ApiError 用回真實類別（addToCart 的 joinWaitlistErrorMessage 靠
// instanceof 判斷 409）。candidate 按鈕現在打真實 POST /waitlist，每個測試按情境
// 個別設定回應；預設（未覆寫）回一個合法的 WaitlistResponse，讓不關心候補 API
// 細節的既有測試不用逐一配置 mock 也能跑完整個 join 流程。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// 原 CatalogCourse 畫面形狀 fixture 改為 wire 輸入(讓真的 getCourses + toCatalogCourse 跑):
// spots = max_students(10) - enrolled_count。
const COACHES = [
	coachResponse({ id: 'coach-1', name: '黃詩涵' }),
	coachResponse({ id: 'coach-2', name: '陳冠宇' }),
	coachResponse({ id: 'coach-3', name: '林雅婷' }),
	coachResponse({ id: 'coach-4', name: '王思齊' })
];

const wireCourse = (id: string, name: string, level: 'foundation' | 'beginner' | 'intermediate' | 'advanced', category: string, min_age: number | null, max_age: number | null, schedule_text: string, price_ntd: number, is_highlighted: boolean, coach_id: string, spots: number) =>
	courseResponse({ id, name, level, category, min_age, max_age, schedule_text, price_cents: price_ntd * 100, is_highlighted, coach_id, max_students: 10, enrolled_count: 10 - spots });

const COURSES = [
	wireCourse('course-1', '幼兒體操 啟蒙班', 'foundation', '幼兒體操', 3, 5, '週六 10:00', 2800, false, 'coach-1', 2),
	wireCourse('course-2', '兒童基礎 B 班', 'intermediate', '兒童基礎', 7, 9, '週一 / 週三 17:30', 3200, true, 'coach-2', 2),
	wireCourse('course-3', '競技啦啦隊 進階班', 'advanced', '競技啦啦隊', 10, 16, '週二 / 週四 19:00', 4800, true, 'coach-3', 1),
	wireCourse('course-4', '成人體操 基礎班', 'intermediate', '成人體操', 16, null, '週五 20:00', 3600, false, 'coach-4', 3),
	wireCourse('course-5', '跑酷入門班', 'beginner', '跑酷', 12, null, '週日 15:00', 3400, false, 'coach-4', 0),
	wireCourse('course-6', '親子體操 同樂班', 'foundation', '幼兒體操', 2, 4, '週日 10:00', 2600, false, 'coach-1', 3)
];
const spotsOf = (c: (typeof COURSES)[number]) => c.max_students - c.enrolled_count;

const FULL = COURSES.find((c) => spotsOf(c) === 0)!; // course-5 跑酷入門班 (spots: 0)
const OPEN = COURSES.find((c) => spotsOf(c) > 0)!; // course-1 幼兒體操 啟蒙班 (spots > 0)

// The catalog must contain exactly one full course for the 候補-button lookup
// below to be unambiguous; assert that here so the fixture can't drift silently.
const fullCount = COURSES.filter((c) => spotsOf(c) === 0).length;

/** Waitlist defaults for the shared fakeRouter (same convention as
 *  checkout-api.test.ts's fakeRouter): defaults GET /waitlist/me to an empty
 *  candidate list and POST /waitlist to a successful join echoing back the
 *  requested course_id, so tests that don't care about the waitlist API's
 *  exact shape still get a working join flow without configuring it. */
const WAITLIST_DEFAULTS: Record<string, unknown> = {
	'GET /waitlist/me': [],
	'POST /waitlist': (init: RequestInit) => {
		const body = JSON.parse((init.body as string) ?? '{}') as { course_id?: string };
		const course = COURSES.find((c) => c.id === body.course_id);
		return { id: 'wl-' + body.course_id, course_id: body.course_id, course_name: course?.name ?? '課程', status: 'waiting', created_at: '2026-07-04T00:00:00Z' };
	}
};

const COURSES_DEFAULTS: Record<string, unknown> = {
	...MEMBER_ROUTES,
	'GET /courses?per_page=100': { courses: COURSES, total: COURSES.length, page: 1, per_page: 100 },
	'GET /coaches': COACHES,
	...WAITLIST_DEFAULTS
};

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({}, COURSES_DEFAULTS));
	waitlist.set([]);
	await resetSessionStores();
});

afterEach(async () => {
	cart.clear();
	waitlist.set([]); // singleton waitlist isn't cleared by cart.clear(); reset it so entries don't leak across tests
});

describe('課程介紹 — addToCart branches on the store AddResult (waitlist guard)', () => {
	it('a full course → click 候補 → POST /waitlist succeeds → shows 已加入候補 toast and never enters the paid cart', async () => {
		cart.clear();
		expect(fullCount).toBe(1); // only the full course renders a 候補 button
		expect(FULL.id).toBe('course-5');

		const { container } = render(Page);
		// Wait for the ready branch — the full course renders a 候補 button once loaded.
		const btn = await findByRole(container, 'button', { name: '候補' });
		await fireEvent.click(btn);

		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledWith('/waitlist', {
				method: 'POST',
				body: JSON.stringify({ course_id: FULL.id })
			});
		});
		expect(get(cart)).toHaveLength(0); // full course did NOT enter the paid cart
		expect(get(toasts).some((t) => t.title === '已加入候補')).toBe(true);
	});

	it('a normal course (spots > 0) enters the cart and shows 已加入購物車', async () => {
		cart.clear();
		// isolation guard: the prior full-course test's waitlist entry must have
		// been reset by afterEach — otherwise singleton waitlist state leaks
		// across tests.
		expect(get(waitlist)).toEqual([]);
		expect(spotsOf(OPEN)).toBeGreaterThan(0);

		const { container } = render(Page);
		// Open courses render an 加入 button; wait for ready then click the first one.
		const btns = await findAllByRole(container, 'button', { name: '加入' });
		await fireEvent.click(btns[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
		// no POST /waitlist for a course that still has spots
		expect(vi.mocked(api).mock.calls.some(([p, i]) => p === '/waitlist' && (i as RequestInit)?.method === 'POST')).toBe(false);
	});

	it('加兩次同一門課 → 第二次顯示「已在購物車中」的 info toast（跟公開頁 courses/+page.svelte 同文案）', async () => {
		cart.clear();
		const { container } = render(Page);
		const btns = await findAllByRole(container, 'button', { name: '加入' });
		await fireEvent.click(btns[0]);
		await fireEvent.click(btns[0]);

		expect(get(toasts).some((t) => t.title === `${OPEN.name} 已在購物車中`)).toBe(true);
	});
});

describe('課程介紹 — 候補狀態（GET /waitlist/me 水合 + 重複候補 409）', () => {
	it('已經候補過的滿班課程進頁即水合為「已候補」，按鈕停用且不再重複打 POST /waitlist', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /waitlist/me': [
					{ id: 'wl-1', course_id: FULL.id, course_name: FULL.name, status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
				]
			}, COURSES_DEFAULTS)
		);

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '已候補' });
		expect(btn).toBeDisabled();

		await fireEvent.click(btn); // disabled — must not fire a second join
		expect(vi.mocked(api).mock.calls.some(([p, i]) => p === '/waitlist' && (i as RequestInit)?.method === 'POST')).toBe(false);
	});

	it('重複候補（後端 409 "already on waitlist"）→ 顯示「加入候補失敗」與專屬繁中文案，不顯示「已加入候補」', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /waitlist': new ApiError(409, 'already on waitlist') }, COURSES_DEFAULTS)
		);

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '候補' });
		await fireEvent.click(btn);

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.title === '加入候補失敗' && t.body === '你已經在候補名單中了')).toBe(true);
		});
		expect(get(cart)).toHaveLength(0);
	});
});

describe('課程介紹 — 三態', () => {
	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /courses?per_page=100': new Error('network') }, COURSES_DEFAULTS));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示課程骨架', async () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('courses-skeleton')).toBeTruthy();
	});
});
