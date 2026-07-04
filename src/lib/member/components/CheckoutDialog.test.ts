import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CheckoutDialog from './CheckoutDialog.svelte';
import { cart, subscriptions, points, pointsLedger, checkoutOpen, toasts } from '$lib/member/stores';
import { passToCartItem, POINTS_LEDGER, ME } from '$lib/member/data';
import { api, ApiError } from '$lib/api/client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
// 只替換 api()，ApiError 用回真實類別（confirmPay 的 orderErrorMessage 靠
// instanceof 判斷）。confirmPay 現在打真實 POST /orders 等端點，每個測試按情境
// 個別設定回應。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// A marketing pass fixture (the /tickets page's public Ticket shape) routed
// through the adapter.
const PASS = passToCartItem({
	id: 'product-uuid-3',
	name: '競技啦啦隊月費',
	price: 4500,
	desc: '專業競技啦啦隊訓練',
	features: ['每週兩堂90分鐘訓練', '比賽代表隊選拔資格']
});

// A course cart-item line shape (carries days; cart v3 dropped the coach field).
const COURSE = {
	id: 'course-uuid-3',
	type: 'course' as const,
	name: '競技啦啦隊 進階班',
	price: 4800,
	icon: 'sparkles',
	days: '週二 / 週四 19:00'
};

beforeEach(() => {
	localStorage.clear();
	cart.clear();
	cart.waitlist.set([]);
	subscriptions.set([]);
	points.set(ME.points);
	pointsLedger.set(POINTS_LEDGER.map((e) => ({ ...e })));
	checkoutOpen.set(false);
	vi.mocked(api).mockReset();
});

/** Drive the dialog from the cart step through payment confirmation. */
async function payThrough(getByText: (t: string) => HTMLElement) {
	await fireEvent.click(getByText('前往付款')); // step 0 → 1
	await fireEvent.click(getByText('確認付款')); // confirmPay(), step 1 → 2
}

/** confirmPay 打的真實序列（DELETE /cart → POST /cart/items ×N → POST /orders
 *  → GET /subscriptions/me → GET /points/me）一次配好回應。DELETE/POST cart
 *  端點回 undefined（204/成功 upsert），呼叫序列本身已由 checkout-api.test.ts
 *  釘住，這裡只需要讓 confirmPay 的成功路徑跑得完整。 */
function mockOrdersApi(order: Record<string, unknown>, subsAfter: unknown[] = [], pointsAfter = 0) {
	vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		if (path === '/orders' && method === 'POST') return order;
		if (path === '/subscriptions/me') return subsAfter;
		if (path === '/points/me') return { balance: pointsAfter };
		return undefined; // DELETE /cart、POST /cart/items
	});
}

describe('CheckoutDialog — pure-pass checkout creates a Subscription (使用權)', () => {
	it('appends a Subscription for the pass and shows 訂閱/使用權 copy, never 日程', async () => {
		cart.addItem(PASS);
		checkoutOpen.set(true);
		mockOrdersApi(
			{
				id: 'order-1', order_number: 'DF-0001', status: 'paid',
				total_cents: 450000, discount_cents: 0, coupon_code: null,
				points_used: 0, points_earned: 225, paid_at: '2026-06-22T00:00:00Z', created_at: '2026-06-22T00:00:00Z',
				items: [{ id: 'oi-1', item_type: 'product', product_id: PASS.id, course_id: null, quantity: 1, unit_price_cents: 450000 }]
			},
			[{ id: 'sub-1', product_id: PASS.id, product_name: PASS.name, status: 'active', started_at: '2026-06-22T00:00:00Z', expires_at: null, total_sessions: null, remaining_sessions: null, price_cents: 450000 }],
			ME.points + 225
		);
		const { getByText, container } = render(CheckoutDialog);

		await payThrough(getByText);
		await vi.waitFor(() => expect(container.textContent).toContain('訂閱'));

		// A Subscription was hydrated from GET /subscriptions/me, keyed by product id.
		const subs = get(subscriptions);
		expect(subs).toHaveLength(1);
		expect(subs[0].id).toBe(PASS.id);
		expect(subs[0].name).toBe('競技啦啦隊月費');
		expect(subs[0].price).toBe(4500);
		expect(typeof subs[0].since).toBe('string');
		expect(subs[0].since.length).toBeGreaterThan(0);

		// Pure-pass success copy talks 訂閱/使用權, NOT 報名 or 加入日程.
		expect(container.textContent).not.toContain('日程');
		expect(container.textContent).not.toContain('報名');
		// Real order_number is surfaced in the success copy.
		expect(container.textContent).toContain('DF-0001');

		// The completion toast also branches to 訂閱 language.
		const tones = get(toasts);
		expect(tones.some((t) => t.title.includes('訂閱'))).toBe(true);
		expect(tones.some((t) => t.body.includes('日程'))).toBe(false);

		// Pass still earns points (5% of 4500 = 225) — hydrated from GET /points/me.
		expect(get(points)).toBe(ME.points + 225);
	});
});

describe('CheckoutDialog — course checkout stays a mock (points only, 報名 copy)', () => {
	it('rewards points, writes no Subscription, and shows 報名 copy', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		mockOrdersApi(
			{
				id: 'order-2', order_number: 'DF-0002', status: 'paid',
				total_cents: 480000, discount_cents: 0, coupon_code: null,
				points_used: 0, points_earned: 240, paid_at: '2026-06-22T00:00:00Z', created_at: '2026-06-22T00:00:00Z',
				items: [{ id: 'oi-2', item_type: 'course', product_id: null, course_id: COURSE.id, quantity: 1, unit_price_cents: 480000 }]
			},
			[],
			ME.points + 240
		);
		const { getByText, container } = render(CheckoutDialog);

		await payThrough(getByText);
		await vi.waitFor(() => expect(container.textContent).toContain('報名'));

		// No entitlement is created for a course.
		expect(get(subscriptions)).toHaveLength(0);
		// Real order_number is surfaced in the success copy.
		expect(container.textContent).toContain('DF-0002');
		// Points rewarded (5% of 4800 = 240) — hydrated from GET /points/me.
		expect(get(points)).toBe(ME.points + 240);
	});
});

describe('CheckoutDialog — per-line display branches by type', () => {
	it('a pass line shows its desc and hides the qty stepper', () => {
		cart.addItem(PASS);
		checkoutOpen.set(true);
		const { container, queryByLabelText } = render(CheckoutDialog);

		// desc shown for a pass (no days to render)
		expect(container.textContent).toContain('專業競技啦啦隊訓練');
		// qty steppers are hidden for a single-entitlement pass
		expect(queryByLabelText('加量')).toBeNull();
		expect(queryByLabelText('減量')).toBeNull();
	});

	it('a course line shows days and keeps the qty stepper', () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		const { container, queryByLabelText } = render(CheckoutDialog);

		expect(container.textContent).toContain('週二 / 週四 19:00');
		expect(queryByLabelText('加量')).not.toBeNull();
	});
});

describe('CheckoutDialog — 優惠碼驗證（GET /coupons/{code}/validate）', () => {
	it('404（查無優惠碼）→ 顯示「優惠碼無效」', async () => {
		cart.addItem(PASS);
		checkoutOpen.set(true);
		vi.mocked(api).mockRejectedValue(new ApiError(404, 'coupon not found'));
		const { getByPlaceholderText, getByText } = render(CheckoutDialog);

		await fireEvent.input(getByPlaceholderText('輸入優惠碼（如 DREAMFLY100）'), { target: { value: 'NOPE' } });
		await fireEvent.click(getByText('套用'));

		await vi.waitFor(() => expect(getByText(/優惠碼無效/)).toBeInTheDocument());
	});
});

describe('CheckoutDialog — 結帳失敗（POST /orders 409 滿班）不清空購物車', () => {
	it('顯示錯誤 toast，本地購物車不清空，不會跳到完成步驟', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
			const method = (init.method ?? 'GET').toString().toUpperCase();
			if (path === '/orders' && method === 'POST') throw new ApiError(409, 'course is full');
			return undefined; // DELETE /cart、POST /cart/items
		});
		const { getByText, queryByText } = render(CheckoutDialog);

		await payThrough(getByText);

		await vi.waitFor(() => {
			const tones = get(toasts);
			expect(tones.some((t) => t.tone === 'error' && t.body.includes('額滿'))).toBe(true);
		});
		expect(get(cart)).toHaveLength(1); // 未清空
		expect(queryByText('報名完成！')).toBeNull(); // 沒有跳到完成步驟
	});
});
