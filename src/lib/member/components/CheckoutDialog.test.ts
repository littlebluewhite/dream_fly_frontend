import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CheckoutDialog from './CheckoutDialog.svelte';
import { cart, subscriptions, points, pointsLedger, checkoutOpen, toasts } from '$lib/member/stores';
import { passToCartItem, POINTS_LEDGER, ME } from '$lib/member/data';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

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
});

/** Drive the dialog from the cart step through payment confirmation. */
async function payThrough(getByText: (t: string) => HTMLElement) {
	await fireEvent.click(getByText('前往付款')); // step 0 → 1
	await fireEvent.click(getByText('確認付款')); // confirmPay(), step 1 → 2
}

describe('CheckoutDialog — pure-pass checkout creates a Subscription (使用權)', () => {
	it('appends a Subscription for the pass and shows 訂閱/使用權 copy, never 日程', async () => {
		cart.addItem(PASS);
		checkoutOpen.set(true);
		const { getByText, container } = render(CheckoutDialog);

		await payThrough(getByText);

		// A Subscription was persisted, keyed by the pass's cart-item id.
		const subs = get(subscriptions);
		expect(subs).toHaveLength(1);
		expect(subs[0].id).toBe(PASS.id);
		expect(subs[0].name).toBe('競技啦啦隊月費');
		expect(subs[0].price).toBe(4500);
		expect(typeof subs[0].since).toBe('string');
		expect(subs[0].since.length).toBeGreaterThan(0);

		// Pure-pass success copy talks 訂閱/使用權, NOT 報名 or 加入日程.
		expect(container.textContent).toContain('訂閱');
		expect(container.textContent).not.toContain('日程');
		expect(container.textContent).not.toContain('報名');

		// The completion toast also branches to 訂閱 language.
		const tones = get(toasts);
		expect(tones.some((t) => t.title.includes('訂閱'))).toBe(true);
		expect(tones.some((t) => t.body.includes('日程'))).toBe(false);

		// Pass still earns points (5% of 4500 = 225).
		expect(get(points)).toBe(ME.points + 225);
	});


});

describe('CheckoutDialog — course checkout stays a mock (points only, 報名 copy)', () => {
	it('rewards points, writes no Subscription, and shows 報名 copy', async () => {
		cart.addItem(COURSE);
		checkoutOpen.set(true);
		const { getByText, container } = render(CheckoutDialog);

		await payThrough(getByText);

		// No entitlement is created for a course.
		expect(get(subscriptions)).toHaveLength(0);
		// Course success keeps the 報名 language.
		expect(container.textContent).toContain('報名');
		// Points rewarded (5% of 4800 = 240).
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
