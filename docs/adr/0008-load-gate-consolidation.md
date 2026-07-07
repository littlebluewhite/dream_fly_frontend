# 載入閘門：三態載入收斂為 `load-gate` 單一機制來源

> Status: Accepted。源自 2026-07 前後端串接收尾的架構深化工程（`feat/backend-integration` 分支，
> 接續 ADR 0007 同一波 `src/lib/load-gate.ts` 深模組收斂批次）。

49 個檔案（44 個 route 頁 + `ScheduleCalendar` + 4 個 mobile overlay）各自手抄同一套
`let phase; load(); onMount(load); retry` 三態載入樣板，四軸各自變異（卸載守衛有無、
load/refresh 是否拆分、`*Hydrated` 守衛、retry 的接法），導致同一類 bug（例如「守衛短路後
retry 不重抓」）要逐頁修、逐頁測。本 ADR 記錄收斂決定：新增 `src/lib/load-gate.ts`，把這套
機制收斂為 `createLoadGate`/`createPagedLoadGate` 兩個 factory，49 個呼叫端全部遷移到它之上。

## 背景與決定

### 收斂範圍：49 個手抄三態閘門 → 單一機制來源

44 個 route 頁 + `ScheduleCalendar` 元件 + 4 個 mobile overlay（`OrdersScreen`/`PointsScreen`/
`ReportScreen`/`ScheduleScreen`），依 surface 分批遷移：public 4 頁 + `ScheduleCalendar`、
member 8 頁、coach 8 頁、mobile 5 頁 + 4 overlay、mobile-admin 10 頁、admin 9 頁（4 平頁 +
5 分頁頁）。遷移後手寫的 `phase`/`alive`/獨立 `refresh()` 一律移除，改由 `createLoadGate`/
`createPagedLoadGate` 提供。

### 介面語意重點

- **`skip` 只擋 `load()`，`refresh()` 一律真抓**：`skip?: () => boolean` 只在 `load()` 內
  檢查——回傳 `true` 時直接進 `ready`、不打 API（守衛頁變體，例如 notifications 頁的
  `*Hydrated` 守衛，避免重訪覆寫已讀狀態）。`refresh()` 完全不看 `skip`，一律呼叫真正的
  fetch——這是釘死既有 bug 的關鍵契約：舊手抄版常見的錯誤是「守衛短路後，使用者按 retry
  仍然被同一個守衛擋住、實際沒有重新發出請求」，`refresh()` 與 `load()` 分開語意即是為了讓
  `ErrorState` 的 retry 永遠有效。
- **`generation` 計數器丟棄過期回應**：每次呼叫 `load`/`refresh`（以及通過 ready 守衛的
  `silentRefresh`）前遞增一個 closure 內的計數器並捕捉序號；回應到達時序號對不上（或已
  `destroy`）一律丟棄，不寫入 phase、不呼叫 `onData`/`onError`。三個方法共用同一個計數器，因此彼此都能讓對方的舊回應
  過期——例如 `ScheduleCalendar` 快速切換月份時，上一個月份的回應即使比較晚回來也不會蓋掉
  使用者已經看到的新月份。
- **`onDestroy` 自動掛載，元件外建構不丟錯**：兩個 factory 都在建構時呼叫
  `onDestroy(destroy)`，包一層 `try/catch`——在元件內建構時自動掛上卸載時的 `destroy()`；
  在元件外建構（例如模組測試）沒有生命週期可掛，靜默略過，呼叫端需自行呼叫 `destroy()`。
  `destroy()` 只是把內部旗標設 true，配合 `generation` 檢查，讓「卸載後 in-flight 回應不得
  寫入任何狀態」自然成立，呼叫端不需要再自己維護一個 `alive` 旗標。
- **`silentRefresh` 不動 `phase`，phase 非 `ready` 時 no-op**：分頁版另有 `silentRefresh()`——
  突變（新增/編輯/建立）後重新整包拉取最新分頁 meta，成功或失敗都不改變 `phase` 欄位（連
  `onError` 都不呼叫，失敗整個吞掉）。守衛在遞增 `generation` 之前檢查目前 `phase`，非
  `ready` 時直接 no-op 返回，不遞增 `generation`、不呼叫 fetch——`loading` 代表有 in-flight
  的 `load()`（遞增 generation 會把它的回應誤判為過期、phase 卡死）；`error` 雖已 settle，
  但列表未渲染、無「靜默重同步」的意義，重試一律走 `refresh()`（2026-07-07 對抗審後強化：
  防止與 in-flight load 的 generation 交錯把分頁頁 strand 在 loading）。

### 四個變體

- **(a) 平頁**：`createLoadGate({ fetch, onData, onError? })`，`onMount(() => gate.load())`，
  模板讀 `$gate === 'loading' | 'error' | 'ready'`。多數 route 頁與全部 mobile overlay 屬此類。
- **(b) 守衛頁**：多帶一個 `skip: () => get(xHydrated)`，用於資料已經活在共享 store 的頁面
  （member/mobile 的 notifications）——首次進頁才真的水合，重訪時 `skip` 短路，但 `refresh()`
  依然一律真抓。
- **(c) mobile-admin store-owned 變體**：`fetch`/`refresh` 直接傳共享 store 既有的
  `hydrateOps`/`refreshOps`、`hydrateMessages`/`refreshMessages`，寫入責任仍在 `stores.ts`
  （`*Hydrated` 守衛 + mutation 重新檢查守衛的機制原地不動，屬 store 層、不在本次遷移範圍）；
  頁面層只負責呼叫 `gate.load()`/讀 `$gate` 三態，原本頁面自己的 `alive` 卸載旗標整個刪除，
  改由 `createLoadGate` 內建的 `generation`/`destroyed` 機制取代。
- **(d) 分頁**：`createPagedLoadGate({ fetch: (page) => ..., onData, onError? })`，訂閱值是
  `{ phase, page, total, perPage }`，多一個 `changePage(p)`（邊界檢查：`p < 1` 或
  `p > Math.ceil(total / perPage)` 時 no-op）與 `silentRefresh()`。5 個 admin 分頁頁
  （members/classes/orders/tickets/coupons）屬此類。

### legacy store factory 約束

`load-gate.ts` 沿用既有的 legacy store factory 風格（前例：`stores/toasts.ts` 的
`createToasts`，見 ADR 0005）：closure、無 `this`、回傳物件的 `subscribe` 直接轉發
`svelte/store` 的 `writable`，頁面以 `$gate` 讀取狀態。不使用 runes，不在模組層讀
`localStorage`，建構本身無副作用（SSR 安全，模組可以被伺服端 import）。

### 排除清單

- **coach/messages 的 `loadThread` 三值哨兵與 `composePhase`**：訊息頁只把外層「對話清單」
  遷到 `createLoadGate`；選定對話後載入該對話串的 `loadThread(conversationId)`，其
  `thread: null | Message[]` 三值哨兵（`null` 代表載入中、`[]` 代表已載入但無訊息）與撰寫
  新對話 dialog 自己的 `composePhase`，形狀與 load-gate 的單一 fetch 不合（`loadThread` 需要
  「目前選定對話是否還是發出請求時的那個對話」的比對，不是單純的 loading/error/ready），
  依規格排除、原樣保留。
- **`PaginationBar` 元件本身不動**：五個分頁頁只是把 `page`/`total`/`perPage` 的來源從本地
  `let` 改成 `$gate.page`/`$gate.total`/`$gate.perPage`，`onPageChange` 改接 `gate.changePage`；
  `PaginationBar.svelte` 元件本身的 prop 介面與渲染邏輯未受影響。

### 有意識保留：CheckoutDialog 的防重複扣款不抽成純模組

`member/components/CheckoutDialog.svelte` 有自己的 `idempotencyKey`（每次結帳流程產生一次、
重試沿用同一把）+ `paying`/`!paying` 守衛，防止使用者在付款請求進行中把 dialog 關了又重開、
換發新 key 而重複扣款/建立報名訂閱。這套機制已有完整的競態回歸測試覆蓋，與 load-gate 的
loading/error/ready 三態是不同層次的關切（load-gate 管「資料讀取」的三態，這裡管「一次性
副作用」的防重放）——抽成獨立純模組的重構收益低於搬動既有測試覆蓋的 churn 成本，本次刻意
不做，維持原狀。

### 突變後重同步的三分法

分頁頁的「新增/編輯/建立」動作完成後，各自依既有形狀選擇三種路徑之一，遷移逐字保留：

- **members、coupons → `gate.silentRefresh()`**：取代原本各自手寫的具名 `refresh()`
  （members）或 inline try/catch 四欄位手動賦值（coupons），改整包重新拉取當前頁、不動
  `phase`。
- **classes、orders、tickets → 本地摺疊，原樣保留、不接 gate**：`classes` 的 `save()`
  （`mapCourse` 映射後併回列表）、`orders` 的 `changeStatus()`（`applyStatusChange`）、
  `tickets` 的 `save()`（直接改陣列）三個函式本體與遷移前逐位元組相同，只是所在檔案的
  import/gate 宣告變了——這三頁的突變不需要整包重新拉取，本地摺疊已經是正確且更省一次
  API 呼叫的做法。

## Parity contract

遷移以「既有頁面測試一字不改、全部維持綠燈」驗收；**唯二刻意的行為變更**：coupons/tickets
兩頁新增分頁範圍提示（比照 members 頁既有的 `{#if $gate.total > $gate.perPage}` 樣式補齊，
各自 `page.test.ts` 新增 2 個斷言），以及 `ScheduleCalendar` 月導航透過 `loadMonth()` 取得
`generation` 計數器的過期回應丟棄能力（舊版手抄實作沒有這層保護）。（另有 Topbar/Sidebar 改讀
真實會員身分、`ClassEditDialog`/`OrdersTable` 的 `coaches`/`rows` prop 改為必填等行為變更，
屬同一波但不同批次的 P2 清理，記錄在 ADR 0006，不屬本次 load-gate 遷移範圍。）

## 後果（刻意，非 bug）

- **`load-gate.ts` 落地後即凍結為唯讀契約**：49 個呼叫端遷移不修改 `load-gate.ts` 本身的
  公開介面；日後若要調整介面（新增選項、改變 `silentRefresh` 語意等），需要重新評估所有既有
  呼叫端。
- **`silentRefresh` 與 in-flight `load()` 交錯已由守衛擋下**：舊版僅假設呼叫時機在 settled
  態、未強制；2026-07-07 對抗審發現真的交錯呼叫時 `phase` 會停留在呼叫前的值、卡在 loading
  且無法自救，已在 `silentRefresh()` 開頭補上「`phase` 非 `ready` 時 no-op」的模組層強制守衛
  （見上「介面語意重點」），此項不再是待觀察的後果。
- **mobile-admin store-owned 變體的卸載保護分屬兩層**：頁面層不再有自己的 `alive` 旗標（改由
  `createLoadGate` 的 `generation`/`destroyed` 保護頁面本地狀態），但共享 store
  （`stores.ts` 的 `hydrateOps`/`hydrateMessages` 等）寫入時機的保護仍在 store 層自己的
  `*Hydrated` 守衛 + mutation 重新檢查機制——兩層保護對象不同（頁面本地 `phase` vs 共享
  store），都要維持才算完整，任何一層被誤刪都可能重新引入「unmount 後回應覆寫」類的 bug。

## 已知後續

- `coach/messages` 的 `loadThread`/`composePhase` 若未來需要類似 load-gate 的過期回應丟棄
  保護，需要另外設計（形狀不合，不能直接套用現有兩個 factory），非本次範圍。
- 若後續發現分頁頁的「本地摺疊 vs `silentRefresh`」三分法有更多分頁頁需要對照分類，優先比照
  本 ADR 已記錄的判斷（是否需要整包重新拉取 vs 用單筆回應摺疊回列表更省一次 API 呼叫）。
