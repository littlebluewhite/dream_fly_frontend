import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import VenuesPage from './+page.svelte';
import { VENUES } from '$lib/admin/data';

/* 場館管理 (reports.jsx VenuesView): PageHead + a card grid over VENUES. Each
 * card shows the venue id chip, name, a venue StatusBadge (dot), the type, a
 * 面積/容納/今日排課 strip and the 器材配置 Tag chips. */
describe('場館管理 (+page)', () => {
	it('renders the PageHead title and 新增場地 action', () => {
		const { container } = render(VenuesPage);
		const txt = container.textContent ?? '';
		expect(txt).toContain('場館管理');
		expect(txt).toContain('新增場地');
	});

	it('renders every venue name from VENUES', () => {
		const { container } = render(VenuesPage);
		const txt = container.textContent ?? '';
		for (const v of VENUES) {
			expect(txt).toContain(v.name);
		}
	});

	it('renders the venue status badge labels (可預約 + 維護中)', () => {
		const { container } = render(VenuesPage);
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('可預約'); // available venues
		expect(badges).toContain('維護中'); // 戶外場 is in maintenance
	});

	it('renders the equipment as Tag chips (含 彈翻床)', () => {
		const { container } = render(VenuesPage);
		const tags = [...container.querySelectorAll('.tag')].map((t) => t.textContent?.trim());
		expect(tags).toContain('彈翻床'); // A 訓練館 器材
		expect(tags).toContain('海綿池');
	});

	it("renders each venue's 今日排課 count and capacity", () => {
		const { container } = render(VenuesPage);
		const txt = container.textContent ?? '';
		// A 訓練館: cap 16, today 4
		expect(txt).toContain('16 人');
		expect(txt).toContain('4 堂');
	});

	/* P1 (plan B2): the 編輯 / 新增場地 buttons were dead (fired a toast only). They
	 * now open the VenueEditDialog. */
	it('opens the VenueEditDialog (編輯場地) when a card 編輯 is clicked', async () => {
		const { getAllByText, getByText, queryByText } = render(VenuesPage);
		expect(queryByText('儲存場地')).toBeNull();
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯場地')).toBeInTheDocument();
		expect(getByText('儲存場地')).toBeInTheDocument();
	});

	it('opens the VenueEditDialog in new mode (新增場地 dialog) when the header 新增場地 is clicked', async () => {
		const { getByText, queryByText } = render(VenuesPage);
		expect(queryByText('建立場地')).toBeNull();
		await fireEvent.click(getByText('新增場地'));
		expect(getByText('建立場地')).toBeInTheDocument();
	});
});
