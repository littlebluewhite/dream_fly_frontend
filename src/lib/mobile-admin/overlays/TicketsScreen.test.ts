import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import TicketsScreen from './TicketsScreen.svelte';
import { getTickets } from '$lib/mobile-admin/api';
import type { Ticket } from '$lib/mobile-admin/data';
import { fmtNT } from '$lib/format';

/* 票券管理 push screen — C4：接真 GET /products(復用桌面 admin/api.ts 的 getTickets()，
 * 見 $lib/mobile-admin/api 薄委派 re-export)。fixture 刻意異於 domain/tickets.ts seed，
 * 證明畫面讀 getTickets() payload 而非殘留的 TICKETS import；hero 總額精確驗算(倣桌面
 * routes/admin/tickets/page.test.ts)；quota null → 「不限」；id 是 UUID 形、不出現於版面。 */
vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getTickets: vi.fn() };
});

const UUID_A = 'a1b2c3d4-0000-4000-8000-000000000001';
const UUID_B = 'a1b2c3d4-0000-4000-8000-000000000002';
const PAYLOAD: { tickets: Ticket[]; total: number; page: number; perPage: number } = {
	tickets: [
		{ id: UUID_A, name: 'Alpha 測試月票', type: 'membership', price: 3000, sold: 10, quota: 50, color: '#123456', icon: 'calendar-days', desc: '測試說明甲' },
		{ id: UUID_B, name: 'Beta 測試體驗券', type: 'ticket', price: 500, sold: 4, quota: null, color: '#654321', icon: 'sparkles', desc: '測試說明乙' }
	],
	total: 2,
	page: 1,
	perPage: 20
};

beforeEach(() => {
	vi.mocked(getTickets).mockReset();
	vi.mocked(getTickets).mockResolvedValue(PAYLOAD);
});

describe('TicketsScreen — 載入(GET /products)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(getTickets).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(TicketsScreen, { props: { onBack: () => {} } });
		expect(getByTestId('tickets-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」', async () => {
		vi.mocked(getTickets).mockRejectedValue(new Error('network'));
		const { findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});
});

describe('TicketsScreen — ready(接真 payload)', () => {
	it('hero 總額＝Σ(price×sold)、總售出＝Σsold，皆由 payload reactive 推導', async () => {
		const { container, findByText } = render(TicketsScreen, { props: { onBack: () => {} } });
		await findByText('Alpha 測試月票');
		const txt = container.textContent ?? '';
		const totalSold = PAYLOAD.tickets.reduce((s, t) => s + t.sold, 0); // 14
		const revenue = PAYLOAD.tickets.reduce((s, t) => s + t.sold * t.price, 0); // 32,000
		expect(txt).toContain(fmtNT(revenue)); // NT$32,000
		expect(txt).toContain('共售出 ' + totalSold + ' 張'); // 共售出 14 張票券
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
});
