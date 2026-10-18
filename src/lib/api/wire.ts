/* Dream Fly — 後端 wire 知識單一來源。
 *
 * 收 ≥2 個 surface 共用的後端 wire 知識：共用顯示知識（Tone、訂單狀態查表、總查表原語 lookupOr、姓名縮寫、
 * 品牌色、日期/時間顯示切片、收款時間、年齡範圍）、訂單雙身分協定與 5% 內含稅顯示反推，以及產生型別
 * （$lib/api/generated）的 type-only 轉出。後端回應形狀由 Rust DTO 產生，這裡不手寫信封或成對 DTO
 * （ADR 0007 與其增補）。UI 目標型別一律不收（結算 per-surface，ADR 0003 精神）。
 *
 * 明確不收（防未來誤收）：
 * - `ntd`/`toCents`/`orderItemsSummary` —— 留在 public/adapters.ts（ADR 0006
 *   既定的 cents 邊界）
 * - `COURSE_LEVEL_LABEL` —— 已在 domain/course-level.ts 單一來源
 * - 窄化的 `ApiUser`/`ApiMe`/`ApiUserAccount` —— 皆為產生型別的 `Pick<…>` 投影，
 *   留在各自消費端（「結構型別無漂移風險」不成立，見 ADR 0007 增補）
 * - mobile 雙 surface 的 tuple 型 `Tone` 與 3 值子集 —— 與後端接線狀態無關，刻意不
 *   預先收斂（見 ADR 0007）
 * - 各 surface 的 UI 目標型別與 member-only 查表
 *
 * **顯示查表**（狀態/類型 → tone/label；ADR 0013 與其增補、ADR 0019）：
 * - 表住 $lib/domain 各 entity 檔與 domain/member-app（member/mobile 雙生的查表與成對常數）；訂單狀態表住本檔。
 * - 取用形只有兩種：facade 真的攜帶自己的型別事實（以較嚴格或不同形狀的 `Tone` 對同一參照純註記收窄，零 `as`）
 *   時，消費端經該 facade 取用（mobile-admin、member、mobile 屬此）；facade 只是同源且結構恆等的轉手時不設這一層，
 *   消費端直取 $lib/domain 各 entity 檔或本檔。不為零型別事實的轉手開 re-export（假接縫）。mobile/stores 的
 *   store/動作轉手管的是 import 方向，不在此列（ADR 0024）。
 * - 以後端 enum 為鍵的表，另提供一支「任何字串都能查」的函式（orderStatusBadge、ticketTypeBadge、attStateBadge），
 *   未知值後備（中性 tone + 原字串）收在表所在的檔；消費端不自己補 `?? …`、不用 `as` 強轉鍵型別。課程等級與
 *   招生狀態同形：消費端呼叫 courseLevelLabel/courseLevelTone/classStatusTone，不索引 LEVEL_TONE/STATUS_TONE。
 * - 總查表（任何字串都不取到 undefined，也不取到 Object.prototype 上的繼承成員）只有 lookupOr 一種寫法：查表
 *   函式與一次性的後備查詢都用它，不另寫 `Object.hasOwn(…) ? … : …` 或 `表[鍵] ?? 後備`。
 * - 報表面板的呈現素材（序列色盤、`{label,color}` 桶表、像素值域）不是域語彙，不算顯示查表：單源住
 *   admin/report-math，兩個 surface 直取。
 *
 * 本檔是最底層的知識檔：只放純型別＋純函式＋常數，不 import 任何 $lib 模組。 */

import type { OrderStatus } from './generated';

export type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** 總查表原語：只認 table 的自有鍵，查無回 fallback。constructor／toString／__proto__ 等
 *  Object.prototype 上的鍵拿 `??` 判查無會取到繼承來的成員，所以用 Object.hasOwn。
 *  `NoInfer`：fallback 不參與 V 的推導，型別以 table 為準。 */
export function lookupOr<V>(table: Readonly<Record<string, V>>, key: string, fallback: NoInfer<V>): V {
  return Object.hasOwn(table, key) ? table[key] : fallback;
}

/** 訂單狀態值域——W-6 起由後端 DTO 產生（src/lib/api/generated/），這裡只轉出。 */
export type { OrderStatus };

/** 訂單狀態 → [badge tone, 中文標籤]。標籤內容必須與現行程式碼逐字相同。
 *  Record<OrderStatus, …>：後端新增狀態時這裡編譯紅（orderStatusBadge 的後備仍保留）。 */
export const ORDER_STATUS: Record<OrderStatus, [Tone, string]> = {
  pending: ['warning', '待付款'],
  paid: ['success', '已付款'],
  processing: ['info', '處理中'],
  completed: ['neutral', '已完成'],
  cancelled: ['error', '已取消'],
  refunded: ['neutral', '已退款']
};

/** 容忍未知字串的查表：查無（只認自有鍵，constructor 等原型鍵也算查無）→ ['neutral', 原字串]。
 */
export const orderStatusBadge = (s: string): [Tone, string] => lookupOr<[Tone, string]>(ORDER_STATUS, s, ['neutral', s]);

/* ── 訂單雙身分協定 + 內含稅顯示反推（2026-07 增收）─────────────────────────
 * admin/member/mobile-admin 三處先前各自散記的兩件訂單 wire 知識，收成單點。 */

/** 訂單雙身分：後端同一筆訂單有兩個識別欄——`order_number` 是給人看的單號（UI 沿用
 *  的顯示 `id` 欄），`id` 才是打 `PATCH /orders/{id}/status` 要用的真 uuid。單點此協定，
 *  三個 surface 不再各自記憶「哪個欄位餵哪條路徑」。四處 wire 型別（admin
 *  AdminOrderSummary、member OrderSummary、checkout 與 PATCH 回應 OrderResponse，皆為
 *  後端產生型別）皆必填 `order_number: string`、無 fallback。註：mobile-admin
 *  的 mock ORDERS 用自參照（orderId = 顯示 id）不走此協定；結帳成交快照
 *  （member/checkout-controller 的 `PaidSummary.orderNumber`）為具名欄位、無混用風險，亦不經此。 */
export const orderIdentity = (o: { id: string; order_number: string }): { display: string; uuid: string } =>
  ({ display: o.order_number, uuid: o.id });

/** 5% 內含稅顯示反推：`tax = round(amount − amount ÷ 1.05)`、`net = amount − tax`。
 *  單位跟隨傳入值（兩呼叫端皆已是 NT$ 整數；cents 邊界的 `ntd`/`toCents` 依 ADR 0007
 *  留在 public/adapters.ts）。這是顯示端推導、非後端欄位（後端訂單無稅額/未稅欄，P2）。 */
export const taxFromGross = (amount: number): { tax: number; net: number } => {
  const tax = Math.round(amount - amount / 1.05);
  return { tax, net: amount - tax };
};

/** 後端清單信封（產生型別 *ListResponse 的 { total, page, per_page }）meta → camelCase
 *  （前端慣用）。W-7 起信封型別一律用產生型別，手寫的 ApiPage 泛型已刪。 */
export const pageMeta = (r: { total: number; page: number; per_page: number }) =>
  ({ total: r.total, page: r.page, perPage: r.per_page });

/** 請假申請狀態（integration-contract.md §3.20 四態）——W-6 起由後端 DTO 產生，這裡只轉出。
 *  請假 wire 形狀（LeaveRequestResponse / 教練清單版 AdminLeaveRequestResponse）由
 *  消費端直接 `import type` 自 $lib/api/generated。 */
export type { LeaveStatus } from './generated';

/** GET /sessions/today 回應（admin/coach 兩分支共用同一形狀，integration-contract.md
 *  §3.18）——W-5 起由後端 DTO 產生（src/lib/api/generated/），這裡只轉出。 */
export type { TodaySessionResponse, SessionStatus } from './generated';

/** 姓名縮寫（頭像 fallback）：trim 後取首字，空字串（或全空白）回 fallback（預設 '?'）。 */
export const initialOf = (name: string, fallback = '?'): string => name.trim().charAt(0) || fallback;

/** ISO 時間字串 → 'YYYY-MM-DD HH:mm'（顯示用途）。 */
export const isoDateTime = (iso: string): string => iso.slice(0, 16).replace('T', ' ');
/** ISO 日期（時間）字串 → 'YYYY-MM-DD'（顯示用途；isoDateTime 的日期截斷版）。 */
export const isoDate = (iso: string): string => iso.slice(0, 10);

/** 收款時間顯示（W-6）：讀後端真實 `paid_at`（AdminOrderSummary / OrderResponse）。
 *  null 時 pending →「—（待付款）」、其他狀態 →「—」；有值則同訂單日期欄的 isoDate
 *  格式。讀取（admin/api.ts 的 mapAdminOrder）與 PATCH 後套回（order-status.ts 的
 *  applyStatusChange）共用。 */
export function paidAtLabel(status: OrderStatus, paidAt: string | null): string {
  if (paidAt === null) return status === 'pending' ? '—（待付款）' : '—';
  return isoDate(paidAt);
}
/** time-only 欄位 'HH:MM(:SS)' → 'HH:MM'（顯示用途；完整 ISO 走 isoDate/isoDateTime）。 */
export const hhmm = (t: string): string => t.slice(0, 5);

/** 品牌主色（後端未給色時的預設頭像色）。 */
export const BRAND_PRIMARY_HEX = '#0066CC';

/** 年齡範圍顯示字串（三分支：雙界/單界/無界）。自現行 admin/api.ts 逐字搬。 */
export function ageRange(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}–${max} 歲`;
  if (min != null) return `${min} 歲以上`;
  if (max != null) return `${max} 歲以下`;
  return '';
}
