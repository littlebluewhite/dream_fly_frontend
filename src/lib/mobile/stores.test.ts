import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import {
	createOverlay,
	createCart,
	createNotifs,
	cartCount,
	unreadCount,
	notifs,
	notifsHydrated,
	cart,
	placeOrder,
	prefs,
	PREFS_DEFAULT
} from './stores';
import { NOTIFS_SEED, type Course, type NotifItem } from './data';
import { submitOrder, type OrderConfirmation } from '$lib/checkout-order';

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
// W1:notifs.markRead/markAllRead 現在會送 PATCH 落庫(見 stores.ts)——只替換
// $lib/api/client 的 api(),spread 保留 ApiError 等其餘 export(同
// member/notifications.test.ts 既有慣例)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

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
	const course = courseFixture({ id: 'k1', name: '競技啦啦隊 進階班', price: 4800, spots: 1 });
	it('adds a new course with qty 1', () => {
		const c = createCart();
		c.add(course);
		expect(get(c)).toHaveLength(1);
		// K5：購物車行收斂為 CartItem（單源於 courseToCartItem），不再是原課程
		// 物件的原樣 spread——只斷言關鍵欄位透傳 + qty 鎖 1，不重建整個 CartItem
		// 形狀（那是 cart-item.test.ts 的責任）。
		expect(get(c)[0]).toMatchObject({ id: course.id, type: 'course', name: course.name, price: course.price, qty: 1 });
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
		c.add(courseFixture({ id: 'k6', name: '選手班', price: 6200, spots: 4 }));
		c.remove('k1');
		expect(get(c)).toHaveLength(1);
		c.clear();
		expect(get(c)).toHaveLength(0);
	});
	// K5-a 新增：icon 覆寫語意釘——courseToCartItem 對 CatalogCourse 消費端給的
	// 是硬編預設 icon('sparkles')，add() 必須用課程自帶的 icon（來自 api.ts 的
	// CATEGORY_ICON 薄映射，如「競技體操」→'medal'）覆寫掉它，購物車行才不會
	// 全部顯示同一個 icon。fixture 刻意選 'medal'（≠ courseToCartItem 的預設
	// 'sparkles'），避免巧合撞值造成假陽性。
	it('add() 保留課程自帶 icon，不被 courseToCartItem 的預設 icon(sparkles)蓋掉——icon 覆寫語意釘', () => {
		const c = createCart();
		const medalCourse = courseFixture({ id: 'k-medal', cat: '競技體操', icon: 'medal' });
		c.add(medalCourse);
		expect(get(c)[0].icon).toBe('medal');
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
	// markMutated 協定,呼叫共用邏輯後翻旗。除了旗標也斷言 read 真的被改寫
	// ——wrapper 若忘了委派共用邏輯,這裡會紅(上面 describe('notifs') 測的是
	// createNotifs 獨立 instance,蓋不到 export 出去的這顆 singleton wrapper)。
	it('markRead/markAllRead 委派共用邏輯改寫 read,並翻 notifsHydrated 為 true', () => {
		// 直接 seed singleton 已知 fixture,不依賴檔內其他測試的執行順序。
		notifs.set([
			{ id: 'w1', cat: 'class', icon: 'bell', tone: 'info', title: '甲', body: '乙', time: '剛才', read: false },
			{ id: 'w2', cat: 'system', icon: 'bell', tone: 'info', title: '丙', body: '丁', time: '剛才', read: false }
		]);
		notifsHydrated.set(false);

		notifs.markRead('w1');
		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(get(notifsHydrated)).toBe(true);

		notifsHydrated.set(false); // 重置守衛,單獨驗證 markAllRead 這條路徑也會翻旗
		notifs.markAllRead();
		expect(get(notifs).every((n) => n.read)).toBe(true);
		expect(get(notifsHydrated)).toBe(true);
	});
});

describe('notifs singleton — 已讀落庫(W1:PATCH /notifications/{id}/read)', () => {
	// 與 $lib/member/notifications.ts 的 markRead/markAllRead 行為同構(PATCH 端點、
	// 樂觀更新失敗不還原、allSettled 併發送出、全部成功回 'ok' 否則 'partial' 四點
	// 對齊),結構刻意不同——member 走 gate.markMutated + notifications.update,這裡
	// 走 notifsBase + notifsHydrated 這顆 plain flag(見 stores.ts 的 notifs 宣告)。
	const seed: NotifItem[] = [
		{ id: 'w1', cat: 'class', icon: 'bell', tone: 'info', title: '甲', body: '乙', time: '剛才', read: false },
		{ id: 'w2', cat: 'system', icon: 'bell', tone: 'info', title: '丙', body: '丁', time: '剛才', read: false },
		{ id: 'w3', cat: 'system', icon: 'bell', tone: 'info', title: '戊', body: '己', time: '剛才', read: true }
	];

	beforeEach(() => {
		vi.mocked(api).mockReset();
		vi.mocked(api).mockResolvedValue(undefined);
		notifs.set(seed.map((n) => ({ ...n })));
		notifsHydrated.set(false);
	});

	it('markRead 樂觀更新後送 PATCH /notifications/{id}/read 落庫，並翻 notifsHydrated', async () => {
		await notifs.markRead('w1');

		expect(api).toHaveBeenCalledWith('/notifications/w1/read', { method: 'PATCH' });
		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(get(notifsHydrated)).toBe(true);
	});

	it('markRead 的 PATCH 失敗只記錄錯誤，樂觀更新的已讀狀態不還原', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockRejectedValue(new Error('network error'));

		await notifs.markRead('w1');

		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(console.error).toHaveBeenCalledWith('Failed to mark notification as read:', expect.any(Error));
	});

	it("markAllRead 只對未讀各發一次 PATCH(已讀的 w3 不重發)，全部成功回 'ok'", async () => {
		const result = await notifs.markAllRead();

		expect(result).toBe('ok');
		const patchCalls = vi.mocked(api).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH');
		const patchPaths = patchCalls.map(([path]) => path).sort();
		expect(patchPaths).toEqual(['/notifications/w1/read', '/notifications/w2/read']);
		expect(patchPaths).not.toContain('/notifications/w3/read'); // w3 已讀，不重發
	});

	it("markAllRead 任一 PATCH 失敗回 'partial'，本地已讀狀態不還原", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/notifications/w2/read') throw new Error('network error');
			return undefined;
		});

		const result = await notifs.markAllRead();

		expect(result).toBe('partial');
		expect(get(notifs).every((n) => n.read)).toBe(true);
	});

	it("無未讀時零 PATCH 仍回 'ok'——unreadIds 必須在 notifsBase.markAllRead() 前捕捉，不是事後從已被翻成全已讀的 store 反查", async () => {
		notifs.set(seed.map((n) => ({ ...n, read: true })));

		const result = await notifs.markAllRead();

		expect(api).not.toHaveBeenCalled();
		expect(result).toBe('ok');
	});
});

describe('cart waitlist guard', () => {
	const fullCourse = courseFixture({ id: 'k9', name: '額滿體操班', price: 5000, spots: 0 });
	it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
		const c = createCart();
		const r = c.add(fullCourse);
		expect(r).toBe('waitlisted');
		expect(get(c)).toHaveLength(0); // never enters the paid cart
	});

	it('adds a course that still has spots to the paid cart and returns "added"', () => {
		const c = createCart();
		const r = c.add(courseFixture({ id: 'k1', name: '競技啦啦隊 進階班', price: 4800, spots: 1 }));
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
		// K5-b：toOrderItem 投影 adapter 已刪，placeOrder 直傳 get(cart)——lines
		// 現在是購物車行本身(CartItem 全欄)，不再是窄化過的 6 欄投影。
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

describe('prefs', () => {
	// W3:PREFS_DEFAULT 單源改宣告在 stores.ts(api.ts 的 getPreferences fallback
	// 改 import 這裡的常數,不再各自硬編一份字面)。prefs store 的初始值必須是
	// PREFS_DEFAULT 的 spread 拷貝,不是同一參照——否則 store 之後的突變會污染
	// 這顆共用常數。
	it('初始值等於 PREFS_DEFAULT，但非同一參照(spread 隔離)', () => {
		expect(get(prefs)).toEqual(PREFS_DEFAULT);
		expect(get(prefs)).not.toBe(PREFS_DEFAULT);
	});
});
