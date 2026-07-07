import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TicketsPage from './+page.svelte';
import { TICKETS, TICKET_TYPE } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';
import { soldPct } from '$lib/admin/tickets-util';
import { getTickets } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getTickets: vi.fn() }));

beforeEach(() => {
	vi.mocked(getTickets).mockReset();
	vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: TICKETS.length, page: 1, perPage: 20 });
});

/* 票券管理 (reports.jsx TicketsView): PageHead + 3 KPI StatCards + a card grid
 * over TICKETS. Each card: icon chip, name, type StatusBadge, price, the
 * 已售/配額 line with a ProgressBar, and the desc. Data now arrives through the
 * getTickets() seam (async), so every assertion first awaits the ready phase. */
describe('票券管理 (+page)', () => {
	it('renders the PageHead title and 新增票券 action', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('票券管理');
		expect(txt).toContain('新增票券');
	});

	it('renders the three summary StatCards (已售票券 / 票券營收 / 販售方案)', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const txt = container.textContent ?? '';
		const totalSold = TICKETS.reduce((s, t) => s + t.sold, 0);
		const revenue = TICKETS.reduce((s, t) => s + t.sold * t.price, 0);
		expect(txt).toContain('已售票券');
		expect(txt).toContain(totalSold + ' 張');
		expect(txt).toContain('票券營收');
		expect(txt).toContain(fmtNT(revenue));
		expect(txt).toContain('販售方案');
		expect(txt).toContain(TICKETS.length + ' 種');
	});

	it('renders every ticket name from TICKETS', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const txt = container.textContent ?? '';
		for (const t of TICKETS) {
			expect(txt).toContain(t.name);
		}
	});

	it('renders the ticket type badge labels (通行票 / 體驗票 / 活動票)', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain(TICKET_TYPE.pass[1]); // 通行票
		expect(badges).toContain(TICKET_TYPE.trial[1]); // 體驗票
		expect(badges).toContain(TICKET_TYPE.event[1]); // 活動票
	});

	it("renders each ticket's price and 已售/配額 figures", async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const txt = container.textContent ?? '';
		const t0 = TICKETS[0]; // 月票: price 2800, 128/200
		expect(txt).toContain(fmtNT(t0.price));
		expect(txt).toContain(`${t0.sold} / ${t0.quota} 張`);
	});

	it('renders a ProgressBar per ticket whose fill width matches soldPct', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const fills = container.querySelectorAll('.pb .fill');
		expect(fills).toHaveLength(TICKETS.length);
		// first ticket (月票): 128/200 = 64%
		expect((fills[0] as HTMLElement).style.width).toBe(`${soldPct(TICKETS[0].sold, TICKETS[0].quota)}%`);
	});

	/* P1 (plan B1): the 編輯 / 新增票券 buttons were dead (fired a toast only). They
	 * now open the TicketEditDialog. */
	it('opens the TicketEditDialog (編輯票券) when a card 編輯 is clicked', async () => {
		const { getAllByText, getByText, queryByText, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		expect(queryByText('儲存票券')).toBeNull();
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯票券')).toBeInTheDocument();
		expect(getByText('儲存票券')).toBeInTheDocument();
	});

	it('opens the TicketEditDialog in new mode (新增票券) when the header 新增票券 is clicked', async () => {
		const { getByText, queryByText, findByText } = render(TicketsPage);
		await findByText('新增票券');
		expect(queryByText('建立票券')).toBeNull();
		await fireEvent.click(getByText('新增票券'));
		expect(getByText('建立票券')).toBeInTheDocument();
	});
});

describe('票券管理 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getTickets).mockReset();
		vi.mocked(getTickets).mockRejectedValue(new Error('network'));
		const { findByText } = render(TicketsPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getTickets).mockReset();
		vi.mocked(getTickets).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(TicketsPage);
		expect(getByTestId('tickets-skeleton')).toBeTruthy();
	});
});

describe('票券管理 — 分頁（Task 17：PaginationBar 接上 getTickets() 的 total/page/perPage）', () => {
	it('依 getTickets() 回應渲染「第 x 頁，共 M 筆」，邊界頁按鈕 disabled', async () => {
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → 呼叫 getTickets(2)，並依新回應重新渲染頁碼', async () => {
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);

		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(getTickets).toHaveBeenCalledWith(2);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 3, perPage: 20 });
		const { findByText, getByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});
