/* Dream Fly — 教練端打卡動作(clock-in/out)。本任務範圍內唯一的寫入操作(教練個人
 * 打卡，非 admin CRUD)，獨立於 api.ts 的 mock-API 讀取接縫之外，直接呼叫
 * $lib/api/client。需登入(見 integration-contract.md §3.4)。
 *
 * 同一教練同時只能有一筆未結束的打卡(DB 唯一索引)：clock-in 若已有進行中的打卡，
 * 後端回 409(「already clocked in」)；clock-out 若沒有進行中的打卡，後端回 404
 * (「no active clock-in record found」)。呼叫端自行 catch ApiError 判斷 status。 */
import { api } from '$lib/api/client';

export interface ClockRecord {
	id: string;
	clock_in: string;
	clock_out: string | null;
	note: string | null;
	created_at: string;
}

export const clockIn = (coachId: string, note?: string): Promise<ClockRecord> =>
	api<ClockRecord>(`/coaches/${coachId}/clock-in`, {
		method: 'POST',
		body: JSON.stringify(note ? { note } : {})
	});

export const clockOut = (coachId: string): Promise<ClockRecord> =>
	api<ClockRecord>(`/coaches/${coachId}/clock-out`, { method: 'POST' });

/** 進頁面時的「目前是否上班中」開機狀態查詢：GET /coaches/{id}/clock-records 依
 *  clock_in DESC 排序(純陣列)，取最新一筆，clock_out 仍為 null 即為上班中。
 *  最佳努力——查詢失敗一律回 false(顯示成「尚未打卡」；使用者實際打卡時仍會被
 *  後端 409/404 校正，不會造成錯誤寫入)，呼叫端不需要 catch。 */
export async function isClockedIn(coachId: string): Promise<boolean> {
	try {
		const records = await api<ClockRecord[]>(`/coaches/${coachId}/clock-records?page=1&per_page=1`);
		return records.length > 0 && records[0].clock_out === null;
	} catch {
		return false;
	}
}
