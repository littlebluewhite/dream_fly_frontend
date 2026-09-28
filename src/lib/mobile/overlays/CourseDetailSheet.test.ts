import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CourseDetailSheet from './CourseDetailSheet.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { joinWaitlist } from '$lib/member/waitlist';
import { ApiError } from '$lib/api/client';
import type { Course } from '$lib/mobile/data';

/* CourseDetailSheet pin-first 測試(架構深化 R11 Task 5 · C6 替代案)——針對現行三徑
 * (加入候補成功/失敗、加入購物車)按現碼行為釘測，mock/render 形抄同目錄
 * CartSheet.test.ts。joinWaitlist 經 vi.mock 攔截(同 TrialScreen.test.ts 攔
 * submitTrialInquiry 的手法)，候補徑不必真的打 POST /waitlist；
 * joinWaitlistErrorMessage 維持真實實作，409 專屬文案照現碼字串比對。Task 7
 * (架構深化 R15·F-4)：元件改直取 $lib/member/waitlist，mock 目標同步改到
 * 擁有者模組。 */
vi.mock('$lib/member/waitlist', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/waitlist')>();
	return { ...actual, joinWaitlist: vi.fn() };
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

beforeEach(() => {
	cart.clear();
	vi.mocked(joinWaitlist).mockReset();
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
		vi.mocked(joinWaitlist).mockResolvedValue({ id: 'w-1', course_id: course.id, course_name: course.name });
		const onClose = vi.fn();
		const { getByText } = render(CourseDetailSheet, { props: { onClose, course } });

		await fireEvent.click(getByText('加入候補名單'));

		await vi.waitFor(() => {
			expect(
				get(toasts).some((t) => t.tone === 'info' && t.title === '已加入候補名單' && t.body === course.name)
			).toBe(true);
		});
		expect(onClose).toHaveBeenCalled();
	});

	it('joinWaitlist 失敗(409 已在候補中)：顯示「加入候補失敗」+ 專屬文案「你已經在候補名單中了」，並呼叫 onClose', async () => {
		const course = courseFixture({ spots: 0 });
		vi.mocked(joinWaitlist).mockRejectedValue(new ApiError(409, 'already on waitlist'));
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
