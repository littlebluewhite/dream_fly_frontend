/* src/lib/domain/member-app.test.ts — member-app 單一來源 seed 守衛
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生。本檔案分三層守衛:
 * 1. wiring check(toBe):member facade 匯出的每個共用常數與 domain 是「同一個
 *    物件參照」—— facade 是 live re-export / `as` 斷言(runtime 消失),不是複本。
 *    注意這一層抓不到「值被誤改」(兩邊永遠同參照),那是第 2、3 層的職責。
 *    (mobile facade 的同參照 + 型別匯出守衛在 src/lib/mobile/data.test.ts。)
 * 2. 獨立字面不變量:比照 src/lib/domain/data.test.ts 的慣例(獨立不變量,不拿
 *    下游 facade 對照),對 seed 關鍵欄位做字面快照(persona 王承恩 GY2024001、
 *    課名、教練名、金額……)—— 誤改 domain 值時這裡變紅。
 * 3. row-count canary:防搬移 / 截斷時整列消失。
 * ANNOUNCE 因兩側有一筆公告的 bg 色不同(member 'var(--df-accent-bg)' vs mobile
 * '#FFF8DB')留在各 facade 原地,不在本檔案涵蓋範圍內。 */
import { describe, it, expect } from 'vitest';
import * as MemberData from '$lib/member/data';
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
	CERTS
} from './member-app';

/* ── 1. wiring check:member facade 與 domain 同參照(toBe,非值比對) ──
 * REPORTS/CERTS 不在此列——Task 13 把 member/api.ts 的 getReports() 換成真 API
 * (GET /report-cards/me + GET /certificates/me,見 integration-contract.md §3.22)
 * 後，member facade(`$lib/member/data`)不再重新匯出這兩個 mock 常數(僅 mobile
 * 仍消費,見檔案開頭註解的 mobile/data.test.ts)，故它們不再是「member facade
 * 的同參照」守衛範圍;domain 本身的字面不變量/row-count 仍在下方第 2、3 節涵蓋。 */
describe('member facade re-exports domain/member-app by reference (single source)', () => {
	it('every shared constant is the SAME array/object as domain (toBe, not a copy)', () => {
		expect(MemberData.ME).toBe(ME);
		expect(MemberData.STATS).toBe(STATS);
		expect(MemberData.SKILLS).toBe(SKILLS);
		expect(MemberData.UPCOMING).toBe(UPCOMING);
		expect(MemberData.MY_COURSES).toBe(MY_COURSES);
		expect(MemberData.ATT_HISTORY).toBe(ATT_HISTORY);
		expect(MemberData.CATALOG).toBe(CATALOG);
		expect(MemberData.SCHEDULE).toBe(SCHEDULE);
		expect(MemberData.ORDERS).toBe(ORDERS);
		expect(MemberData.MAKEUP_SLOTS).toBe(MAKEUP_SLOTS);
		expect(MemberData.CONTACT_THREAD).toBe(CONTACT_THREAD);
		expect(MemberData.NOTIFS_SEED).toBe(NOTIFS_SEED);
		expect(MemberData.POINTS_LEDGER).toBe(POINTS_LEDGER);
		expect(MemberData.REWARDS).toBe(REWARDS);
	});
});

/* ── 2. 獨立字面不變量(誤改 domain 值 → 這裡變紅) ── */
describe('literal seed invariants (independent of the facades)', () => {
	it('ME is 王承恩 GY2024001, 1250 points, age 13', () => {
		expect(ME.name).toBe('王承恩');
		expect(ME.id).toBe('GY2024001');
		expect(ME.points).toBe(1250);
		expect(ME.age).toBe(13);
	});
	it('STATS[0] is 報名課程數 = 3', () => {
		expect(STATS[0].label).toBe('報名課程數');
		expect(STATS[0].value).toBe('3');
	});
	it('SKILLS leads with 前滾翻 95', () => {
		expect(SKILLS[0]).toEqual(['前滾翻', 95]);
	});
	it('UPCOMING[0] is 競技啦啦隊 進階班 by 林雅婷, 可報到', () => {
		expect(UPCOMING[0].name).toBe('競技啦啦隊 進階班');
		expect(UPCOMING[0].coach).toBe('林雅婷');
		expect(UPCOMING[0].status).toEqual(['success', '可報到']);
	});
	it('MY_COURSES ids are k1/k6/k8 with coaches 林雅婷/林雅婷/陳冠宇', () => {
		expect(MY_COURSES.map((c) => c.id)).toEqual(['k1', 'k6', 'k8']);
		expect(MY_COURSES.map((c) => c.coach)).toEqual(['林雅婷', '林雅婷', '陳冠宇']);
	});
	it('ATT_HISTORY[0] is 06/06 present', () => {
		expect(ATT_HISTORY[0]).toEqual({ date: '06/06', state: 'present' });
	});
	it('CATALOG id 3 is 競技啦啦隊 進階班 at NT$4,800 (hot, 1 spot)', () => {
		const c = CATALOG[2];
		expect(c.id).toBe(3);
		expect(c.name).toBe('競技啦啦隊 進階班');
		expect(c.price).toBe(4800);
		expect(c.hot).toBe(true);
		expect(c.spots).toBe(1);
	});
	it('SCHEDULE[0] is Monday 19:00 競技啦啦隊 進階班', () => {
		expect(SCHEDULE[0].day).toBe(1);
		expect(SCHEDULE[0].start).toBe('19:00');
		expect(SCHEDULE[0].name).toBe('競技啦啦隊 進階班');
	});
	it('ORDERS[0] is DF-24061 for NT$4,800, 已付款', () => {
		expect(ORDERS[0].id).toBe('DF-24061');
		expect(ORDERS[0].amount).toBe(4800);
		expect(ORDERS[0].status).toEqual(['success', '已付款']);
	});
	it('MAKEUP_SLOTS[0] is m1 with 3 spots, coach 林雅婷', () => {
		expect(MAKEUP_SLOTS[0].id).toBe('m1');
		expect(MAKEUP_SLOTS[0].spots).toBe(3);
		expect(MAKEUP_SLOTS[0].coach).toBe('林雅婷');
	});
	it('CONTACT_THREAD opens coach → me', () => {
		expect(CONTACT_THREAD[0].from).toBe('coach');
		expect(CONTACT_THREAD[1].from).toBe('me');
	});
	it('NOTIFS_SEED[0] is n1 明日課程提醒 (unread class notif)', () => {
		expect(NOTIFS_SEED[0].id).toBe('n1');
		expect(NOTIFS_SEED[0].cat).toBe('class');
		expect(NOTIFS_SEED[0].title).toBe('明日課程提醒');
		expect(NOTIFS_SEED[0].read).toBe(false);
	});
	it('POINTS_LEDGER[0] is pl1 earn +120', () => {
		expect(POINTS_LEDGER[0].id).toBe('pl1');
		expect(POINTS_LEDGER[0].type).toBe('earn');
		expect(POINTS_LEDGER[0].delta).toBe(120);
	});
	it('REWARDS[0] is 報名費折抵 NT$100 for 100 points', () => {
		expect(REWARDS[0].name).toBe('報名費折抵 NT$100');
		expect(REWARDS[0].cost).toBe(100);
	});
	it('REPORTS.k1 is graded A by 林雅婷 with 6 skills', () => {
		expect(REPORTS.k1.coach).toBe('林雅婷');
		expect(REPORTS.k1.grade).toBe('A');
		expect(REPORTS.k1.skills).toHaveLength(6);
	});
	it('CERTS[0] is ct1 issued by Dream Fly 夢飛體操館', () => {
		expect(CERTS[0].id).toBe('ct1');
		expect(CERTS[0].issuer).toBe('Dream Fly 夢飛體操館');
	});
});

/* ── 3. row-count canaries(防搬移 / 截斷時整列消失) ── */
describe('row counts', () => {
	it('STATS has 3 rows', () => expect(STATS).toHaveLength(3));
	it('SKILLS has 4 rows', () => expect(SKILLS).toHaveLength(4));
	it('UPCOMING has 3 rows', () => expect(UPCOMING).toHaveLength(3));
	it('MY_COURSES has 3 rows', () => expect(MY_COURSES).toHaveLength(3));
	it('ATT_HISTORY has 8 rows', () => expect(ATT_HISTORY).toHaveLength(8));
	it('CATALOG has 6 rows', () => expect(CATALOG).toHaveLength(6));
	it('SCHEDULE has 4 rows', () => expect(SCHEDULE).toHaveLength(4));
	it('ORDERS has 4 rows', () => expect(ORDERS).toHaveLength(4));
	it('MAKEUP_SLOTS has 4 rows', () => expect(MAKEUP_SLOTS).toHaveLength(4));
	it('CONTACT_THREAD has 2 rows', () => expect(CONTACT_THREAD).toHaveLength(2));
	it('NOTIFS_SEED has 6 rows', () => expect(NOTIFS_SEED).toHaveLength(6));
	it('POINTS_LEDGER has 6 rows', () => expect(POINTS_LEDGER).toHaveLength(6));
	it('REWARDS has 4 rows', () => expect(REWARDS).toHaveLength(4));
	it('CERTS has 3 rows', () => expect(CERTS).toHaveLength(3));
});
