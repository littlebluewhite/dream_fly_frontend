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

- **`skip` 只擋 `load()`，`refresh()` 一律真抓**（`skip` 選項已於 2026-07-13 退役，本條
  短路契約由 `hydrate` 選項承接——見文末增補段；本節保留為歷史紀錄）：`skip?: () => boolean` 只在 `load()` 內
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

- **(a) 平頁**：`createLoadGate({ fetch, onData, onError? })`，建構即自動首載（R19 起 gate 自己在
  元件初始化期掛 `onMount` 發起 `load()`，頁面不再手寫，見文末 R19 增補），
  模板讀 `$gate === 'loading' | 'error' | 'ready'`。多數 route 頁與全部 mobile overlay 屬此類。
- **(b) 守衛頁**（歷史型態——`skip` 已於 2026-07-13 退役，兩個守衛頁已遷移至 `hydrate`
  選項，見文末增補段）：多帶一個 `skip: () => get(xHydrated)`，用於資料已經活在共享 store 的頁面
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

> **2026-07-20（R5 C5）取代裁決**：本節「有意識保留」已被重裁取代——(a) ADR 0012 單頁 controller
> 四判準此時已滿足；(b) 使用者裁決 race render its 瘦身，「搬動既有測試覆蓋」的 churn 前提不再
> 成立；(c) 抽取 commit 以 13 個 render its 一字不動原封全綠證明搬動零 churn。付款狀態機現居
> `member/checkout-controller.ts`，詳 `docs/adr/0016` 附記。本節原文保留不改寫。

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
- store 層守衛——本 ADR「四個變體」一節明示屬 store 層、不在本次遷移範圍的 mobile-admin
  `*Hydrated` 守衛＋mutation 重新檢查機制——已於 2026-07-08 收斂為 `src/lib/hydration-gate.ts`
  的 `createHydrationGate`：`mobile-admin/stores.ts` 的 `hydrateOps`／`hydrateMessages`（連同
  `refreshOps`／`refreshMessages`）原地改採這個 factory，mutator（`markOrderPaid`／
  `markMessageRead`；`saveCoach` 已隨 Round 4 Task F5 改接真 `/coaches` 寫入＋`refreshOps()`
  整包重抓而移除）翻旗語意改經 `markMutated()`；guard 短路 +
  post-await re-check（mutation 勝出、放棄覆寫剛抓回的資料）這條競態分支首次有測試釘住。
  `member/notifications.ts` 的 `refreshNotifications()` 未採用這個 factory，但手動補了同語意的
  一行 post-await re-check（`if (get(notificationsHydrated)) return;`）。
- 呈現層 wrapper `src/lib/components/ui/LoadGate.svelte` 已於 2026-07-08 落地：把 44 個 route
  頁＋4 個 mobile overlay（共 48 站）手抄的 `{#if $gate === 'loading'} … {:else if 'error'} …
  {:else} …` 模板分支收斂成 `slot="loading"`／`slot="error"`（`let:retry`，未覆寫時 fallback 為
  `Card`+`ErrorState`）／預設 slot 三段插槽契約；`ScheduleCalendar` 的 bespoke 三態模板依規劃
  排除、原樣保留（49 個 `load-gate.ts` 呼叫端中唯一不經 `LoadGate.svelte` 呈現的一個）。元件內
  `retry()` 固定呼叫 `gate.refresh()`、絕不呼叫 `load()`——即上方「skip 只擋 `load()`，
  `refresh()` 一律真抓」契約在呈現層的落地方式（該契約今由 `hydrate` 承接，見文末增補段）。`load-gate.ts` 本身的公開介面仍依「後果」一節的
  凍結契約，未被本次呈現層收斂觸碰。Round 4 整合（2026-07-10 merge）後，Round 4 新建／重建的
  gate 頁也全數對齊此慣例——現況為 53 站（45 個 route 頁＋7 個 mobile／mobile-admin overlay，另含
  member 我的課程頁與 mobile `MyCourseDetail` 的卡片內出席紀錄區塊 gate，兩處以 `slot="error"`
  覆寫為裸 `ErrorState`，避免 Card 套 Card）；`ScheduleCalendar` 仍是唯一依規劃排除的呼叫端。
- `hydrate` 選項語意（T1/B0/K2-a，2026-07-13）：`load-gate.ts` 新增
  `LoadGateHydrateOptions<T>`——與 `onData` 型別層互斥（discriminated union）的另一個選項，
  把「共享 store 的水合協定」（語意同 `$lib/hydration-gate` 的 `createHydrationGate`）收進
  `load()`／`refresh()`／`silentRefresh()` 本身。`load()` 內是 guard 短路：`hydrate.flag`
  為 `true` 時直接 `setPhase('ready')`、不打 API——與上方「介面語意重點」第一點 `skip` 的
  短路同一個位置（`load()` 內，不影響 `refresh()`）；`fetch` 進行中若 `hydrate.flag` 被
  外部翻 `true`（mutation 發生），是 post-await 重查——resolve 後放棄套用 `into()`、不覆寫
  共享 store，但 `phase` 仍收斂 `ready`（資料已經在 store 裡，不該卡在骨架）。翻旗動作收進
  `load()`／`refresh()`／`silentRefresh()` 三者共用的 apply 路徑（`applyLoaded`／
  `applyRefreshed`）：`load()` 只在未被 mutation 搶先時才套用並翻旗；`refresh()`／
  `silentRefresh()` 無條件套用 `into()` 並翻旗、不做旗標重查（同一節「`refresh()` 一律真抓」
  的對稱契約）；`into()` 的 subscriber 若同步重入 `gate.load()` 開出新一輪 `generation`，
  翻旗前會重新核對 `generation`，不符者放棄翻旗、交由新一輪自己完成。
- `skip` 選項退役（T9/K2-d，2026-07-13）：上方「介面語意重點」第一點與「四個變體」(b) 所述
  的 `skip: () => get(xHydrated)` 守衛頁模式，正是 `hydrate` 收斂之前 `member`／`mobile`
  通知頁手焊的雛形；兩頁遷移到 `hydrate` 後（T6/T7，即 K2-b/K2-c），`skip` 選項在 production
  碼已無任何消費者，兩節描述均已被取代。全倉 `grep` 驗證零消費者後隨即退役：自
  `LoadGateBaseOptions<T>` 型別與 `load()` 的短路邏輯移除，`refresh()`／`silentRefresh()`／
  `generation`／`createPagedLoadGate` 未受影響。`LoadGate.svelte` 的 `retry()`「一律呼叫
  `refresh()`、絕不呼叫 `load()`」設計不變——guard 短路只擋 `load()` 的契約改由 `hydrate`
  承接，行為對呼叫端透明。

## 增補（2026-08-03，架構深化 R10 D 案 + A 案）

- **呼叫點 −1：member 我的課程頁的卡片內出席明細 gate 退役。** 該頁原本有兩個 gate——外層
  `getMine` 的頁面 gate（不動）與卡片內出席紀錄區塊的 `attGate`。R10 D 案把頁面內層協調收進
  `src/lib/member/mine-controller.ts`（`docs/adr/0012` 增補），`attGate` 連同其
  `createLoadGate` 呼叫整支移除，in-card 區塊改讀 controller 快照的 `attState` 三分支
  （`Skeleton`／`ErrorState`／清單，props 與 DOM 逐字保留）。過期回應保護沒有消失、只是換了住所：
  controller 自持遞增 `seq`/`token` guard，提供與本篇「`generation` 計數器丟棄過期回應」同一份
  不變式（同輪 24 個頁面 it 逐字未動、全綠）。這與本篇「排除清單」裡 coach/messages 的
  `loadThread` 是同一種先例——**頁面內層的次級載入不一定要再開一個 gate**，形狀不合時交給該頁
  自己的 controller 反而更貼；`loadThread` 那一段本身已於 R8 收進 `messages-controller.ts`。
  呈現層 wrapper `LoadGate.svelte` 的呼叫站因此 **55 → 54**（本篇「已知後續」記的 53 站是
  2026-07-10 當下的數字，其後 R5 C4 接上 VenuesScreen／TicketsScreen 成為 55）；卡片內 gate 自此
  只剩 mobile `MyCourseDetail` 一處以 `slot="error"` 覆寫為裸 `ErrorState`。`load-gate.ts` 本身
  的公開介面未被此變更觸碰。
- **「已知後續」中 `hydrate` 選項語意一條的現況指北針。** 該條寫的「`refresh()`／`silentRefresh()`
  無條件套用 `into()` 並翻旗、不做旗標重查」在程式面**仍然逐字為真**——`applyRefreshed` 確實不
  呼叫 `core.mutationWins()`。但自 R10 A 案起，`hydrate` 選項多了一個可選的 `gen?: () => number`
  （由 `session-gate` 的 `pageEntry()` 佈線）：在場時 `refresh()`／`silentRefresh()` 的**取數**改走
  `$lib/hydration-gate` 的 `fetchGenStable` 世代穩定重抓，飛行窗口內發生的本地 mutation 會讓那份
  快照作廢並原地重抓。也就是說「無條件」描述的是 apply 那一步，世代穩定發生在上游的 `run()`。
  省略 `gen` 的 plain-flag 消費端（生產上目前除 `pageEntry()` 之外全部）語意逐字不變。完整判準與
  契約見 `docs/adr/0020`。

## 增補(2026-09-27,架構深化 R14):`pageEntry()` 改由任何水合閘門供給

完整背景見 `docs/adr/0024` §2、§3。上節末段寫 `hydrate.gen`「由 `session-gate` 的 `pageEntry()` 佈線」,
並說 plain-flag 消費端「生產上目前除 `pageEntry()` 之外全部」。R14 起以下列為準:

- **`pageEntry()` 住 `HydrationGate`**(Task 2,候選 F1):plain 閘門與 session 閘門都交出同一形的進場包
  `{ fetch, refresh, hydrate: { flag, into, gen, pendingSettle } }`。session 閘門繼承它,`fetch`/`refresh`
  自帶 epoch 核對。mobile-admin 的 ops 三頁、`CoachesScreen` 與訊息頁改寫成
  `createLoadGate({ ...opsPageEntry })`/`createLoadGate({ ...messagesPageEntry })`,與通知頁同一條接法。
- **`fetch` 與閘門的 `hydrate()` 共用在飛 GET**(Task 3,候選 F2):只併入同世代出發的那支。`refresh`
  是不合併的另一支,load-gate 的 `refresh()`/`silentRefresh()` 本來就優先用它。
- 本篇的 load-gate 公開介面、`hydrate` 選項語意與 `applyLoaded`/`applyRefreshed` 的重入重查都未被觸碰。
  「plain-flag 消費端」自此指的是頁面自帶 writable、不經任何閘門的呼叫端。
- **名稱**:上文提到的 `refreshMessages` 已退役(訊息頁改經 `messagesPageEntry`,重試走
  load-gate 的 `refresh`);`refreshNotifications()` 更名為 `hydrateNotifications()`,仍是通知閘門的
  `gate.hydrate`。`hydrateOps`/`refreshOps` 保留,供 mobile-admin 首頁與寫後重抓使用。

## 增補(2026-10-09,架構深化 R19):載入閘門建構即自動首載,56 處 `onMount` 樣板退役

本篇原文不改寫(只有「四個變體」(a) 一行改成現況),以下各點以本節為準。

病灶:「變體 (a)」的 `onMount(() => { gate.load(); })` 在 56 個呼叫端逐字重複——gate 每頁建構一次、
再手寫一次首載。gate 早就自己掛了卸載(`onDestroy(destroy)`),首載是同一份生命週期知識,卻沒收進來。

- **決定**:`load-gate.ts` 新增模組私有的 `autoLoadOnMount(load)`——`try { onMount(() => { void load(); }); }
  catch {}`——兩個 factory 都緊接 `autoDestroyOnUnmount` 之後呼叫。元件初始化期(script 頂層同步)建構:
  掛載時自動發起首載;元件外建構(模組測試等)沒有生命週期可掛,`onMount` 丟錯被吞掉,**不自動 load**,
  呼叫端自行 `load()`/`destroy()`——與上文「`onDestroy` 自動掛載,元件外建構不丟錯」一條同一個模式。
  `onMount` 不在伺服端執行,SSR 不會因此發請求;上文「建構本身無副作用」仍成立(建構只登記 callback,不發請求)。
- **不加任何選項**:`LoadGateOptions`/`PagedLoadGateOptions` 不變,也沒有 `manual`/`lazy` 之類的逃生口。
  全倉唯一的條件式首載是 `MyCourseDetail` 的 `if (c) attGate.load()`,而 `courseDetail` overlay 的唯一
  開啟點 `routes/mobile/mine` 的 `openCourse` 一律帶入 course,該條件在正式環境走不到。
- **依上文「後果」一節的凍結條款,附完整呼叫端清單重新評估**。56 個檔案、各自恰好一個 gate
  (`createLoadGate` 51、`createPagedLoadGate` 5;其中 7 個接共享 store 的 `{ ...xPageEntry }`、44 個
  plain `{ fetch, onData }`):
  - 公開 4 頁:`routes/{coaches,courses,tickets,venues}`;`lib/components/ScheduleCalendar`。
  - member 8 頁:`routes/member/` 的根、`account`、`courses`、`mine`、`notifications`、`points`、`reports`、
    `schedule`。
  - coach 8 頁:`routes/coach/` 的根、`attendance`、`leave-requests`、`messages`、`schedule`、`settings`、
    `students`、`today`。
  - admin 10 頁:`routes/admin/` 的根、`coaches`、`reports`、`settings`、`venues`(平頁),
    `classes`、`coupons`、`members`、`orders`、`tickets`(分頁,`createPagedLoadGate`)。
  - mobile 5 頁 + 5 overlay:`routes/mobile/` 的根、`account`、`courses`、`mine`、`notifications`;
    `lib/mobile/overlays/` 的 `MyCourseDetail`、`OrdersScreen`、`PointsScreen`、`ReportScreen`、
    `ScheduleScreen`。
  - mobile-admin 10 頁 + 5 overlay:`routes/mobile-admin/admin/` 的根、`classes`、`members`、`more`、
    `orders`;`routes/mobile-admin/coach/` 的根、`attendance`、`csettings`、`messages`、`students`;
    `lib/mobile-admin/overlays/` 的 `AdminSettingsScreen`、`CoachesScreen`、`ReportsScreen`、
    `TicketsScreen`、`VenuesScreen`。

  逐站核對的結論:
  1. **gate 都在 script 頂層(元件初始化期)建構**,沒有條件式建構、也沒有 `await` 之後才建構的站,
     所以每一站都恰好登記一次 `onMount` 首載;沒有哪一頁刻意「建了 gate 卻不在掛載時載入」,不會被誤傷。
  2. **53 站只有 `onMount(() => { gate.load(); })` 一塊**:整塊連同只服務它的 `import { onMount }` 刪除。
  3. **`routes/member/courses`(`hydrateWaitlist()`)與 `routes/mobile-admin/admin`(`hydrateOps()`)的
     `onMount` 還有別的工作**:只刪 `gate.load();` 一行。gate 在 script 頂端先建構,它的 `onMount` 先登記、
     先執行,與別的工作的執行順序跟改前相同。
  4. **`MyCourseDetail`**:刪 `if (c) attGate.load()`(理由見上)。改前同一個 `onMount` 內先
     `refreshLeaveRequests()` 後 `attGate.load()`,改後 gate 的 `onMount` 先登記、先出首載;兩者一個寫
     出席紀錄、一個寫 `leaveRequests` store,互相獨立,對調順序無影響。
  5. **接共享 store 的 7 站(變體 (b)/(c))**:首載仍走 `load()`,所以 guard 短路(已水合 → 直接 `ready`、
     不 fetch)與 post-await 重查原樣成立。**分頁 5 站(變體 (d))**:首載等於 `load()` 無參數,即第 1 頁,
     與改前相同。
  6. 公開介面(選項、`silentRefresh` 語意、`refresh()` 一律真抓)全部未動,凍結條款管的範圍沒有被碰;
     唯一的行為差異是「首載由 gate 自己登記」,不需要任何呼叫端另外配合。
- **後果(刻意,非 bug)**:在元件初始化期(script 頂層同步)建構的 gate 一定會在掛載時載入,沒有
  opt-out。較晚才建構的 gate(事件處理器、`await` 之後、reactive 區塊)已經不在初始化期,`onMount`/
  `onDestroy` 一樣丟錯被吞掉:既不會自動首載、也不會隨卸載自動 `destroy()`,呼叫端須自行呼叫。56 站
  全是頂層同步建構,沒有這種站。日後若出現「建構了卻不想立刻載入」的呼叫端(惰性或條件式首載),再補
  選項,屆時依本節的方式重新評估清單。
- **因本節而過時的原文**:「介面語意重點」`onDestroy` 一條(現在 factory 還多登記一個 `onMount`)、
  「四個變體」(c) 的「頁面層只負責呼叫 `gate.load()`」(現在連呼叫都不用)——兩處以本節為準。
  同一條 `onDestroy` 的「在元件內建構時自動掛上」也要讀成「在元件初始化期(script 頂層同步)建構時」:
  元件內但較晚才建構的 gate 不會自動 `destroy()`(見上一點「後果」)。
- **測試**:`load-gate.harness.svelte` 不再手動 `load()`,並新增可選的 `paged` prop;`load-gate.test.ts`
  新增 plain 與 paged 兩種 gate 掛載後 fetch 恰好 1 次並進入 `ready`,以及元件外建構不 fetch 的斷言。
