import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MembersPage from './+page.svelte';
import type { UserResponse } from '$lib/api/generated';
import { toasts } from '$lib/admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';
import { userResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，getMembers/createMember/updateMember 走真
 * mapper(GET /users?page=n、POST /users、PATCH /users/{id})。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 學員管理 (+page): Task 5 — wires the real getMembers() seam (GET /users, admin).
 * PageHead (進階篩選 toggle) over MembersTable's honest, slimmed table (name/phone/
 * joined/status/points — the only 7 fields GET /users returns). Data now arrives
 * async via getMembers(): onMount loads it into a three-state gate
 * (loading/error/ready), matching the orders/tickets/classes/coaches admin pages
 * wired in Task 18.
 *
 * Task 16: 新增/編輯 wired for real — contract §3.2 gained POST /users and PATCH
 * /users/{id}. This page owns MemberCreateDialog/MemberEditDialog + the actual
 * createMember/updateMember calls (same ownership split as classes/venues/
 * coupons +page.svelte); MembersTable itself only fires onNew/onEdit callback
 * props. 409/422 errors surface e.message directly (backend's own 繁中 text is
 * already user-facing — no custom status→copy mapping table like courses/
 * coupons use). */

const FIXTURE: UserResponse[] = [
	userResponse({ id: 'u1', name: '王小明', phone: '0912345678', created_at: '2026-01-15T00:00:00Z', is_active: true, points_balance: 1250 }),
	userResponse({ id: 'u2', name: '陳小華', phone: null, created_at: '2026-02-01T00:00:00Z', is_active: false, points_balance: 0 })
];

const page = (users: UserResponse[], n: number, total = users.length) => ({ users, total, page: n, per_page: 20 });

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users?page=1': page(FIXTURE, 1), ...overrides }, ADMIN_ROUTES));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('學員管理 (+page)', () => {
	it('renders the PageHead title and the 進階篩選 toggle once loaded', async () => {
		const { container, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('學員管理');
		expect(txt).toContain('進階篩選');
	});

	it('toggles the MemberFilterPanel (套用/重設) when 進階篩選 is clicked', async () => {
		const { getByRole, getByText, queryByText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		// collapsed by default — the panel actions are not shown
		expect(queryByText('套用')).toBeNull();
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(getByText('套用')).toBeInTheDocument();
		expect(getByText('重設')).toBeInTheDocument();
		// clicking again collapses it
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(queryByText('套用')).toBeNull();
	});

	it('calls GET /users?page=1 on mount and renders the real fields', async () => {
		const { findByText, container } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(apiCalls('GET /users?page=1')).toHaveLength(1);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE[0].id);
		expect(txt).toContain('0912345678');
		expect(txt).toContain('2026-01-15'); // created_at 的日期部分
		expect(txt).toContain('1250');
		expect(txt).toContain(FIXTURE[1].name);
	});

	it('does not render columns/filters with no backend data source (新增學員 now shows — Task 16)', async () => {
		const { findByText, container, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		const txt = container.textContent ?? '';
		for (const label of ['課程', '分校', '授課教練', '出席率', '繳費', '剩餘堂數', '近況']) {
			expect(txt).not.toContain(label);
		}
		expect(container.querySelectorAll('.att-dot')).toHaveLength(0);
		expect(getByText('新增學員')).toBeInTheDocument();
	});

	it('進階篩選 panel only offers 最低點數 (course/pay/attendance filters removed — no backend data)', async () => {
		const { getByRole, getByLabelText, queryByText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(getByLabelText('最低點數')).toBeInTheDocument();
		expect(queryByText('報名課程')).toBeNull();
		expect(queryByText('繳費狀態')).toBeNull();
		expect(queryByText('出席率區間')).toBeNull();
	});
});

describe('學員管理 (+page) — 三態', () => {
	it('error：顯示「載入失敗」', async () => {
		route({ 'GET /users?page=1': new Error('network') });
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');
	});

	it('loading：顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(MembersPage);
		expect(getByTestId('members-skeleton')).toBeTruthy();
	});
});

describe('學員管理 — 新增學員（POST /users，Task 16）', () => {
	it('填寫必填欄位並建立 → POST /users(payload)，成功後重新整包刷新列表', async () => {
		const created = userResponse({ id: 'u-new', name: '新學員', email: 'new@example.com', created_at: '2026-07-06T00:00:00Z' });
		const refreshed = [...FIXTURE, created];

		const { getByText, getByLabelText, findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getByText('新增學員'));
		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });

		route({ 'GET /users?page=1': page(refreshed, 1), 'POST /users': created }); // 下一次 GET（刷新）回傳含新學員的清單
		await fireEvent.click(getByText('建立學員'));

		await vi.waitFor(() => expect(apiCalls('POST /users')).toHaveLength(1));
		expect(apiBody('POST /users')).toEqual({ email: 'new@example.com', name: '新學員', password: 'abcd1234' });

		await findByText('新學員'); // 刷新後的列表包含新學員
		expect(apiCalls('GET /users?page=1')).toHaveLength(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立學員')).toBeNull(); // 對話框已關閉
	});

	it('新增失敗（409 email 重複）→ 顯示 ApiError.message 原文 toast，對話框維持開啟，列表不變', async () => {
		route({ 'POST /users': new ApiError(409, 'Email 已被使用') });
		const before = get(toasts).length;

		const { getByText, getByLabelText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getByText('新增學員'));
		await fireEvent.input(getByLabelText('Email'), { target: { value: 'dup@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '重複學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });
		await fireEvent.click(getByText('建立學員'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toBe('Email 已被使用'); // ApiError.message 直通，無二次改寫
		expect(apiCalls('GET /users?page=1')).toHaveLength(1); // 失敗不重新整包刷新
		expect(await findByText('建立學員')).toBeInTheDocument(); // 對話框仍開著（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
	});
});

describe('學員管理 — 編輯學員（PATCH /users/{id}，Task 16）', () => {
	it('點擊列上的 編輯 圖示、修改後儲存 → PATCH /users/{真實 id}(body)，成功後重新整包刷新列表', async () => {
		const updated = { ...FIXTURE[0], name: '王大明' };
		const refreshed = [updated, FIXTURE[1]];

		const { getByText, getAllByLabelText, getByDisplayValue, findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getAllByLabelText('編輯')[0]); // 第一列（王小明）
		await fireEvent.input(getByDisplayValue(FIXTURE[0].name), { target: { value: '王大明' } });

		route({ 'GET /users?page=1': page(refreshed, 1), 'PATCH /users/u1': updated });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(apiCalls('PATCH /users/u1')).toHaveLength(1));
		expect(apiBody('PATCH /users/u1')).toEqual({
			name: '王大明',
			phone: FIXTURE[0].phone,
			is_active: true
		});

		await findByText('王大明'); // 刷新後的列表反映改名
		expect(apiCalls('GET /users?page=1')).toHaveLength(2); // 初次載入 + 編輯成功後刷新
		expect(queryByText('編輯學員')).toBeNull(); // 對話框已關閉
	});

	it('編輯失敗（422）→ 顯示 ApiError.message 原文 toast，列表維持原值', async () => {
		route({ 'PATCH /users/u1': new ApiError(422, '至少提供一個欄位') });
		const before = get(toasts).length;

		const { getByText, getAllByLabelText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getAllByLabelText('編輯')[0]);
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toBe('至少提供一個欄位');
		expect(apiCalls('GET /users?page=1')).toHaveLength(1); // 失敗不重新整包刷新
		expect(getByText(FIXTURE[0].name)).toBeInTheDocument(); // 列表維持原值
	});
});

describe('學員管理 — 分頁（Task 17：PaginationBar 接上 GET /users 的 total/page/per_page）', () => {
	it('依 GET /users 回應渲染「第 x 頁，共 M 筆」，邊界頁按鈕 disabled', async () => {
		route({ 'GET /users?page=1': page(FIXTURE, 1, 45) });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true); // 第一頁
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → GET /users?page=2，並依新回應重新渲染清單與頁碼', async () => {
		const page2 = [userResponse({ id: 'u3', name: '林大同', created_at: '2026-03-01T00:00:00Z', points_balance: 10 })];
		route({ 'GET /users?page=1': page(FIXTURE, 1, 45), 'GET /users?page=2': page(page2, 2, 45) });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getByText('下一頁'));

		await findByText('林大同');
		expect(apiCalls('GET /users?page=2')).toHaveLength(1);
		expect(getByText('第 2 頁，共 45 筆')).toBeInTheDocument();
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		route({ 'GET /users?page=1': page(FIXTURE, 3, 45) });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('學員管理 — 複審修復（Finding 1）：搜尋/篩選僅作用於目前頁面的提示', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		route({ 'GET /users?page=1': page(FIXTURE, 1, 45) });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		route({ 'GET /users?page=1': page(FIXTURE, 1) });
		const { findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('學員管理 — 複審修復（Finding 2）：「N 位學員」headline 改用 seam total', () => {
	it('total=57、目前頁只有 2 筆時，標題仍顯示「57 位學員」（非 members.length）', async () => {
		route({ 'GET /users?page=1': page(FIXTURE, 1, 57) });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getByText('57 位學員')).toBeInTheDocument();
	});
});

describe('學員管理 — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新 GET /users', async () => {
		let page2Calls = 0;
		route({
			'GET /users?page=1': page(FIXTURE, 1, 45),
			'GET /users?page=2': () => (++page2Calls === 1 ? new Error('network') : page(FIXTURE, 2, 45))
		});
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /users?page=2')).toHaveLength(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
		expect(apiCalls('GET /users?page=1')).toHaveLength(1);
	});
});
