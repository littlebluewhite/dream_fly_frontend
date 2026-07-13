import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	createOverlay,
	createCart,
	createNotifs,
	cartCount,
	unreadCount,
	notifs,
	notifsHydrated,
	cart,
	placeOrder
} from './stores';
import { NOTIFS_SEED } from './data';
import { submitOrder, type OrderConfirmation } from '$lib/checkout-order';

// C4:placeOrder 委派 submitOrder(見 stores.ts)——mock 掉整個 checkout-order
// 模組,只驗 stores.ts 這層 adapter 有沒有把行動版自己的東西(購物車行對映、
// clearCart 注入)接對,不重新驗 submitOrder 本身的 orchestration(那是
// checkout-order.test.ts 的責任)。
vi.mock('$lib/checkout-order', () => ({
	submitOrder: vi.fn()
}));

describe('createOverlay', () => {
	it('pushes and pops the screen stack', () => {
		const o = createOverlay();
		o.push('courseDetail', { course: { id: 'k1' } });
		expect(get(o).stack).toHaveLength(1);
		expect(get(o).stack[0]).toEqual({ id: 'courseDetail', props: { course: { id: 'k1' } } });
		o.pop();
		expect(get(o).stack).toHaveLength(0);
	});
	it('opens and closes a sheet', () => {
		const o = createOverlay();
		o.sheet('cart');
		expect(get(o).sheet).toEqual({ id: 'cart', props: {} });
		o.closeSheet();
		expect(get(o).sheet).toBe(null);
	});
	it('closeAll clears both the stack and the sheet (used on tab change)', () => {
		const o = createOverlay();
		o.push('schedule');
		o.sheet('leave');
		o.closeAll();
		expect(get(o).stack).toHaveLength(0);
		expect(get(o).sheet).toBe(null);
	});
});

describe('cart', () => {
	const course = { id: 'k1', name: '競技啦啦隊 進階班', price: 4800, spots: 1 };
	it('adds a new course with qty 1', () => {
		const c = createCart();
		c.add(course);
		expect(get(c)).toEqual([{ ...course, qty: 1 }]);
	});
	it('bumps (not increments) qty when the same course is added again — a course is an enrolment, not a quantity', () => {
		const c = createCart();
		expect(c.add(course)).toBe('added');
		expect(c.add(course)).toBe('bumped');
		expect(get(c)).toHaveLength(1);
		expect(get(c)[0].qty).toBe(1);
	});
	it('removes a line and clears the whole cart', () => {
		const c = createCart();
		c.add(course);
		c.add({ id: 'k6', name: '選手班', price: 6200, spots: 4 });
		c.remove('k1');
		expect(get(c)).toHaveLength(1);
		c.clear();
		expect(get(c)).toHaveLength(0);
	});
});

describe('cartCount', () => {
	it('sums the quantities across lines', () => {
		expect(cartCount([{ qty: 2 }, { qty: 3 }])).toBe(5);
		expect(cartCount([])).toBe(0);
	});
});

describe('notifs', () => {
	const seed = [
		{ id: 'n1', read: false },
		{ id: 'n2', read: false },
		{ id: 'n3', read: true }
	];
	it('markRead flips a single notification and lowers the unread count', () => {
		const n = createNotifs(seed);
		expect(unreadCount(get(n))).toBe(2);
		n.markRead('n1');
		expect(get(n).find((x) => x.id === 'n1')?.read).toBe(true);
		expect(unreadCount(get(n))).toBe(1);
	});
	it('markAllRead clears every unread', () => {
		const n = createNotifs(seed);
		n.markAllRead();
		expect(unreadCount(get(n))).toBe(0);
	});
	it('never mutates the caller seed array', () => {
		const n = createNotifs(seed);
		n.markAllRead();
		expect(seed.filter((x) => !x.read)).toHaveLength(2);
	});

	// set() 是水合用的整批覆寫(notifications 頁 load()/refresh() 拿 getNotifications()
	// 的結果寫回 store),不影響 markRead/markAllRead 既有 mutation 行為。
	it('set 整批覆寫內容,供 getNotifications() 水合結果寫回', () => {
		const n = createNotifs(seed);
		const fresh = [{ id: 'n9', read: false }];
		n.set(fresh);
		expect(get(n)).toEqual(fresh);
	});
});

describe('notifs singleton — 同步 seed + 水合守衛(notifications 頁 core risk)', () => {
	// 與 member notifications 前例同型:同步 seed(badge 立即有值),首訪通知頁
	// 時經 getNotifications() 水合覆寫一次,notifsHydrated 守衛防重訪重抓。
	it('起始即帶 NOTIFS_SEED(clone,badge 立即有值),notifsHydrated 起始為 false', () => {
		expect(get(notifs)).toEqual(NOTIFS_SEED);
		// clone 而非共享參照:store 上的 mutation 不得污染 seed 常數。
		expect(get(notifs)[0]).not.toBe(NOTIFS_SEED[0]);
		expect(get(notifsHydrated)).toBe(false);
	});

	// K2-c 協定補完:markRead/markAllRead 先前完全沒有翻旗,mutation 後
	// notifsHydrated 仍是 false,重訪通知頁會被 load-gate 判定「尚未水合」而
	// 整包重抓、覆寫掉這裡剛做的已讀 mutation。包裝函式對齊 member 的
	// markMutated 協定,呼叫共用邏輯後翻旗。
	it('markRead/markAllRead 呼叫共用邏輯後翻 notifsHydrated 為 true', () => {
		notifs.markRead(NOTIFS_SEED[0].id);
		expect(get(notifsHydrated)).toBe(true);

		notifsHydrated.set(false); // 重置守衛,單獨驗證 markAllRead 這條路徑也會翻旗
		notifs.markAllRead();
		expect(get(notifsHydrated)).toBe(true);
	});
});

describe('cart waitlist guard', () => {
	const fullCourse = { id: 'k9', name: '額滿體操班', price: 5000, spots: 0 };
	it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
		const c = createCart();
		const r = c.add(fullCourse);
		expect(r).toBe('waitlisted');
		expect(get(c)).toHaveLength(0); // never enters the paid cart
	});

	it('adds a course that still has spots to the paid cart and returns "added"', () => {
		const c = createCart();
		const r = c.add({ id: 'k1', name: '競技啦啦隊 進階班', price: 4800, spots: 1 });
		expect(r).toBe('added');
		expect(get(c)).toHaveLength(1);
	});

	it('reports "waitlisted" on every add of a full course — no local list to dedup; the caller\'s joinWaitlist() call now owns idempotency via the backend 409 (C8)', () => {
		const c = createCart();
		expect(c.add(fullCourse)).toBe('waitlisted');
		expect(c.add(fullCourse)).toBe('waitlisted');
		expect(get(c)).toHaveLength(0); // still never in the paid cart
	});
});

describe('placeOrder — 委派 submitOrder(mobile adapter,C4 首套單測)', () => {
	// 涵蓋任務簡報步驟 6 的三項斷言:①購物車行(對映成 CartItem)/coupon/usePoints
	// 正確轉發給 submitOrder,且注入的 clearCart 真的操作到 mobile 自己的 cart
	// store;②回傳值即 submitOrder 的 resolve 值(OrderConfirmation 透傳、不重組);
	// ③submitOrder reject 時原樣拋出、購物車不清空。submitOrder 本身的
	// orchestration 由 checkout-order.test.ts 覆蓋,這裡只驗 adapter 這層接線。
	const course = { id: 'p1', name: '基礎體操班', price: 3200, spots: 5, icon: 'dumbbell' };

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
		expect(lines).toEqual([{ id: 'p1', type: 'course', name: '基礎體操班', price: 3200, qty: 1, icon: 'dumbbell' }]);
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
