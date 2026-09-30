import { describe, it, expect } from 'vitest';
import {
	NOTIFS,
	CLASS_STATUS,
	SCHED_HOURS,
	type TodayStatus
} from './data';

describe('coach data — shape', () => {
	it('has the expected collection lengths', () => {
		expect(SCHED_HOURS).toHaveLength(8);
		expect(NOTIFS).toHaveLength(3); // R1 補遺:SLA 逾時那筆隨死概念退役(原 4 筆)
	});
});

/* Task 1(C2 死種子退役):TODAY_CLASSES/STUDENTS/SCHED_DAYS/SCHED_COURSES/ATT_CLASS/
 * ATT_ROSTER/ATT_TODAY_CLASSES/THREAD/SHARED_FILES 已從 './data' 退役——本檔案原本
 * 借這些示範資料驗證 CLASS_STATUS/LEVEL_TINT/CAT_COLOR 三個活查表的涵蓋率，改為
 * 直接以各自聯集型別的全部字面值做 inline fixture(涵蓋率比原本借道 5/12/10 筆
 * 示範資料更完整——例如原本 STUDENTS 從未出現 level:'啟蒙' 的學員，從未真正驗證過
 * 那個 key)。純測示範資料自身形狀、不牽涉任何活查表的斷言(如「SCHED_DAYS 恰有
 * 一天是今天」「SCHED_COURSES.venue 合法」)隨死值一併刪除。R16 Task 2a:LEVEL_TINT/
 * CAT_COLOR 隨後端沒有的 level/cat 欄位退役,其涵蓋率斷言一併刪除,只剩 CLASS_STATUS。 */
describe('coach data — referential integrity (live lookup tables)', () => {
	it('every TodayStatus value resolves in CLASS_STATUS', () => {
		const statuses: TodayStatus[] = ['done', 'live', 'soon', 'wait'];
		for (const s of statuses) expect(CLASS_STATUS[s]).toBeDefined();
	});
});
