import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { cart } from './stores';
import { type Course } from './data';
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

// C4/Task 9(架構深化 R15·F-5)：placeOrder 已退役，checkout 單例委派
// $lib/member/checkout-sync 的 createCheckout（單測見 checkout-sync.test.ts）——
// 本檔不再需要 mock $lib/checkout-order。通知段(唯一會打 $lib/api/client 的一段)
// 自 R12 起是 member 通知 module 的轉出(測試在 $lib/member/notifications.test.ts)，
// 本檔不需要 api mock。

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
	// ('sparkles')，add() 必須用課程自帶的 icon（來自 domain/course-category.ts 的
	// courseCategoryIcon，如「競技體操」→'medal'）覆寫掉它，購物車行才不會全部顯示同一個 icon。
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
