/* Dream Fly — 後端 wire 知識單一來源。
 *
 * 背景：後端 wire 知識（訂單狀態 union＋標籤表、清單信封形狀、成對 DTO、品牌色/
 * 縮寫/日期切片等）目前人手同步散落多個 surface：domain/orders.ts 自註「kept in
 * sync with admin/data.ts」、ORDER_STATUS 標籤表逐字複製 2 份、清單信封 interface
 * 手寫 11 份、`ApiReportCard`/`ApiCertificate` 在 member 與 coach 成對重抄。本檔
 * 建立單一來源；後續任務（乙線）會把 8 個檔案改為 import 這裡——本檔落地後即
 * 凍結為唯讀契約，既有重複點的改線不在本檔異動範圍內。
 *
 * 收錄原則：≥2 個 surface 共用的後端 wire 知識才收；UI 目標型別一律不收（結算
 * per-surface，ADR 0003 精神）。
 *
 * 明確不收（防未來誤收）：
 * - `ntd`/`toCents`/`orderItemsSummary` —— 留在 public/adapters.ts（ADR 0006
 *   既定的 cents 邊界）
 * - `COURSE_LEVEL_LABEL` —— 已在 domain/course-level.ts 單一來源
 * - 三份窄化 `ApiUser` —— 不同投影非重複，結構型別無漂移風險
 * - mobile 雙 surface 的 tuple 型 `Tone` 與 3 值子集 —— P2 凍結區
 * - 各 surface 的 UI 目標型別與 member-only 查表
 *
 * 本檔是最底層的知識檔：只放純型別＋純函式＋常數，不 import 任何 $lib 模組。 */

export type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded';

/** 訂單狀態 → [badge tone, 中文標籤]。標籤內容必須與現行程式碼逐字相同。 */
export const ORDER_STATUS: Record<OrderStatus, [Tone, string]> = {
  pending: ['warning', '待付款'],
  paid: ['success', '已付款'],
  processing: ['info', '處理中'],
  completed: ['neutral', '已完成'],
  cancelled: ['error', '已取消'],
  refunded: ['neutral', '已退款']
};

/** 容忍未知字串的查表：查無 → ['neutral', 原字串]。
 *  顯式放寬 cast 是必要的：strict 下以任意 string 索引 Record<OrderStatus,…> 會使 check 紅。 */
export const orderStatusBadge = (s: string): [Tone, string] =>
  (ORDER_STATUS as Record<string, [Tone, string] | undefined>)[s] ?? ['neutral', s];

/** 後端清單信封：{ [K]: T[], total, page, per_page }。
 *  mapped type，不能被 interface extends——消費端一律用 type alias。 */
export type ApiPage<K extends string, T> = { [P in K]: T[] } & { total: number; page: number; per_page: number };

/** 信封 meta → camelCase（前端慣用）。 */
export const pageMeta = (r: { total: number; page: number; per_page: number }) =>
  ({ total: r.total, page: r.page, perPage: r.per_page });

/** GET /report-cards/me（member）與 POST /report-cards（coach）共用的成績單 wire
 *  形狀（integration-contract.md §3.22）。自現行 member/api.ts 與 coach/api.ts
 *  逐字複製——兩處欄位完全相同。 */
export interface ApiReportCard {
  id: string;
  course_id: string;
  course_name: string;
  term_label: string;
  comment: string | null;
  rating: number | null;
  created_by_name: string;
  created_at: string;
}

/** GET /certificates/me（member）與 POST /certificates（coach）共用的證書 wire
 *  形狀（integration-contract.md §3.22）。自現行 member/api.ts 與 coach/api.ts
 *  逐字複製——兩處欄位完全相同。 */
export interface ApiCertificate {
  id: string;
  course_id: string | null;
  course_name: string | null;
  title: string;
  level: string | null;
  issued_on: string; // "YYYY-MM-DD"
  note: string | null;
  created_at: string;
}

/** 姓名縮寫（頭像 fallback）：空字串回 '?'。 */
export const initialOf = (name: string): string => name.charAt(0) || '?';

/** ISO 時間字串 → 'YYYY-MM-DD HH:mm'（顯示用途）。 */
export const isoDateTime = (iso: string): string => iso.slice(0, 16).replace('T', ' ');

/** 品牌主色（後端未給色時的預設頭像色）。 */
export const BRAND_PRIMARY_HEX = '#0066CC';

/** 年齡範圍顯示字串（三分支：雙界/單界/無界）。自現行 admin/api.ts 逐字搬。 */
export function ageRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}–${max} 歲`;
  if (min != null) return `${min} 歲以上`;
  if (max != null) return `${max} 歲以下`;
  return '';
}
