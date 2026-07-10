import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import TicketsPage from './+page.svelte';
import { TICKETS, TICKET_TYPE } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';
import { soldPct } from '$lib/admin/tickets-util';
import { getTickets, createProduct, updateProduct } from '$lib/admin/api';
import { toasts } from '$lib/admin/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({ getTickets: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn() }));

beforeEach(() => {
	vi.mocked(getTickets).mockReset();
	vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: TICKETS.length, page: 1, perPage: 20 });
	vi.mocked(createProduct).mockReset();
	vi.mocked(updateProduct).mockReset();
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

	it('renders the ticket type badge labels (單次票券 / 月票方案 / 課程套裝)', async () => {
		const { container, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain(TICKET_TYPE.ticket[1]); // 單次票券
		expect(badges).toContain(TICKET_TYPE.membership[1]); // 月票方案
		expect(badges).toContain(TICKET_TYPE.course_package[1]); // 課程套裝
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

describe('票券管理 — 新增/編輯接真 API（Task F1：POST/PATCH /products）', () => {
	it('新增票券：填寫名稱後點擊建立票券，呼叫 createProduct 並在成功後重新整包刷新列表', async () => {
		vi.mocked(createProduct).mockResolvedValue({
			id: 'p-new', name: '新票券', slug: 'new', product_type: 'ticket', description: '',
			price_cents: 100000, original_price_cents: null, features: [], is_highlighted: false,
			badge: null, stock: 100, quota: 100, sold: 0, valid_days: null, session_count: null,
			is_active: true, created_at: '', updated_at: ''
		});
		const refreshed = [...TICKETS, { ...TICKETS[0], id: 'p-new', name: '新票券' }];

		const { getByText, getByLabelText, findByText, queryByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		await fireEvent.click(getByText('新增票券'));
		await fireEvent.input(getByLabelText('票券名稱'), { target: { value: '新票券' } });

		vi.mocked(getTickets).mockResolvedValue({ tickets: refreshed, total: refreshed.length, page: 1, perPage: 20 }); // 下一次 GET（刷新）回傳含新票券的清單
		await fireEvent.click(getByText('建立票券'));

		await vi.waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
		const body = vi.mocked(createProduct).mock.calls[0][0];
		expect(body.name).toBe('新票券');
		expect(body.product_type).toBe('ticket'); // blankTicket 預設類型（TICKET_TYPES[0]）
		expect(body.price_cents).toBe(100000); // toCents(1000)，blankTicket 預設票價
		expect(body.stock).toBe(100); // quota → stock 反向映射，blankTicket 預設配額

		await findByText('新票券'); // 刷新後的列表包含新票券
		expect(getTickets).toHaveBeenCalledTimes(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立票券')).toBeNull(); // 對話框已關閉
	});

	it('編輯票券：修改後點擊儲存票券，呼叫 updateProduct(真實 id, body) 並在成功後重新整包刷新列表', async () => {
		const target = TICKETS[0];
		vi.mocked(updateProduct).mockResolvedValue({
			id: target.id, name: '改名票券', slug: 'x', product_type: target.type, description: target.desc,
			price_cents: target.price * 100, original_price_cents: null, features: [], is_highlighted: false,
			badge: null, stock: target.quota, quota: target.quota, sold: target.sold, valid_days: null,
			session_count: null, is_active: true, created_at: '', updated_at: ''
		});
		const refreshed = TICKETS.map((t) => (t.id === target.id ? { ...t, name: '改名票券' } : t));

		const { getByText, getAllByText, getByDisplayValue, findByText } = render(TicketsPage);
		await findByText(target.name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名票券' } });

		vi.mocked(getTickets).mockResolvedValue({ tickets: refreshed, total: refreshed.length, page: 1, perPage: 20 });
		await fireEvent.click(getByText('儲存票券'));

		await vi.waitFor(() => expect(updateProduct).toHaveBeenCalledTimes(1));
		expect(vi.mocked(updateProduct).mock.calls[0][0]).toBe(target.id); // 真實 id
		const body = vi.mocked(updateProduct).mock.calls[0][1];
		expect(body.name).toBe('改名票券');
		expect(body.product_type).toBe(target.type); // 讀寫共用同一組真實值，直接透傳
		expect(body.stock).toBe(target.quota); // quota → stock 反向映射，未改動的配額原樣送出

		await findByText('改名票券'); // 刷新後的列表反映改名
		expect(getTickets).toHaveBeenCalledTimes(2); // 初次載入 + 編輯成功後刷新
	});

	it('新增票券失敗（409 名稱已存在）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		vi.mocked(createProduct).mockRejectedValue(new ApiError(409, 'product slug already exists'));
		const before = get(toasts).length;

		const { getByText, getByLabelText, findByText, queryByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		await fireEvent.click(getByText('新增票券'));
		await fireEvent.input(getByLabelText('票券名稱'), { target: { value: '重複票券' } });
		await fireEvent.click(getByText('建立票券'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('已存在');
		expect(queryByText('重複票券')).toBeNull(); // 未進入列表
		expect(await findByText('建立票券')).toBeInTheDocument(); // 對話框仍開著，可修正重試（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(getTickets).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
	});

	/* Important #1(終審)：EditModal 的 busy 鎖是共用機制(見 EditModal.test.ts)，這裡
	 * 補一個代表性頁面的端對端驗證——連點「建立票券」兩次，createProduct 只送出一次
	 * (其餘四個呼叫端 tickets/venues/coupons/coaches/members 靠同一支 EditModal 機制，
	 * 不逐一重複整合測試)。 */
	it('連點「建立票券」兩次只送出一次 createProduct（EditModal 防連點鎖）', async () => {
		let resolveCreate!: (v: Awaited<ReturnType<typeof createProduct>>) => void;
		vi.mocked(createProduct).mockReturnValue(
			new Promise((resolve) => {
				resolveCreate = resolve;
			})
		);

		const { getByText, getByLabelText, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		await fireEvent.click(getByText('新增票券'));
		await fireEvent.input(getByLabelText('票券名稱'), { target: { value: '連點票券' } });

		const saveBtn = getByText('建立票券');
		await fireEvent.click(saveBtn);
		await fireEvent.click(saveBtn); // 連點第二次：按鈕此時應已被 busy 鎖 disabled

		resolveCreate({
			id: 'p-new', name: '連點票券', slug: 'new', product_type: 'ticket', description: '',
			price_cents: 100000, original_price_cents: null, features: [], is_highlighted: false,
			badge: null, stock: 100, quota: 100, sold: 0, valid_days: null, session_count: null,
			is_active: true, created_at: '', updated_at: ''
		});

		await vi.waitFor(() => expect(createProduct).toHaveBeenCalledTimes(1));
		// 等整條成功流程(closeEdit + toast + gate.silentRefresh，皆在 save() 內接續 await)
		// 完整跑完，不留下未 await 的 promise 尾巴——toasts/gate 是跨測試共用的 module-level
		// 狀態，沒等到底會讓殘留的 toast/getTickets 呼叫污染下一個測試。
		await vi.waitFor(() => expect(getTickets).toHaveBeenCalledTimes(2));
	});

	it('編輯票券失敗（422 驗證）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		vi.mocked(updateProduct).mockRejectedValue(new ApiError(422, 'invalid product_type'));

		const { getByText, getAllByText, findByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('儲存票券'));

		// toasts store 全域 CAP=4(見 $lib/stores/toasts.ts)——同檔案內先跑過的測試累積的
		// toast 一旦頂到上限，長度就會卡住不再增加(舊的被擠掉)，用「長度變成 before+1」
		// 判斷不可靠；改判斷「最新一則」的內容，不受上限擠壓影響(同 coaches/page.test.ts
		// 既有慣例：`get(toasts).at(-1)?.title`)。
		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('不符規則'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(await findByText(TICKETS[0].name)).toBeInTheDocument(); // 原名稱仍在
		expect(getTickets).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
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

describe('票券管理 — 分頁範圍提示（G6：五頁統一 range hint）', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: TICKETS.length, page: 1, perPage: 20 });
		const { findByText, queryByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('票券管理 — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新呼叫 getTickets', async () => {
		vi.mocked(getTickets).mockResolvedValue({ tickets: TICKETS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(TicketsPage);
		await findByText(TICKETS[0].name);

		vi.mocked(getTickets).mockRejectedValueOnce(new Error('network'));
		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		vi.mocked(getTickets).mockResolvedValueOnce({ tickets: TICKETS, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(getTickets).toHaveBeenLastCalledWith(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
	});
});
