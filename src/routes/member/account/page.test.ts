import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { subscriptions, toasts } from '$lib/member/stores';
import { getAccount, saveBirthDate } from '$lib/member/api';
import type { AccountData } from '$lib/member/api';
import { ME, type Order } from '$lib/member/data';

vi.mock('$lib/member/api', () => ({ getAccount: vi.fn(), saveBirthDate: vi.fn() }));

// The 帳戶 page must surface the member's 訂閱/使用權 (subscriptions created at pass
// checkout) in a card after the points card.

// Task 1(C2 死種子退役):domain/member-app.ts 的 ORDERS(值)已退役——改為檔內 inline
// fixture(2 筆)。domain 的 Order.status 是寬鬆的 [string, string]；member/data.ts
// 的 Order 是嚴格的 [Tone, string]——沿用既有慣例宣告成嚴格型別，維持與
// AccountData.orders: Order[] 的相容。
const ORDERS: Order[] = [
	{ id: 'DF-24061', item: '競技啦啦隊 進階班 · 2026 春季', amount: 4800, status: ['success', '已付款'], date: '2026/03/01' },
	{ id: 'DF-23955', item: '兒童翻滾 技巧班 · 2026 春季', amount: 3400, status: ['success', '已付款'], date: '2026/02/24' }
];

const SEED: AccountData = {
	orders: ORDERS,
	profile: {
		...ME,
		birth: '2013-05-18',
		phone: '0911-222-333',
		email: 'wang.family@example.com',
		guardian: '王先生 · 0911-222-333',
		remind: true,
		promo: false
	}
};

beforeEach(() => {
	vi.mocked(getAccount).mockReset();
	vi.mocked(saveBirthDate).mockReset();
	localStorage.clear();
	subscriptions.set([]);
});

describe('帳戶 — 我的訂閱 / 使用權 card', () => {
	it('lists each active subscription (name, since, price)', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);
		subscriptions.set([
			{ id: 'product-uuid-3', name: '競技啦啦隊月費', since: '2026/06/17', price: 4500 },
			{ id: 'product-uuid-6', name: '無限會員卡', since: '2026/06/10', price: 6000 }
		]);

		const { container } = render(Page);

		await screen.findByText('競技啦啦隊月費');
		expect(screen.getByText('無限會員卡')).toBeTruthy();
		expect(container.textContent).toContain('2026/06/17');
		expect(screen.getByText('NT$4,500')).toBeTruthy();
		expect(screen.getByText('NT$6,000')).toBeTruthy();
	});

	it('shows an empty state when there are no subscriptions', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);
		subscriptions.set([]);

		render(Page);

		await screen.findByText('目前沒有訂閱中的方案');
	});
});

describe('帳戶 — 三態', () => {
	it('shows error state when getAccount rejects', async () => {
		vi.mocked(getAccount).mockRejectedValue(new Error('network'));

		render(Page);

		await screen.findByText('載入失敗');
	});

	it('shows skeleton while loading', () => {
		vi.mocked(getAccount).mockReturnValue(new Promise(() => {}));

		render(Page);

		expect(document.querySelector('[data-testid="account-skeleton"]')).toBeTruthy();
	});

	it('shows profile name in ready state', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);

		render(Page);

		await screen.findByText('王承恩');
	});
});

describe('帳戶 — 編輯個人資料 · 生日（Round 4 Task P4-F4）', () => {
	async function openEditDialog() {
		vi.mocked(getAccount).mockResolvedValue(SEED);
		render(Page);
		await screen.findByText('王承恩');
		await fireEvent.click(screen.getByText('編輯個人資料')); // dialog 尚未開啟，此時唯一一個符合的元素
		return screen.getByLabelText('生日') as HTMLInputElement;
	}

	it('顯示既有生日（YYYY-MM-DD，與 <input type="date"> 格式一致）', async () => {
		const birthInput = await openEditDialog();
		expect(birthInput.value).toBe('2013-05-18');
	});

	it('修改生日並儲存 → 呼叫 saveBirthDate(新日期)，成功後顯示成功 toast 並關閉對話框', async () => {
		vi.mocked(saveBirthDate).mockResolvedValue({ ...SEED.profile, birth: '2013-06-01' });
		const birthInput = await openEditDialog();

		await fireEvent.input(birthInput, { target: { value: '2013-06-01' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() => expect(saveBirthDate).toHaveBeenCalledWith('2013-06-01'));
		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.tone === 'success' && t.body.includes('僅本機預覽'))).toBe(true);
		});
		expect(screen.queryByText('儲存資料')).toBeNull(); // 對話框已關閉
	});

	it('清空生日並儲存 → saveBirthDate 收到空字串（由 api 層負責轉成顯式 null 清除）', async () => {
		vi.mocked(saveBirthDate).mockResolvedValue({ ...SEED.profile, birth: '' });
		const birthInput = await openEditDialog();

		await fireEvent.input(birthInput, { target: { value: '' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() => expect(saveBirthDate).toHaveBeenCalledWith(''));
	});

	it('儲存失敗（saveBirthDate rejects）→ 顯示錯誤 toast，對話框不關閉', async () => {
		vi.mocked(saveBirthDate).mockRejectedValue(new Error('network'));
		const birthInput = await openEditDialog();

		await fireEvent.input(birthInput, { target: { value: '2013-06-01' } });
		await fireEvent.click(screen.getByText('儲存資料'));

		await vi.waitFor(() => {
			expect(get(toasts).some((t) => t.tone === 'error' && t.body.includes('連線發生問題'))).toBe(true);
		});
		expect(screen.getByText('儲存資料')).toBeInTheDocument(); // 對話框仍開啟，可重試
	});
});
