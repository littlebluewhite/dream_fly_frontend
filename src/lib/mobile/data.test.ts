import { describe, it, expect } from 'vitest';

/* Regression guard (Task 1, member-app 單一來源): mobile's data facade re-exports
 * both VALUES and TYPES from `$lib/domain/member-app` for the 16 seed constants
 * that are byte-equal between member and mobile (ANNOUNCE differs by one item's
 * `bg` colour, so it stays local as its own literal array — not covered here).
 * The value assertions below prove each one is the SAME reference as domain's
 * (not a re-typed copy) — the single-source guarantee this refactor exists for.
 * The type block mirrors `src/lib/admin/facade-type-exports.test.ts`: if mobile
 * ever drops a type re-export (including a renamed alias like `Upcoming` /
 * `MyCourse`), this file fails to COMPILE under `npm run check`, not just at
 * runtime (vitest alone can't catch a missing type-only export). */

import {
	ME,
	STATS,
	SKILLS,
	UPCOMING,
	MY_COURSES,
	ATT_HISTORY,
	CATALOG,
	SCHEDULE,
	ORDERS,
	MAKEUP_SLOTS,
	CONTACT_THREAD,
	NOTIFS_SEED,
	POINTS_LEDGER,
	REWARDS,
	REPORTS,
	CERTS,
	type Member,
	type Stat,
	type Skill,
	type Upcoming,
	type MyCourse,
	type AttRecord,
	type Course,
	type ScheduleBlock,
	type Order,
	type MakeupSlot,
	type ThreadMsg,
	type NotifItem,
	type PointsEntry,
	type Reward,
	type Report,
	type Cert
} from '$lib/mobile/data';
import {
	ME as D_ME,
	STATS as D_STATS,
	SKILLS as D_SKILLS,
	UPCOMING as D_UPCOMING,
	MY_COURSES as D_MY_COURSES,
	ATT_HISTORY as D_ATT_HISTORY,
	CATALOG as D_CATALOG,
	SCHEDULE as D_SCHEDULE,
	ORDERS as D_ORDERS,
	MAKEUP_SLOTS as D_MAKEUP_SLOTS,
	CONTACT_THREAD as D_CONTACT_THREAD,
	NOTIFS_SEED as D_NOTIFS_SEED,
	POINTS_LEDGER as D_POINTS_LEDGER,
	REWARDS as D_REWARDS,
	REPORTS as D_REPORTS,
	CERTS as D_CERTS
} from '$lib/domain/member-app';

describe('mobile facade re-exports domain/member-app by reference (single source)', () => {
	it('every shared constant is the SAME array/object as domain (toBe, not a copy)', () => {
		expect(ME).toBe(D_ME);
		expect(STATS).toBe(D_STATS);
		expect(SKILLS).toBe(D_SKILLS);
		expect(UPCOMING).toBe(D_UPCOMING);
		expect(MY_COURSES).toBe(D_MY_COURSES);
		expect(ATT_HISTORY).toBe(D_ATT_HISTORY);
		expect(CATALOG).toBe(D_CATALOG);
		expect(SCHEDULE).toBe(D_SCHEDULE);
		expect(ORDERS).toBe(D_ORDERS);
		expect(MAKEUP_SLOTS).toBe(D_MAKEUP_SLOTS);
		expect(CONTACT_THREAD).toBe(D_CONTACT_THREAD);
		expect(NOTIFS_SEED).toBe(D_NOTIFS_SEED);
		expect(POINTS_LEDGER).toBe(D_POINTS_LEDGER);
		expect(REWARDS).toBe(D_REWARDS);
		expect(REPORTS).toBe(D_REPORTS);
		expect(CERTS).toBe(D_CERTS);
	});
});

describe('mobile facade preserves every TYPE export (zero-API-change guard)', () => {
	it('re-exports every shared type (plain or renamed alias), usable against its data array', () => {
		const a: Member = ME;
		const b: Stat = STATS[0];
		const c: Skill = SKILLS[0];
		const d: Upcoming = UPCOMING[0];
		const e: MyCourse = MY_COURSES[0];
		const f: AttRecord = ATT_HISTORY[0];
		const g: Course = CATALOG[0];
		const h: ScheduleBlock = SCHEDULE[0];
		const i: Order = ORDERS[0];
		const j: MakeupSlot = MAKEUP_SLOTS[0];
		const k: ThreadMsg = CONTACT_THREAD[0];
		const l: NotifItem = NOTIFS_SEED[0];
		const m: PointsEntry = POINTS_LEDGER[0];
		const n: Reward = REWARDS[0];
		const o: Report = REPORTS['k1'];
		const p: Cert = CERTS[0];
		expect([a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p].every((x) => x != null)).toBe(true);
	});
});
