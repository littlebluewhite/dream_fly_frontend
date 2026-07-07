import { describe, it, expect } from 'vitest';

/* Regression guard for codex round-1 [P2]: `$lib/mobile-admin/data` must re-export
 * the report row TYPES that existed on `main`, not only the data values — the
 * refactor's contract is a byte-for-byte-preserved public API. The type binding
 * below is what enforces this: if the facade drops the type re-export, `npm run
 * check` fails to compile this file (TS2305 "no exported member"). (vitest alone
 * can't catch it — type-only imports are erased at transpile time — so this guard
 * is meaningful under `npm run check`, the repo's type gate.) The runtime
 * assertion keeps it a real test and ties the type to its live data array.
 *
 * Task 15: `$lib/admin/data`'s half of this guard was removed — admin's getReports()
 * now maps real GET /reports/admin data (see admin/api.ts), and the mock report row
 * types/arrays this test pinned (CATEGORY_SPLIT, TOP_COURSES, VENUE_USAGE, …) are no
 * longer re-exported from admin/data.ts (nothing in admin/ consumes them anymore).
 * mobile-admin/data.ts is untouched and still re-exports domain/reports.ts
 * independently for its own (still-mock, out of scope) reports screen. */

import { CATEGORY_SPLIT as M_CATEGORY_SPLIT, type Split } from '$lib/mobile-admin/data';

describe('ops facades preserve report row TYPE exports (zero-API-change guard)', () => {
	it('mobile re-exports the `Split` percentage-split type', () => {
		const s: Split = M_CATEGORY_SPLIT[0];
		expect(s.label).toBeTypeOf('string');
		expect(s.pct).toBeTypeOf('number');
	});
});
