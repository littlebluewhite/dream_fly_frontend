/* Dream Fly — public 課表月曆（ScheduleCalendar.svelte）的選取狀態純轉移函式。
 * 與 calendar-grid.ts（格線/日期數學）同居：本檔管「當月/選取日/選取時段」三元組
 * 的轉移，一律回傳新物件、不變異輸入（唯一例外：停用時段的 no-op 回傳同參照）。
 * 月變必 refetch——gate.refresh() 副作用留在元件呼叫點（loadMonth），這裡不設
 * shouldRefetch 旗標（恆真，無資訊量）。 */

import type { ApiTimeSlot } from '$lib/public/api';

/** ScheduleCalendar 的選取三元組；selectedTimeSlot 存 slotLabel 字串（非 slot id）。 */
export interface CalendarSelection {
	currentDate: Date;
	selectedDate: Date | null;
	selectedTimeSlot: string | null;
}

/** 「HH:MM-HH:MM」時段標籤（start/end_time 各截前 5 碼、去秒）。 */
export function slotLabel(slot: ApiTimeSlot): string {
	return `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;
}

/** 額滿（full）或不開放（closed）的時段不可選。 */
export function isSlotDisabled(slot: ApiTimeSlot): boolean {
	return slot.status === 'full' || slot.status === 'closed';
}

/** 換月共通：±1 月、錨定 1 日（跨年由 Date 建構子自動借/進位），日/時段雙選取一併清空。 */
function shiftMonth(sel: CalendarSelection, offset: -1 | 1): CalendarSelection {
	return {
		currentDate: new Date(sel.currentDate.getFullYear(), sel.currentDate.getMonth() + offset, 1),
		selectedDate: null,
		selectedTimeSlot: null
	};
}

/** 上一月。 */
export function previousMonth(sel: CalendarSelection): CalendarSelection {
	return shiftMonth(sel, -1);
}

/** 下一月。 */
export function nextMonth(sel: CalendarSelection): CalendarSelection {
	return shiftMonth(sel, 1);
}

/** 選取當月第 `day` 日；換日清空已選時段，currentDate 不動。 */
export function selectDate(sel: CalendarSelection, day: number): CalendarSelection {
	return {
		...sel,
		selectedDate: new Date(sel.currentDate.getFullYear(), sel.currentDate.getMonth(), day),
		selectedTimeSlot: null
	};
}

/** 選取時段；停用時段為 no-op——回傳同一參照（呼叫端/測試可據以判定未發生轉移）。 */
export function selectTimeSlot(sel: CalendarSelection, slot: ApiTimeSlot): CalendarSelection {
	if (isSlotDisabled(slot)) return sel;
	return { ...sel, selectedTimeSlot: slotLabel(slot) };
}
