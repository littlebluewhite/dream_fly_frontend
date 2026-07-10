/* Dream Fly — 管理後台報表頁面消費的純數學／查表函式庫(Round 4 P4-F1)。
 *
 * 全部零外部依賴(同 $lib/checkout-math.ts 慣例)：只吃/吐最小必要形狀的純函式，
 * report-math.test.ts 可直接用字面量測邊界，不需要 mock admin/api.ts 的任何型別。
 * 型別因此與 admin/api.ts 的 wire/FE 型別各自獨立宣告(桶 key 等小型封閉字串集合
 * 兩邊都各自寫一份字面量)，非共用同一份——換取本檔可獨立測試、獨立於 api.ts 改版
 * (同 $lib/api/wire.ts「不 import 任何 $lib 模組」的最底層知識檔慣例)。
 *
 * cents/ratio 的顯示格式化(NT$/%字串)不在本檔——那是 ntd()/fmtNT()/fmtPct() 的
 * 職責(public/adapters.ts、admin/format.ts)；本檔只做「數字→數字」的環比/占比/
 * 正規化運算，和「wire 桶 key → 中文標籤(+色)」查表。 */

/* ═════════════════════════ 環比／占比／正規化(純數字運算) ═════════════════════════ */

/** 環比 %：(current-last)/last×100；current 或 last 為 null，或 last<=0(分母不成立)
 *  → null。用於 kpis 四組 this/last 月對(契約 §3.24：「環比成長 % 由前端算」)。 */
export function deltaPct(current: number | null, last: number | null): number | null {
	if (current == null || last == null || last <= 0) return null;
	return ((current - last) / last) * 100;
}

/** count/金額列 → 占比陣列(0–1 比例，對齊 fmtPct()/category_split.ratio 的既有
 *  0–1 慣例)；合計 <=0 時全部回 0，不除以 0。用於契約明言「占比由前端算」的段落
 *  (如 payment_split)。 */
export function pctShares(rows: number[]): number[] {
	const total = rows.reduce((sum, v) => sum + v, 0);
	if (total <= 0) return rows.map(() => 0);
	return rows.map((v) => v / total);
}

/** 長條圖高度/寬度正規化：每筆 value 相對陣列最大值的比例 × maxScale(預設 100，
 *  對齊 MiniBar 等既有元件的 0–100 值域)；全 0 或空陣列 → 全 0，不除以 0。 */
export function normalizeBars(values: number[], maxScale = 100): number[] {
	const max = Math.max(...values, 0);
	if (max <= 0) return values.map(() => 0);
	return values.map((v) => (v / max) * maxScale);
}

/* ═════════════════════════ 課程/收入來源 重塑 ═════════════════════════ */

/** 熱門課程一列——rank 為陣列位置(非資料欄位)。 */
export interface TopCourseRow {
	rank: number;
	name: string;
	count: number;
}

/** 熱門課程 Top 5：既有 courses[] 依 enrolled 降冪排序取前 5，免後端另開聚合端點
 *  (契約 §3.24「mock 有但契約無」清單對 topCourses 的裁決)；不變動輸入陣列。 */
export function topCoursesFrom(courses: { name: string; enrolled: number }[]): TopCourseRow[] {
	return [...courses]
		.sort((a, b) => b.enrolled - a.enrolled)
		.slice(0, 5)
		.map((c, i) => ({ rank: i + 1, name: c.name, count: c.enrolled }));
}

/** 單一收入來源的 12 月時間序列(月序已對齊、缺月零填)。 */
export interface IncomeSourceSeries {
	source: string;
	points: { month: string; grossCents: number }[];
}

/** income_sources_12m 的「12 月 × 6 source」攤平列 → 圖表友善的「每 source 一條
 *  時間序列」結構：月序取列中出現過的月份由舊到新排序、每個 source 缺的月份零填
 *  (防禦性——即使輸入未依契約保證的 72 列零填也不會缺點)。source 順序＝輸入列中
 *  首次出現的順序(呼叫端傳入契約保證的 canonical 序列即得 canonical 輸出序)。 */
export function groupIncomeSources(
	rows: { month: string; source: string; grossCents: number }[]
): IncomeSourceSeries[] {
	const months = [...new Set(rows.map((r) => r.month))].sort();
	const sources = [...new Set(rows.map((r) => r.source))];
	return sources.map((source) => {
		const bySource = new Map(rows.filter((r) => r.source === source).map((r) => [r.month, r.grossCents]));
		return { source, points: months.map((month) => ({ month, grossCents: bySource.get(month) ?? 0 })) };
	});
}

/* ═════════════════════════ 顯示格式化 ═════════════════════════ */

/** 分鐘 → 「X 小時」/「X.5 小時」顯示字串，四捨五入至最近半小時(venue_usage.minutes
 *  的顯示格式)。 */
export function fmtHours(minutes: number): string {
	const hours = Math.round(minutes / 30) * 0.5;
	return `${hours} 小時`;
}

/* ═════════════════════════ wire 桶 key → 中文標籤(+色) 對照常數 ═════════════════════════ */

/** users.points_balance 分級桶 key → 中文標籤 + 代表色(契約 §3.24 tier_distribution，
 *  4 桶固定序 regular/bronze/silver/gold，封閉集合不需容錯 fallback)。色票沿用既有
 *  domain/reports.ts TIER_DIST 的既定配色，維持視覺一致。 */
export const TIER_LABEL: Record<'regular' | 'bronze' | 'silver' | 'gold', { label: string; color: string }> = {
	regular: { label: '一般', color: '#64748B' },
	bronze: { label: '銅', color: '#B45309' },
	silver: { label: '銀', color: '#94A3B8' },
	gold: { label: '金', color: '#F59E0B' }
};

/** revenue_breakdown / income_sources_12m / category_split 的 source 桶 key →
 *  中文標籤 + 代表色(契約 §3.24 canonical 6 值封閉集合,不需容錯 fallback;
 *  category_split 只會出現前 5 桶——venue_rental 非 order line)。標籤對齊既有
 *  product_type 三值的中文(單次票券/月票方案/課程套裝,見 TicketEditDialog),
 *  色票沿用歸檔 REVENUE_BREAKDOWN/INCOME_SOURCES 的既定配色。P4-F2 新增。 */
export const REVENUE_SOURCE_LABEL: Record<
	'course' | 'ticket' | 'membership' | 'course_package' | 'merchandise' | 'venue_rental',
	{ label: string; color: string }
> = {
	course: { label: '課程報名', color: 'var(--df-primary)' },
	ticket: { label: '單次票券', color: '#8B5CF6' },
	membership: { label: '月票方案', color: '#0EA5E9' },
	course_package: { label: '課程套裝', color: '#10B981' },
	merchandise: { label: '裝備週邊', color: 'var(--df-warning)' },
	venue_rental: { label: '場地租借', color: '#EC4899' }
};

/** payment_split.method(應用層自由字串；契約僅列舉本輪已知值，NULL 已由後端轉
 *  "unknown")→ 中文標籤查表。 */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
	credit_card: '信用卡',
	line_pay: 'LINE Pay',
	atm: 'ATM 轉帳',
	jkopay: '街口支付',
	cash: '現場付款',
	unknown: '其他'
};

/** 容忍未知 method 的查表(付款方式為應用層值域、非 DB enum，未來可能新增)：查無
 *  → 原字串穿透，不丟例外(同 $lib/api/wire.ts orderStatusBadge 的容忍查表慣例)。 */
export const paymentMethodLabel = (method: string): string => PAYMENT_METHOD_LABEL[method] ?? method;

/** weekday_load[].weekday(0=週日..6=週六，契約 §3.24，同 §3.18 慣例)→ 中文單字
 *  標籤，陣列索引即 weekday 值。 */
export const WEEKDAY_LABEL: readonly string[] = ['日', '一', '二', '三', '四', '五', '六'];

/** age_distribution 桶 key(足歲，排除 birth_date 為 NULL 者)→ 中文顯示標籤。 */
export const AGE_BUCKET_LABEL: Record<'0-6' | '7-12' | '13-17' | '18-25' | '26-40' | '41+', string> = {
	'0-6': '0–6 歲',
	'7-12': '7–12 歲',
	'13-17': '13–17 歲',
	'18-25': '18–25 歲',
	'26-40': '26–40 歲',
	'41+': '41 歲以上'
};

/** attendance_distribution 桶 key(present/(present+absent)，leave 不入分母)→
 *  中文顯示標籤。 */
export const ATTENDANCE_BUCKET_LABEL: Record<'gte_95' | '85_94' | '75_84' | 'lt_75', string> = {
	gte_95: '95–100%',
	'85_94': '85–94%',
	'75_84': '75–84%',
	lt_75: '低於 75%'
};
