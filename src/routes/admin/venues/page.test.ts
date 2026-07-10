import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import VenuesPage from './+page.svelte';
import { VENUES } from '$lib/admin/data';
import { getVenues, createVenue, updateVenue } from '$lib/admin/api';
import { toasts } from '$lib/admin/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({ getVenues: vi.fn(), createVenue: vi.fn(), updateVenue: vi.fn() }));

beforeEach(() => {
	vi.mocked(getVenues).mockReset();
	vi.mocked(getVenues).mockResolvedValue({ venues: VENUES });
	vi.mocked(createVenue).mockReset();
	vi.mocked(updateVenue).mockReset();
});

/* 場館管理 (reports.jsx VenuesView): PageHead + a card grid over VENUES. Each
 * card shows the venue slug chip, name, a venue StatusBadge (dot), the type,
 * and the 器材配置 Tag chips (Task F4：area/cap/今日排課 已收斂移除，見
 * VenueEditDialog 欄位收斂). Data arrives through the getVenues() seam (async),
 * so every assertion first awaits the ready phase. */
describe('場館管理 (+page)', () => {
	it('renders the PageHead title and 新增場地 action', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館管理');
		expect(txt).toContain('新增場地');
	});

	it('renders every venue name from VENUES', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const txt = container.textContent ?? '';
		for (const v of VENUES) {
			expect(txt).toContain(v.name);
		}
	});

	it('renders the venue status badge labels (可預約 + 維護中)', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('可預約'); // available venues
		expect(badges).toContain('維護中'); // 戶外場 is in maintenance
	});

	it('renders the equipment as Tag chips (含 彈翻床)', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const tags = [...container.querySelectorAll('.tag')].map((t) => t.textContent?.trim());
		expect(tags).toContain('彈翻床'); // A 訓練館 器材
		expect(tags).toContain('海綿池');
	});

	it('renders each venue slug (the id chip) instead of the removed 面積/容納/今日排課 stats (Task F4)', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain(VENUES[0].slug);
		for (const removed of ['面積', '容納', '今日排課']) {
			expect(txt).not.toContain(removed);
		}
	});

	/* P1 (plan B1): the 編輯 / 新增場地 buttons were dead (fired a toast only). They
	 * now open the VenueEditDialog. */
	it('opens the VenueEditDialog (編輯場地) when a card 編輯 is clicked', async () => {
		const { getAllByText, getByText, queryByText, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		expect(queryByText('儲存場地')).toBeNull();
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯場地')).toBeInTheDocument();
		expect(getByText('儲存場地')).toBeInTheDocument();
	});

	it('opens the VenueEditDialog in new mode (新增場地 dialog) when the header 新增場地 is clicked', async () => {
		const { getByText, queryByText, findByText } = render(VenuesPage);
		await findByText('新增場地');
		expect(queryByText('建立場地')).toBeNull();
		await fireEvent.click(getByText('新增場地'));
		expect(getByText('建立場地')).toBeInTheDocument();
	});
});

describe('場館管理 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getVenues).mockReset();
		vi.mocked(getVenues).mockRejectedValue(new Error('network'));
		const { findByText } = render(VenuesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getVenues).mockReset();
		vi.mocked(getVenues).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(VenuesPage);
		expect(getByTestId('venues-skeleton')).toBeTruthy();
	});
});

describe('場館管理 — 新增/編輯接真 API（Task F4：POST/PATCH /venues）', () => {
	it('新增場地：填寫名稱後點擊建立場地，呼叫 createVenue 並在成功後重新整包刷新列表', async () => {
		vi.mocked(createVenue).mockResolvedValue({
			id: 'v-new', category_id: null, name: '新場地', slug: 'new-venue', description: '',
			features: [], image_url: null, is_active: true, created_at: ''
		});
		const refreshed = [...VENUES, { ...VENUES[0], id: 'v-new', slug: 'new-venue', name: '新場地' }];

		const { getByText, getByLabelText, findByText, queryByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		await fireEvent.click(getByText('新增場地'));
		await fireEvent.input(getByLabelText('場地名稱'), { target: { value: '新場地' } });

		vi.mocked(getVenues).mockResolvedValue({ venues: refreshed }); // 下一次 GET（刷新）回傳含新場地的清單
		await fireEvent.click(getByText('建立場地'));

		await vi.waitFor(() => expect(createVenue).toHaveBeenCalledTimes(1));
		const body = vi.mocked(createVenue).mock.calls[0][0];
		expect(body.name).toBe('新場地');
		expect(body.description).toBe(''); // blankVenue 預設 type（借用 description）
		expect(body.features).toEqual([]); // blankVenue 預設 equip
		expect(body.is_active).toBe(true); // blankVenue 預設狀態 available

		await findByText('新場地'); // 刷新後的列表包含新場地
		expect(getVenues).toHaveBeenCalledTimes(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立場地')).toBeNull(); // 對話框已關閉
	});

	it('編輯場地：修改後點擊儲存場地，呼叫 updateVenue(真實 id, body) 並在成功後重新整包刷新列表', async () => {
		const target = VENUES[0];
		vi.mocked(updateVenue).mockResolvedValue({
			id: target.id, category_id: null, name: '改名場地', slug: target.slug, description: target.type,
			features: target.equip, image_url: null, is_active: true, created_at: ''
		});
		const refreshed = VENUES.map((v) => (v.id === target.id ? { ...v, name: '改名場地' } : v));

		const { getByText, getAllByText, getByDisplayValue, findByText } = render(VenuesPage);
		await findByText(target.name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名場地' } });

		vi.mocked(getVenues).mockResolvedValue({ venues: refreshed });
		await fireEvent.click(getByText('儲存場地'));

		await vi.waitFor(() => expect(updateVenue).toHaveBeenCalledTimes(1));
		expect(vi.mocked(updateVenue).mock.calls[0][0]).toBe(target.id); // 真實 id
		const body = vi.mocked(updateVenue).mock.calls[0][1];
		expect(body.name).toBe('改名場地');
		expect(body.features).toEqual(target.equip); // 未改動的器材配置原樣送出

		await findByText('改名場地'); // 刷新後的列表反映改名
		expect(getVenues).toHaveBeenCalledTimes(2); // 初次載入 + 編輯成功後刷新
	});

	it('新增場地失敗（409 slug 撞號）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		vi.mocked(createVenue).mockRejectedValue(new ApiError(409, 'venue slug already exists'));
		const before = get(toasts).length;

		const { getByText, getByLabelText, findByText, queryByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		await fireEvent.click(getByText('新增場地'));
		await fireEvent.input(getByLabelText('場地名稱'), { target: { value: '重複場地' } });
		await fireEvent.click(getByText('建立場地'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('slug');
		expect(queryByText('重複場地')).toBeNull(); // 未進入列表
		expect(await findByText('建立場地')).toBeInTheDocument(); // 對話框仍開著，可修正重試（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(getVenues).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
	});

	it('編輯場地失敗（422 驗證）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		vi.mocked(updateVenue).mockRejectedValue(new ApiError(422, 'invalid venue payload'));
		const before = get(toasts).length;

		const { getByText, getAllByText, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('儲存場地'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不符規則');
		expect(await findByText(VENUES[0].name)).toBeInTheDocument(); // 原名稱仍在
		expect(getVenues).toHaveBeenCalledTimes(1); // 失敗不重新整包刷新
	});
});
