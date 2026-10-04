import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole, findAllByRole } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, subscriptions } from '$lib/member/stores';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { productResponse } from '$lib/testing/wire-fixtures';
import type { ProductListResponse } from '$lib/api/generated';

// The /tickets marketing page sells PASSES (方案/購票). cart v3: the page now
// fetches products via the public seam (mock ticketTypes' string-price/number-id
// shape doesn't line up with the backend Ticket type) and 加入購物車 routes a
// pass into the unified member cart keyed by the product's uuid.

// 只假造 HTTP 層：真的 listProducts + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const PRODUCT = productResponse({
	id: 'product-uuid-1',
	name: '單堂體驗課',
	slug: 'trial',
	description: '首次體驗任一課程，感受專業體操訓練',
	price_cents: 50000,
	features: ['60-90分鐘完整課程', '專業教練一對一指導'],
	session_count: 1,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
});

const route = (products: ReturnType<typeof productResponse>[]) =>
	vi.mocked(api).mockImplementation(
		fakeRouter({
			'GET /products?per_page=100': { products, total: products.length, page: 1, per_page: 100 } satisfies ProductListResponse
		})
	);
const routeRaw = (value: unknown) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /products?per_page=100': value }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route([PRODUCT]);
	localStorage.clear();
	cart.clear();
	subscriptions.set([]);
});

describe('購票資訊 — 接真 API', () => {
	it('renders the adapted pass (name, price/100, description, features)', async () => {
		const { container, findByText } = render(Page);

		await findByText('單堂體驗課');
		expect(container.textContent).toContain('NT$ 500'); // ntd(50000)
		expect(container.textContent).toContain('首次體驗任一課程，感受專業體操訓練');
		expect(container.textContent).toContain('60-90分鐘完整課程');
	});

	it('error 態:顯示「載入失敗」', async () => {
		routeRaw(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示骨架', () => {
		routeRaw(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('tickets-skeleton')).toBeTruthy();
	});
});

describe('購票資訊 — merchandising display (badge / highlight / original price)', () => {
	it('renders the badge chip, highlighted card styling, and strikethrough original price when the product carries them', async () => {
		route([
			productResponse({
				...PRODUCT,
				id: 'product-uuid-2',
				name: '競技啦啦隊月費',
				price_cents: 450000,
				original_price_cents: 500000,
				badge: '最熱門',
				is_highlighted: true
			})
		]);

		const { container, findByText } = render(Page);

		await findByText('競技啦啦隊月費');
		expect(await findByText('最熱門')).toBeTruthy(); // badge chip
		const orig = container.querySelector('.original-price');
		expect(orig?.textContent).toContain('NT$ 5,000'); // ntd(500000), struck through
		expect(container.textContent).toContain('NT$ 4,500'); // selling price still shown
		expect(container.querySelector('.ticket-card.highlighted')).toBeTruthy();
	});

	it('falls back to the 優惠中 badge when there is an original price but no explicit badge', async () => {
		route([productResponse({ ...PRODUCT, original_price_cents: 400000, badge: null })]);

		const { findByText } = render(Page);

		await findByText('單堂體驗課');
		expect(await findByText('優惠中')).toBeTruthy();
	});

	it('renders no badge, no strikethrough, and no highlight when the product carries none', async () => {
		// default PRODUCT: badge null, original_price_cents null, is_highlighted false
		const { container, findByText } = render(Page);

		await findByText('單堂體驗課');
		expect(container.querySelector('.discount-badge')).toBeNull();
		expect(container.querySelector('.original-price')).toBeNull();
		expect(container.querySelector('.ticket-card.highlighted')).toBeNull();
	});
});

describe('購票資訊 — 加入購物車 routes a pass into the member cart', () => {
	it('clicking 加入購物車 adds a pass line (uuid id, type:pass, qty 1) to the member cart', async () => {
		const { container } = render(Page);

		await fireEvent.click(await findByRole(container, 'button', { name: '加入購物車' }));

		const items = get(cart);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe('product-uuid-1');
		expect(items[0].type).toBe('pass');
		expect(items[0].name).toBe('單堂體驗課');
		expect(items[0].price).toBe(500); // ntd(50000)
		expect(items[0].qty).toBe(1); // a pass is a single entitlement
	});

	it('a ticket already in the cart shows 已在購物車 and does not add a second line', async () => {
		// Seed the cart with the product already added as a pass.
		cart.addItem({ id: 'product-uuid-1', type: 'pass', name: '單堂體驗課', price: 500, icon: 'ticket' });

		const { container, findByText } = render(Page);

		// Its footer shows the disabled 已在購物車 state, not an 加入購物車 button.
		await findByText('已在購物車');
		expect(await findAllByRole(container, 'button', { name: '已在購物車' })).toHaveLength(1);
		// still exactly one line, no duplicate
		expect(get(cart)).toHaveLength(1);
	});

	it('a pass the member already subscribes to shows 已訂閱 and cannot be re-added (blocks the paid no-op)', async () => {
		// Member already holds this product as a persisted entitlement.
		subscriptions.set([{ id: 'product-uuid-1', name: '單堂體驗課', since: '2026/06/17', price: 500 }]);

		const { findByText } = render(Page);

		// Its footer must read 已訂閱 (disabled), not 加入購物車 — checkout skips
		// owned passes (chargeableLines), so re-adding would be a confusing no-op.
		await findByText('已訂閱');
		expect(get(cart)).toHaveLength(0); // never enters the cart
	});
});
