# 單頁窄域 controller/編排器與型別註冊表

> Status: Accepted。源自 2026-07 架構深化工程 Round 3（2026-07-11 架構審查第二輪候選
> K1～K8 八張卡 + 收尾清理五條，2026-07-13～14 落地）。

Round 3 延續 Round 1/2 的收斂路線，落地兩類新慣例，外加一次型別系統接管既有執行期契約的案例：
(a) **單頁窄域 controller/編排器**——把單一頁面的無測編排層抽成可獨立測試的模組，但明確與
`docs/adr/0011` 已否決的跨頁 factory 劃清界線；(b) **型別註冊表接管執行期守衛**——icon 與
overlay id 兩處原本靠 `foundation-contracts.test.ts` 執行期原始碼掃描把關的契約，改由型別系統
在編譯期強制，掃描隨之退役。本 ADR 記錄四項決定：K1 的單頁 controller 判準與一次 guard 疊加
裁決、K4 一個否決案例（供未來止步）、K6 的型別接管與過程中一次型別斷言教訓、以及 K7 一項刻意
保守、遞延一步的收斂。

## 背景與決定

### 1. K1：單頁 controller 何時成立——判準四條，與 c3 的 guard 疊加裁決

`docs/adr/0011`「否決：list-page controller factory」記錄了一次跨頁 factory 的否決——把 admin
8 個列表頁的「load-gate 佈線 + filter + mutation + error-toast」收成一支 controller factory，
因為呼叫端異質（分頁 vs 全量、dialog vs sheet、樂觀 vs refetch、單列 vs 批次）逼出一堆行為選項
參數，介面複雜度逼近實作複雜度，是典型的 shallow module。K1（`src/lib/coach/
attendance-controller.ts` 的 `createAttendanceController`）、K3（`src/lib/coach/
conversations-filter.ts`）、K4（`src/lib/admin/components/coach-save.ts` 的
`saveNewCoach`/`saveCoachEdit`）三個新模組看似同一類「把頁面編排抽出去」，但落地時逐一核對，
四條判準同時成立才算數，缺一即退回頁面內聯：

1. **呼叫端恆為 1 頁**：三個模組分別只被 `coach/attendance/+page.svelte`、
   `coach/messages/+page.svelte`、`admin/coaches/+page.svelte` 各自唯一一頁 import——不是
   「目前只有一個呼叫端，未來可能加第二個」，是這張卡的規格本身就沒有第二個呼叫端。跨頁 factory
   的否決理由（介面要同時服務異質呼叫端）從一開始就不成立。
2. **deps 只注入效應、零行為選項**：`AttendanceControllerDeps` 只有 `saveAttendance`（I/O
   效應）與 `now`（壁鐘讀取，SSR 安全的注入慣例）；`SaveNewCoachDeps`/`SaveCoachEditDeps` 只有
   `createMember`/`createCoach`/`updateMember`/`updateCoach` 四支 API 呼叫。沒有一個模組帶
   `mode`/`variant` 這類切換內部控制流的行為旗標——跨頁 factory 之所以否決，正是異質呼叫端逼出
   這類選項參數；三個新模組的 deps 型別本身就是「這張卡不需要選項」的證據。
3. **介面詞彙是本頁領域意圖**：`AttendanceController` 的方法名（`setMark`/`applyNote`/
   `markAllPresent`/`undo`/`selectClass`/`save`）是點名這個領域的動作，`SaveOutcome` 的
   `kind`（`saved`/`stale`/`failed`）是這頁 save 生命週期的結果；`SaveNewCoachOutcome`/
   `SaveCoachEditOutcome` 的 `kind`（`created`/`userCreateFailed`/`coachBindFailed`/`saved`/
   `nameUpdateFailed`/`coachUpdateFailed`）是「建帳兩步序列」這個具體流程的產物，不是
   `success`/`error` 這種可以套用到任何頁面的通用詞彙。介面詞彙一旦通用化，就是模組正在往
   「服務多個呼叫端」的方向滑動——判準②③互為表裡。
4. **gate/toast/error-mapper 留頁面，不碰 `docs/adr/0008` 三分法**：三個模組零 import
   `$lib/load-gate`、`toasts`、`$lib/api/error-text`。`attendance-controller.ts` 的
   `SaveOutcome` 攜帶 toast 文案所需素材但不注入 toast 回呼，文案逐字留頁面；
   `coach-save.ts` 檔頭明文「兩支 mapper（`apiErrorMessage`/`coachErrorMessage`）留頁面
   （`docs/adr/0011`）——本模組的 error 欄位一律是原始拋出物，不做文案轉換」。三個模組因此完全
   不觸碰 `docs/adr/0008` 記錄的「突變後重同步三分法」（refetch / markMutated / 直接寫店）——
   它們是嵌在 load-gate 佈線**之下**的一層，不是取代或包裝它。

四條判準同時成立，才是「這張卡值得抽成獨立模組」而非「應該留頁面內聯」的訊號；只滿足其中幾條
（例如呼叫端只有一個，但 deps 卻要塞一個 `mode` 參數）應視為警訊，退回內聯或重新設計介面。

**c3 的 guard 疊加裁決**：K1 的第三顆 commit（c3，`src/lib/coach/attendance-controller.ts` 的
`save()`）修一個 latent ABA 洞——現行 state guard（`state !== 'saving'` 才套用回應）單獨存在時，
儲存中若先 `setMark`/`applyNote`/`markAllPresent` 把 `state` 打回 `dirty`，`canSwitchClass`
隨即放行切班，再啟第二次 `save()` 後，第一次的舊回應會見 `state === 'saving'`（第二次 save 已把
它打回 saving）穿透 guard，以當下的 `curClassId` 把舊班的 roster 寫進新班；`catch` 分支完全沒有
guard，舊請求失敗會把新班打成 `failed`。這個洞在本輪計畫的唯讀 codex 審視中被揪出，寫進了 K1 的
任務規格（c1/c2 忠實複刻現行語意、含這個已知缺陷；c3 才修），而非在 c1/c2 執行過程中才發現。

修法是遞增序號 `token`（`attendance-controller.ts` 的 `seq`/`token`，見該檔 `save()`
本體）：每次 `save()` 起始 `const token = ++seq`，`resolve` 與 `catch` 兩條路徑皆重驗
`token === seq`，不符即丟棄該回應（回傳 `{kind: 'stale'}`）。**這一層疊加在既有 state guard
之上、不取代它**——`attendance-controller.ts` 檔頭與 `save()` 內的兩處註解都明文這個裁決。
理由：state guard 管的是「in-flight 期間頁面狀態是否還是儲存中」，token guard 管的是「這個回應
是否來自最新一次 `save()` 呼叫」，兩者是正交的兩個問題，state guard 單獨存在時無法回答第二個
問題（`state === 'saving'` 在 ABA 序列裡對兩次 save 都成立）。移除任一層都會讓另一層單獨存在時
的已知缺陷復發——這是往後任何人想「簡化」這段 guard 邏輯前，需要先理解的前提。

### 2. K4 否決紀錄：純述詞 planner（案 A），改採兩階段編排器（案 B）

`coach-save.ts` 落地前，曾有一個更薄的候選設計（案 A）：把「新增教練時是否要先建帳」這個判斷
單獨抽成一支純述詞 planner——`needCreateUser = !pendingUserId`，一行布林反相，甚至夠不上
「函式」的門檻。**否決**，理由記錄供未來止步：

1. **deletion test 不過**：案 A 抽出的不是行為，是一個既有 `if` 條件的鏡像。把這一行從呼叫端
   搬進獨立模組後，呼叫端仍要自己組完整的兩步 API 序列（`createMember` → `createCoach`）與
   outcome 翻譯——刪掉這支 planner，複雜度原地在呼叫端重現，沒有任何東西被真正收斂，是搬家
   不是收斂。
2. **比 `docs/adr/0011` 已否決的更薄**：`docs/adr/0011`「明文不收清單」記錄 venues/tickets
   頁的 5 行 body-builder 留 inline，理由是「太薄，抽出後模組不比呼叫點深（deletion test
   不過——刪了模組，複雜度原地重現且無聚合收益）」。案 A 的一行布林反相比那 5 行 body-builder
   更薄——連「模組不比呼叫點深」這條既有否決線都夠不上，是比 ADR 0011 案例更明確的否決。

案 B（`coach-save.ts` 實際落地的兩階段 async 編排器，見 §1）把整段序列——API 呼叫順序、
`pendingUserId` 哨兵語意（有值即跳過 `createMember`、直接重打 `createCoach`）、outcome
判別聯集——一起收進模組，呼叫端只剩「呼叫 `saveNewCoach`/`saveCoachEdit` → 依
`outcome.kind` 翻譯 toast、視需要存回哨兵」。這才是把複雜度真正搬離呼叫端，而非鏡像呼叫端
既有的一行條件判斷。

### 3. K6：型別註冊表接管執行期掃描，與整陣列 `as` 斷言的教訓

K6（K6-1～K6-4）把兩個原本只靠 `src/lib/mobile/foundation-contracts.test.ts` 執行期原始碼
掃描把關的契約，改由 TypeScript 型別系統在編譯期強制：

- **`IconName`**：`src/lib/icon-registry.ts` 是全倉 icon 名稱的單一權威來源，刻意放在
  lib-root 而非 `lib/components/` 下——`lib/components/`（含 `Icon.svelte`）對 lib-root 的
  值 import 是既有向下方向；`lib/domain`/各 facade 的 `data.ts` 之後只需要對本檔做
  `IconName` 的 type-only import，編譯後零 runtime 邊，不會開一條 domain → components 的
  反向依賴邊。`Icon.svelte` 的 `name` prop、資料層各處的 `icon` 欄位現在全數收窄為
  `IconName = keyof typeof ICONS`——未註冊的名稱在 `npm run check` 就是編譯錯誤，不必等到
  執行期原始碼掃描或 `<Icon>` 實際渲染才發現。
- **overlay push/sheet id 雙泛型**：`src/lib/components/mobile/overlay.ts` 的
  `createOverlay<PushId, SheetId>()` 收斂為雙泛型——push（畫面堆疊）與 sheet（單一浮層）是
  不相交的命名空間，共用一個型別參數會讓兩邊互相汙染（例如 `'cart'` 只合法屬於 sheet，單泛型
  下 `push('cart')` 會被誤放行）。泛型貫通整條型別鏈（`OverlayEntry<Id>`、
  `OverlayState<PushId, SheetId>`），兩個型別參數皆預設 `string` 保舊用法。`mobile`/
  `mobile-admin` 各自在 overlay singleton 旁宣告 `MobilePushId`/`MobileSheetId`（及
  `MobileAdminPushId`/`MobileAdminSheetId`）聯集，成員對齊各自 `OverlayHost.svelte` 的
  `PUSH`/`SHEETS` 註冊表鍵；兩個 `OverlayHost.svelte` 的註冊表改宣告為
  `Record<union, Comp>`，漏鍵/多餘鍵在編譯期雙向擋下。
- **`foundation-contracts.test.ts` 退役兩個掃描**：上述兩個型別收窄分別讓該檔的
  icon-registry completeness（K6-3）與 overlay-map completeness（K6-4）兩個執行期原始碼
  掃描 describe 退役——兩者都是原掃描的嚴格超集（`npm run check` 覆蓋全倉，比原本只抓特定
  regex 的掃描更廣），且 overlay 一項多驗到一條原掃描從未覆蓋的方向：原掃描只查「規劃中的 id
  有沒有出現在 `OverlayHost` 的表裡」，沒有反過來查「呼叫端 `push()`/`sheet()` 傳入的 id
  是否真的在合法集合內」，型別化後這個方向也一併鎖住。該測試檔現在只剩 route inventory 與
  css safety 兩個契約。

**本輪教訓（B3 codex P2 修復，commit `be74901`）**：K6-3/K6-4 過程中一度為多筆字面陣列/物件
（例如 icon + 文案的 tuple 清單）加上整段 `as [IconName, string][]` 這類斷言以求可編譯。
codex 以 TypeScript compiler API 實證：整陣列/物件的 `as X[]` 斷言**不逐一驗證個別字面**——
只要求陣列字面的推導型別與目標型別「足夠重疊」，混在合法 sibling 中的一個非法字面會被斷言
吞掉，之後帶著這個已斷言的型別抵達 `<Icon name>`/`overlay.push()` 等消費點，等於在
`foundation-contracts.test.ts` 檔頭「`check` 是原掃描的嚴格超集」這個宣稱上開一個洞（洞
存在但當時尚無非法字面掉進去）。修復：本輪 14 處 `as X[]`/`as X` 全數改 `satisfies X[]`（例如
`[...] satisfies [IconName, string][]`），讓每個字面被 `check` 逐一驗證；T14 收尾與終審 Part A
又各掃出 1 處同型整陣列斷言（`SettingsScreen` 的 personal 陣列、`NOTIFS_SEED`——commits
`e7ee259`/`47ca9eb`），依同慣例退役，合計 16 處。**自本輪起，宣告
字面陣列/物件、同時掛型別標註只用三種形式——`satisfies`、顯式型別注記（如
`const x: T[] = [...]`）、`as const`——整段 `as T[]` 斷言不在其中**；日後遇到需要壓字面
型別的場景，改用前三形之一，不再用整段 `as` 斷言。

### 4. K7：水合佈線具名化（保守版），「頁面顯式水合」版遞延

`src/lib/member/api.ts` 的 `getDashboard`/`getAccount` 兩支 getter 各自「順手」把共享 store
（points/notifications/subscriptions）水合成真資料——這個副作用藏在 getter 內部，呼叫端
（頁面）看不出這一層；兩段幾乎逐字重複的 `Promise.allSettled` 佈線。K7 把它們收成檔內
**非匯出**具名函式 `hydrateSessionStores(caller, tasks)`：`tasks` 是
`[中文資源名, hydrate 函式]` tuple 陣列，`Promise.allSettled` 平行執行，單項失敗只
`console.error` 記錄（前綴 `${caller}: ${label} hydrate 失敗`）、不 `throw`——best-effort
語意。`getPoints()` 刻意不動：那裡的 rewards 目錄與 points store 是同一次「進頁必要資料」的
並行副產品，失敗即代表頁面本身也拿不到資料，理應 fail-hard，與 `hydrateSessionStores` 的
「頁面主資料以外的順手動作」語意不同，兩者刻意不合流。

一個更徹底的替代設計——**「頁面顯式呼叫水合」版**（getter 不再順手水合，改由呼叫端頁面自己
決定要不要、以及何時觸發 store 水合）——本輪**刻意不做**，另開後續任務：`getDashboard`/
`getAccount` 現有的呼叫端已經預期「呼叫這支 getter 就會連帶水合共享 store」這個副作用
（Topbar/Sidebar 的未讀角標、`CheckoutDialog` 的 `$points` 皆直接讀 store、不是讀 getter
回傳值）；把水合搬到呼叫端顯式觸發，等同同時改變兩個頁面的初始化序列與呼叫端契約，風險與
範圍超出「幫兩段重複的三行 allSettled 佈線取名字」這張卡的邊界。K7 本輪僅做保守具名化，
不變更任一呼叫端的行為或時序。

## 增補（2026-07-22，架構深化 R7 C8）：login-submit 的跨 surface 編排裁決

`src/lib/login-submit.ts`（`submitLogin`，member/mobile/mobile-admin/staff 四份 login 頁共用）
形式上撞本 ADR 判準①（呼叫端恆為 1 頁）與②（零行為選項——它帶 `fields?`/`onNoAccess?` 兩個
選配），亦不落入 `docs/adr/0014` §2 的「雙生收斂核可類」（該類要求編排逐字重複、零行為旗標；
staff 系兩頁多一道空欄守衛，非逐字）。明文裁決如下，不視為 `docs/adr/0011` 已否決 factory
的重演：

1. **家族歸屬不同**：本 ADR 判準管的是「單頁窄域 controller」——嵌在單一頁面 load-gate 佈線
   之下的領域編排；login-submit 屬 lib-root 跨 surface 純編排家族（`checkout-gate`/`load-gate`/
   `hydration-gate` 同列）。login 是四個 surface 共有的同一領域動作，不是某一頁的領域。
2. **與被否決 factory 的距離**：`docs/adr/0011` 否決 list-page factory 的理由是異質呼叫端
   （分頁/全量、dialog/sheet、樂觀/refetch、單列/批次）逼出行為選項、介面複雜度逼近實作。
   login 四頁的 submit 是同構九步骨架，分歧恰兩點且是 surface 真實需求差（staff 系才有空欄
   守衛與無後台權限分支），四個呼叫端只行使兩種選配組合（member/mobile 皆不傳；mobile-admin/
   staff 皆傳）——選項空間未爆炸，deletion test 通過（刪掉模組，~45 行骨架 ×4 原地回歸）。
3. **選配的形狀**：`fields` 傳的是欄位值（資料）而非 `mode` 類枚舉；`onNoAccess` 是效應注入
   （與 `login`/`navigate` 同類 deps）。「未提供＝不啟用守衛」是行為保真約束（member/mobile
   不得偷加空欄守衛），不是 factory 為吸收異質性硬造的開關。
4. **滑坡界線**：出現第 5 個呼叫端、第 3 個選配、或任一選配長成枚舉旗標時，重新對本節與
   `docs/adr/0011` 審視；屆時偏向拆分而非加選項。
