import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { getHome } from '$lib/mobile/api';
import { ANNOUNCE } from '$lib/mobile/data';
import type { Course } from '$lib/mobile/data';
import { cart, toasts } from '$lib/mobile/stores';

// Task 5(架構深化 R12):本頁的鈴鐺角標(unreadCount)改經 member 側的通知 module
// (getNotifications 隨 mobile/notifications.ts 退役一併移除,不再是
// $lib/mobile/api 的一員)——這裡不需要再交代它。Task 7(架構深化 R15·F-4)起
// 本頁直取 $lib/member/notifications,不再經 $lib/mobile/stores 轉手。
vi.mock('$lib/mobile/api', () => ({ getHome: vi.fn() }));

// Task 1(C2 死種子退役):mobile/data.ts 的 CATALOG/MY_COURSES(值)已退役(R16 Task 2c 起首頁不再讀報名課程)——本檔案
// 每個 it() 大多用自己的「相異 fixture」覆寫 getHome() 回應(證明資料來自接縫而非
// 直接 import seed),下方僅供 beforeEach 預設值,內容本身不受個別斷言檢查。
const CATALOG: Course[] = [
	{ id: '3', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', icon: 'sparkles', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。', spots: 1 }
];

beforeEach(() => {
	vi.mocked(getHome).mockReset();
	vi.mocked(getHome).mockResolvedValue({ catalog: CATALOG, announce: ANNOUNCE });
});

afterEach(() => {
	cart.clear();
});

describe('首頁 tab — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="mobile-home-skeleton")', () => {
		vi.mocked(getHome).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="mobile-home-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getHome).mockRejectedValue(new Error('boom'));
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

		expect(get(toasts).some((t) => t.title === `${CATALOG[0].name} 已在購物車中`)).toBe(true);
	});
});
