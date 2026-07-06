/* Dream Fly — 請假/補課場次選單格式化（純函式，Task 11）。
 *
 * GET /courses/{id}/sessions（integration-contract.md §3.18）回傳的 session_date
 * 為 naive date（無時區資訊，裁決 2）—— 用 `new Date(y, m-1, d)` 之類的 local
 * 建構子取星期幾，不用 `new Date(dateStr)`（會被當 UTC 午夜解析，在 UTC+8 等時區
 * 可能推算成前一天，星期幾顯示錯誤）。 */

export interface FormattableSession {
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

/** "YYYY-MM-DD" → 星期幾（中文單字）。 */
export function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAY[new Date(y, m - 1, d).getDay()];
}

/** 請假/補課 Select 選項用：日期 + 星期 + 起訖時間，例如 "2026-07-10 (五) 19:00–20:30"。 */
export function formatSessionLabel(s: FormattableSession & { end_time: string }): string {
  return `${s.session_date} (${weekdayOf(s.session_date)}) ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
}

/** 「我的請假」清單顯示用：LeaveRequestResponse 沒有 end_time，只有日期+起始時間，
 *  例如 "2026-07-10 (五) 19:00"。 */
export function formatSessionDateTime(session_date: string, start_time: string): string {
  return `${session_date} (${weekdayOf(session_date)}) ${start_time.slice(0, 5)}`;
}

/** GET /courses/{id}/sessions 的場次列表 → Select 元件的 {value,label} 選項。 */
export function sessionOptions(
  sessions: (FormattableSession & { id: string; end_time: string })[]
): { value: string; label: string }[] {
  return sessions.map((s) => ({ value: s.id, label: formatSessionLabel(s) }));
}
