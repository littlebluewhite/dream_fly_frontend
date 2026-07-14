/* src/lib/domain/status-lookups.test.ts — ops 顯示查表單一來源守衛(批次 1 W2a)
 *
 * admin 與 mobile-admin 是同一組維運資料的桌面/行動雙生，各自原本手抄一份狀態/類型
 * → tone/label 對照表，已隨單源收斂改為 re-export(admin)/純註記 re-assert
 * (mobile-admin)。本檔比照 member-app.test.ts 的三層守衛：
 * 1. wiring check(toBe)：admin/mobile-admin facade 匯出的每張表與 domain 是「同一個
 *    物件參照」——不是各自維護、恰好值相同的複本。
 * 2. 獨立字面不變量：對 domain 的表做 toEqual 快照(誤改 domain 值時這裡變紅)，另加
 *    兩類守衛——同名異義(MEMBER_STATUS.active 與 MEMBER_ACCOUNT_STATUS.active 鍵名
 *    相同、語意不同，標籤不可相等)、canonical(VENUE_STATUS.available 的標籤是
 *    「可預約」，不是 mobile-admin 舊值「可使用」)。
 * 3. key-count canary：防漏鍵/多鍵。
 *
 * LEVEL_TONE 的 facade toBe/字面不變量留在 course-level.test.ts(單獨擴充，含
 * member/mobile 兩發留給 W2b)。 */
import { describe, it, expect } from 'vitest';
import { MEMBER_STATUS, MEMBER_ACCOUNT_STATUS } from './members';
import { VENUE_STATUS } from './venues';
import { TICKET_TYPE } from './tickets';
import { STATUS_TONE } from './classes';
import * as AdminData from '$lib/admin/data';
import * as MobileAdminData from '$lib/mobile-admin/data';

/* ── 1. wiring check：facade 與 domain 同參照(toBe，非值比對) ── */
describe('admin facade re-exports domain status lookups by reference (single source)', () => {
	it('every shared table is the SAME object as domain (toBe, not a copy) ×5', () => {
		expect(AdminData.MEMBER_STATUS).toBe(MEMBER_STATUS);
		expect(AdminData.MEMBER_ACCOUNT_STATUS).toBe(MEMBER_ACCOUNT_STATUS);
		expect(AdminData.VENUE_STATUS).toBe(VENUE_STATUS);
		expect(AdminData.TICKET_TYPE).toBe(TICKET_TYPE);
		expect(AdminData.STATUS_TONE).toBe(STATUS_TONE);
	});
});

describe('mobile-admin facade re-asserts domain status lookups by reference (single source)', () => {
	it('every shared table is the SAME object as domain (toBe, not a copy) ×4', () => {
		expect(MobileAdminData.MEMBER_ACCOUNT_STATUS).toBe(MEMBER_ACCOUNT_STATUS);
		expect(MobileAdminData.VENUE_STATUS).toBe(VENUE_STATUS);
		expect(MobileAdminData.TICKET_TYPE).toBe(TICKET_TYPE);
		expect(MobileAdminData.STATUS_TONE).toBe(STATUS_TONE);
	});
});

/* ── 2. 獨立字面不變量(誤改 domain 值 → 這裡變紅) ── */
describe('literal table invariants (independent of the facades)', () => {
	it('MEMBER_STATUS matches the known 3-state literal (在學中/出席偏低/暫停中)', () => {
		expect(MEMBER_STATUS).toEqual({
			active: ['success', '在學中'],
			warning: ['warning', '出席偏低'],
			paused: ['neutral', '暫停中']
		});
	});

	it('MEMBER_ACCOUNT_STATUS matches the known 2-state literal (啟用中/已停用)', () => {
		expect(MEMBER_ACCOUNT_STATUS).toEqual({
			active: ['success', '啟用中'],
			inactive: ['neutral', '已停用']
		});
	});

	it('VENUE_STATUS matches the known 2-state literal (可預約/維護中)', () => {
		expect(VENUE_STATUS).toEqual({
			available: ['success', '可預約'],
			maintenance: ['warning', '維護中']
		});
	});

	it('TICKET_TYPE matches the known 3-state literal (單次票券/月票方案/課程套裝)', () => {
		expect(TICKET_TYPE).toEqual({
			ticket: ['accent', '單次票券'],
			membership: ['primary', '月票方案'],
			course_package: ['success', '課程套裝']
		});
	});

	it('STATUS_TONE matches the known 3-state literal (招生中/候補/額滿)', () => {
		expect(STATUS_TONE).toEqual({
			招生中: 'success',
			候補: 'warning',
			額滿: 'neutral'
		});
	});

	it('同名異義守衛：MEMBER_STATUS.active(在學中)與 MEMBER_ACCOUNT_STATUS.active(啟用中)標籤不相等', () => {
		expect(MEMBER_STATUS.active[1]).not.toBe(MEMBER_ACCOUNT_STATUS.active[1]);
	});

	it('canonical 守衛：VENUE_STATUS.available 標籤是「可預約」，不是 mobile-admin 舊值「可使用」', () => {
		expect(VENUE_STATUS.available[1]).toBe('可預約');
	});
});

/* ── 3. key-count canaries(防漏鍵/多鍵) ── */
describe('key counts', () => {
	it('MEMBER_STATUS has 3 keys', () => expect(Object.keys(MEMBER_STATUS)).toHaveLength(3));
	it('MEMBER_ACCOUNT_STATUS has 2 keys', () => expect(Object.keys(MEMBER_ACCOUNT_STATUS)).toHaveLength(2));
	it('VENUE_STATUS has 2 keys', () => expect(Object.keys(VENUE_STATUS)).toHaveLength(2));
	it('TICKET_TYPE has 3 keys', () => expect(Object.keys(TICKET_TYPE)).toHaveLength(3));
	it('STATUS_TONE has 3 keys', () => expect(Object.keys(STATUS_TONE)).toHaveLength(3));
});
