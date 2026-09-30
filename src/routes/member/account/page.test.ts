import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { toasts } from '$lib/member/stores';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';

// R13 Task 3(C1):個人資料改由會員資料 module($lib/self-account)持有,頁面讀
// $selfAccount、存檔走 saveSelfAccount。測試改走 $lib/api/client + fakeRouter(ADR-0022
// 通知合一的前例)——真 getAccount、真 profile module、真 authStore,斷言 PATCH body。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// The 帳戶 page must surface the member's 訂閱/使用權 (subscriptions created at pass
// checkout) in a card after the points card.

const USER = {
	id: 'u-acct', email: 'wang.family@example.com', name: '王承恩', phone: '0911222333', phone_verified: false,
	avatar_url: null, is_active: true, created_at: '2023-09-15T00:00:00Z', roles: ['member']
};
const ME = { ...USER, birth_date: '2013-05-18', preferences: { class_reminder: true, promo: false } };

const ORDERS_RES = {
	orders: [
		{ id: 'o1', order_number: 'DF-24061', status: 'paid', total_cents: 480000, created_at: '2026-03-01T00:00:00Z', items: [{ name: '競技啦啦隊 進階班 · 2026 春季', quantity: 1 }] },
		{ id: 'o2', order_number: 'DF-23955', status: 'paid', total_cents: 340000, created_at: '2026-02-24T00:00:00Z', items: [{ name: '兒童翻滾 技巧班 · 2026 春季', quantity: 1 }] }
	],
	total: 2, page: 1, per_page: 100
};

function apiSub(id: string, name: string, started: string, cents: number) {
	return {
		id: 's-' + id, product_id: id, product_name: name, status: 'active', started_at: started,
		expires_at: null, total_sessions: null, remaining_sessions: null, price_cents: cents
	};
}

let routes: Record<string, unknown>;
function route(extra: Record<string, unknown>) {
	routes = { ...routes, ...extra };
}
function patchBodies(): unknown[] {
	return vi.mocked(api).mock.calls
		.filter(([path, init]) => path === '/users/me' && init?.method === 'PATCH')
		.map(([, init]) => JSON.parse(String(init!.body)));
}

beforeEach(async () => {
	vi.mocked(api).mockReset();
	routes = {
		'POST /auth/logout': undefined,
		'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user: USER },
		'GET /users/me': ME,
		'GET /orders/me?per_page=100': ORDERS_RES,
		'GET /points/me': { balance: 1250, ledger: [] },
		'GET /subscriptions/me': []
	};
	vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
	localStorage.clear();
	await authStore.logout(); // identity 重置:會員資料 module 每個 it 重新水合
	await authStore.login(USER.email, 'pw');
});

describe('帳戶 — 我的訂閱 / 使用權 card', () => {
	it('lists each active subscription (name, since, price)', async () => {
		route({
			'GET /subscriptions/me': [
				apiSub('product-uuid-3', '競技啦啦隊月費', '2026-06-17T00:00:00Z', 450000),
				apiSub('product-uuid-6', '無限會員卡', '2026-06-10T00:00:00Z', 600000)
			]
		});

		const { container } = render(Page);

		await screen.findByText('競技啦啦隊月費');
		expect(screen.getByText('無限會員卡')).toBeTruthy();
		expect(container.textContent).toContain('2026-06-17');
		expect(screen.getByText('NT$4,500')).toBeTruthy();
		expect(screen.getByText('NT$6,000')).toBeTruthy();
	});

	it('shows an empty state when there are no subscriptions', async () => {
		render(Page);

		await screen.findByText('目前沒有訂閱中的方案');
	});
});

describe('帳戶 — 三態', () => {
	it('shows error state when getAccount rejects', async () => {
		route({ 'GET /orders/me?per_page=100': new Error('network') });

		render(Page);

		await screen.findByText('載入失敗');
	});

	it('GET /users/me 失敗 → 整頁錯誤態(個人資料是主資料,fail-hard)', async () => {
		route({ 'GET /users/me': new Error('network') });

		render(Page);

		await screen.findByText('載入失敗');
	});

	it('shows skeleton while loading', () => {
		route({ 'GET /orders/me?per_page=100': () => new Promise(() => {}) });

		render(Page);

		expect(document.querySelector('[data-testid="account-skeleton"]')).toBeTruthy();
	});

	it('shows profile name in ready state', async () => {
		render(Page);

		await screen.findByText('王承恩');
	});

	it('不再顯示後端沒有的會員編號與家長聯絡人(D2);電話與 email 是真值', async () => {
		const { container } = render(Page);

		await screen.findByText('王承恩');
		expect(container.textContent).not.toContain('u-acct');
		expect(container.textContent).toContain('0911222333');
		expect(container.textContent).toContain('wang.family@example.com');
	});
});

describe('帳戶 — 暖機(R15 候選 F2：getAccount() 只回訂單資料，暖機與個人資料水合改由本頁宣告)', () => {
	// 退化成「等 getAccount 完成才暖機」的尾端序列會紅——主 fetch 未 resolve 前，
	// 個人資料水合與點數/訂閱暖機已經先發出。
	it('個人資料水合(GET /users/me)與點數/訂閱暖機(GET /points/me、GET /subscriptions/me)與主 GET /orders/me 並行發出', async () => {
		let resolveOrders!: (v: typeof ORDERS_RES) => void;
		route({ 'GET /orders/me?per_page=100': () => new Promise((res) => { resolveOrders = res; }) });

		render(Page);

		await vi.waitFor(() => {
			const paths = vi.mocked(api).mock.calls.map(([p]) => p);
			expect(paths).toContain('/users/me');
			expect(paths).toContain('/points/me');
			expect(paths).toContain('/subscriptions/me');
		});

		resolveOrders(ORDERS_RES);
		await screen.findByText('王承恩');
	});

	// 搬自 member/api.test.ts 舊 getAccount 單元測試(側效 hydrate 失敗仍成功回傳
	// orders)——暖機移到頁面層後，這個等價保證改在頁面層驗證。
	it('點數/訂閱暖機失敗時仍成功顯示帳戶頁(主資料 fail-hard、暖機 best-effort)', async () => {
		route({ 'GET /points/me': new Error('network down'), 'GET /subscriptions/me': new Error('network down') });

		render(Page);

		await screen.findByText('王承恩');
		expect(screen.queryByText('載入失敗')).toBeNull();
	});
});

describe('帳戶 — 編輯個人資料(R13 Task 3:經 saveSelfAccount 寫回 PATCH /users/me)', () => {
	async function openEditDialog() {
		render(Page);
		await screen.findByText('王承恩');
		await fireEvent.click(screen.getByText('編輯個人資料')); // dialog 尚未開啟，此時唯一一個符合的元素
	}
	const birthInput = () => screen.getByLabelText('生日') as HTMLInputElement;

	it('顯示既有生日（YYYY-MM-DD，與 <input type="date"> 格式一致）', async () => {
		await openEditDialog();
		expect(birthInput().value).toBe('2013-05-18');
	});

	it('改姓名/生日/活動與優惠並儲存 → PATCH 只送改過的欄位、偏好送整包;成功 toast、關閉對話框、名字同步', async () => {
		route({
			'PATCH /users/me': {
				...ME, name: '王大明', birth_date: '2013-06-01',
				preferences: { class_reminder: true, coach_msg: true, promo: true, dark: false }
			}
		});
		await openEditDialog();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '王大明' } });
		await fireEvent.input(birthInput(), { target: { value: '2013-06-01' } });
		await fireEvent.click(screen.getAllByRole('switch')[1]); // 活動與優惠
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() =>
			expect(patchBodies()).toEqual([
				{ name: '王大明', birth_date: '2013-06-01', preferences: { class_reminder: true, coach_msg: true, promo: true, dark: false } }
			])
		);
		await vi.waitFor(() => expect(screen.queryByText('儲存資料')).toBeNull()); // 對話框已關閉
		expect(get(toasts).some((t) => t.tone === 'success' && t.body.includes('個人資料已更新'))).toBe(true);
		expect(screen.getByText('王大明')).toBeInTheDocument(); // 卡片讀 $selfAccount,已更新
		expect(get(authStore).member?.name).toBe('王大明'); // Topbar 讀的 authStore 也同步
	});

	it('清空生日並儲存 → PATCH 送 birth_date: null', async () => {
		route({ 'PATCH /users/me': { ...ME, birth_date: null } });
		await openEditDialog();

		await fireEvent.input(birthInput(), { target: { value: '' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() => expect(patchBodies()).toEqual([{ birth_date: null }]));
	});

	it('Email 只讀', async () => {
		await openEditDialog();
		expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
	});

	it('姓名不合規(少於 2 字)→ 顯示原因、儲存鈕停用', async () => {
		await openEditDialog();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '王' } });

		expect(screen.getByRole('alert').textContent).toContain('2–100');
		expect((screen.getByText('儲存資料').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});

	it('儲存失敗（PATCH rejects）→ 顯示錯誤 toast，對話框不關閉', async () => {
		route({ 'PATCH /users/me': new Error('network') });
		await openEditDialog();

		await fireEvent.input(birthInput(), { target: { value: '2013-06-01' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.tone === 'error' && t.body.includes('連線發生問題'))).toBe(true);
		});
		expect(screen.getByText('儲存資料')).toBeInTheDocument(); // 對話框仍開啟，可重試
	});
});
