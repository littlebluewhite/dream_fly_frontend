import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CouponsPage from './+page.svelte';
import { toasts } from '$lib/admin/stores';
import type { CouponResponse } from '$lib/api/generated';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';
import { couponResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，getCoupons/createCoupon/updateCoupon/
 * deleteCoupon 走真 mapper(GET /coupons?page=n、POST /coupons、PATCH/DELETE
 * /coupons/{id})。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 優惠碼管理 (Task 8 piece 3) — admin page: GET /coupons list + POST /coupons
 * create. Task F6: 後端補上 PATCH/DELETE /coupons/{id}，這裡接上編輯／停用啟用／
 * 刪除——列表列有「編輯」「停用/啟用」，刪除藏在編輯對話框的危險區 + 確認 Dialog。 */
const FIXTURE: CouponResponse[] = [
	couponResponse({ id: 'cp1', code: 'SPRING10', discount_cents: 30000, is_active: true, expires_at: '2026-12-31T23:59:59Z' }),
	couponResponse({ id: 'cp2', code: 'WELCOME50', discount_cents: 5000, is_active: false, expires_at: null })
];

const page = (coupons: CouponResponse[], n: number, total = coupons.length) => ({ coupons, total, page: n, per_page: 20 });

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /coupons?page=1': page(FIXTURE, 1), ...overrides }, ADMIN_ROUTES));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
	// toasts is a module-level singleton (not reset by the test framework) capped
	// at 4 entries (oldest evicted past that, see stores/toasts.ts) — Task F6 added
	// enough toast-producing tests to this file that leftovers from earlier tests
	// would saturate the cap and break later tests' `before + 1` delta assertions.
	// Drain it so every test starts from an empty stack.
	for (const t of get(toasts)) toasts.dismiss(t.id);
});

describe('優惠碼管理 (+page)', () => {
	it('renders the PageHead title and 新增優惠碼 action', async () => {
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(getByText('優惠碼管理')).toBeInTheDocument();
		expect(getByText('新增優惠碼')).toBeInTheDocument();
	});

	it('renders every coupon: code, NT$ discount, active/inactive badge, expiry date', async () => {
		const { container, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(container.textContent).toContain('SPRING10');
		expect(container.textContent).toContain('NT$300');
		expect(container.textContent).toContain('2026-12-31');
		expect(container.textContent).toContain('WELCOME50');
		expect(container.textContent).toContain('NT$50');
		expect(container.textContent).toContain('—'); // 永久有效

		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('啟用中');
		expect(badges).toContain('已停用');
	});

	it('renders 編輯 and 停用/啟用 actions per row (Task F6), but no 刪除 button directly in the list (secondary/danger-zone only)', async () => {
		const { getAllByText, queryByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(getAllByText('編輯')).toHaveLength(FIXTURE.length);
		expect(getAllByText('停用')).toHaveLength(1); // cp1 (SPRING10) 目前啟用中
		expect(getAllByText('啟用')).toHaveLength(1); // cp2 (WELCOME50) 目前已停用
		expect(queryByText('刪除')).toBeNull(); // 刪除只在編輯對話框的危險區，不在列表
	});

	it('shows an empty message when there are no coupons', async () => {
		route({ 'GET /coupons?page=1': page([], 1) });
		const { findByText } = render(CouponsPage);
		await findByText('尚無優惠碼');
	});
});

describe('優惠碼管理 — 三態', () => {
	it('error: 顯示「載入失敗」', async () => {
		route({ 'GET /coupons?page=1': new Error('network') });
		const { findByText } = render(CouponsPage);
		await findByText('載入失敗');
	});

	it('loading: 顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CouponsPage);
		expect(getByTestId('coupons-skeleton')).toBeTruthy();
	});
});

describe('優惠碼管理 — 新增優惠碼（POST /coupons）', () => {
	it('填寫代碼與折扣金額並建立 → POST /coupons(toCents 換算過的 body)，成功後重新整包刷新列表', async () => {
		const created = couponResponse({ id: 'cp-new', code: 'NEWCODE', discount_cents: 20000 });
		const refreshed = [...FIXTURE, created];

		const { getByText, getByLabelText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getByText('新增優惠碼'));
		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'NEWCODE' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '200' } });

		route({ 'GET /coupons?page=1': page(refreshed, 1), 'POST /coupons': created }); // 下一次 GET（刷新）回傳含新碼的清單
		await fireEvent.click(getByText('建立優惠碼'));

		await vi.waitFor(() => expect(apiCalls('POST /coupons')).toHaveLength(1));
		expect(apiBody('POST /coupons')).toEqual({ code: 'NEWCODE', discount_cents: 20000 });

		await findByText('NEWCODE'); // 刷新後的列表包含新碼
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立優惠碼')).toBeNull(); // 對話框已關閉
	});

	it('建立失敗（409 代碼重複）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		route({ 'POST /coupons': new ApiError(409, 'coupon code already exists') });
		const before = get(toasts).length;

		const { getByText, getByLabelText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getByText('新增優惠碼'));
		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'SPRING10' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '300' } });
		await fireEvent.click(getByText('建立優惠碼'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('已存在');
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(1); // 失敗不重新整包刷新
		expect(await findByText('建立優惠碼')).toBeInTheDocument(); // 對話框仍開著（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(queryByText('NEWCODE')).toBeNull();
	});
});

describe('優惠碼管理 — 編輯優惠碼（PATCH /coupons/{id}，Task F6）', () => {
	it('點編輯 → 修改折扣金額並儲存 → PATCH /coupons/{真實 id}(全量 body)，成功後重新整包刷新列表', async () => {
		const target = FIXTURE[0]; // SPRING10：300、啟用中、2026-12-31
		const updated = { ...target, discount_cents: 45000 };
		const refreshed = FIXTURE.map((c) => (c.id === target.id ? updated : c));

		const { getAllByText, getByLabelText, getByText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '450' } });

		route({ 'GET /coupons?page=1': page(refreshed, 1), [`PATCH /coupons/${target.id}`]: updated });
		await fireEvent.click(getByText('儲存優惠碼'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coupons/${target.id}`)).toHaveLength(1)); // 真實 id
		expect(apiBody(`PATCH /coupons/${target.id}`)).toEqual({
			discount_cents: 45000,
			is_active: true,
			expires_at: '2026-12-31T23:59:59Z'
		});

		await findByText('NT$450'); // 刷新後的列表反映新折扣金額
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(2); // 初次載入 + 編輯成功後刷新
		expect(queryByText('儲存優惠碼')).toBeNull(); // 對話框已關閉
	});

	it('清空到期日並儲存 → PATCH body 帶 expires_at:null（清成永久有效）', async () => {
		const target = FIXTURE[0];
		route({ [`PATCH /coupons/${target.id}`]: { ...target, expires_at: null } });

		const { getAllByText, getByLabelText, getByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.input(getByLabelText('到期日（選填，留白為永久有效）'), { target: { value: '' } });
		await fireEvent.click(getByText('儲存優惠碼'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coupons/${target.id}`)).toHaveLength(1));
		expect(apiBody(`PATCH /coupons/${target.id}`)).toEqual({
			discount_cents: 30000,
			is_active: true,
			expires_at: null
		});
	});

	it('編輯優惠碼失敗（422 驗證）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		route({ 'PATCH /coupons/cp1': new ApiError(422, 'invalid discount_cents') });
		const before = get(toasts).length;

		const { getAllByText, getByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('儲存優惠碼'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不符規則');
		expect(await findByText('NT$300')).toBeInTheDocument(); // 原折扣金額仍在
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(1); // 失敗不重新整包刷新
	});
});

describe('優惠碼管理 — 列表列停用/啟用（PATCH /coupons/{id}，Task F6：一鍵直達，不需確認）', () => {
	it('點擊啟用中優惠碼列的「停用」→ PATCH /coupons/{id}({ is_active:false })，成功後刷新列表並顯示成功 toast', async () => {
		const target = FIXTURE[0]; // SPRING10，目前啟用中
		const updated = { ...target, is_active: false };
		const refreshed = FIXTURE.map((c) => (c.id === target.id ? updated : c));

		const { getByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');

		route({ 'GET /coupons?page=1': page(refreshed, 1), [`PATCH /coupons/${target.id}`]: updated });
		await fireEvent.click(getByText('停用'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coupons/${target.id}`)).toHaveLength(1));
		expect(apiBody(`PATCH /coupons/${target.id}`)).toEqual({ is_active: false });
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(2); // 初次載入 + 切換後刷新

		const successes = get(toasts).filter((t) => t.tone === 'success');
		expect(successes.at(-1)?.title).toBe('已停用');
	});

	it('點擊已停用優惠碼列的「啟用」→ PATCH /coupons/{id}({ is_active:true })', async () => {
		const target = FIXTURE[1]; // WELCOME50，目前已停用
		route({ [`PATCH /coupons/${target.id}`]: { ...target, is_active: true } });

		const { getByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getByText('啟用'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coupons/${target.id}`)).toHaveLength(1));
		expect(apiBody(`PATCH /coupons/${target.id}`)).toEqual({ is_active: true });
	});

	it('停用/啟用失敗 → 顯示繁中錯誤 toast，列表狀態不變（不重新整包刷新）', async () => {
		route({ 'PATCH /coupons/cp1': new ApiError(403, 'forbidden') });
		const before = get(toasts).length;

		const { getByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getByText('停用'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('沒有權限');
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(1); // 失敗不重新整包刷新
	});
});

describe('優惠碼管理 — 刪除優惠碼（DELETE /coupons/{id}，Task F6：危險區 + 確認流程）', () => {
	it('編輯對話框危險區點刪除 → 關閉編輯對話框並開出確認 Dialog，文案提及「僅適用…未使用」', async () => {
		const { getAllByText, getByText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('儲存優惠碼')).toBeInTheDocument();
		await fireEvent.click(getByText('刪除'));

		expect(queryByText('儲存優惠碼')).toBeNull(); // 編輯對話框已關閉
		expect(getByText('刪除優惠碼')).toBeInTheDocument(); // 確認 Dialog 標題
		expect(getByText('確認刪除')).toBeInTheDocument();
		expect(getByText(/僅適用於誤建且尚未被使用/)).toBeInTheDocument();
	});

	it('確認 Dialog 點取消 → 不打 DELETE /coupons/{id}，列表不變', async () => {
		const { getAllByText, getByText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('刪除'));

		await fireEvent.click(getByText('取消'));

		expect(queryByText('刪除優惠碼')).toBeNull(); // 確認 Dialog 已關閉
		expect(apiCalls('DELETE /coupons/cp1')).toHaveLength(0);
	});

	it('確認 Dialog 點確認刪除 → DELETE /coupons/{真實 id}，成功後重新整包刷新列表並顯示成功 toast', async () => {
		const target = FIXTURE[0];
		const refreshed = FIXTURE.filter((c) => c.id !== target.id);

		const { getAllByText, getByText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('刪除'));

		route({ 'GET /coupons?page=1': page(refreshed, 1), [`DELETE /coupons/${target.id}`]: undefined }); // 204 → api() 回 undefined
		await fireEvent.click(getByText('確認刪除'));

		await vi.waitFor(() => expect(apiCalls(`DELETE /coupons/${target.id}`)).toHaveLength(1));

		await vi.waitFor(() => expect(queryByText('SPRING10')).toBeNull()); // 已從刷新後的列表移除
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(2); // 初次載入 + 刪除成功後刷新

		const successes = get(toasts).filter((t) => t.tone === 'success');
		expect(successes.at(-1)?.title).toBe('已刪除優惠碼');
	});

	it('刪除失敗（404 已被別處刪除）→ 顯示繁中錯誤 toast，確認 Dialog 關閉，列表不變', async () => {
		route({ 'DELETE /coupons/cp1': new ApiError(404, 'coupon not found') });
		const before = get(toasts).length;

		const { getAllByText, getByText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('刪除'));
		await fireEvent.click(getByText('確認刪除'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('已不存在');
		expect(queryByText('刪除優惠碼')).toBeNull(); // 確認 Dialog 無論成敗都關閉
		expect(await findByText('SPRING10')).toBeInTheDocument(); // 列表不變
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(1); // 失敗不重新整包刷新
	});
});

describe('優惠碼管理 — 分頁（Task 17：PaginationBar 接上 GET /coupons 的 total/page/per_page）', () => {
	it('依 GET /coupons 回應渲染「第 x 頁，共 M 筆」（含 sub 標題），邊界頁按鈕 disabled', async () => {
		route({ 'GET /coupons?page=1': page(FIXTURE, 1, 45) });
		const { container, findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect(container.textContent).toContain('45 組優惠碼'); // sub 標題改用 total，不是 coupons.length
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → GET /coupons?page=2，並依新回應重新渲染頁碼', async () => {
		route({ 'GET /coupons?page=1': page(FIXTURE, 1, 45), 'GET /coupons?page=2': page(FIXTURE, 2, 45) });
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /coupons?page=2')).toHaveLength(1);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		route({ 'GET /coupons?page=1': page(FIXTURE, 3, 45) });
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('優惠碼管理 — 分頁範圍提示（G6：五頁統一 range hint）', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		route({ 'GET /coupons?page=1': page(FIXTURE, 1, 45) });
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		route({ 'GET /coupons?page=1': page(FIXTURE, 1) });
		const { findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('優惠碼管理 — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新 GET /coupons', async () => {
		let page2Calls = 0;
		route({
			'GET /coupons?page=1': page(FIXTURE, 1, 45),
			'GET /coupons?page=2': () => (++page2Calls === 1 ? new Error('network') : page(FIXTURE, 2, 45))
		});
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /coupons?page=2')).toHaveLength(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
		expect(apiCalls('GET /coupons?page=1')).toHaveLength(1);
	});
});
