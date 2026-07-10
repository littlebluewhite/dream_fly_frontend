/* Dream Fly — public 課表月曆（ScheduleCalendar.svelte）的格線/日期純函式數學。
 * Sunday-leading、前置 null、ragged 不補尾，與 coach 側 `coach/schedule-dates.ts`
 * （Monday-leading、42 格、MonthCell 型別、注入式 todayRef）形狀不相容——兩者
 * 各自服務不同 surface，絕不可合併、絕不可互相 import。 */

import type { ApiDaySchedule, ApiTimeSlot } from '$lib/public/api';

/** 補零 YYYY-MM-DD；month0 一律 0-based（與 Date 相容）。 */
export function isoDate(year: number, month0: number, day: number): string {
	const mm = String(month0 + 1).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

/** 該月天數。 */
export function getDaysInMonth(year: number, month0: number): number {
	return new Date(year, month0 + 1, 0).getDate();
}

/** 該月 1 號是星期幾；0 = Sunday。 */
export function getFirstDayOfMonth(year: number, month0: number): number {
	return new Date(year, month0, 1).getDay();
}

/** Sunday-leading 月曆格線：前置 `getFirstDayOfMonth` 個 null，接 1..天數，
 * 尾端不補 null（ragged）。 */
export function sundayGridDays(year: number, month0: number): (number | null)[] {
	const firstDay = getFirstDayOfMonth(year, month0);
	const daysInMonth = getDaysInMonth(year, month0);
	const days: (number | null)[] = [];
	for (let i = 0; i < firstDay; i++) {
		days.push(null);
	}
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(i);
	}
	return days;
}

/** clone `todayRef` 並歸零時分秒——絕不可改動呼叫者傳入的 Date 物件。 */
function startOfDay(todayRef: Date): Date {
	const cloned = new Date(todayRef);
	cloned.setHours(0, 0, 0, 0);
	return cloned;
}

/** `day` 格子（所屬月份為 `anchor`）是否為今天；`todayRef` 預設現在，異月同日號不誤判。 */
export function isToday(day: number, anchor: Date, todayRef: Date = new Date()): boolean {
	const today = startOfDay(todayRef);
	return (
		day === today.getDate() &&
		anchor.getMonth() === today.getMonth() &&
		anchor.getFullYear() === today.getFullYear()
	);
}

/** `day` 格子（所屬月份為 `anchor`）是否早於今天（不含今天）。 */
export function isPastDate(day: number, anchor: Date, todayRef: Date = new Date()): boolean {
	const today = startOfDay(todayRef);
	const checkDate = new Date(anchor.getFullYear(), anchor.getMonth(), day);
	return checkDate < today;
}

/** zh-TW long 格式（年月日+星期），照現行元件的格式化行為。 */
export function formatDate(date: Date): string {
	return date.toLocaleDateString('zh-TW', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long'
	});
}

/** 在 `days` 裡找 `date === dateStr` 的那天，回傳其 slots；找不到回空陣列。 */
export function slotsForDay(days: ApiDaySchedule[], dateStr: string): ApiTimeSlot[] {
	return days.find((d) => d.date === dateStr)?.slots ?? [];
}
