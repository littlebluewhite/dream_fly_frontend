import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { courseResponse, coachResponse } from '$lib/testing/wire-fixtures';
import { cart, toasts } from '$lib/mobile/stores';

// Task 5(架構深化 R12):本頁的鈴鐺角標(unreadCount)改經 member 側的通知 module
// (getNotifications 隨 mobile/notifications.ts 退役一併移除,不再是
// $lib/mobile/api 的一員)——這裡不需要再交代它。Task 7(架構深化 R15·F-4)起
// 本頁直取 $lib/member/notifications,不再經 $lib/mobile/stores 轉手。
// W4d：只假造 HTTP(api())，真 getHome + mapper 跑起來；畫面文字斷言不變。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// Task 1(C2 死種子退役):mobile/data.ts 的 CATALOG/MY_COURSES(值)已退役(R16 Task 2c 起首頁不再讀報名課程)——本檔案
// 每個 it() 大多用自己的「相異 fixture」覆寫 getHome() 回應(證明資料來自接縫而非
// 直接 import seed),下方僅供 beforeEach 預設值,內容本身不受個別斷言檢查。
const COURSE_NAME = '競技啦啦隊 進階班';
const COURSES = {
	courses: [
		courseResponse({
			id: '3', name: COURSE_NAME, level: 'advanced', category: '競技啦啦隊', min_age: 10, max_age: 16,
			schedule_text: '週二 / 週四 19:00', price_cents: 480000, is_highlighted: true, coach_id: 'coach-1',
			description: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。', max_students: 12, enrolled_count: 11
		})
	],
	total: 1, page: 1, per_page: 100
};

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(over, { 'GET /courses?per_page=100': COURSES, 'GET /coaches': [coachResponse({ id: 'coach-1', name: '林雅婷' })] })
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

afterEach(() => {
	cart.clear();
});

describe('首頁 tab — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="mobile-home-skeleton")', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="mobile-home-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /courses?per_page=100': new Error('boom') });
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('「下一堂課」卡已拿掉(R16 Task 2c：後端沒有下一堂資料，卡片原本就永遠隱藏)', async () => {
		render(Page);
		expect(await screen.findByText('熱門課程')).toBeInTheDocument();
		expect(screen.queryByText('下一堂課')).toBeNull();
		expect(screen.queryByText('可報到')).toBeNull();
	});
});

describe('首頁 tab — 加入購物車', () => {
	it('連按兩次同一門課的「加入」→ 第二次顯示「已在購物車中」的 info toast', async () => {
		render(Page);
		const btn = await screen.findByRole('button', { name: /加入/ });
		await fireEvent.click(btn);
		await fireEvent.click(btn);

		expect(get(toasts).some((t) => t.title === `${COURSE_NAME} 已在購物車中`)).toBe(true);
	});
});
