/* src/lib/domain/member-app.test.ts — member-app 單一來源 seed 守衛
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生。本檔案分三層守衛:
 * 1. wiring check(toBe):member facade 匯出的每個共用常數與 domain 是「同一個
 *    物件參照」—— facade 是 live re-export / `as` 斷言(runtime 消失),不是複本。
 *    注意這一層抓不到「值被誤改」(兩邊永遠同參照),那是第 2、3 層的職責。
 *    (mobile facade 的同參照 + 型別匯出守衛在 src/lib/mobile/data.test.ts;
 *    LEAVE_STATUS 因兩側 facade 都是收窄 re-assert(卡 3),在本檔一併雙釘。)
 * 2. 獨立字面不變量:比照 src/lib/domain/data.test.ts 的慣例(獨立不變量,不拿
 *    下游 facade 對照),對 seed 關鍵欄位做字面快照(persona 王承恩 GY2024001、
 *    課名、教練名、金額……)—— 誤改 domain 值時這裡變紅。
 * 3. row-count canary:防搬移 / 截斷時整列消失。
 * ANNOUNCE 因兩側有一筆公告的 bg 色不同(member 'var(--df-accent-bg)' vs mobile
 * '#FFF8DB')留在各 facade 原地,不在本檔案涵蓋範圍內。
 *
 * Task 1(C2 死種子退役):CATALOG/MAKEUP_SLOTS/REWARDS/REPORTS/CERTS(值+
 * interface)與 MY_COURSES/SCHEDULE/ORDERS(值)經確認無 runtime 消費者後整批從
 * domain/member-app.ts 移除——這裡的三層守衛同步縮減為僅涵蓋還活著的常數,
 * 現為 12 個(卡 3 升遷 LEAVE_STATUS 後 11→12)。
 * MY_COURSES/SCHEDULE/ORDERS 的 interface(EnrolledCourse/ScheduleBlock/Order)
 * 仍在,但沒有示範值可供這裡的字面不變量/row-count 測試涵蓋。 */
import { describe, it, expect } from 'vitest';
import * as MemberData from '$lib/member/data';
import * as MobileData from '$lib/mobile/data';
import {
	ME,
	STATS,
	SKILLS,
	UPCOMING,
	CONTACT_THREAD,
	NOTIFS_SEED,
	POINTS_LEDGER,
	WEEK,
	TIME_ROWS,
	COACH_REPLIES,
	NOTIF_CATS,
	LEAVE_STATUS
} from './member-app';

/* ── 1. wiring check:member facade 與 domain 同參照(toBe,非值比對) ── */
describe('member facade re-exports domain/member-app by reference (single source)', () => {
	it('every shared constant is the SAME array/object as domain (toBe, not a copy)', () => {
		expect(MemberData.ME).toBe(ME);
		expect(MemberData.STATS).toBe(STATS);
		expect(MemberData.SKILLS).toBe(SKILLS);
		expect(MemberData.UPCOMING).toBe(UPCOMING);
		expect(MemberData.CONTACT_THREAD).toBe(CONTACT_THREAD);
		expect(MemberData.NOTIFS_SEED).toBe(NOTIFS_SEED);
		expect(MemberData.POINTS_LEDGER).toBe(POINTS_LEDGER);
		expect(MemberData.WEEK).toBe(WEEK);
		expect(MemberData.TIME_ROWS).toBe(TIME_ROWS);
		expect(MemberData.COACH_REPLIES).toBe(COACH_REPLIES);
		expect(MemberData.NOTIF_CATS).toBe(NOTIF_CATS);
	});
	// 卡 3:LEAVE_STATUS 兩側 facade 都是「純註記收窄同一參照」形(member 收窄回
	// [Tone, string]、mobile 收窄回自家 tuple Tone)——雙釘防任何一側改成字面重建。
	it('LEAVE_STATUS is the SAME object through BOTH facades (member + mobile narrow one domain reference)', () => {
		expect(MemberData.LEAVE_STATUS).toBe(LEAVE_STATUS);
		expect(MobileData.LEAVE_STATUS).toBe(LEAVE_STATUS);
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
	it('WEEK covers all 7 weekdays 一 through 日', () => {
		expect(WEEK).toEqual(['一', '二', '三', '四', '五', '六', '日']);
	});
	it('COACH_REPLIES leads with 收到！我會留意，謝謝家長。', () => {
		expect(COACH_REPLIES[0]).toBe('收到！我會留意，謝謝家長。');
	});
	it('NOTIF_CATS[0] is the 全部 (all) tab', () => {
		expect(NOTIF_CATS[0]).toEqual(['all', '全部']);
	});
	it('LEAVE_STATUS maps the four §3.20 statuses to tone/label pairs', () => {
		expect(LEAVE_STATUS).toEqual({
			pending: ['warning', '待審核'],
			approved: ['success', '已核准'],
			rejected: ['error', '已婉拒'],
			cancelled: ['neutral', '已取消']
		});
	});
});

/* ── 3. row-count canaries(防搬移 / 截斷時整列消失) ── */
describe('row counts', () => {
	it('STATS has 3 rows', () => expect(STATS).toHaveLength(3));
	it('SKILLS has 4 rows', () => expect(SKILLS).toHaveLength(4));
	it('UPCOMING has 3 rows', () => expect(UPCOMING).toHaveLength(3));
	it('CONTACT_THREAD has 2 rows', () => expect(CONTACT_THREAD).toHaveLength(2));
	it('NOTIFS_SEED has 6 rows', () => expect(NOTIFS_SEED).toHaveLength(6));
	it('POINTS_LEDGER has 6 rows', () => expect(POINTS_LEDGER).toHaveLength(6));
	it('WEEK has 7 rows', () => expect(WEEK).toHaveLength(7));
	it('TIME_ROWS has 8 rows', () => expect(TIME_ROWS).toHaveLength(8));
	it('COACH_REPLIES has 4 rows', () => expect(COACH_REPLIES).toHaveLength(4));
	it('NOTIF_CATS has 5 rows', () => expect(NOTIF_CATS).toHaveLength(5));
	it('LEAVE_STATUS has 4 keys', () => expect(Object.keys(LEAVE_STATUS)).toHaveLength(4));
});
