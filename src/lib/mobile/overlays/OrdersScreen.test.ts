import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import OrdersScreen from './OrdersScreen.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { orderSummary } from '$lib/testing/wire-fixtures';
import type { OrderListResponse } from '$lib/api/generated';

/* Task 19 — OrdersScreen 改真後端(自行呼叫 getAccount()，取代直接 import 的 mock
 * ORDERS 常數) —— 帳戶頁「我的訂單 N 筆」摘要與這裡現在是同一支接縫，不會再
 * 各自顯示不同的訂單資料。Task 7(架構深化 R15·F-4)：mobile/api.ts 原本的純轉手
 * getAccount() 已退役，本畫面直取桌面 seam，mock 目標同步改到擁有者模組。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// W4c：只假造 HTTP(api())，真 getAccount + mapper 跑起來；畫面文字斷言不變。
const FIXTURE = orderSummary({
	order_number: 'DF-9001',
	total_cents: 123400,
	created_at: '2026-01-01T00:00:00Z',
	items: [{ name: '接縫測試專用訂單', quantity: 1 }]
});

const ordersRes = (orders = [FIXTURE], total = orders.length) =>
	({ orders, total, page: 1, per_page: 100 }) satisfies OrderListResponse;

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(over, { 'GET /orders/me?per_page=100': ordersRes() }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('OrdersScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(OrdersScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="orders-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /orders/me?per_page=100': new Error('boom') });
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示訂單(資料來自接縫，非直接 import 的 mock 常數)', async () => {
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('接縫測試專用訂單')).toBeInTheDocument();
		expect(screen.getByText('NT$1,234')).toBeInTheDocument();
		expect(screen.getByText('1 筆報名紀錄')).toBeInTheDocument();
	});

	it('沒有訂單時顯示誠實空狀態，不留白', async () => {
		route({ 'GET /orders/me?per_page=100': ordersRes([]) });
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('目前沒有任何訂單紀錄。')).toBeInTheDocument();
	});

	it('total 57 但只回 20 筆時，標題顯示 57 筆(pin：不是被截斷的 orders.length)', async () => {
		const twenty = Array.from({ length: 20 }, (_, i) => ({ ...FIXTURE, id: `o-${i}`, order_number: `DF-${i}` }));
		route({ 'GET /orders/me?per_page=100': ordersRes(twenty, 57) });
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('57 筆報名紀錄')).toBeInTheDocument();
	});
});
