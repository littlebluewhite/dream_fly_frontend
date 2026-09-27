import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { cart, placeOrder } from './stores';
import { type Course } from './data';
import { submitOrder, type OrderConfirmation } from '$lib/checkout-order';
import { cart as libCart } from '$lib/cart';

// K5-a：cart.add() 收窄為 add(course: Course)，本檔案原本多處的鬆散課程物件
// 在 TS strict 下無法編譯——換成回傳完整 Course 的 builder（同
// CartSheet.test.ts、CourseCard.test.ts 既有的 fixture 慣例）。
function courseFixture(overrides: Partial<Course> = {}): Course {
	return {
		id: 'course-uuid-1',
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

// C4:placeOrder 委派 submitOrder(見 stores.ts)——mock 掉整個 checkout-order
// 模組,只驗 stores.ts 這層 adapter 有沒有把行動版自己的東西(購物車行對映、
// clearCart 注入)接對,不重新驗 submitOrder 本身的 orchestration(那是
// checkout-order.test.ts 的責任)。
vi.mock('$lib/checkout-order', () => ({
	submitOrder: vi.fn()
}));
// 通知段(唯一會打 $lib/api/client 的一段)自 R12 起是 member 通知 module 的轉出
// (測試在 $lib/member/notifications.test.ts),本檔不需要 api mock。

// createOverlay 的直接單元測試已搬到 $lib/components/mobile/overlay.test.ts
// (Task 1(1.5)：ADR-0010「死值不留死出口」——mobile/stores.ts 的 createOverlay
// 轉出已退役，overlay singleton 本身直接 import 自 $lib/components/mobile/overlay)。

describe('mobile seam 收窄接線(C2：factory 上移 $lib/cart 後，mobile cart 收斂為 subscribe/add/remove/clear 四個成員)', () => {
	// 工廠本體的 dedup/qty 鎖/waitlist guard 語意已由 lib/cart.test.ts 覆蓋——這裡
	// 只驗 mobile 這層 adapter 的接線本身有沒有接對：icon 覆寫、委派到工廠、與
	// $lib/cart 的持久化單例互不干擾。
	beforeEach(() => {
		localStorage.clear();
		cart.clear();
		libCart.clear();
	});

	// K5-a 前例延續：courseToCartItem 對 CatalogCourse 消費端給的是硬編預設 icon
	// ('sparkles')，add() 必須用課程自帶的 icon（來自 api.ts 的 CATEGORY_ICON 薄
	// 映射，如「競技體操」→'medal'）覆寫掉它，購物車行才不會全部顯示同一個 icon。
	// fixture 刻意選 'medal'（≠ courseToCartItem 的預設 'sparkles'），避免巧合撞
	// 值造成假陽性。
	it('add() 保留課程自帶 icon，不被 courseToCartItem 的預設 icon(sparkles)蓋掉——icon 覆寫語意釘', () => {
		const medalCourse = courseFixture({ id: 'k-medal', cat: '競技體操', icon: 'medal' });
		cart.add(medalCourse);
		expect(get(cart)[0].icon).toBe('medal');
	});

	it('add() 委派 $lib/cart 工廠：額滿課回 waitlisted、重複加入同一課程回 bumped（delegation smoke）', () => {
		const full = courseFixture({ id: 'k-full', name: '額滿體操班', price: 5000, spots: 0 });
		expect(cart.add(full)).toBe('waitlisted');
		expect(get(cart)).toHaveLength(0); // never enters the paid cart

		const normal = courseFixture({ id: 'k-normal', name: '競技啦啦隊 進階班', price: 4800, spots: 3 });
		expect(cart.add(normal)).toBe('added');
		expect(cart.add(normal)).toBe('bumped');
		expect(get(cart)).toHaveLength(1);
	});

	// 實例分離釘：mobile 的 cart 只是拿了一個無 persist 的工廠實例，不是 $lib/cart
	// 那個 persist:true 的 app-wide 單例本身——兩邊必須是完全獨立的 store，加進一邊
	// 不會出現在另一邊。
	it('mobile cart 與 $lib/cart 持久化單例是兩個獨立實例——加進一邊不會出現在另一邊', () => {
		cart.add(courseFixture({ id: 'k-mobile-only', spots: 3 }));
		expect(get(libCart).some((x) => x.id === 'k-mobile-only')).toBe(false);

		libCart.addItem({ id: 'k-lib-only', type: 'course', name: '共用工廠課程', price: 100, icon: 'sparkles', spots: 3 });
		expect(get(cart).some((x) => x.id === 'k-lib-only')).toBe(false);
	});
});

describe('placeOrder — 委派 submitOrder(mobile adapter,C4 首套單測)', () => {
	// 涵蓋任務簡報步驟 6 的三項斷言:①購物車行(對映成 CartItem)/coupon/usePoints
	// 正確轉發給 submitOrder,且注入的 clearCart 真的操作到 mobile 自己的 cart
	// store;②回傳值即 submitOrder 的 resolve 值(OrderConfirmation 透傳、不重組);
	// ③submitOrder reject 時原樣拋出、購物車不清空。submitOrder 本身的
	// orchestration 由 checkout-order.test.ts 覆蓋,這裡只驗 adapter 這層接線。
	const course = courseFixture({ id: 'p1', name: '基礎體操班', price: 3200, spots: 5, icon: 'dumbbell' });

	beforeEach(() => {
		cart.clear();
		vi.mocked(submitOrder).mockReset();
	});

	it('把購物車行、coupon、usePoints、idempotencyKey 傳給 submitOrder;注入的 clearCart 真的清空 mobile 購物車', async () => {
		cart.add(course);
		const confirmation = {
			total: 3200,
			earned: 32,
			ptRedeem: 0,
			orderNumber: 'DF-TEST-0001',
			hasCourse: true,
			hasPass: false,
			raw: {}
		} as unknown as OrderConfirmation;
		let injectedClearCart: (() => void) | undefined;
		vi.mocked(submitOrder).mockImplementation(async (_lines, opts) => {
			injectedClearCart = opts.clearCart;
			return confirmation;
		});

		await placeOrder('DREAMFLY100', true, 'key-1');

		expect(submitOrder).toHaveBeenCalledTimes(1);
		const [lines, opts] = vi.mocked(submitOrder).mock.calls[0];
		// K5-b/C6：toOrderItem 投影 adapter 已刪;placeOrder 現在把 get(cart) 經
		// chargeableLines(get(cart), get(subscriptions)) 傳出——course-only 購物車
		// 加上恆空的 subscriptions，過濾恆 no-op，lines 仍是購物車行本身(CartItem
		// 全欄)、不是窄化過的 6 欄投影，故以下斷言不變。
		expect(lines).toEqual([
			{
				id: 'p1',
				type: 'course',
				name: '基礎體操班',
				price: 3200,
				qty: 1,
				icon: 'dumbbell',
				spots: course.spots,
				desc: course.desc,
				level: course.level,
				cat: course.cat,
				days: course.days
			}
		]);
		expect(opts.coupon).toBe('DREAMFLY100');
		expect(opts.usePoints).toBe(true);
		expect(opts.idempotencyKey).toBe('key-1');
		// mobile 不做付款方式選擇 UI(Round 4 P4-F4 計畫裁決)——一律帶預設 credit_card。
		expect(opts.paymentMethod).toBe('credit_card');

		// submitOrder 本身才會在內部 settle 後呼叫 clearCart——這裡先確認購物車
		// 尚未被動到,再手動觸發注入的 callback,驗證它真的操作到 mobile 的
		// cart store(不是空殼參數)。
		expect(get(cart)).toHaveLength(1);
		injectedClearCart?.();
		expect(get(cart)).toHaveLength(0);
	});

	it('回傳值直接透傳 submitOrder 的 resolve 值(OrderConfirmation,不重組)', async () => {
		cart.add(course);
		const confirmation = {
			total: 4800,
			earned: 48,
			ptRedeem: 100,
			orderNumber: 'DF-TEST-0002',
			hasCourse: true,
			hasPass: false,
			raw: {}
		} as unknown as OrderConfirmation;
		vi.mocked(submitOrder).mockResolvedValue(confirmation);

		const result = await placeOrder('', false, 'key-2');

		expect(result).toBe(confirmation);
	});

	it('submitOrder reject 時原樣拋出,購物車不清空', async () => {
		cart.add(course);
		const err = new Error('course is full');
		vi.mocked(submitOrder).mockRejectedValue(err);

		await expect(placeOrder('', false, 'key-3')).rejects.toBe(err);

		expect(get(cart)).toHaveLength(1); // adapter 沒有自己的 try/catch,失敗原樣拋出、不會動購物車
	});
});
