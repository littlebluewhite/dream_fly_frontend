import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CouponsPage from './+page.svelte';
import { toasts } from '$lib/admin/stores';
import { getCoupons, createCoupon, type Coupon } from '$lib/admin/api';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({ getCoupons: vi.fn(), createCoupon: vi.fn() }));

/* 優惠碼管理 (Task 8 piece 3) — new admin page: GET /coupons list + POST /coupons
 * create. No update/delete endpoints exist (issue #4), so this page renders no
 * edit/delete affordance at all — the assertions below explicitly guard that. */
const FIXTURE: Coupon[] = [
	{ id: 'cp1', code: 'SPRING10', discount: 300, active: true, expiresAt: '2026-12-31' },
	{ id: 'cp2', code: 'WELCOME50', discount: 50, active: false, expiresAt: '—' }
];

beforeEach(() => {
	vi.mocked(getCoupons).mockReset();
	vi.mocked(getCoupons).mockResolvedValue({ coupons: FIXTURE, total: FIXTURE.length, page: 1, perPage: 20 });
	vi.mocked(createCoupon).mockReset();
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

	it('renders NO edit/delete affordance (no update/delete endpoint exists)', async () => {
		const { queryByText, findByText } = render(CouponsPage);
		await findByText('SPRING10');
		expect(queryByText('編輯')).toBeNull();
		expect(queryByText('刪除')).toBeNull();
	});

	it('shows an empty message when there are no coupons', async () => {
		vi.mocked(getCoupons).mockResolvedValue({ coupons: [], total: 0, page: 1, perPage: 20 });
		const { findByText } = render(CouponsPage);
		await findByText('尚無優惠碼');
	});
});

describe('優惠碼管理 — 三態', () => {
	it('error: 顯示「載入失敗」', async () => {
		vi.mocked(getCoupons).mockRejectedValue(new Error('network'));
		const { findByText } = render(CouponsPage);
		await findByText('載入失敗');
	});

	it('loading: 顯示骨架', () => {
		vi.mocked(getCoupons).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CouponsPage);
		expect(getByTestId('coupons-skeleton')).toBeTruthy();
	});
});

describe('優惠碼管理 — 新增優惠碼（POST /coupons）', () => {
	it('填寫代碼與折扣金額並建立 → 呼叫 createCoupon(toCents 換算過的 body)，成功後重新整包刷新列表', async () => {
		vi.mocked(createCoupon).mockResolvedValue({
			id: 'cp-new', code: 'NEWCODE', discount_cents: 20000, is_active: true, expires_at: null, created_at: ''
		});
		const refreshed: Coupon[] = [
			...FIXTURE,
			{ id: 'cp-new', code: 'NEWCODE', discount: 200, active: true, expiresAt: '—' }
		];

		const { getByText, getByLabelText, findByText, queryByText } = render(CouponsPage);
		await findByText('SPRING10');

		await fireEvent.click(getByText('新增優惠碼'));
		await fireEvent.input(getByLabelText('優惠碼代碼'), { target: { value: 'NEWCODE' } });
		await fireEvent.input(getByLabelText('折扣金額 (NT$)'), { target: { value: '200' } });

		vi.mocked(getCoupons).mockResolvedValue({ coupons: refreshed, total: refreshed.length, page: 1, perPage: 20 }); // 下一次 GET（刷新）回傳含新碼的清單
		await fireEvent.click(getByText('建立優惠碼'));

		await vi.waitFor(() => expect(createCoupon).toHaveBeenCalledTimes(1));
		expect(createCoupon).toHaveBeenCalledWith({ code: 'NEWCODE', discount_cents: 20000 });

		await findByText('NEWCODE'); // 刷新後的列表包含新碼
		expect(getCoupons).toHaveBeenCalledTimes(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立優惠碼')).toBeNull(); // 對話框已關閉
	});

	it('建立失敗（409 代碼重複）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		vi.mocked(createCoupon).mockRejectedValue(new ApiError(409, 'coupon code already exists'));
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
		expect(getCoupons).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
		expect(getByText('建立優惠碼')).toBeInTheDocument(); // 對話框仍開著
		expect(queryByText('NEWCODE')).toBeNull();
	});
});

describe('優惠碼管理 — 分頁（Task 17：PaginationBar 接上 getCoupons() 的 total/page/perPage）', () => {
	it('依 getCoupons() 回應渲染「第 x 頁，共 M 筆」（含 sub 標題），邊界頁按鈕 disabled', async () => {
		vi.mocked(getCoupons).mockResolvedValue({ coupons: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { container, findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect(container.textContent).toContain('45 組優惠碼'); // sub 標題改用 total，不是 coupons.length
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → 呼叫 getCoupons(2)，並依新回應重新渲染頁碼', async () => {
		vi.mocked(getCoupons).mockResolvedValue({ coupons: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		vi.mocked(getCoupons).mockResolvedValue({ coupons: FIXTURE, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(getCoupons).toHaveBeenCalledWith(2);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		vi.mocked(getCoupons).mockResolvedValue({ coupons: FIXTURE, total: 45, page: 3, perPage: 20 });
		const { findByText, getByText } = render(CouponsPage);
		await findByText('SPRING10');

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});
