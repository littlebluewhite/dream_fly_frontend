/* src/lib/domain/weekday.ts — 星期換算單一模組（純函式）。
 *
 * 兩套星期索引並存，混用就會差一天（aaabc12 曾錯了 3 個月）：
 *   - 後端 day_of_week：0=Sunday … 6=Saturday（PostgreSQL EXTRACT(DOW)），與 JS
 *     Date.getDay() 同一順序。DAY_KEYS / WEEKDAY_ZH 以它為 index。
 *   - 週課表欄位 WeekColumn：0=Monday … 6=Sunday（週一起頭的 UI 版面），ScheduleBlock.day
 *     與 WEEK[] 用它。
 * 兩者之間的換算只經 toWeekColumn。 */

/** 週課表欄位：0=週一 … 6=週日。 */
export type WeekColumn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 英文星期鍵，index = 後端 day_of_week = Date.getDay()（0=Sun）。 */
export const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** 中文單字星期，index = 後端 day_of_week = Date.getDay()（0=日）。 */
export const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** day_of_week（0=日）→ 週課表欄位（0=一）的型別化對照表。 */
const DOW_TO_WEEK_COLUMN: readonly WeekColumn[] = [6, 0, 1, 2, 3, 4, 5];

/** 後端 day_of_week / Date.getDay()（0=Sunday）→ 週課表欄位（0=Monday）。 */
export function toWeekColumn(dow: number): WeekColumn {
	return DOW_TO_WEEK_COLUMN[dow];
}
