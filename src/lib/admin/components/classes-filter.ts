/* Dream Fly — 管理後台 · 課程管理 filter derivation.
 *
 * Pure, framework-free port of the React ClassesView body logic
 * (docs/design/admin/admin.jsx): filter by the selected category chip, then by
 * the topbar search term (matches class name OR coach, case-insensitive — the
 * source matches `k.name + k.coach`). Kept here, unit-testable without
 * rendering, and imported by the 課程管理 page. */

import type { ClassRow } from '$lib/admin/data';

export interface ClassesFilter {
	/** Selected category chip. '全部' (or omitted) = all categories. */
	cat?: string;
	/** Topbar search term; matched against name + coach, case-insensitive. */
	query?: string;
}

/**
 * Filter the class rows. Order mirrors the source: category → search term.
 * Returns a new array; the input is never mutated.
 */
export function filterClasses(rows: ClassRow[], opts: ClassesFilter = {}): ClassRow[] {
	const { cat = '全部', query = '' } = opts;

	let out = cat === '全部' ? [...rows] : rows.filter((k) => k.cat === cat);

	const q = query.trim().toLowerCase();
	if (q) {
		out = out.filter((k) => (k.name + k.coach).toLowerCase().includes(q));
	}

	return out;
}
