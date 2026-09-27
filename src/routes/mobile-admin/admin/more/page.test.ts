import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MorePage from './+page.svelte';
import { PROFILES } from '$lib/mobile-admin/data';
import type { ApiCoach, ApiVenue, ApiProduct } from '$lib/public/api';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getMore()(組合器，
 * 3b 留任；平行拉取 GET /coaches、/venues、/products)走真實 fetch adapter。
 * profiles 一律是 getMore() 內建的 PROFILES 常數(P2 cosmetic，無後端來源)——不受
 * wire fixture 影響，斷言改用真值(PROFILES.admin.name)而非過去可任意覆寫的假名。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const WIRE_COACHES: ApiCoach[] = [
	{ id: 'tc1', user_id: 'u-tc1', name: '測試教練甲', title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '' }
];
const WIRE_VENUES: ApiVenue[] = [
	{ id: 'tv1', category_id: null, slug: 'tv1', name: '測試場地甲', description: '測試類型', features: [], image_url: null, is_active: true, created_at: '' }
];
const WIRE_PRODUCTS: ApiProduct[] = [
	{ id: 'tt1', name: '測試票券甲', slug: 'tt1', product_type: 'ticket', description: null, price_cents: 100000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: null, quota: null, sold: 0, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' }
];

const routes = (coaches: ApiCoach[], venues: ApiVenue[], products: ApiProduct[]) => ({
	'GET /coaches': coaches,
	'GET /venues': venues,
	'GET /products?page=1': { products, total: products.length, page: 1, per_page: 20 }
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter(routes(WIRE_COACHES, WIRE_VENUES, WIRE_PRODUCTS)));
});

describe('mobile-admin/admin/more 頁', () => {
	it('loading 分支顯示骨架(data-testid="more-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(MorePage);
		expect(container.querySelector('[data-testid="more-skeleton"]')).not.toBeNull();
	});

	it('async 載入後顯示 payload 的管理員姓名(getMore() 內建 PROFILES,P2)與各群組筆數(相異 fixture)', async () => {
		const { findByText, findAllByText } = render(MorePage);
		expect((await findAllByText(PROFILES.admin.name)).length).toBeGreaterThan(0);
		expect(await findByText('1 位專任教練')).toBeInTheDocument();
		expect(await findByText('1 個場地 · 器材')).toBeInTheDocument();
		expect(await findByText('1 種方案 · 銷售')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...routes(WIRE_COACHES, WIRE_VENUES, WIRE_PRODUCTS), 'GET /coaches': new Error('boom') }));
		const { findByText } = render(MorePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('空集合(教練/場地/票券皆 0 筆)不當機,顯示 0 筆敘述', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(routes([], [], [])));
		const { findByText } = render(MorePage);
		expect(await findByText('0 位專任教練')).toBeInTheDocument();
		expect(await findByText('0 個場地 · 器材')).toBeInTheDocument();
		expect(await findByText('0 種方案 · 銷售')).toBeInTheDocument();
	});
});
