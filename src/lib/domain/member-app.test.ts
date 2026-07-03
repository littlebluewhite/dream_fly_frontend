/* src/lib/domain/member-app.test.ts — member-app 單一來源 seed 深度相等守衛
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生；本檔案鎖定 member-app 匯出
 * 的每個常數與 member 側現值(src/lib/member/data.ts)深度相等 —— 這是本次抽取
 * (member↔mobile 去重)的回歸測試：往後任一邊被誤改而與 domain 分岔，這裡就會變紅。
 * ANNOUNCE 因兩側有一筆公告的 bg 色不同(member 'var(--df-accent-bg)' vs mobile
 * '#FFF8DB')留在原地不抽，故不在本檔案涵蓋範圍內。 */
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

describe('member-app seed matches member/data.ts current values (deep-equal)', () => {
	it('ME', () => expect(ME).toEqual(MemberData.ME));
	it('STATS', () => expect(STATS).toEqual(MemberData.STATS));
	it('SKILLS', () => expect(SKILLS).toEqual(MemberData.SKILLS));
	it('UPCOMING', () => expect(UPCOMING).toEqual(MemberData.UPCOMING));
	it('MY_COURSES', () => expect(MY_COURSES).toEqual(MemberData.MY_COURSES));
	it('ATT_HISTORY', () => expect(ATT_HISTORY).toEqual(MemberData.ATT_HISTORY));
	it('CATALOG', () => expect(CATALOG).toEqual(MemberData.CATALOG));
	it('SCHEDULE', () => expect(SCHEDULE).toEqual(MemberData.SCHEDULE));
	it('ORDERS', () => expect(ORDERS).toEqual(MemberData.ORDERS));
	it('MAKEUP_SLOTS', () => expect(MAKEUP_SLOTS).toEqual(MemberData.MAKEUP_SLOTS));
	it('CONTACT_THREAD', () => expect(CONTACT_THREAD).toEqual(MemberData.CONTACT_THREAD));
	it('NOTIFS_SEED', () => expect(NOTIFS_SEED).toEqual(MemberData.NOTIFS_SEED));
	it('POINTS_LEDGER', () => expect(POINTS_LEDGER).toEqual(MemberData.POINTS_LEDGER));
	it('REWARDS', () => expect(REWARDS).toEqual(MemberData.REWARDS));
	it('REPORTS', () => expect(REPORTS).toEqual(MemberData.REPORTS));
	it('CERTS', () => expect(CERTS).toEqual(MemberData.CERTS));
});

/* ── row-count canaries (guards against silent truncation during the move) ── */
describe('row counts', () => {
	it('CATALOG has 6 rows', () => expect(CATALOG).toHaveLength(6));
	it('MY_COURSES has 3 rows', () => expect(MY_COURSES).toHaveLength(3));
	it('UPCOMING has 3 rows', () => expect(UPCOMING).toHaveLength(3));
	it('ATT_HISTORY has 8 rows', () => expect(ATT_HISTORY).toHaveLength(8));
	it('SCHEDULE has 4 rows', () => expect(SCHEDULE).toHaveLength(4));
	it('ORDERS has 4 rows', () => expect(ORDERS).toHaveLength(4));
	it('MAKEUP_SLOTS has 4 rows', () => expect(MAKEUP_SLOTS).toHaveLength(4));
	it('NOTIFS_SEED has 6 rows', () => expect(NOTIFS_SEED).toHaveLength(6));
	it('POINTS_LEDGER has 6 rows', () => expect(POINTS_LEDGER).toHaveLength(6));
	it('REWARDS has 4 rows', () => expect(REWARDS).toHaveLength(4));
	it('CERTS has 3 rows', () => expect(CERTS).toHaveLength(3));
});
