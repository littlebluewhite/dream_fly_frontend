/* Dream Fly — 桌面 admin 頁共用 wire fixture(W-8)。
 *
 * 照 ops-routes.ts / coach-routes.ts 的寫法：routes/admin/* 頁面測試 mock
 * $lib/api/client 的 api()，以 fakeRouter(overrides, ADMIN_ROUTES) 讓 $lib/admin/api
 * 的真 getter 走真實 mapper。OPS_ROUTES 已交代 users/courses/coaches/orders 第 1 頁；
 * 這裡補上 admin 其餘頁面的讀取端點，fixture 一律由 wire-fixtures builders 組出。
 * 各測試只覆寫自己關心的路徑(寫入端點一律由測試自己交代)。 */
import { vi } from 'vitest';
import { api } from '$lib/api/client';
import { OPS_ROUTES } from './ops-routes';
import {
	activityItem,
	adminReportResponse,
	couponResponse,
	productResponse,
	settingsResponse,
	todaySession,
	venueResponse
} from './wire-fixtures';

export const ADMIN_ROUTES: Record<string, unknown> = {
	...OPS_ROUTES,
	'GET /venues': [venueResponse()],
	'GET /products?page=1': { products: [productResponse()], total: 1, page: 1, per_page: 20 },
	'GET /coupons?page=1': { coupons: [couponResponse()], total: 1, page: 1, per_page: 20 },
	'GET /settings': settingsResponse(),
	'GET /reports/admin': adminReportResponse(),
	'GET /reports/admin/activity': { items: [activityItem()] },
	'GET /sessions/today': [todaySession()]
};

const keyOf = (path: string, init?: RequestInit) => `${(init?.method ?? 'GET').toUpperCase()} ${path}`;

/** 打到 "METHOD path" 的每次呼叫的 RequestInit(依呼叫順序)。須搭配
 *  vi.mock('$lib/api/client') 把 api 換成 vi.fn()。 */
export const apiCalls = (key: string): RequestInit[] =>
	vi
		.mocked(api)
		.mock.calls.filter(([path, init]) => keyOf(path, init) === key)
		.map(([, init]) => init ?? {});

/** 第 n 次(預設第一次)打到 "METHOD path" 的 JSON body。 */
export const apiBody = (key: string, n = 0): unknown => {
	const init = apiCalls(key)[n];
	if (!init) throw new Error(`no api call #${n} to ${key}`);
	return JSON.parse(init.body as string);
};
