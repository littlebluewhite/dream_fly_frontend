# error-mapper 單源：apiErrorMessage / apiErrorText + 明文不收清單

> Status: Accepted。源自 2026-07 架構深化工程（Round 1 commit 4/4 預鋪 + Round 2 乙/丙批次接線，
> 2026-07-10 架構審查候選 4）。

Round 4 之後，每個會打真後端的頁面都長出一支 inline 的 `xErrorMessage(e: unknown): string`，
把 `ApiError` 映成 toast 文案、其餘一律收 `'連線發生問題，請稍後再試。'`。落地前全量普查
恰 22 支，形狀只有兩種、無一例外：

- **透傳式 ×10**（byte-identical，兩種等價寫法）：`e instanceof ApiError` → 回 `e.message`，
  否則連線 fallback。**沒有任何一支對 `e.message` 做 truthy 檢查**——空字串照樣透傳。
- **查表式 ×12**：`e instanceof ApiError` 且特定 `e.status` 有對應文案 → 回該文案，否則連線
  fallback。**不透傳 `e.message`**——隱藏後端原文是刻意語意（後端錯誤字串不是給會員/館方看的）。

## 決定

### 1. plumbing 單源、文案留呼叫端

`src/lib/api/error-text.ts` 收兩支純函式：

- `apiErrorMessage(e)` — 透傳式。**依現況普查刻意不加 truthy 檢查**：抽出函式的行為必須與被
  替換的 10 支逐字等價，否則接線那一刻就是 10 個呼叫點的靜默行為飄移。`ApiError.message`
  型別上是 `string`（`client.ts`），空字串僅在後端回 `{"error": ""}` 時出現——既有風險、
  非本次引入。
- `apiErrorText(e, byStatus)` — 查表式。status 命中 `byStatus` 才回表內文案，否則連線
  fallback，**任何路徑都不讀 `e.message`**。

每個呼叫端保留自己 1–4 行的實體文案表（per-entity 知識留在頁，如
`apiErrorText(e, { 409: '該時段已有課程', 422: '…' })`）。**status 分歧逐字保留**：桌面 admin
orders 判 `400`、mobile-admin OrderSheet 判 `409`——同名不同狀態碼是兩端後端路徑的現況，
收斂 plumbing 不裁決這種分歧。

接線範圍：mobile-admin 8 支（乙批次）+ admin 9 支（8 頁，coaches 頁 2 支）+ coach 5 支
（丙批次）= 22 支全數。`coach/messages/+page.svelte` 的區域函式恰好也叫 `apiErrorMessage`，
刪定義換 import 即無痕替換。

### 2. coupons 頁 body-builder 抽出（`admin/components/coupon-request.ts`）

`buildCreateCouponBody`/`buildUpdateCouponBody` 自 coupons 頁原文搬出（先例：
`course-request.ts`），測試釘住四個易碎細節：`code.trim()`、`toCents`、`expires_at` 的
`T23:59:59Z` 後綴、`'—'` sentinel 在 create（省略欄位）與 update（明送 `null` 清空）的
**不對稱**。

## 明文不收清單（下次架構審查不要再提）

- **member 域 4 支既有 mapper 維持自治**：`checkout.ts` `orderErrorMessage` 與 `waitlist.ts`
  `joinWaitlistErrorMessage` 是**訊息子字串判定**（如 `message.includes('already on waitlist')`），
  形狀根本不同；`leave.ts`/`points.ts` 兩支雖是透傳式，但早已抽出成模組並各自有測試——再收
  進 error-text 是搬家不是收斂。
  > **增補（2026-07-22，架構深化 R7 順風車 D-2）**：上句「維持自治」的排除語意是**不搬家**——
  > 不把 mapper 移出模組、不改呼叫端 import；它不禁止 mapper **內部**委派。R7 起
  > `leaveRequestErrorMessage`/`redeemRewardErrorMessage` 的實作改為 `return apiErrorMessage(err);`
  > （兩支的透傳邏輯與其逐字相同；匯出名、模組位置、各自測試、消費端全數不變）——消除的是
  > 第 11/12 份手刻 `instanceof ApiError` 骨架，與本 ADR「後果」節「不要再手刻」一致。對呼叫端
  > 而言兩支仍是自治的具名 mapper（丙形 wrapper）；若日後任一支要長出查表/子字串邏輯，改回
  > 自有實作即可，不受 error-text 牽制。`orderErrorMessage`/`joinWaitlistErrorMessage`（子字串
  > 判定，形狀不同）維持原判不動。
- **coach 首頁（儀表板）的 2 支不收**：其 `catch` 分支夾帶 `clockedIn = true/false` 的
  **狀態翻旗**，不是純 error→文案映射；硬套 `apiErrorMessage` 得把翻旗拆出來重排控制流，
  收益負。
- **TrialScreen / ContactForm 一類 member/mobile 域透傳式不收**：與 member 域自治同理，
  且各自綁著表單重置等頁面副作用。
- **venues / tickets 頁的 5 行 body-builder 留 inline**：太薄，抽出後模組不比呼叫點深
  （deletion test 不過——刪了模組，複雜度原地重現且無聚合收益）。

## 否決：list-page controller factory（記錄在案）

審查時曾有一個更大的候選：把「列表頁的 load-gate 佈線 + filter + mutation + error-toast」
收成一支 controller factory。**否決**，理由供未來審查止步：

1. **寬介面、淺框架**：admin 8 個列表頁的差異（分頁 vs 全量、dialog vs sheet、樂觀 vs
   refetch、單列 vs 批次操作）逼 factory 長出一堆選項參數——介面複雜度逼近實作複雜度，
   是典型的 shallow module。
2. **ADR 0008 的突變後三分法抗拒一體化**：mutation 後「refetch / markMutated / 直接寫店」
   三條路是 per-page 的裁決結果（各頁已在 ADR 0008 記錄理由），factory 要嘛硬選一條（改變
   行為），要嘛三條都留參數（回到第 1 點）。
3. 本 ADR 的兩支小函式 + per-page 文案表已拿走 22 支重複中真正 byte-identical 的部分；
   剩下的「重複」是每頁的實體知識，收走它們不是收斂是搬家。

## 後果

- 新增第 23 支錯誤 mapper 時：先判型（透傳/查表），直接用 `error-text.ts` 對應函式 +
  頁內文案表；不要再手刻 `instanceof ApiError` 分支。
- **接線形狀兩種皆合規，不是待統一的不一致**：乙批次（mobile-admin）查表式呼叫端用元件層
  `const XXX_ERROR_TEXT: Record<number, string>` 常數表直接餵給 `apiErrorText(e, XXX_ERROR_TEXT)`
  （如 `STATUS_ERROR_TEXT`/`SETTINGS_ERROR_TEXT`/`COURSE_ERROR_TEXT`）；丙批次（admin/coach）
  保留具名包裝函式（如 `statusErrorMessage`/`coachErrorMessage`）內部呼叫
  `apiErrorText(e, {...})`，呼叫端改叫該函式。第 23 支兩形皆可任選——greppability 粒度不同但
  皆可達：搜尋 `apiErrorText(`/`apiErrorMessage(` 命中所有接線點（乙形即呼叫端本身；丙形命中
  wrapper 定義處，其呼叫端再以 wrapper 名反查一跳）。
- `apiErrorMessage` 的空字串透傳是**已知且刻意**的現況複刻；若日後要加 truthy 防護，
  必須一次評估全部呼叫點（屆時是行為變更，不是重構）。
