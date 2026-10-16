import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CourseDetailSheet from './CourseDetailSheet.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { api, ApiError } from '$lib/api/client';
import type { Course } from '$lib/mobile/data';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { apiBody } from '$lib/testing/admin-routes';
import { waitlistResponse } from '$lib/testing/wire-fixtures';

/* CourseDetailSheet pin-first 測試(架構深化 R11 Task 5 · C6 替代案)——針對現行三徑
 * (加入候補成功/失敗、加入購物車)按現碼行為釘測，mock/render 形抄同目錄
 * CartSheet.test.ts。joinWaitlist 是真的(元件直取 $lib/member/waitlist)，候補徑經
 * $lib/api/client 的 api() 假造 POST /waitlist(同 routes/member/courses/page.test.ts 的
 * 寫法：回應照 body 的 course_id 回聲)；joinWaitlistErrorMessage 維持真實實作，409 專屬
 * 文案照現碼字串比對。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** 候補路由:未水合時加入候補會排和解重抓(GET /waitlist/me);POST /waitlist 照 body 回聲。 */
const waitlistRoutes = (course: Course, post?: unknown) =>
	fakeRouter({
		'GET /waitlist/me': [],
		'POST /waitlist':
			post ??
			((init: RequestInit) => {
				const body = JSON.parse((init.body as string) ?? '{}') as { course_id?: string };
				return waitlistResponse({ id: 'w-1', course_id: body.course_id, course_name: course.name });
			})
	});

// 欄位形狀同 CartSheet.test.ts 的 courseFixture（同目錄既有慣例）。
function courseFixture(overrides: Partial<Course> = {}): Course {
	return {
		id: 'course-uuid-9',
		name: '競技啦啦隊 進階班',
		level: '進階',
		cat: '競技啦啦隊',
		age: '6–12 歲',
		days: '週六 10:00',
		price: 4800,
		hot: false,
		coach: '',
		desc: '',
		spots: 3,
		icon: 'sparkles',
		...overrides
	};
}

beforeEach(async () => {
	cart.clear();
	vi.mocked(api).mockReset();
	await resetSessionStores(); // 候補閘門回開機態
});

describe('CourseDetailSheet — 加入購物車(尚有名額，spots > 0)', () => {
	it('cart.add 直接成功：顯示「已加入購物車」toast，並呼叫 onClose', async () => {
		const course = courseFixture({ spots: 3 });
		const onClose = vi.fn();
		const { getByText } = render(CourseDetailSheet, { props: { onClose, course } });

		await fireEvent.click(getByText('加入購物車'));

		expect(
			get(toasts).some((t) => t.tone === 'success' && t.title === '已加入購物車' && t.body === course.name)
		).toBe(true);
		expect(onClose).toHaveBeenCalled();
	});

	it('連按兩次「加入購物車」→ 第二次顯示「已在購物車中」的 info toast，並呼叫 onClose', async () => {
		const course = courseFixture({ spots: 3 });
		const onClose = vi.fn();
		const { getByText } = render(CourseDetailSheet, { props: { onClose, course } });

		await fireEvent.click(getByText('加入購物車'));
		await fireEvent.click(getByText('加入購物車'));

		expect(get(toasts).some((t) => t.tone === 'info' && t.title === `${course.name} 已在購物車中`)).toBe(true);
		expect(onClose).toHaveBeenCalled();
	});
});

describe('CourseDetailSheet — 加入候補(額滿，spots === 0)', () => {
	it('joinWaitlist 成功：顯示「已加入候補名單」toast，並呼叫 onClose', async () => {
		const course = courseFixture({ spots: 0 });
		vi.mocked(api).mockImplementation(waitlistRoutes(course));
		const onClose = vi.fn();
		const { getByText } = render(CourseDetailSheet, { props: { onClose, course } });

		await fireEvent.click(getByText('加入候補名單'));

		await vi.waitFor(() => {
			expect(
				get(toasts).some((t) => t.tone === 'info' && t.title === '已加入候補名單' && t.body === course.name)
			).toBe(true);
		});
		expect(apiBody('POST /waitlist')).toEqual({ course_id: course.id });
		expect(onClose).toHaveBeenCalled();
	});

	it('joinWaitlist 失敗(409 已在候補中)：顯示「加入候補失敗」+ 專屬文案「你已經在候補名單中了」，並呼叫 onClose', async () => {
		const course = courseFixture({ spots: 0 });
		vi.mocked(api).mockImplementation(waitlistRoutes(course, new ApiError(409, 'already on waitlist')));
		const onClose = vi.fn();
		const { getByText } = render(CourseDetailSheet, { props: { onClose, course } });

		await fireEvent.click(getByText('加入候補名單'));

		await vi.waitFor(() => {
			expect(
				get(toasts).some((t) => t.tone === 'error' && t.title === '加入候補失敗' && t.body === '你已經在候補名單中了')
			).toBe(true);
		});
		expect(onClose).toHaveBeenCalled();
	});
});
