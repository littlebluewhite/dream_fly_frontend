import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, toasts, waitlist } from '$lib/member/stores';
import { getCourses } from '$lib/member/api';
import { api, ApiError } from '$lib/api/client';

vi.mock('$lib/member/api', () => ({ getCourses: vi.fn() }));
// 只替換 api()，ApiError 用回真實類別（addToCart 的 joinWaitlistErrorMessage 靠
// instanceof 判斷 409）。candidate 按鈕現在打真實 POST /waitlist，每個測試按情境
// 個別設定回應；預設（未覆寫）回一個合法的 WaitlistResponse，讓不關心候補 API
// 細節的既有測試不用逐一配置 mock 也能跑完整個 join 流程。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// Task 17: getCourses() now returns the public-seam CatalogCourse (uuid id, no
// icon field) — a local fixture replaces the old member-domain CATALOG mock.
const CATALOG = [
	{ id: 'course-1', name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', age: '3–5 歲', days: '週六 10:00', price: 2800, hot: false, coach: '黃詩涵', desc: '', spots: 2 },
	{ id: 'course-2', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', age: '7–9 歲', days: '週一 / 週三 17:30', price: 3200, hot: true, coach: '陳冠宇', desc: '', spots: 2 },
	{ id: 'course-3', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '', spots: 1 },
	{ id: 'course-4', name: '成人體操 基礎班', level: '基礎', cat: '成人體操', age: '16 歲以上', days: '週五 20:00', price: 3600, hot: false, coach: '王思齊', desc: '', spots: 3 },
	{ id: 'course-5', name: '跑酷入門班', level: '入門', cat: '跑酷', age: '12 歲以上', days: '週日 15:00', price: 3400, hot: false, coach: '王思齊', desc: '', spots: 0 },
	{ id: 'course-6', name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', age: '2–4 歲', days: '週日 10:00', price: 2600, hot: false, coach: '黃詩涵', desc: '', spots: 3 }
];

const FULL = CATALOG.find((c) => c.spots === 0)!; // course-5 跑酷入門班 (spots: 0)
const OPEN = CATALOG.find((c) => c.spots > 0)!; // course-1 幼兒體操 啟蒙班 (spots > 0)

// The catalog must contain exactly one full course for the 候補-button lookup
// below to be unambiguous; assert that here so the fixture can't drift silently.
const fullCount = CATALOG.filter((c) => c.spots === 0).length;

/** Tiny fake router for the `api` client mock (same convention as
 *  checkout-api.test.ts's fakeRouter): defaults GET /waitlist/me to an empty
 *  candidate list and POST /waitlist to a successful join echoing back the
 *  requested course_id, so tests that don't care about the waitlist API's
 *  exact shape still get a working join flow without configuring it. */
function apiRouter(overrides: Record<string, unknown> = {}) {
	return vi.fn(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		const key = `${method} ${path}`;
		if (key in overrides) {
			const value = overrides[key];
			if (value instanceof Error) throw value;
			return value;
		}
		if (path === '/waitlist/me' && method === 'GET') return [];
		if (path === '/waitlist' && method === 'POST') {
			const body = JSON.parse((init.body as string) ?? '{}') as { course_id?: string };
			const course = CATALOG.find((c) => c.id === body.course_id);
			return { id: 'wl-' + body.course_id, course_id: body.course_id, course_name: course?.name ?? '課程', status: 'waiting', created_at: '2026-07-04T00:00:00Z' };
		}
		throw new Error(`unexpected api call: ${key}`);
	});
}

beforeEach(() => {
	vi.mocked(getCourses).mockReset();
	vi.mocked(getCourses).mockResolvedValue({ catalog: CATALOG });
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(apiRouter());
	waitlist.set([]);
});

afterEach(() => {
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
		expect(OPEN.spots).toBeGreaterThan(0);

		const { container } = render(Page);
		// Open courses render an 加入 button; wait for ready then click the first one.
		const btns = await findAllByRole(container, 'button', { name: '加入' });
		await fireEvent.click(btns[0]);

		expect(get(cart).length).toBeGreaterThan(0);
		expect(get(toasts).some((t) => t.title === '已加入購物車')).toBe(true);
		// no POST /waitlist for a course that still has spots
		expect(vi.mocked(api).mock.calls.some(([p, i]) => p === '/waitlist' && (i as RequestInit)?.method === 'POST')).toBe(false);
	});
});

describe('課程介紹 — 候補狀態（GET /waitlist/me 水合 + 重複候補 409）', () => {
	it('已經候補過的滿班課程進頁即水合為「已候補」，按鈕停用且不再重複打 POST /waitlist', async () => {
		vi.mocked(api).mockImplementation(
			apiRouter({
				'GET /waitlist/me': [
					{ id: 'wl-1', course_id: FULL.id, course_name: FULL.name, status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
				]
			})
		);

		const { container } = render(Page);
		const btn = await findByRole(container, 'button', { name: '已候補' });
		expect(btn).toBeDisabled();

		await fireEvent.click(btn); // disabled — must not fire a second join
		expect(vi.mocked(api).mock.calls.some(([p, i]) => p === '/waitlist' && (i as RequestInit)?.method === 'POST')).toBe(false);
	});

	it('重複候補（後端 409 "already on waitlist"）→ 顯示「加入候補失敗」與專屬繁中文案，不顯示「已加入候補」', async () => {
		vi.mocked(api).mockImplementation(
			apiRouter({ 'POST /waitlist': new ApiError(409, 'already on waitlist') })
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
