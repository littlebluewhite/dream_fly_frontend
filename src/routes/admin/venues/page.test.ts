import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import VenuesPage from './+page.svelte';
import { VENUES } from '$lib/admin/data';
import { getVenues } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getVenues: vi.fn() }));

beforeEach(() => {
	vi.mocked(getVenues).mockReset();
	vi.mocked(getVenues).mockResolvedValue({ venues: VENUES });
});

/* 場館管理 (reports.jsx VenuesView): PageHead + a card grid over VENUES. Each
 * card shows the venue id chip, name, a venue StatusBadge (dot), the type, a
 * 面積/容納/今日排課 strip and the 器材配置 Tag chips. Data now arrives through the
 * getVenues() seam (async), so every assertion first awaits the ready phase. */
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

	it("renders each venue's 今日排課 count and capacity", async () => {
		const { container, findByText } = render(VenuesPage);
		await findByText(VENUES[0].name);
		const txt = container.textContent ?? '';
		// A 訓練館: cap 16, today 4
		expect(txt).toContain('16 人');
		expect(txt).toContain('4 堂');
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
