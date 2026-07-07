import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MembersPage from './+page.svelte';
import type { MemberAccount } from '$lib/admin/data';
import { getMembers, createMember, updateMember } from '$lib/admin/api';
import { toasts } from '$lib/admin/stores';
import { ApiError } from '$lib/api/client';

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

const FIXTURE: MemberAccount[] = [
	{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250 },
	{ id: 'u2', name: '陳小華', initial: '陳', phone: '', joined: '2026-02-01', status: 'inactive', points: 0 }
];

vi.mock('$lib/admin/api', () => ({ getMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn() }));

beforeEach(() => {
	vi.mocked(getMembers).mockReset();
	vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: FIXTURE.length, page: 1, perPage: 20 });
	vi.mocked(createMember).mockReset();
	vi.mocked(updateMember).mockReset();
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

	it('calls getMembers() on mount and renders the real fields', async () => {
		const { findByText, container } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getMembers).toHaveBeenCalledTimes(1);
		const txt = container.textContent ?? '';
		expect(txt).toContain(FIXTURE[0].id);
		expect(txt).toContain(FIXTURE[0].phone);
		expect(txt).toContain(FIXTURE[0].joined);
		expect(txt).toContain(String(FIXTURE[0].points));
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
		vi.mocked(getMembers).mockReset();
		vi.mocked(getMembers).mockRejectedValue(new Error('network'));
		const { findByText } = render(MembersPage);
		await findByText('載入失敗');
	});

	it('loading：顯示骨架', () => {
		vi.mocked(getMembers).mockReset();
		vi.mocked(getMembers).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(MembersPage);
		expect(getByTestId('members-skeleton')).toBeTruthy();
	});
});

describe('學員管理 — 新增學員（POST /users，Task 16）', () => {
	it('填寫必填欄位並建立 → 呼叫 createMember(payload)，成功後重新整包刷新列表', async () => {
		vi.mocked(createMember).mockResolvedValue({
			id: 'u-new', name: '新學員', initial: '新', phone: '', joined: '2026-07-06', status: 'active', points: 0
		});
		const refreshed: MemberAccount[] = [
			...FIXTURE,
			{ id: 'u-new', name: '新學員', initial: '新', phone: '', joined: '2026-07-06', status: 'active', points: 0 }
		];

		const { getByText, getByLabelText, findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getByText('新增學員'));
		await fireEvent.input(getByLabelText('Email'), { target: { value: 'new@example.com' } });
		await fireEvent.input(getByLabelText('姓名'), { target: { value: '新學員' } });
		await fireEvent.input(getByLabelText('初始密碼'), { target: { value: 'abcd1234' } });

		vi.mocked(getMembers).mockResolvedValue({ members: refreshed, total: refreshed.length, page: 1, perPage: 20 }); // 下一次 GET（刷新）回傳含新學員的清單
		await fireEvent.click(getByText('建立學員'));

		await vi.waitFor(() => expect(createMember).toHaveBeenCalledTimes(1));
		expect(createMember).toHaveBeenCalledWith({ email: 'new@example.com', name: '新學員', password: 'abcd1234' });

		await findByText('新學員'); // 刷新後的列表包含新學員
		expect(getMembers).toHaveBeenCalledTimes(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立學員')).toBeNull(); // 對話框已關閉
	});

	it('新增失敗（409 email 重複）→ 顯示 ApiError.message 原文 toast，對話框維持開啟，列表不變', async () => {
		vi.mocked(createMember).mockRejectedValue(new ApiError(409, 'Email 已被使用'));
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
		expect(getMembers).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
		expect(getByText('建立學員')).toBeInTheDocument(); // 對話框仍開著
	});
});

describe('學員管理 — 編輯學員（PATCH /users/{id}，Task 16）', () => {
	it('點擊列上的 編輯 圖示、修改後儲存 → 呼叫 updateMember(真實 id, body)，成功後重新整包刷新列表', async () => {
		vi.mocked(updateMember).mockResolvedValue({
			id: 'u1', name: '王大明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250
		});
		const refreshed: MemberAccount[] = [
			{ ...FIXTURE[0], name: '王大明' },
			FIXTURE[1]
		];

		const { getByText, getAllByLabelText, getByDisplayValue, findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getAllByLabelText('編輯')[0]); // 第一列（王小明）
		await fireEvent.input(getByDisplayValue(FIXTURE[0].name), { target: { value: '王大明' } });

		vi.mocked(getMembers).mockResolvedValue({ members: refreshed, total: refreshed.length, page: 1, perPage: 20 });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(updateMember).toHaveBeenCalledTimes(1));
		expect(updateMember).toHaveBeenCalledWith('u1', {
			name: '王大明',
			phone: FIXTURE[0].phone,
			is_active: true
		});

		await findByText('王大明'); // 刷新後的列表反映改名
		expect(getMembers).toHaveBeenCalledTimes(2); // 初次載入 + 編輯成功後刷新
		expect(queryByText('編輯學員')).toBeNull(); // 對話框已關閉
	});

	it('編輯失敗（422）→ 顯示 ApiError.message 原文 toast，列表維持原值', async () => {
		vi.mocked(updateMember).mockRejectedValue(new ApiError(422, '至少提供一個欄位'));
		const before = get(toasts).length;

		const { getByText, getAllByLabelText, findByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		await fireEvent.click(getAllByLabelText('編輯')[0]);
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toBe('至少提供一個欄位');
		expect(getMembers).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
		expect(getByText(FIXTURE[0].name)).toBeInTheDocument(); // 列表維持原值
	});
});

describe('學員管理 — 分頁（Task 17：PaginationBar 接上 getMembers() 的 total/page/perPage）', () => {
	it('依 getMembers() 回應渲染「第 x 頁，共 M 筆」，邊界頁按鈕 disabled', async () => {
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true); // 第一頁
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → 呼叫 getMembers(2)，並依新回應重新渲染清單與頁碼', async () => {
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		const page2: MemberAccount[] = [
			{ id: 'u3', name: '林大同', initial: '林', phone: '', joined: '2026-03-01', status: 'active', points: 10 }
		];
		vi.mocked(getMembers).mockResolvedValue({ members: page2, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('下一頁'));

		await findByText('林大同');
		expect(getMembers).toHaveBeenCalledWith(2);
		expect(getByText('第 2 頁，共 45 筆')).toBeInTheDocument();
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 45, page: 3, perPage: 20 });
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
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: FIXTURE.length, page: 1, perPage: 20 });
		const { findByText, queryByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('學員管理 — 複審修復（Finding 2）：「N 位學員」headline 改用 seam total', () => {
	it('total=57、目前頁只有 2 筆時，標題仍顯示「57 位學員」（非 members.length）', async () => {
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 57, page: 1, perPage: 20 });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);
		expect(getByText('57 位學員')).toBeInTheDocument();
	});
});

describe('學員管理 — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新呼叫 getMembers', async () => {
		vi.mocked(getMembers).mockResolvedValue({ members: FIXTURE, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(MembersPage);
		await findByText(FIXTURE[0].name);

		vi.mocked(getMembers).mockRejectedValueOnce(new Error('network'));
		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		vi.mocked(getMembers).mockResolvedValueOnce({ members: FIXTURE, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(getMembers).toHaveBeenLastCalledWith(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
	});
});
