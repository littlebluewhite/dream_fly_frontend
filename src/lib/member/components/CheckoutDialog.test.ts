import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import CheckoutDialog from './CheckoutDialog.svelte';
import { cart, subscriptions, points, pointsLedger, checkoutOpen, toasts } from '$lib/member/stores';
import { POINTS_LEDGER, ME } from '$lib/member/data';
import { passToCartItem } from '$lib/cart-item';
import { fmtNT } from '$lib/member/format';
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
	icon: 'sparkles' as const,
	days: '週二 / 週四 19:00'
};

beforeEach(() => {
	localStorage.clear();
	cart.clear();
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
 *  釘住，這裡只需要讓 confirmPay 的成功路徑跑得完整。
 *
 *  有狀態：subsAfter/pointsAfter 是「下單後」的世界 —— dialog 開啟時的水合
 *  （下單前）回傳「未持有／餘額 0」，POST /orders 之後才回傳購買後狀態，忠實
 *  模擬後端（否則開啟即水合會把『這次要買的 pass』誤判成已持有而擋下付款）。 */
function mockOrdersApi(order: Record<string, unknown>, subsAfter: unknown[] = [], pointsAfter = 0) {
	let ordered = false;
	vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		if (path === '/orders' && method === 'POST') {
			ordered = true;
			return order;
		}
		if (path === '/subscriptions/me') return ordered ? subsAfter : [];
		if (path === '/points/me') return { balance: ordered ? pointsAfter : 0, ledger: [] };
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

	it('a course line shows days and renders NO qty stepper — courses are enrolments locked at qty 1', () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		const { container, queryByLabelText } = render(CheckoutDialog);

		expect(container.textContent).toContain('週二 / 週四 19:00');
		// 課程數量恆為 1（同步/DB 都夾 1）——顯示 3× 預覽卻請款 1× 是同意漂移，
		// 所以 stepper 對課程也不再渲染。
		expect(queryByLabelText('加量')).toBeNull();
		expect(queryByLabelText('減量')).toBeNull();
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

describe('CheckoutDialog — 付款飛行中的關閉/重開競態（Idempotency-Key 防線）', () => {
	it('付款中 Escape 關不掉；外部關閉再重開不重置 in-flight 狀態，全程只發一張 POST /orders', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		// POST /orders 停在飛行中（held promise），由測試手動 resolve。
		let resolveOrder!: (v: unknown) => void;
		vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
			const method = (init.method ?? 'GET').toString().toUpperCase();
			if (path === '/orders' && method === 'POST') return new Promise((r) => (resolveOrder = r));
			if (path === '/subscriptions/me') return [];
			if (path === '/points/me') return { balance: 0, ledger: [] };
			return undefined; // DELETE /cart、POST /cart/items
		});
		const { getByText } = render(CheckoutDialog);

		await fireEvent.click(getByText('前往付款'));
		await fireEvent.click(getByText('確認付款'));
		// 等 POST /orders 真的發出（前面還有 DELETE /cart、POST /cart/items 的 await）。
		await vi.waitFor(() => {
			const calls = vi.mocked(api).mock.calls.filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
			expect(calls).toHaveLength(1);
		});

		// (a) 付款飛行中 Escape / close() 不允許關閉。
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(get(checkoutOpen)).toBe(true);

		// (b) 外部直接翻 store 強制關閉再重開（不經 close()）——重開不得重置
		//     paying / idempotencyKey：按鈕仍是「處理中…」，再點也不會發第二張單。
		checkoutOpen.set(false);
		await tick();
		checkoutOpen.set(true);
		await tick();
		const btn = getByText('處理中…'); // in-flight 狀態存活重開
		await fireEvent.click(btn);

		// (c) 第一張單 resolve 後：完成步驟顯示，全程恰好一張 POST /orders。
		resolveOrder({
			id: 'order-9', order_number: 'DF-0009', status: 'paid',
			total_cents: 480000, discount_cents: 0, coupon_code: null,
			points_used: 0, points_earned: 240, paid_at: '2026-06-22T00:00:00Z', created_at: '2026-06-22T00:00:00Z',
			items: [{ id: 'oi-9', item_type: 'course', product_id: null, course_id: COURSE.id, quantity: 1, unit_price_cents: 480000 }]
		});
		await vi.waitFor(() => expect(getByText('報名完成！')).toBeInTheDocument());

		const orderCalls = vi
			.mocked(api)
			.mock.calls.filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
		expect(orderCalls).toHaveLength(1);
	});
});

describe('CheckoutDialog — 開啟時水合已持有訂閱（GET /subscriptions/me）', () => {
	it('server 端已持有、本地沒有的 pass：開啟後被 chargeableLines 跳過，合計為 0', async () => {
		cart.addItem(PASS);
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/subscriptions/me') {
				return [{
					id: 'sub-1', product_id: PASS.id, product_name: PASS.name, status: 'active',
					started_at: '2026-06-01T00:00:00Z', expires_at: null,
					total_sessions: null, remaining_sessions: null, price_cents: 450000
				}];
			}
			return undefined;
		});
		expect(get(subscriptions)).toHaveLength(0); // 本地一開始不知道持有
		checkoutOpen.set(true);
		const { container } = render(CheckoutDialog);

		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledWith('/subscriptions/me');
			expect(get(subscriptions)).toHaveLength(1);
		});
		expect(get(subscriptions)[0].id).toBe(PASS.id);
		// 已持有 pass 被預覽跳過 → 合計 NT$0（頁面上該 pass 的單行金額仍顯示，但不計費）。
		await vi.waitFor(() => expect(container.querySelector('.total-n')?.textContent).toBe(fmtNT(0)));
	});
});

describe('CheckoutDialog — 開啟時水合點數餘額（GET /points/me）', () => {
	it('點數折抵預覽用 API 餘額，不用本地 mock 殘值（可用 300 點，非 1,250）', async () => {
		cart.addItem(COURSE);
		// beforeEach 已把本地 points 設成 mock 殘值 ME.points=1250；開啟後必須被
		// API 的真實餘額（300）蓋掉，否則折抵預覽是照虛構餘額算的。
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/points/me') return { balance: 300, ledger: [] };
			if (path === '/subscriptions/me') return [];
			return undefined;
		});
		checkoutOpen.set(true);
		const { container } = render(CheckoutDialog);

		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledWith('/points/me');
			expect(get(points)).toBe(300);
		});
		expect(container.textContent).toContain('可用 300 點');
		expect(container.textContent).not.toContain('1,250');
	});
});

describe('CheckoutDialog — 全數已持有（chargeable 為空）不可送單', () => {
	it('確認付款 disabled、顯示提示，點了也不發 POST /orders', async () => {
		subscriptions.set([{ id: PASS.id, name: PASS.name, since: '2026-06-01', price: 4500 }]);
		cart.addItem(PASS);
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/subscriptions/me') {
				return [{
					id: 'sub-1', product_id: PASS.id, product_name: PASS.name, status: 'active',
					started_at: '2026-06-01T00:00:00Z', expires_at: null,
					total_sessions: null, remaining_sessions: null, price_cents: 450000
				}];
			}
			if (path === '/points/me') return { balance: 0, ledger: [] };
			return undefined;
		});
		checkoutOpen.set(true);
		const { getByText } = render(CheckoutDialog);

		await fireEvent.click(getByText('前往付款')); // 車內仍有 1 行（已持有）→ 可進付款步驟
		const btn = getByText('確認付款').closest('button')!;
		expect(btn).toBeDisabled(); // 沒有可計費項目 → 不可送單（避免 POST 出空訂單吃 400）
		expect(getByText(/皆已持有/)).toBeInTheDocument(); // 說明為何不用付款
		await fireEvent.click(btn);

		const orderCalls = vi
			.mocked(api)
			.mock.calls.filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
		expect(orderCalls).toHaveLength(0);
	});
});

describe('CheckoutDialog — 付款方式（payment_method）單選（Round 4 Task P4-F4）', () => {
	it('不動單選（預設 credit_card）→ POST /orders body 帶 payment_method: credit_card', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		mockOrdersApi({
			id: 'order-pm-1', order_number: 'DF-PM1', status: 'paid',
			total_cents: 480000, discount_cents: 0, coupon_code: null,
			points_used: 0, points_earned: 240, paid_at: '2026-06-22T00:00:00Z', created_at: '2026-06-22T00:00:00Z',
			items: [{ id: 'oi-1', item_type: 'course', product_id: null, course_id: COURSE.id, quantity: 1, unit_price_cents: 480000 }]
		});
		const { getByText } = render(CheckoutDialog);

		await payThrough(getByText);

		const orderCall = vi.mocked(api).mock.calls.find(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
		const body = JSON.parse((orderCall?.[1] as RequestInit).body as string);
		expect(body).toMatchObject({ payment_method: 'credit_card' });
	});

	it('選 LINE Pay → POST /orders body 帶 payment_method: line_pay', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		mockOrdersApi({
			id: 'order-pm-2', order_number: 'DF-PM2', status: 'paid',
			total_cents: 480000, discount_cents: 0, coupon_code: null,
			points_used: 0, points_earned: 240, paid_at: '2026-06-22T00:00:00Z', created_at: '2026-06-22T00:00:00Z',
			items: [{ id: 'oi-1', item_type: 'course', product_id: null, course_id: COURSE.id, quantity: 1, unit_price_cents: 480000 }]
		});
		const { getByText, getByLabelText } = render(CheckoutDialog);

		await fireEvent.click(getByText('前往付款'));
		await fireEvent.click(getByLabelText('LINE Pay'));
		await fireEvent.click(getByText('確認付款'));

		await vi.waitFor(() => {
			const calls = vi.mocked(api).mock.calls.filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
			expect(calls).toHaveLength(1);
		});
		const orderCall = vi.mocked(api).mock.calls.find(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
		const body = JSON.parse((orderCall?.[1] as RequestInit).body as string);
		expect(body).toMatchObject({ payment_method: 'line_pay' });
	});

	it('重新開啟 dialog（關閉重開）→ 單選重置回預設 credit_card', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		const { getByText, getByLabelText } = render(CheckoutDialog);

		await fireEvent.click(getByText('前往付款'));
		await fireEvent.click(getByLabelText('現場付款'));
		checkoutOpen.set(false);
		await tick();
		checkoutOpen.set(true);
		await tick();
		await fireEvent.click(getByText('前往付款'));

		expect((getByLabelText('信用卡') as HTMLInputElement).checked).toBe(true);
		expect((getByLabelText('現場付款') as HTMLInputElement).checked).toBe(false);
	});
});
