import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TicketsScreen from './TicketsScreen.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import type { ApiProduct } from '$lib/public/api';
import { fmtNT } from '$lib/format';

/* 票券管理 push screen — C4：接真 GET /products(復用桌面 admin/api.ts 的 getTickets()，
 * 見 $lib/mobile-admin/api 薄委派 re-export)。fixture 刻意異於 domain/tickets.ts seed，
 * 證明畫面讀 getTickets() payload 而非殘留的 TICKETS import；hero 總額精確驗算(倣桌面
 * routes/admin/tickets/page.test.ts)；quota null → 「不限」；id 是 UUID 形、不出現於版面。
 * R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，走真實 getTickets()
 * (GET /products?page=1)+ mapProduct()——product_type 過濾 merchandise 已在真實實作
 * 裡；icon 由 mapProduct() 固定給 'ticket'，本頁未斷言 icon 字面。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const UUID_A = 'a1b2c3d4-0000-4000-8000-000000000001';
const UUID_B = 'a1b2c3d4-0000-4000-8000-000000000002';
const UUID_C = 'a1b2c3d4-0000-4000-8000-000000000003';
const PRODUCTS: ApiProduct[] = [
	{ id: UUID_A, name: 'Alpha 測試月票', slug: 'alpha', product_type: 'membership', description: '測試說明甲', price_cents: 300000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: 50, quota: 50, sold: 10, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' },
	{ id: UUID_B, name: 'Beta 測試體驗券', slug: 'beta', product_type: 'ticket', description: '測試說明乙', price_cents: 50000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: null, quota: null, sold: 4, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' },
	// quota 0（後端可回的合法值,≠ null 的「不限」）——F4 釘 soldPct 的零值防呆。
	{ id: UUID_C, name: 'Gamma 測試預售票', slug: 'gamma', product_type: 'ticket', description: '測試說明丙', price_cents: 80000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: 0, quota: 0, sold: 7, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' }
];
const PAYLOAD = { products: PRODUCTS, total: PRODUCTS.length, page: 1, per_page: 20 };

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /products?page=1': PAYLOAD }));
});

describe('TicketsScreen — 載入(GET /products)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(TicketsScreen, { props: { onBack: () => {} } });
		expect(getByTestId('tickets-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /products?page=1': new Error('network') }));
		const { findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});
});

describe('TicketsScreen — ready(接真 payload)', () => {
	it('hero 文案為「票券銷售總額」，不帶「本季」等後端未提供的窗口口徑(R2)', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		expect(txt).toContain('票券銷售總額');
		expect(txt).not.toContain('本季');
	});

	it('hero 總額＝Σ(price×sold)、總售出＝Σsold，皆由 payload reactive 推導', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		const totalSold = PRODUCTS.reduce((s, t) => s + t.sold, 0); // 10+4+7 = 21
		const revenue = PRODUCTS.reduce((s, t) => s + t.sold * (t.price_cents / 100), 0); // 37,600
		expect(txt).toContain(fmtNT(revenue)); // NT$37,600
		expect(txt).toContain('共售出 ' + totalSold + ' 張'); // 共售出 21 張票券
	});

	it('每張票券名稱/類型 Badge/售價讀 payload，UUID id 不出現於版面', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		expect(txt).toContain('Beta 測試體驗券');
		expect(txt).toContain('月票方案'); // membership → TICKET_TYPE
		expect(txt).toContain('單次票券'); // ticket → TICKET_TYPE
		expect(txt).toContain(fmtNT(3000)); // 售價
		// UUID 形 id 絕不出現在版面(#each key 用 id 但不渲染進 DOM)
		expect(container.innerHTML).not.toContain(UUID_A);
		expect(container.innerHTML).not.toContain(UUID_B);
	});

	it('quota null → 「不限」；有配額 → 已售/配額 + 正確百分比', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		expect(txt).toContain('已售 10 / 50 張'); // Alpha quota 50
		expect(txt).toContain('20%'); // 10/50
		expect(txt).toContain('已售 4 / 不限 張'); // Beta quota null → 不限
	});

	it('F4:quota 0 → soldPct 零值防呆,顯示 0%、版面無 NaN/Infinity(重用桌面 admin tickets-util)', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		expect(txt).toContain('已售 7 / 0 張'); // quota 0 ≠ null:照實顯示 0,不是「不限」
		expect(txt).toMatch(/\b0%/); // Gamma 的獨立 0%(\b 擋掉 Alpha「20%」的子字串矇混)
		expect(txt).not.toContain('NaN'); // 舊算式 quota 0 → sold/0 = Infinity;0/0 → NaN
		expect(txt).not.toContain('Infinity');
	});
});
