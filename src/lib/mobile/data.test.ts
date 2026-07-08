import { describe, it, expect } from 'vitest';

/* Regression guard (Task 1, member-app 單一來源): mobile's data facade re-exports
 * both VALUES and TYPES from `$lib/domain/member-app` for the 15 seed constants
 * that are byte-equal between member and mobile (ANNOUNCE differs by one item's
 * `bg` colour, so it stays local as its own literal array — not covered here).
 * The value assertions below prove each one is the SAME reference as domain's
 * (not a re-typed copy) — the single-source guarantee this refactor exists for.
 * The type block mirrors `src/lib/admin/facade-type-exports.test.ts`: if mobile
 * ever drops a type re-export (including a renamed alias like `Upcoming` /
 * `MyCourse`), this file fails to COMPILE under `npm run check`, not just at
 * runtime (vitest alone can't catch a missing type-only export).
 *
 * Task 19：CATALOG/Course 移出這份 domain 對照 —— getCourses()/getHome() 已改真接
 * 後端(見 api.ts)，Course 也跟著改為擴充 `$lib/public/adapters` 的真實
 * CatalogCourse(uuid string id)，不再是 domain/member-app 的 mock 形狀(number
 * id)。CATALOG 常數本身仍在 mobile/data.ts 保留(僅供既有測試當 fixture)，但
 * 不再是 domain 那份的同一參照，故移出下面兩個 facade 一致性測試。
 *
 * Task F7：ATT_HISTORY 同理移出「同參照」測試——逐堂出勤明細已改真 GET
 * /enrolments/{id}/attendance(§3.12)，這個 mock 常數本身已從 domain/member-app.ts
 * 移除。AttRecord 型別仍在(真資料的映射目標形狀不變)，型別守衛區塊改用字面值
 * 驗證可用性，不再借用已退役的 ATT_HISTORY[0]。 */

import {
	ME,
	STATS,
	SKILLS,
	UPCOMING,
	MY_COURSES,
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
		// ATT_HISTORY 已退役(Task F7)——用字面值證明 AttRecord 型別匯出仍可用，
		// 不再借用退役的 mock 陣列。
		const f: AttRecord = { date: '06/06', state: 'present' };
		const h: ScheduleBlock = SCHEDULE[0];
		const i: Order = ORDERS[0];
		const j: MakeupSlot = MAKEUP_SLOTS[0];
		const k: ThreadMsg = CONTACT_THREAD[0];
		const l: NotifItem = NOTIFS_SEED[0];
		const m: PointsEntry = POINTS_LEDGER[0];
		const n: Reward = REWARDS[0];
		const o: Report = REPORTS['k1'];
		const p: Cert = CERTS[0];
		expect([a, b, c, d, e, f, h, i, j, k, l, m, n, o, p].every((x) => x != null)).toBe(true);
	});
});
