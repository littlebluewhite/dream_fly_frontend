# 後端 wire 知識單一來源：`src/lib/api/wire.ts`

> Status: Accepted。源自 2026-07 前後端串接收尾的架構深化工程（`feat/backend-integration` 分支，
> `src/lib/api/wire.ts` 與 `src/lib/load-gate.ts`〔ADR 0008〕兩支深模組的收斂批次）。

六個 surface 全面接上 `dream_fly_backend` 之後（ADR 0006），一批「後端回應形狀」的知識——訂單
狀態 union 與標籤表、清單分頁信封、member/coach 成對 DTO、顯示用小工具——散落在
`public/api.ts`、`public/adapters.ts`、`domain/orders.ts`、`admin/data.ts`、`admin/api.ts`、
`member/api.ts`、`member/data.ts`、`coach/api.ts` 8 個檔案裡逐字複製。本 ADR 記錄收斂決定：
新增 `src/lib/api/wire.ts` 作為這類知識的單一來源，8 個檔案改為 import；並記錄「什麼該收、
什麼不該收」的判準，供日後新增欄位時依循。

## 背景與決定

### 收錄判準：≥2 個 surface 共用的後端 wire 知識才收；UI 目標型別一律不收

`wire.ts` 只收「後端回應形狀」與由它直接導出的顯示原子，不收任何一個 surface 自訂的 UI 目標
型別——各 surface 的 `Order`/`Ticket`/`ClassRow` 等仍留在各自的 `data.ts`/`api.ts`，per-surface
結算的精神見 ADR 0003。判準是**至少兩個 surface 逐字複製同一份宣告**；只有一個 surface 用到
的形狀，即使將來可能被第二個 surface 用到，也不預先搬進來——不做投機性抽象。

### `ApiPage<K, T>` 泛型信封與 `pageMeta`

11 份逐欄位相同、只差 key 名稱的清單分頁 interface（例如 `{ orders: Order[], total, page,
per_page }` 這種形狀，各 surface 各自手寫一次）收斂成一個 mapped type：

```ts
export type ApiPage<K extends string, T> = { [P in K]: T[] } & { total: number; page: number; per_page: number };
```

`ApiPage` 是 mapped type，**消費端一律用 `type` alias**（例如
`type ApiUserListResponse = ApiPage<'users', ApiUserAccount>`），不能用 `interface extends`——
mapped type 無法被 interface 繼承，這是 TypeScript 語言限制，不是本 ADR 的風格偏好。`pageMeta()`
把回應的 `{ total, page, per_page }` 轉成前端慣用的 `{ total, page, perPage }`，取代各處手寫的
三行展開。

### `ORDER_STATUS` / `orderStatusBadge`：含 `['neutral', 原字串]` fallback 契約

訂單狀態 → `[tone, 中文標籤]` 查表原本逐字複製多份。收斂後 `orderStatusBadge(s: string)` 是
唯一查詢入口，**查無時 fallback 成 `['neutral', s]`**——用原始字串當標籤，而不是拋錯或顯示
空字串。這是刻意的容錯契約：後端未來若新增一個前端還不認得的狀態值，畫面上會出現一個灰色徽章
顯示該生字串，而不是整頁壞掉或顯示空白。呼叫端不應該自己再包一層 try/catch 或預設值頂替這個
fallback。

### `ageRange` 收斂——推翻 `admin/api.ts` 當年「刻意複製避免動 Task-14 檔案」的裁決

`admin/api.ts` 原本自己維護一份私有 `ageRange()`，函式頭原註解明講：與 `public/adapters.ts`
的私有 `ageRange` 相同，「這裡另存一份小對照，避免為了共用 3 行邏輯去改動 Task 14 own 的
檔案」——當年是刻意的複製，理由是協調成本（不要去動另一個任務正在進行中的檔案）。那個觸發
條件現在已經不存在：Task 14 早已結束，本次整合本來就要同時改動 8 個檔案。**本 ADR 有意識地
推翻當年那個裁決**——繼續維持複製只會讓兩份 3 行邏輯留下日後分岔的風險，沒有對應的協調收益。
收斂後 `ageRange` 只在 `wire.ts` 一份，`admin/api.ts` 改為 import。

### `ApiReportCard` / `ApiCertificate`：member 與 coach 的成對 DTO

`GET /report-cards/me`（member）與 `POST /report-cards`（coach）共用同一套 wire 形狀，
`GET /certificates/me`（member）與 `POST /certificates`（coach）亦然——這兩組原本在
`member/api.ts` 與 `coach/api.ts` 分別逐欄位重抄一次（欄位完全相同，一邊讀、一邊寫）。收斂後
兩個 interface 只在 `wire.ts` 定義一次，兩個 surface 都 import。

### `ApiUser` 三處窄化投影——刻意不合併

`member/api.ts`、`coach/api.ts`、`stores/authStore.ts` 各自宣告一個 `ApiUser`，欄位不完全
相同（各自只窄化出自己需要的欄位子集）。**這不進 `wire.ts`**：三份是同一個後端 `/users/me`
回應的三種不同投影，不是同一份宣告的複製貼上。結構型別（structural typing）下，三個窄化
interface 天生沒有「同一份宣告被改壞其中一處、其他處沒跟著改」的漂移風險——每一份都只是
「後端回應至少要有這些欄位」的局部斷言。合併成一個大 interface 反而會讓每個消費端都背上其他
兩處用不到的欄位，也讓「這個 surface 到底依賴後端的哪些欄位」變得不清楚。

### 明確不收清單（防未來誤收）

- `ntd` / `toCents` / `orderItemsSummary`——留在 `public/adapters.ts`，是 ADR 0006 訂下的
  cents↔NT$ 換算邊界，屬於「換算規則」而非「wire 形狀知識」。
- `COURSE_LEVEL_LABEL`——已經在 `src/lib/domain/course-level.ts` 是單一來源，不重複開第二個
  來源。
- mobile 雙 surface 的 tuple 型 `Tone`（`[string, string]`）及其 3 值子集——這是 `mobile`/
  `mobile-admin` 各自 `data.ts` 的本地展示層概念，與頁面是否已接上真後端無關（`mobile-admin`
  仍全 mock，`mobile` 已接真後端，見 ADR 0006）；`mobile-admin` 完成接線後，若發現這塊型別
  與 `wire.ts` 既有型別重複，再一併評估是否收斂，本次整合刻意不預先處理。
- 各 surface 專屬的 UI 目標型別與 member-only 查表——per-surface 結算的精神（ADR 0003），
  `wire.ts` 只放後端形狀，不放任何一個 surface 的顯示層決定。

### 現況：8 檔已改線

`public/api.ts`、`public/adapters.ts`、`domain/orders.ts`、`admin/data.ts`、`admin/api.ts`、
`member/api.ts`、`member/data.ts`、`coach/api.ts` 均已把上述重複宣告刪除、改為 import
`$lib/api/wire`；既有對外 import 路徑一律以 facade re-export 保留，下游 getter 的簽章與回傳
形狀逐欄位不變（行為零變更）。

## 後果（刻意，非 bug）

- **`wire.ts` 落地後即凍結為唯讀契約**：本檔只放純型別＋純函式＋常數，不 import 任何 `$lib`
  模組（避免反過來依賴某個 surface、形成循環或隱性耦合）。新增內容前先確認符合「≥2 surface
  共用」判準，不要因為「未來可能用得到」就先搬進來。
- **`ORDER_STATUS` 標籤文字必須逐字不變**：查表內容是既有畫面顯示過的中文標籤，改動其中任何
  一個字，等於同時改變所有消費端（目前至少 admin 訂單表、member 訂單記錄）的顯示文案。
- **`ageRange` 的推翻只解除協調成本，不代表函式行為可以隨意再改**：三分支（雙界/單界/無界）
  的行為與既有畫面顯示逐字相同，改動一樣會同時影響 `admin`（票券年齡範圍顯示）。
- **已於終審後收斂**：`coach/api.ts` 的 `mapCoach()` 原有一處 `user.last_login.slice(0, 16)
  .replace('T', ' ')` 內聯字面重複 `isoDateTime()` 的邏輯，是 8 檔改線後唯一一處「字面合規、
  實質仍是複製」的殘留；現已改為委派 `isoDateTime()`，不再複製邏輯。

## 已知後續

- `mobile-admin` 接上真後端後（P2，見 ADR 0006「已知後續」），若發現 tuple 型 `Tone` 或其他
  wire 形狀開始與 `wire.ts` 既有型別重複，再評估收斂；本次整合刻意不預先處理。
- 若後端未來新增 `OrderStatus` 之外的其他 union+標籤表（例如付款方式、會員等級的 badge 化），
  可比照 `ORDER_STATUS`/`orderStatusBadge` 的既有 pattern（含 fallback 契約）新增，不必另創
  一套機制。
