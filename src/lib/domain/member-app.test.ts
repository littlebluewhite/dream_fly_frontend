/* src/lib/domain/member-app.test.ts — member-app 單一來源 seed 守衛
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生。本檔案分三層守衛:
 * 1. wiring check(toBe):member facade 仍轉出的共用常數與 domain 是「同一個
 *    物件參照」—— facade 側是純註記收窄(LEAVE_STATUS)或 `as` 斷言(UPCOMING),
 *    兩者 runtime 都消失,不是複本。
 *    注意這一層抓不到「值被誤改」(兩邊永遠同參照),那是第 2、3 層的職責。
 *    (mobile facade 的同款守衛原在 src/lib/mobile/data.test.ts,該檔隨 C4 批1
 *    純轉手退役整檔退場;LEAVE_STATUS 因兩側 facade 都是收窄 re-assert(卡 3),
 *    在本檔一併雙釘,mobile 側僅存的同參照釘因此續存於此。)
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
 * 現為 9 個(卡 3 升遷 LEAVE_STATUS 後 11→12;R13 會員資料 module 落地後 ME 退役,12→11;
 * R14 候選 F3 誠實開機後 NOTIFS_SEED/POINTS_LEDGER 退役、值搬進 $lib/testing/seed-fixtures,11→9)。
 * MY_COURSES/SCHEDULE/ORDERS 的 interface(EnrolledCourse/ScheduleBlock/Order)
 * 仍在,但沒有示範值可供這裡的字面不變量/row-count 測試涵蓋。
 *
 * C4 批2(facade 純轉手退役):member facade 對 ME/STATS/SKILLS/CONTACT_THREAD/
 * POINTS_LEDGER/WEEK/TIME_ROWS/COACH_REPLIES/NOTIF_CATS 的純轉手匯出退役,消費端
 * 改直取 $lib/domain/member-app——第 1 層 wiring check 的 toBe 釘同步減少,只留
 * UPCOMING(facade 側仍是續存收窄的同參照,攜帶本檔型別事實;R14 F3 起 NOTIFS_SEED 退役;
 * LEAVE_STATUS 另有專屬 it,見下)。第 2、3 層是「domain 自身」的獨立不變量,與
 * facade 現況無關,不受影響、全數保留。 */
import { describe, it, expect } from 'vitest';
import * as MemberData from '$lib/member/data';
import * as MobileData from '$lib/mobile/data';
import {
	STATS,
	SKILLS,
	UPCOMING,
	CONTACT_THREAD,
	WEEK,
	TIME_ROWS,
	COACH_REPLIES,
	NOTIF_CATS,
	LEAVE_STATUS
} from './member-app';

/* ── 1. wiring check:member facade 與 domain 同參照(toBe,非值比對) ── */
describe('member facade re-exports domain/member-app by reference (single source)', () => {
	it('every shared constant is the SAME array/object as domain (toBe, not a copy)', () => {
		expect(MemberData.UPCOMING).toBe(UPCOMING);
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
	it('WEEK has 7 rows', () => expect(WEEK).toHaveLength(7));
	it('TIME_ROWS has 8 rows', () => expect(TIME_ROWS).toHaveLength(8));
	it('COACH_REPLIES has 4 rows', () => expect(COACH_REPLIES).toHaveLength(4));
	it('NOTIF_CATS has 5 rows', () => expect(NOTIF_CATS).toHaveLength(5));
	it('LEAVE_STATUS has 4 keys', () => expect(Object.keys(LEAVE_STATUS)).toHaveLength(4));
});
