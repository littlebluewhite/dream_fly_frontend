/* src/lib/domain/status-lookups.test.ts — ops 顯示查表單一來源守衛(批次 1 W2a)
 *
 * admin 與 mobile-admin 原是同一組維運資料的桌面/行動雙生，各自原本手抄一份狀態/
 * 類型 → tone/label 對照表，批次 1 W2a 單源收斂後 admin 改為 re-export、
 * mobile-admin 改為純註記 re-assert；C4 批4 進一步把 admin 的 re-export 退役
 * (消費端改直取 $lib/domain 各 entity 檔)，本檔的 wiring check 因此只留
 * mobile-admin 一側。本檔比照 member-app.test.ts 的三層守衛：
 * 1. wiring check(toBe)：mobile-admin facade 匯出的每張表與 domain 是「同一個
 *    物件參照」——不是各自維護、恰好值相同的複本。
 * 2. 獨立字面不變量：對 domain 的表做 toEqual 快照(誤改 domain 值時這裡變紅)，另加
 *    canonical 守衛(VENUE_STATUS.available 的標籤是「可預約」，不是 mobile-admin
 *    舊值「可使用」)。MEMBER_STATUS(連同它的同名異義守衛)隨 MemberDialog 的死
 *    member 分支一併退役於 Task 1(R13 小 bug 包)。
 * 3. key-count canary：防漏鍵/多鍵。
 *
 * LEVEL_TONE 的 facade toBe/字面不變量留在 course-level.test.ts(單獨擴充，含
 * member/mobile 兩發留給 W2b)。
 *
 * SESSION_STATUS(C4)只補層 2/3——admin/coach/mobile-admin 三處都是「查表結果
 * 內部組裝成各自形狀」的消費方式(mapTodaySession()/mapTodayClassToRow() 組出
 * TodayClass/TodayRow、coach/data.ts CLASS_STATUS 另組 {label,bg,fg})，沒有一處
 * 是單純轉出同一個查表物件的 facade，故無層 1 wiring check 可補(同 LEVEL_TONE
 * 的例外，理由不同：LEVEL_TONE 另檔測，SESSION_STATUS 是無 facade 可測)。 */
import { describe, it, expect } from 'vitest';
import { MEMBER_ACCOUNT_STATUS } from './members';
import { VENUE_STATUS } from './venues';
import { TICKET_TYPE } from './tickets';
import { STATUS_TONE } from './classes';
import { SESSION_STATUS } from './sessions';
import * as MobileAdminData from '$lib/mobile-admin/data';

/* ── 1. wiring check：facade 與 domain 同參照(toBe，非值比對) ── */
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

	it('SESSION_STATUS matches the known 4-state literal (尚未開始/上課中/已結束/即將開始)', () => {
		expect(SESSION_STATUS).toEqual({
			wait: ['neutral', '尚未開始'],
			live: ['success', '上課中'],
			done: ['neutral', '已結束'],
			soon: ['warning', '即將開始']
		});
	});

	it('canonical 守衛：VENUE_STATUS.available 標籤是「可預約」，不是 mobile-admin 舊值「可使用」', () => {
		expect(VENUE_STATUS.available[1]).toBe('可預約');
	});

	it('canonical 守衛：SESSION_STATUS.live 標籤是「上課中」，不是 admin 舊值「進行中」', () => {
		expect(SESSION_STATUS.live[1]).toBe('上課中');
	});
});

/* ── 3. key-count canaries(防漏鍵/多鍵) ── */
describe('key counts', () => {
	it('MEMBER_ACCOUNT_STATUS has 2 keys', () => expect(Object.keys(MEMBER_ACCOUNT_STATUS)).toHaveLength(2));
	it('VENUE_STATUS has 2 keys', () => expect(Object.keys(VENUE_STATUS)).toHaveLength(2));
	it('TICKET_TYPE has 3 keys', () => expect(Object.keys(TICKET_TYPE)).toHaveLength(3));
	it('STATUS_TONE has 3 keys', () => expect(Object.keys(STATUS_TONE)).toHaveLength(3));
	it('SESSION_STATUS has 4 keys', () => expect(Object.keys(SESSION_STATUS)).toHaveLength(4));
});
