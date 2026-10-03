/* Dream Fly — 管理後台報表頁面消費的純數學／查表函式庫(Round 4 P4-F1)。
 *
 * 全部零外部依賴(同 $lib/checkout-math.ts 慣例)：只吃/吐最小必要形狀的純函式，
 * report-math.test.ts 可直接用字面量測邊界，不需要 mock admin/api.ts 的任何型別。
 * 型別因此與 admin/api.ts 的 wire/FE 型別各自獨立宣告(桶 key 等小型封閉字串集合
 * 兩邊都各自寫一份字面量)，非共用同一份——換取本檔可獨立測試、獨立於 api.ts 改版
 * (同 $lib/api/wire.ts「不 import 任何 $lib 模組」的最底層知識檔慣例)。
 *
 * cents/ratio 的顯示格式化(NT$/%字串)不在本檔——那是 ntd()/fmtNT()/fmtPct() 的
 * 職責(public/adapters.ts、admin/format.ts)；本檔只做三件事：「數字→數字」的環比/
 * 占比/正規化運算、「wire 桶 key → 中文標籤(+色)」查表，與 2026-07(架構深化 R7 C5)
 * 增收的「報表 KPI band 6 卡識別四欄(icon/label/tint/color)」單源查表(見檔尾
 * REPORT_KPI_CARDS 註記)。 */

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

/* ═════════════ 逐面板 view-model(Round 2 C3:桌面 reports 元件 × mobile-admin ReportsScreen 共用) ═════════════
 * 每面板一支「數字→數字」純函式,收斂兩個 surface 原本各自 re-inline 的同一套算式
 * (ADR 0009:per-surface 的是元件,共用的只有純邏輯)。柱高/條寬的 maxScale 仍由呼叫端
 * 傳入(參數是接口——桌面/行動用不同值域,本來就該由呼叫端決定傳哪一組)；但具體
 * 像素值不再各自硬編,單源收在下方 REPORT_SCALES(R10 架構深化 E 案),呼叫端經其
 * 取值,不再逐字重抄同一組數字。 */

/** 各面板柱高/條寬的桌面／行動像素值域單源查表——原本 5 組 scale 數對散在桌面 9 檔
 *  與 ReportsScreen.svelte 呼叫端各自硬編同一組數字(110/84、100/84、104/92、
 *  116/104,加 revenueTrend 的 160/108),現收斂本表;呼叫端改傳
 *  `REPORT_SCALES.<panel>.desktop`/`.mobile`,各 VM 的 maxScale 參數本身不動。 */
export const REPORT_SCALES = {
	revenueTrend: { desktop: 160, mobile: 108 },
	attDist: { desktop: 110, mobile: 84 },
	tier: { desktop: 100, mobile: 84 },
	weekday: { desktop: 104, mobile: 92 },
	retention: { desktop: 116, mobile: 104 }
} as const;

/** 月營收趨勢:total=12 月加總;heights=normalizeBars 柱高(桌面 maxScale=160、行動
 *  108,見 REPORT_SCALES.revenueTrend;全 0 → 全 0,不產生 NaN)。R10 架構深化 E 案
 *  將桌面原本內嵌的 (h/max)*160、max 另保底 1 的算式收進本函式,改與其餘面板 VM
 *  同型(heights[] + normalizeBars)。等價前提:月營收金額(新台幣元)<1 不可達——
 *  舊「max 保底 1」寫法只在 0<max<1 這個不可達區間會與 normalizeBars 的「max<=0
 *  才保底 0」不同(此時舊式=h×160、新式=滿高 160),真實資料(整數元、全 0 或至少
 *  1 元)下兩式結果相同。 */
export function revenueTrendVM(rows: { h: number }[], maxScale = 100): { total: number; heights: number[] } {
	return {
		total: rows.reduce((sum, d) => sum + d.h, 0),
		heights: normalizeBars(rows.map((d) => d.h), maxScale)
	};
}

/** 本月營收來源拆解:合計毛額(cents)——合計取自列本身加總,非 revenue KPI 的實收
 *  口徑(折扣後、僅訂單),兩者刻意不對帳(見 RevenueBreakdown.svelte 檔頭)。 */
export function breakdownTotalCents(rows: { grossCents: number }[]): number {
	return rows.reduce((sum, r) => sum + r.grossCents, 0);
}

/** 收入來源分析:groupIncomeSources() 每 source 的 12 月毛額加總 + pctShares() 占比
 *  (0–1,fmtPct-ready;全 0 → 全 0,不除以 0)。source 序=canonical 輸入序。 */
export function incomeSourcesVM(rows: { month: string; source: string; grossCents: number }[]): {
	totals: { source: string; totalCents: number }[];
	shares: number[];
} {
	const totals = groupIncomeSources(rows).map((s) => ({
		source: s.source,
		totalCents: s.points.reduce((sum, p) => sum + p.grossCents, 0)
	}));
	return { totals, shares: pctShares(totals.map((t) => t.totalCents)) };
}

/** 教練表現排行:依 12 月營收降冪排序(複本,不變動輸入;同額靠 sort 穩定性維持輸入
 *  序)+ normalizeBars 橫條寬(相對最大值 0–100)。泛型讓呼叫端的顯示欄位(name/
 *  studentCount…)原樣通過排序帶回。 */
export function coachPerfVM<T extends { revenueCents12m: number }>(
	rows: T[]
): { ranked: T[]; widths: number[] } {
	const ranked = [...rows].sort((a, b) => b.revenueCents12m - a.revenueCents12m);
	return { ranked, widths: normalizeBars(ranked.map((c) => c.revenueCents12m)) };
}

/** 場館使用時數:minutes 選擇器 → normalizeBars 橫條寬(兩 surface 皆用預設 0–100)。 */
export function venueUsageVM(rows: { minutes: number }[], maxScale = 100): number[] {
	return normalizeBars(rows.map((v) => v.minutes), maxScale);
}

/** 出席率分布:count 選擇器 → normalizeBars 柱高(桌面 110px、行動 84px)。 */
export function attDistVM(rows: { count: number }[], maxScale = 100): number[] {
	return normalizeBars(rows.map((d) => d.count), maxScale);
}

/** 會員分級分布:count 選擇器 → normalizeBars 柱高(桌面 100px、行動 84px)。 */
export function tierVM(rows: { count: number }[], maxScale = 100): number[] {
	return normalizeBars(rows.map((d) => d.count), maxScale);
}

/** 星期別出席負載:presentCount 選擇器 → normalizeBars 柱高(桌面 104px、行動 92px)
 *  + 最忙桶原始人次(max,0 保底——全 0 時呼叫端據此不畫最忙強調色)。 */
export function weekdayVM(
	rows: { presentCount: number }[],
	maxScale = 100
): { heights: number[]; max: number } {
	return {
		heights: normalizeBars(rows.map((d) => d.presentCount), maxScale),
		max: Math.max(...rows.map((d) => d.presentCount), 0)
	};
}

/** 新生 vs 回訪:月活躍總數(new+returning)→ normalizeBars 疊柱高(桌面 116px、行動
 *  104px)+ 末桶留存率(空清單或末桶 rate 為 null → null,交給 fmtPct 畫「—」)。 */
export function retentionVM(
	rows: { newCount: number; returningCount: number; rate: number | null }[],
	maxScale = 100
): { heights: number[]; lastRate: number | null } {
	return {
		heights: normalizeBars(rows.map((d) => d.newCount + d.returningCount), maxScale),
		lastRate: rows.at(-1)?.rate ?? null
	};
}

/** 試上洽詢 → 報名:兩段條寬(相對較大段 0–100,全 0 → 全 0)+ 轉化率(洽詢 0 →
 *  null,不除以 0;報名可能非全來自試上,>1 如實回傳)。 */
export function funnelVM(funnel: { trialInquiries: number; newEnrolments: number }): {
	widths: number[];
	conversion: number | null;
} {
	return {
		widths: normalizeBars([funnel.trialInquiries, funnel.newEnrolments]),
		conversion: funnel.trialInquiries > 0 ? funnel.newEnrolments / funnel.trialInquiries : null
	};
}

/** 付款方式占比:count 占比(0–1)+ 是否有任何進帳(hasData=false 時呼叫端畫中性圓
 *  環)。conic 色標(donutStops 組裝)仍是呼叫端的事——但色盤本身(PAYMENT_PALETTE)
 *  已單源收在本檔(R10 架構深化 E 案),呼叫端依索引循環取色餵給 donutStops,不再
 *  各自重抄色碼陣列。 */
export function paymentVM(rows: { count: number }[]): { shares: number[]; hasData: boolean } {
	return {
		shares: pctShares(rows.map((p) => p.count)),
		hasData: rows.some((p) => p.count > 0)
	};
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
 *  4 桶固定序 regular/bronze/silver/gold；呼叫端經 bucketLabel() 容忍未知桶)。色票沿用既有
 *  domain/reports.ts TIER_DIST 的既定配色，維持視覺一致。 */
export const TIER_LABEL: Record<'regular' | 'bronze' | 'silver' | 'gold', { label: string; color: string }> = {
	regular: { label: '一般', color: '#64748B' },
	bronze: { label: '銅', color: '#B45309' },
	silver: { label: '銀', color: '#94A3B8' },
	gold: { label: '金', color: '#F59E0B' }
};

/** revenue_breakdown / income_sources_12m / category_split 的 source 桶 key →
 *  中文標籤 + 代表色(契約 §3.24 canonical 6 值,呼叫端經 revenueSourceLabel() 容忍未知值;
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

/** 容忍未知 source 的查表(income_sources_12m 的 source 是 groupIncomeSources() 攤平出
 *  的純字串，非型別窄化過的 canonical 6 值)：查無 key → 中性灰 + 原字串穿透，不丟
 *  例外(同 paymentMethodLabel／$lib/api/wire.ts orderStatusBadge 的容忍查表慣例)。
 *  契約現為封閉 6 值，但若擴集，呼叫端(IncomeSources.svelte/ReportsScreen.svelte)靠
 *  這支查表降級，不會在 REVENUE_SOURCE_LABEL[source] 直接索引時因 undefined 炸頁。 */
export const revenueSourceLabel = (source: string): { label: string; color: string } =>
	bucketLabel(REVENUE_SOURCE_LABEL, source);

/** 容忍未知 key 的 {label,color} 桶表查表(TIER/AGE/ATTENDANCE/REVENUE_SOURCE 共用)：查無
 *  → 中性灰 + 原字串穿透，後端擴集時面板顯示原 key 而不是 undefined 或炸頁。 */
export const bucketLabel = (
	table: Readonly<Record<string, { label: string; color: string }>>,
	key: string
): { label: string; color: string } =>
	(table as Record<string, { label: string; color: string } | undefined>)[key] ?? {
		label: key,
		color: 'var(--df-text-muted)'
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

/** age_distribution 桶 key(足歲，排除 birth_date 為 NULL 者)→ 中文顯示標籤 + 代表色
 *  (桌面 AgeDist.svelte 與 ReportsScreen.svelte 原本各自逐字重抄同一份桶色，R10
 *  架構深化 E 案併入本表，同 TIER_LABEL 的 {label,color} 複合形)。 */
export const AGE_BUCKET_LABEL: Record<
	'0-6' | '7-12' | '13-17' | '18-25' | '26-40' | '41+',
	{ label: string; color: string }
> = {
	'0-6': { label: '0–6 歲', color: '#10B981' },
	'7-12': { label: '7–12 歲', color: 'var(--df-primary)' },
	'13-17': { label: '13–17 歲', color: '#0EA5E9' },
	'18-25': { label: '18–25 歲', color: '#8B5CF6' },
	'26-40': { label: '26–40 歲', color: '#F59E0B' },
	'41+': { label: '41 歲以上', color: '#EC4899' }
};

/** attendance_distribution 桶 key(present/(present+absent)，leave 不入分母)→
 *  中文顯示標籤 + 代表色(桌面 AttDist.svelte 與 ReportsScreen.svelte 原本各自逐字
 *  重抄同一份桶色，R10 架構深化 E 案併入本表，同 TIER_LABEL 的 {label,color} 複合
 *  形)。 */
export const ATTENDANCE_BUCKET_LABEL: Record<
	'gte_95' | '85_94' | '75_84' | 'lt_75',
	{ label: string; color: string }
> = {
	gte_95: { label: '95–100%', color: 'var(--df-success)' },
	'85_94': { label: '85–94%', color: 'var(--df-primary)' },
	'75_84': { label: '75–84%', color: '#0EA5E9' },
	lt_75: { label: '低於 75%', color: 'var(--df-warning)' }
};

/** 教練表現排行/場館使用時數/付款方式占比三面板的開放集合(數量不定)循環色盤——
 *  桌面 CoachPerf/VenueUsage/PaymentSplit 三檔與 ReportsScreen.svelte 原本各自逐字
 *  重抄同一份陣列,R10 架構深化 E 案單源收斂;呼叫端仍以 `PALETTE[i %
 *  PALETTE.length]` 依索引循環取色(桶 key 固定的面板走上面的 xxx_LABEL Record,
 *  這三個是索引式,shape 不同故不併入同一批常數)。 */
export const COACH_PALETTE: readonly string[] = [
	'var(--df-primary)',
	'#0EA5E9',
	'#10B981',
	'#8B5CF6',
	'#EC4899',
	'#F59E0B'
];

export const VENUE_PALETTE: readonly string[] = [
	'var(--df-primary)',
	'#0EA5E9',
	'#10B981',
	'#8B5CF6',
	'#EC4899',
	'var(--df-warning)'
];

export const PAYMENT_PALETTE: readonly string[] = [
	'var(--df-primary)',
	'#10B981',
	'#0EA5E9',
	'#8B5CF6',
	'var(--df-warning)',
	'#EC4899'
];

/* ═════════════════════════ KPI 卡識別四欄(單源) ═════════════════════════ */

/** 報表 KPI band 6 卡的識別四欄(icon/label/tint/color)單源——桌面 ReportKpi
 *  (admin/reports/+page.svelte)與 mobile-admin KpiCard(ReportsScreen.svelte)原本
 *  各自手抄同一份六張卡的識別資料，在此上收共用。value/delta 兩者仍是 per-surface
 *  接線，不收進本表(ADR 0009 §2：KPI 卡 value 因單位混雜維持頁面組字串，delta 由
 *  呼叫端傳 deltaPct() 算出的數字、格式化下沉各元件內部)——本表只管兩邊逐字相同的
 *  識別資料。零 import 憲章維持(icon 為字面量字串，呼叫端既有 `icon: IconName`
 *  prop 型別把關，本檔無需 import IconName)。 */
export const REPORT_KPI_CARDS = {
	revenue: { icon: 'dollar-sign', label: '本月營收', tint: '#0066CC14', color: 'var(--df-primary)' },
	newMembers: { icon: 'user-plus', label: '本月新會員', tint: '#F59E0B14', color: '#F59E0B' },
	newEnrolments: { icon: 'book-open', label: '本月新報名', tint: '#10B98114', color: '#10B981' },
	paidOrdersCount: { icon: 'receipt', label: '本月訂單數', tint: '#8B5CF614', color: '#8B5CF6' },
	attendanceRate: { icon: 'calendar-check', label: '本月出席率', tint: '#10B98114', color: '#10B981' },
	retention: { icon: 'repeat', label: '會員留存率', tint: '#0EA5E914', color: '#0EA5E9' }
} as const;
