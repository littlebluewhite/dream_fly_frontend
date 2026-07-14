import { describe, it, expect } from 'vitest';

/* Regression guard (Task 1, member-app 單一來源): mobile's data facade re-exports
 * both VALUES and TYPES from `$lib/domain/member-app` for the constants that are
 * byte-equal between member and mobile (ANNOUNCE differs by one item's `bg`
 * colour, so it stays local as its own literal array — not covered here).
 * The value assertions below prove each one is the SAME reference as domain's
 * (not a re-typed copy) — the single-source guarantee this refactor exists for.
 * The type block below binds each re-exported type to a live value: if mobile
 * ever drops a type re-export (including a renamed alias like `MyCourse`),
 * this file fails to COMPILE under `npm run check`, not just at runtime
 * (vitest alone can't catch a missing type-only export).
 *
 * Task 19：CATALOG/Course 移出這份 domain 對照 —— getCourses()/getHome() 已改真接
 * 後端(見 api.ts)，Course 也跟著改為擴充 `$lib/public/adapters` 的真實
 * CatalogCourse(uuid string id)，不再是 domain/member-app 的 mock 形狀(number
 * id)。CATALOG 常數本身已隨 Task 1(見下)整段退役，不再是這個檔案的涵蓋範圍。
 *
 * Task F7：ATT_HISTORY 同理移出「同參照」測試——逐堂出勤明細已改真 GET
 * /enrolments/{id}/attendance(§3.12)，這個 mock 常數本身已從 domain/member-app.ts
 * 移除。AttRecord 型別仍在(真資料的映射目標形狀不變)，型別守衛區塊改用字面值
 * 驗證可用性，不再借用已退役的 ATT_HISTORY[0]。
 *
 * Task 1(C2 死種子退役)：STATS/SKILLS/UPCOMING/MY_COURSES/SCHEDULE/ORDERS/
 * MAKEUP_SLOTS/POINTS_LEDGER/REWARDS/REPORTS/CERTS 的值，以及 Stat/Skill/
 * Upcoming/ScheduleBlock/Order/MakeupSlot/PointsEntry/Reward/Report/Cert 型別，
 * 經確認這個 facade 本身無 runtime 消費者後整批移除——下面兩個守衛區塊同步縮減
 * 為僅涵蓋還活著的 ME/CONTACT_THREAD/NOTIFS_SEED/WEEK/COACH_REPLIES/NOTIF_CATS
 * 六個值（WEEK/COACH_REPLIES/NOTIF_CATS 是批次 2 W2b 新增的 re-export）與
 * Member/MyCourse/AttRecord/ThreadMsg/NotifItem 五個型別；MyCourse 改用檔內
 * inline literal（同 ATT_HISTORY 退役後的既有模式）驗證型別匯出仍可用，不再
 * 借用已退役的 MY_COURSES[0]。 */

import {
	ME,
	CONTACT_THREAD,
	NOTIFS_SEED,
	WEEK,
	COACH_REPLIES,
	NOTIF_CATS,
	type Member,
	type MyCourse,
	type AttRecord,
	type ThreadMsg,
	type NotifItem,
	type Tone
} from '$lib/mobile/data';
import {
	ME as D_ME,
	CONTACT_THREAD as D_CONTACT_THREAD,
	NOTIFS_SEED as D_NOTIFS_SEED,
	WEEK as D_WEEK,
	COACH_REPLIES as D_COACH_REPLIES,
	NOTIF_CATS as D_NOTIF_CATS
} from '$lib/domain/member-app';

describe('mobile facade re-exports domain/member-app by reference (single source)', () => {
	it('every shared constant is the SAME array/object as domain (toBe, not a copy)', () => {
		expect(ME).toBe(D_ME);
		expect(CONTACT_THREAD).toBe(D_CONTACT_THREAD);
		expect(NOTIFS_SEED).toBe(D_NOTIFS_SEED);
		expect(WEEK).toBe(D_WEEK);
		expect(COACH_REPLIES).toBe(D_COACH_REPLIES);
		expect(NOTIF_CATS).toBe(D_NOTIF_CATS);
	});
});

describe('mobile facade preserves every TYPE export (zero-API-change guard)', () => {
	it('re-exports every shared type (plain or renamed alias), usable against its data array', () => {
		const a: Member = ME;
		// MY_COURSES 已退役(Task 1)——用字面值證明 MyCourse 型別匯出仍可用，
		// 不再借用已退役的 mock 陣列(同 ATT_HISTORY 退役後的既有模式)。
		const e: MyCourse = {
			id: 'k1', name: '競技啦啦隊 進階班', cat: '競技啦啦隊', level: '進階', coach: '林雅婷',
			icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', room: 'A 訓練館',
			att: 98, attended: 23, total: 24, next: '明日 19:00', term: '2026 春季', remain: 14
		};
		// ATT_HISTORY 已退役(Task F7)——用字面值證明 AttRecord 型別匯出仍可用，
		// 不再借用退役的 mock 陣列。
		const f: AttRecord = { date: '06/06', state: 'present' };
		const k: ThreadMsg = CONTACT_THREAD[0];
		const l: NotifItem = NOTIFS_SEED[0];
		// 批次 2 W2b:NOTIF_CATS 改 re-assert 自 domain 後，證明其值仍結構滿足本檔
		// 自身的 Tone tuple 型別(零斷言;NOTIF_CATS_BASE 型別與 Tone[] 恆等)。
		const t: Tone = NOTIF_CATS[0];
		expect([a, e, f, k, l, t].every((x) => x != null)).toBe(true);
	});
});
