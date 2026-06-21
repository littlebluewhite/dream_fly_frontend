import { describe, it, expect } from 'vitest';

/* Regression guard for codex round-1 [P2]: the ops-pair facades (`$lib/admin/data`,
 * `$lib/mobile-admin/data`) must re-export the report ROW TYPES that existed on `main`,
 * not only the data values — the refactor's contract is a byte-for-byte-preserved public
 * API. The type binding on each line below is what enforces this: if a facade drops a type
 * re-export, `npm run check` fails to compile this file (TS2305 "no exported member").
 * (vitest alone can't catch it — type-only imports are erased at transpile time — so this
 * guard is meaningful under `npm run check`, the repo's type gate.) The runtime assertions
 * keep it a real test and tie each type to its live data array. */

import {
	CATEGORY_SPLIT,
	TOP_COURSES,
	VENUE_USAGE,
	ATT_DIST,
	TIER_DIST,
	RETENTION,
	AGE_DIST,
	CAMPUS_REVENUE,
	PAYMENT_SPLIT,
	FUNNEL,
	WEEKDAY_LOAD,
	type PctSlice,
	type TopCourse,
	type VenueUsage,
	type CountBar,
	type RetentionBar,
	type CampusRevenue,
	type FunnelStage,
	type WeekdayLoad
} from '$lib/admin/data';
import { CATEGORY_SPLIT as M_CATEGORY_SPLIT, type Split } from '$lib/mobile-admin/data';

describe('ops facades preserve report row TYPE exports (zero-API-change guard)', () => {
	it('admin re-exports every report row type, usable against its data array', () => {
		const a: PctSlice = CATEGORY_SPLIT[0];
		const b: TopCourse = TOP_COURSES[0];
		const c: VenueUsage = VENUE_USAGE[0];
		const d: CountBar = ATT_DIST[0];
		const e: CountBar = TIER_DIST[0];
		const f: RetentionBar = RETENTION[0];
		const g: PctSlice = AGE_DIST[0];
		const h: CampusRevenue = CAMPUS_REVENUE[0];
		const i: PctSlice = PAYMENT_SPLIT[0];
		const j: FunnelStage = FUNNEL[0];
		const k: WeekdayLoad = WEEKDAY_LOAD[0];
		expect([a, b, c, d, e, f, g, h, i, j, k].every((x) => x != null)).toBe(true);
	});

	it('mobile re-exports the `Split` percentage-split type', () => {
		const s: Split = M_CATEGORY_SPLIT[0];
		expect(s.label).toBeTypeOf('string');
		expect(s.pct).toBeTypeOf('number');
	});
});
