import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import {
	createOverlay,
	createCart,
	createNotifs,
	cartCount,
	unreadCount,
	notifs,
	notifsHydrated
} from './stores';
import { NOTIFS_SEED } from './data';

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
});

describe('cart waitlist guard', () => {
	const fullCourse = { id: 'k9', name: '額滿體操班', price: 5000, spots: 0 };
	it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
		const c = createCart();
		const r = c.add(fullCourse);
		expect(r).toBe('waitlisted');
		expect(get(c)).toHaveLength(0); // never enters the paid cart
		expect(get(c.waitlist)).toContain('k9'); // registered for waitlist
	});

	it('adds a course that still has spots to the paid cart and returns "added"', () => {
		const c = createCart();
		const r = c.add({ id: 'k1', name: '競技啦啦隊 進階班', price: 4800, spots: 1 });
		expect(r).toBe('added');
		expect(get(c)).toHaveLength(1);
		expect(get(c.waitlist)).toHaveLength(0);
	});

	it('keeps the waitlist idempotent when the same full course is added twice', () => {
		const c = createCart();
		c.add(fullCourse);
		c.add(fullCourse);
		expect(get(c.waitlist)).toEqual(['k9']); // recorded once
		expect(get(c)).toHaveLength(0); // still never in the paid cart
	});
});
