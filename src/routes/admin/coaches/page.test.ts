import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachesPage from './+page.svelte';
import { COACHES } from '$lib/admin/data';
import { getCoaches } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getCoaches: vi.fn() }));

beforeEach(() => {
	vi.mocked(getCoaches).mockReset();
	vi.mocked(getCoaches).mockResolvedValue({ coaches: COACHES });
});

/* 教練團隊 (admin.jsx CoachesView): PageHead + a card grid over COACHES. Data now
 * arrives through the getCoaches() seam (async), so every assertion first
 * awaits the ready phase.
 *
 * Clicking a card's 編輯教練 pencil opens CoachEditDialog pre-filled with that
 * coach's data (see below) — previously untestable because of a two-stage
 * `wasOpen` reactive bug that never re-populated the dialog's local copy on an
 * already-mounted instance; fixed in CoachEditDialog.svelte (single-stage
 * `lastCoach`/`wasOpen` guard, mirrors ClassEditDialog). */
describe('教練團隊 (+page)', () => {
	it('renders the PageHead title and 新增教練 action', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('教練團隊');
		expect(txt).toContain('新增教練');
	});

	it('renders every coach name from COACHES', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const txt = container.textContent ?? '';
		for (const c of COACHES) {
			expect(txt).toContain(c.name);
		}
	});

	it('renders one 編輯教練 pencil button per coach', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		expect(pencils).toHaveLength(COACHES.length);
	});

	it('opens CoachEditDialog pre-filled when the 編輯教練 pencil is clicked', async () => {
		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);

		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);

		expect(getByText('編輯教練')).toBeInTheDocument();
		expect(getByDisplayValue(COACHES[0].name)).toBeInTheDocument();
	});
});

describe('教練團隊 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getCoaches).mockReset();
		vi.mocked(getCoaches).mockRejectedValue(new Error('network'));
		const { findByText } = render(CoachesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getCoaches).mockReset();
		vi.mocked(getCoaches).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CoachesPage);
		expect(getByTestId('coaches-skeleton')).toBeTruthy();
	});
});
