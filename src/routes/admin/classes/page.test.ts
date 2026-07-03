import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassesPage from './+page.svelte';
import { CLASSES, COACHES } from '$lib/admin/data';
import { getClasses } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getClasses: vi.fn() }));

beforeEach(() => {
	vi.mocked(getClasses).mockReset();
	vi.mocked(getClasses).mockResolvedValue({ classes: CLASSES, coaches: COACHES });
});

/* 課程管理 (admin.jsx ClassesView): PageHead + category chips + a card grid over
 * CLASSES; 編輯 / 新增課程 open the ClassEditDialog (授課教練 Select sourced from
 * COACHES). Data now arrives through the getClasses() seam (async), so every
 * assertion first awaits the ready phase. */
describe('課程管理 (+page)', () => {
	it('renders the PageHead title and 新增課程 action', async () => {
		const { container, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('課程管理');
		expect(txt).toContain('新增課程');
	});

	it('renders every class name from CLASSES', async () => {
		const { container, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		const txt = container.textContent ?? '';
		for (const k of CLASSES) {
			expect(txt).toContain(k.name);
		}
	});

	/* Validates the coaches seam payload actually reaches ClassEditDialog (not
	 * just the page's own blankClass default) — the 授課教練 Select must list
	 * every real coach name, not just whatever the dialog happened to import. */
	it('opens the ClassEditDialog (編輯) with the 授課教練 Select populated from COACHES', async () => {
		const { getAllByText, getByText, getByLabelText, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯課程')).toBeInTheDocument();

		const coachSelect = getByLabelText('授課教練') as HTMLSelectElement;
		const optionLabels = [...coachSelect.options].map((o) => o.textContent);
		for (const c of COACHES) {
			expect(optionLabels).toContain(c.name);
		}
	});

	it('opens the ClassEditDialog in new mode (新增班級) when the header 新增課程 is clicked', async () => {
		const { getByText, queryByText, findByText } = render(ClassesPage);
		await findByText('新增課程');
		expect(queryByText('建立班級')).toBeNull();
		await fireEvent.click(getByText('新增課程'));
		expect(getByText('建立班級')).toBeInTheDocument();
	});
});

describe('課程管理 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getClasses).mockReset();
		vi.mocked(getClasses).mockRejectedValue(new Error('network'));
		const { findByText } = render(ClassesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getClasses).mockReset();
		vi.mocked(getClasses).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(ClassesPage);
		expect(getByTestId('classes-skeleton')).toBeTruthy();
	});
});
