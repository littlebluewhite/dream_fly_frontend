import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import VenuesPage from './+page.svelte';
import type { VenueResponse } from '$lib/api/generated';
import { toasts } from '$lib/admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';
import { venueResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，getVenues/createVenue/updateVenue 走真 mapper
 * (GET /venues、POST /venues、PATCH /venues/{id})。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const VENUES: VenueResponse[] = [
	venueResponse({ id: 'v-a', slug: 'a-hall', name: 'A 訓練館', description: '競技主訓練場', features: ['彈翻床', '平衡木', '海綿池'] }),
	venueResponse({ id: 'v-b', slug: 'b-room', name: 'B 教室', description: '兒童基礎教室', features: ['軟墊', '跳箱'] }),
	venueResponse({ id: 'v-d', slug: 'outdoor', name: '戶外場', description: '跑酷 / 體能', features: ['跑酷箱'], is_active: false })
];

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /venues': VENUES, ...overrides }, ADMIN_ROUTES));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

/* 場館管理 (reports.jsx VenuesView): PageHead + a card grid over VENUES. Each
 * card shows the venue slug chip, name, a venue StatusBadge (dot), the type,
 * and the 器材配置 Tag chips (Task F4：area/cap/今日排課 已收斂移除，見
 * VenueEditDialog 欄位收斂). Data arrives through GET /venues (async),
 * so every assertion first awaits the ready phase. */
describe('場館管理 (+page)', () => {
	it('renders the PageHead title and 新增場地 action', async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館管理');
		expect(txt).toContain('新增場地');
	});

	it('renders every venue name from GET /venues', async () => {
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
		expect(badges).toContain('維護中'); // 戶外場 is_active=false → 維護中
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
		route({ 'GET /venues': new Error('network') });
		const { findByText } = render(VenuesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(VenuesPage);
		expect(getByTestId('venues-skeleton')).toBeTruthy();
	});
});

describe('場館管理 — 新增/編輯接真 API（Task F4：POST/PATCH /venues）', () => {
	it('新增場地：填寫名稱後點擊建立場地，POST /venues 並在成功後重新整包刷新列表', async () => {
		const created = venueResponse({ id: 'v-new', name: '新場地', slug: 'new-venue', description: '' });
		const refreshed = [...VENUES, created];

		const { getByText, getByLabelText, findByText, queryByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		await fireEvent.click(getByText('新增場地'));
		await fireEvent.input(getByLabelText('場地名稱'), { target: { value: '新場地' } });

		route({ 'GET /venues': refreshed, 'POST /venues': created }); // 下一次 GET（刷新）回傳含新場地的清單
		await fireEvent.click(getByText('建立場地'));

		await vi.waitFor(() => expect(apiCalls('POST /venues')).toHaveLength(1));
		const body = apiBody('POST /venues') as Record<string, unknown>;
		expect(body.name).toBe('新場地');
		expect(body.description).toBe(''); // blankVenue 預設 type（借用 description）
		expect(body.features).toEqual([]); // blankVenue 預設 equip
		expect(body.is_active).toBe(true); // blankVenue 預設狀態 available

		await findByText('新場地'); // 刷新後的列表包含新場地
		expect(apiCalls('GET /venues')).toHaveLength(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立場地')).toBeNull(); // 對話框已關閉
	});

	it('編輯場地：修改後點擊儲存場地，PATCH /venues/{真實 id} 並在成功後重新整包刷新列表', async () => {
		const target = VENUES[0];
		const updated = { ...target, name: '改名場地' };
		const refreshed = VENUES.map((v) => (v.id === target.id ? updated : v));

		const { getByText, getAllByText, getByDisplayValue, findByText } = render(VenuesPage);
		await findByText(target.name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名場地' } });

		route({ 'GET /venues': refreshed, [`PATCH /venues/${target.id}`]: updated });
		await fireEvent.click(getByText('儲存場地'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /venues/${target.id}`)).toHaveLength(1)); // 真實 id
		const body = apiBody(`PATCH /venues/${target.id}`) as Record<string, unknown>;
		expect(body.name).toBe('改名場地');
		expect(body.features).toEqual(target.features); // 未改動的器材配置原樣送出

		await findByText('改名場地'); // 刷新後的列表反映改名
		expect(apiCalls('GET /venues')).toHaveLength(2); // 初次載入 + 編輯成功後刷新
	});

	it('新增場地失敗（409 slug 撞號）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		route({ 'POST /venues': new ApiError(409, 'venue slug already exists') });
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
		expect(apiCalls('GET /venues')).toHaveLength(1); // 失敗不重新整包刷新
	});

	it('編輯場地失敗（422 驗證）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		route({ [`PATCH /venues/${VENUES[0].id}`]: new ApiError(422, 'invalid venue payload') });
		const before = get(toasts).length;

		const { getByText, getAllByText, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('儲存場地'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不符規則');
		expect(await findByText(VENUES[0].name)).toBeInTheDocument(); // 原名稱仍在
		expect(apiCalls('GET /venues')).toHaveLength(1); // 失敗不重新整包刷新
	});
});
