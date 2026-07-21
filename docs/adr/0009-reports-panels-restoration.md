# 報表面板還原：13 個元件復原接真、KPI band 6 卡、report-math.ts 純函式層

> Status: Accepted。源自 Round 4 Phase 4（前端 P4-F1~F3，2026-07-10）——admin 報表分析頁與
> mobile-admin `ReportsScreen` 的圖表面板還原工程。承接 `docs/adr/0006` §5 記錄的「報表資料已接真，
> 面板 UI 尚未還原」現況快照；報表聚合口徑（毛額 vs 實收、出席率排除請假、tier 分桶邊界等）的定義
> 屬於後端 `dream_fly_backend` 的 ADR-0004，本 ADR 只記錄前端這一側的還原決策，不重複貼口徑細節。

`689769a`（Task 15）讓 admin 報表分析頁的 `getReports()` 第一次接上真實的 `GET /reports/admin`，但
當時後端還沒有這批面板需要的細分聚合欄位（revenue 六桶拆解、age/attendance 分布、留存 cohort 等），
於是同一個 commit 依裁決 9 把原型（`reports.jsx` 移植版）留下的 15 個圖表面板（連同 period picker
與 donut 輔助函式）整批移除，換成兩張誠實表格（courses/coaches）與一個精簡的 5 卡 KPI 陣列——寧可
「誠實但少」，也不要顯示無資料源的假圖表。Round 4 Phase 4（後端 Task P4-B3 seed／P4-B4a 金流／
P4-B4b 人流擴充 `GET /reports/admin` 的聚合欄位後），前端得以把其中 13 個面板連同 `ReportKpi` 卡從
封存的原型還原、重新接上這批新資料，KPI band 也一併重新設計為 6 卡。本 ADR 記錄：哪些還原、哪些
刻意不還原、還原時定下的新慣例，以及新增的 `report-math.ts` 純函式層的角色。

## 背景與決定

### 1. 13 個面板 + `ReportKpi` + `donut.ts` 從 `689769a^` 還原；`CampusRevenue` 與 period picker 不還原

`0a88fc3` 從 `689769a^`（移除前的最後一版）還原以下檔案，逐一適配 Round 4 擴充後的 `ReportsData`：

`AgeDist`、`AttDist`、`CategoryDonut`、`CoachPerf`、`ConversionFunnel`、`IncomeSources`、
`PaymentSplit`、`RetentionTrend`、`RevenueBreakdown`、`TierDist`、`TopCourses`、`VenueUsage`、
`WeekdayLoad`（以上 13 個圖表面板）+ `ReportKpi`（KPI 卡元件）+ `donut.ts`（圓餅圖比例輔助函式）。

刻意**不**還原兩項：

- **`CampusRevenue.svelte`（分校營收）**：後端 `venues`/`courses` schema 從來沒有「分校」這個維度——
  本系統只有單一場館的多個「場地」，不是多分校。`dream_fly_backend` ADR-0004 明文判定
  `campusRevenue` 是前端 mock 原型階段的遺留假設欄位，本輪不新增一個假的分校概念去湊這個欄位。
- **`reports-period.ts`（period picker）**：後端 `admin_report` handler（`modules/reports/
  handlers.rs`）不接受任何 query 參數——`GET /reports/admin` 永遠回傳固定的「本月 vs 上月 + 12
  個月趨勢」，沒有可供 period picker 切換的後端維度；還原一顆切不動任何資料的下拉選單只是裝飾。

**`RevenueTrend.svelte` 既不在上述還原清單、也不在上面的刻意不還原清單**：它自 Task 15（`689769a`）
起就不曾被移除——`689769a` 那批刪除對它只是局部編輯（改吃 `getReports()` 的真實月營收資料），非本輪
還原範圍。它現與上述 13 個還原面板並列渲染在報表頁（`routes/admin/reports/+page.svelte:120`），頁面
實際圖表面板因此共 **14 個**（13 還原 + `RevenueTrend`）+ 6 卡 KPI band——本節與本 ADR 標題的「13 個
面板」僅指本輪還原範圍，不是頁面圖表面板的總數。

`ConversionFunnel` 額外把原型的 4 段假漏斗（預約體驗/完成體驗/正式報名/季末續報）收斂成後端真正能
證實的 2 段：試上洽詢（`inquiry_type='trial'`）→ 完成報名（近 90 天窗），中間兩段因無資料源直接
砍掉，而不是留著顯示 0；轉化率允許 >100%（報名不一定全部來自試上洽詢）如實顯示，不做上限裁切。

### 2. props 慣例：能確定單位的資料下沉格式化，KPI 卡的 `value` 因單位混雜維持頁面組字串

**13 個還原面板**：`rows`（或等價 props）一律改吃最小必要的原始結構化資料（cents 數字、比例陣列、
列陣列），格式化（`fmtNT`/`fmtPct`/`fmtHours`/`ntd()`）下沉到各元件內部。例如
`RevenueBreakdown.svelte` 只收 `rows: AdminRevenueBreakdownRow[]`（`grossCents` 原始數字），合計
（`totalCents`）由元件內 `$derived` 現算；原型版本的對應 props 是 `rows: RevenueRow[]`（`dot`/
`meta` 等已經是顯示層字串）外加一個獨立的 `total: string`（呼叫端先格式化好字串再傳入）。這個轉向
讓格式化規則集中在少數共用函式，不會因為 13 個面板各自接手格式化字串而分岔出不一致的寫法；也讓
`charts.test.ts` 可以直接餵數字斷言，不需要先猜呼叫端會怎麼格式化。

**KPI band（`ReportKpi`）是刻意的例外**：`value` 仍是頁面組好的**顯示字串**——6 張卡的單位不同
（NT$／位／筆／%），沒有單一格式化函式可以通用，續用「頁面組字串、元件只管排版」不會製造分歧。真正
下沉進元件的是**新增的 `delta`**：原型版本的 `k.delta` 是預格式化字串、且固定畫 `trending-up` 圖示
（原型資料從未示範過負成長）；還原版把 `delta` 改成 `deltaPct()` 算出的原始數字，+/− 號、小數位、
trend 圖示方向與正負配色四樣顯示規則現在都收在 `ReportKpi.svelte` 內部一份，不必 13 張卡各自複製。

### 3. KPI band 重新設計為 6 卡，環比 delta 前端算

`689769a` 移除 15 個圖表面板後，報表頁暫時留了一個 5 卡 `StatCard` 陣列頂著版面（本月營收/上月營收/
會員總數/本月新增會員/在學會員，並列呈現、無環比）。本輪把它整個換掉，改成 6 張 `ReportKpi` 卡：
本月營收、本月新會員、本月新報名、本月訂單數、本月出席率、會員留存率——前 5 張都是「本月 vs 上月」
的環比對，取代舊版並列兩張獨立卡片（本月／上月分開顯示）的呈現方式。環比 % 由前端計算，不是後端
回傳：

```ts
// src/lib/admin/report-math.ts
export function deltaPct(current: number | null, last: number | null): number | null {
	if (current == null || last == null || last <= 0) return null;
	return ((current - last) / last) * 100;
}
```

`current`/`last` 任一為 `null`，或 `last <= 0`（分母不成立）一律回 `null`——卡片顯示層把 `null`
渲染成「—」，不是 0% 或拋錯。第 6 張（會員留存率）沒有對應的「上期」欄位可比，`delta` 固定傳
`null`，不勉強湊一個環比數字。

### 4. `report-math.ts`：零外部依賴的純函式 + 查表層

新增 `src/lib/admin/report-math.ts`，收斂本輪還原面板共同需要的數字運算與中文標籤查表：

- **純數字運算**：`deltaPct`（環比 %）、`pctShares`（佔比陣列，合計 ≤0 時全部回 0 不除以零）、
  `normalizeBars`（長條圖高度正規化，全 0 或空陣列時全部回 0）、`topCoursesFrom`（既有
  `courses[]` 依 `enrolled` 降冪排序取前 5，附加 `rank`）、`groupIncomeSources`（12 月 × 6 來源
  攤平列 → 每來源一條時間序列，缺月零填）、`fmtHours`（分鐘 → 「X(.5) 小時」顯示字串，四捨五入至
  最近半小時）。
- **wire 桶 key → 中文標籤（+ 色）查表**：`TIER_LABEL`（points_balance 4 桶）、
  `REVENUE_SOURCE_LABEL`（6 個 canonical 收入來源桶）、`PAYMENT_METHOD_LABEL` + 容錯版
  `paymentMethodLabel()`（查無 key 原字串穿透，不丟例外）、`WEEKDAY_LABEL`（`0=週日..6=週六`）、
  `AGE_BUCKET_LABEL`、`ATTENDANCE_BUCKET_LABEL`。

比照 `$lib/checkout-math.ts` 的既有慣例：全部零外部依賴，只吃/吐最小必要形狀；型別與 `admin/api.ts`
的 wire/FE 型別各自獨立宣告（不共用同一份），換取 `report-math.test.ts` 可以直接用字面量測邊界
（null/0/空陣列/除以零等），不需要 mock `admin/api.ts` 的任何型別、也不受它改版牽動。cents/ratio 的
**顯示**格式化（`NT$`/`%` 字串）刻意不放這裡——那是 `ntd()`/`fmtNT()`/`fmtPct()` 的職責；本檔只做
「數字→數字」的運算與「wire 桶 key → 中文標籤」查表兩件事。

2026-07（架構深化 R7 C5）增收 `REPORT_KPI_CARDS`——報表 KPI band 6 卡的識別四欄（icon/label/
tint/color）單源查表，收斂桌面 `ReportKpi` 與 mobile-admin `KpiCard` 原本各自手抄的同一份卡片
識別資料；§2 決定的 `value`/`delta` per-surface 接線不變，不收進這張表。本節「數字運算＋查表」
的原始二分敘述，自此擴為三類。

### 5. mobile-admin `ReportsScreen` 同步接真，`domain/reports.ts` 舊 mock 模組隨之整個退役

`mobile-admin/api.ts` 新增 `getReports()`（零映射 re-export 桌面 `admin/api.ts` 同名函式）；
`ReportsScreen.svelte` 改用 `report-math.ts`/`admin/format.ts` 同一套格式化與查表，以行動版既有的
`Panel`/`KpiCard`/`MiniBar` 元件重新呈現——不是直接復用桌面那 13 個 `.svelte` 元件，桌面/行動版本來
就是不同的視覺呈現（同 `docs/adr/0003` per-surface 結算的精神）；分校 panel 與假下鑽按鈕同理移除，
副標改真實動態年月。這是 `domain/reports.ts`（13 組 mock 陣列/型別）最後一個消費者，隨之整個
`git rm`——連同 admin 側 Task F11 已無消費者的 `REPORT_KPIS`/`REVENUE_*` 孤兒常數一併清除，因退役
紅掉的測試（`domain/data.test.ts` 13 組斷言、`facade-type-exports.test.ts` 整檔）同批修復。

## 後果（刻意，非 bug）

- **`revenue_breakdown`（面板）與 `revenue.thisMonth`（KPI 卡）是兩個刻意不同的口徑**：前者是訂單
  品項折扣前毛額加總，後者是實收（已扣折扣）——`RevenueBreakdown.svelte` 的合計刻意取 `rows` 自己
  的加總，不是 `data.revenue.thisMonth`，兩者不會、也不應該對得起來（口徑定義見
  `dream_fly_backend` ADR-0004 §1）。前端串接時不能假設這兩組數字加總會一致。
- **`topCoursesFrom` 是前端推導，非後端獨立欄位**：`GET /reports/admin` 不提供獨立的「熱門課程」
  聚合，前端用既有 `courses[]` 依 `enrolled` 排序取前 5——多開一支後端聚合端點的成本高於在前端排序
  一次既有陣列。
- **`report-math.ts` 的桶 key 型別與 `admin/api.ts` 刻意不共用**：兩邊各自維護一份桶 key 的字面
  聯集型別（例如 `REVENUE_SOURCE_LABEL` 的 6 桶 key）。這是有意的重複，換取 `report-math.ts` 可以
  獨立測試、不被 `admin/api.ts` 改版牽動；若兩邊桶 key 集合未來不同步，型別檢查會在兩邊個別報錯，
  不會互相掩蓋成一筆難查的執行期 bug。

## 已知後續

- 若後端未來新增可切換的時間區間查詢（例如自訂日期範圍），`reports-period.ts` 才有重新評估還原的
  價值——目前 `GET /reports/admin` 固定回傳「本月 vs 上月 + 12 個月趨勢」，沒有可切的維度。
- 若後端未來新增「分校/campus」維度（需要 `venues` 或更上層新增對應概念，見 `dream_fly_backend`
  ADR-0004 結尾），`CampusRevenue.svelte` 才有復活的資料基礎；在此之前不建議重新加回這個面板。
- `mobile-admin` `ReportsScreen` 與 desktop 版共用 `report-math.ts`/`admin/format.ts`，但各自維護
  一份 Svelte 元件（視覺呈現不同）；若未來兩邊需要進一步統一顯示邏輯，需要另外評估抽共用元件的
  成本與 per-surface 結算慣例（`docs/adr/0003`）的取捨，非本輪範圍。
