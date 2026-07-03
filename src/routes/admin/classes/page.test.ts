import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassesPage from './+page.svelte';
import { CLASSES, COACHES, type Coach } from '$lib/admin/data';
import { getClasses } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getClasses: vi.fn() }));

/* 與真 COACHES 完全不同的自造教練 fixture — 可證偽的關鍵:ClassEditDialog 的
 * coaches prop 預設值是真 COACHES,若頁面漏綁 `{coaches}`,對話框會靜默退回
 * 預設值;用同參照的 COACHES 當 mock payload 就永遠測不出這個漏綁。 */
const FIXTURE_COACHES: Coach[] = [
	{ id: 'cx1', name: '測試教練甲', initial: '測', title: '單元測試專用', color: '#0066CC', tags: [], years: 1, students: 0, awards: 0, classes: 0, status: 'online', phone: '0900-000-000' },
	{ id: 'cx2', name: '測試教練乙', initial: '試', title: '單元測試專用', color: '#10B981', tags: [], years: 2, students: 0, awards: 0, classes: 0, status: 'offline', phone: '0900-000-001' }
];

beforeEach(() => {
	vi.mocked(getClasses).mockReset();
	vi.mocked(getClasses).mockResolvedValue({ classes: CLASSES, coaches: FIXTURE_COACHES });
});

/* 課程管理 (admin.jsx ClassesView): PageHead + category chips + a card grid over
 * CLASSES; 編輯 / 新增課程 open the ClassEditDialog (授課教練 Select sourced from
 * the getClasses() payload). Data now arrives through the seam (async), so every
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

	/* Validates the coaches seam payload actually reaches ClassEditDialog: the
	 * 授課教練 Select must list EXACTLY the mock fixture's names (which exist
	 * nowhere else). If the page forgets to pass `{coaches}`, the dialog falls
	 * back to its default (the real COACHES) and this assertion goes red. */
	it('opens the ClassEditDialog (編輯) with the 授課教練 Select wired to the seam payload', async () => {
		const { getAllByText, getByText, getByLabelText, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯課程')).toBeInTheDocument();

		const coachSelect = getByLabelText('授課教練') as HTMLSelectElement;
		const optionLabels = [...coachSelect.options].map((o) => o.textContent);
		expect(optionLabels).toEqual(['測試教練甲', '測試教練乙']); // 只可能來自 mock payload
		expect(optionLabels).not.toContain(COACHES[0].name); // 且絕非對話框的預設 COACHES
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
