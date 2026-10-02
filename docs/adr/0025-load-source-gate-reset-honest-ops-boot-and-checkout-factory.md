# 頁面進場包改交資料來源、閘門自帶重置、mobile-admin 轉手退役、誠實開機擴及營運集合、營運列型別單源、點名文案分流、mobile 只留自有、會員 getter 瘦身、結帳工廠化、請假列 view-model 單源

> Status: Accepted。源自 2026-09-28 架構深化工程 Round 15(`/improve-codebase-architecture` 審查的
> 前端候選 F-1/閘門自有 reset/轉手退役/F-3/列型別單源/點名文案/F-4/F-2/F-5/請假列 VM,2026-09-28
> 落地)。base `fa7aab2`;Task 1 `5b36889`(F-1)、Task 2 `9dd278e`(閘門重置)、Task 3a `c487efe`+
> 修正 `0896df5`+Task 3b `128c592`(轉手退役)、Task 4 `39c460a`(F-3)、Task 5 `d078db1`(列型別
> 單源)、Task 6 `f00471c`(點名文案)、Task 7 `43164b7`(F-4)、Task 8 `d4a0eba`(F-2)、Task 9
> `dfe3be4`(F-5)、Task 10 `2e0257f`(請假列 VM)、Task 11(本篇與各 ADR 增補)。使用者於同日裁決:
> **全部候選照審查建議做**;F-4 的 seam 轉出本身不退役(重開 ADR-0024 F6);F-2 只動
> `getMine`/`getAccount`,`getPoints` 照留。

R15 沿 `docs/adr/0018`/`0019`/`0022`/`0023`/`0024`「一輪多案、單篇記錄」的體例,不新開架構類別。
共同目標仍是 locality:「頁面怎麼接共享 store」「測試怎麼清閘門狀態」「mobile-admin 的轉手住哪裡」
「營運集合開機時是什麼」「營運列型別住哪裡」「點名存檔失敗顯示什麼」「mobile 只留什麼」「會員
getter 該不該順手水合」「結帳輸入組裝住哪裡」「請假列的顯示規則住哪裡」這幾類知識各自只住一處。
每個候選都配一條先紅後綠的回歸測試或改前改後都綠的鎖定測試,測試打在新 interface 上。本篇依序記錄
十項決定、明確**不做**的事與理由、可見的行為變更、刻意遞延的已知項,以及 ADR 點名測試的改寫對照。
被既有 ADR 點名的地方,各篇已補 2026-09-28 的 dated 增補指回本篇。

## 背景與決定

### 1. 候選 F-1 — 頁面進場包改交「資料來源」,水合決策全歸水合閘門(含 bug #3,Task 1)

**病灶**:`docs/adr/0024` 讓 `pageEntry()` 住進 `HydrationGate`,交出
`{ fetch, refresh, hydrate: { flag, into, gen, pendingSettle } }`——頁面 load-gate 仍然自己拿旗標
(`flag`)和套用函式(`into`)組協定(guard 短路、post-await mutation-wins、翻旗),只是這三個決策點
現在讀的是閘門的同一實例。這代表「怎麼抓、抓回來寫不寫、何時翻旗」這條知識**分居兩處**:決策詞彙住
`hydration-gate.ts`,決策的**執行**住 `load-gate.ts` 的 `applyLoaded`/`applyRefreshed`。另外,
load-gate 的 `load()` 路徑判斷「mutation 勝出」只查旗標當下值,不比世代——`docs/adr/0024`「已知、
刻意遞延」記的 bug #3(「load 在飛 → markMutated → invalidate() → 回應落地」會套用舊快照)即源於此。

**決定**:

- 新增 port `LoadSource`(宣告在 `load-gate.ts`,`hydration-gate.ts` 只 `import type`,執行期只剩
  單向依賴):
  ```ts
  export interface LoadSource {
  	guarded(): boolean; // 已水合 → load() 同步收斂 ready
  	load(isCurrent: () => boolean): Promise<void>; // 重入防護(F1):!isCurrent() 時不寫、不翻旗
  	refresh(isCurrent: () => boolean): Promise<void>; // 重入防護(F5):一律真抓
  }
  export type LoadGateOptions<T> =
  	| { fetch: () => Promise<T>; onData?: (d: T) => void; onError?: (e: unknown) => void; source?: never }
  	| { source: LoadSource; onError?: (e: unknown) => void; fetch?: never; onData?: never };
  ```
- `load-gate.ts` 收斂為只管 phase、run 世代、卸載與 `onError`。`isCurrent` 是 load-gate 交給
  source 的棄追判準(「未卸載且仍是最新一輪 run」);source 只能讀它,拿不到 phase 與世代的寫入權。
  plain 頁面由模組私有的 `plainSource({ fetch, onData })` 包成同一個介面(guard 恆假,load 與
  refresh 共用一支)。
- `hydration-gate.ts` 新增內部 `loadRun(isCurrent)`/`refreshRun(isCurrent)`,三個決策點改成具名
  閉包 `guarded`/`mutationWins`/`commit`(保留 `docs/adr/0016` 的詞彙)。對外方法都委派給這兩支:
  `hydrate = () => loadRun(ALWAYS)`、`refresh = () => refreshRun(ALWAYS)`、
  `pageEntry = () => ({ source: { guarded, load: loadRun, refresh: refreshRun } })`。
- **bug #3 的修法**:`mutationWins` 改為 `entered !== mutationGen || get(flag)`——與 `gate.hydrate()`
  同一判準。`loadRun` 在套用之後、翻旗之前重查 `isCurrent()`(重入防護 F1),`refreshRun` 對稱。

**為什麼這不是 `docs/adr/0020` 否決的形 3**:load-gate 不再接受任何旗標,形 3 那個「直接讀旗標的
消費端留洞」在結構上消失。phase、世代的寫入點與棄追判準都還在 load-gate,契約 2、3(卸載即棄追、
被新一輪取代不寫)照樣看得到、釘得住。

**為什麼可以取代 `docs/adr/0016` 決定一**:當年否決「load-gate 整體委派 `createHydrationGate`」的
理由是「F1 重入語意要求 `into()` 後、翻旗前重查 generation,而 hydrate() 無條件翻旗」。`isCurrent`
由呼叫方交進來之後,閘門可以在 apply 和 commit 之間尊重頁面的 run 身分——當年擋住整體委派的那件事
不再成立。

**退役**:`LoadGateHydrateOptions`、`LoadGateBaseOptions.refresh`、`applyLoaded`/`applyRefreshed`、
兩處 genReader 分支;`HydrationCore`、`createHydrationCore`、`FetchGenStableOptions`、
`fetchGenStable`(改為模組私有,原本兩個 overload 的唯一用途「省略 `iterate`」已無呼叫端,收成單一
簽章、`opts` 必填)。

**測試**:`load-gate.test.ts` 新增 describe「source 選項(pageEntry 整合)」,紅釘「load 在飛 →
markMutated → invalidate → 回應落地:舊快照不套用、直寫列保留」;型別釘 `it.skip` 改
`@ts-expect-error`(涵蓋 `{fetch,source}` 與 `{source,onData}`)。既有鎖定釘(F1、F5、常規序、在飛時
mutation 勝出、失敗、世代與尾流七支)全部改用真 `createHydrationGate(...).pageEntry()`,斷言不變。
新增 4 支假 `LoadSource` 契約釘(guarded 為真時同步 ready 且不呼叫 load;destroy/被新一輪取代後
`isCurrent()` 皆回 false;source 跨多 tick 時 phase 只有 loading→ready;silentRefresh 交出 isCurrent、
吞掉錯誤、不動 phase)。

**已知殘餘(carry,見「刻意遞延」)**:`refreshRun` 在 `iterate` 非恆真(頁面 load-gate 的 refresh 族)
時,`fetchGenStable` 可能回傳 `undefined`——理論上 `opts.apply(data as T)` 會把 `undefined` 當
`T` 套用並翻旗;現行呼叫端的 payload 一律是物件/陣列,這條路徑不可達,詳見「刻意遞延」。

### 2. 候選 閘門重置 — 閘門自帶 reset、`hydrated` 唯讀(收掉 `docs/adr/0024` D-F2a,Task 2)

**病灶**:`docs/adr/0024` D-F2a 記錄「`hydrated` 型別不收窄」,理由是測試直寫旗標的地方仍多達 63
處/14 檔。同時 session-gate 的 identity 重置(`ownerChanged()`)與各模組測試各自維護一套「清空重來」
的手法,兩者其實是同一件事的兩種住所。

**決定**:

- `HydrationGateOptions` 加 `reset?: () => void`(還原內容為開機值);`HydrationGate` 去泛型,公開面
  收斂為 `hydrated: Readable<boolean>`、`hydrate()`、`refresh()`、`invalidate()`、
  `markMutated(tail?)`、`pageEntry()`,以及新增的 **`reset()`**。`reset()` 依序:
  1. 丟掉在飛合併 GET(`inflight = null`)
  2. 換尾流帳本(`resetEpoch += 1`,原 `tailEpoch`)
  3. `pendingTails = 0`
  4. `opts.reset?.()`
  5. 旗標翻回 false
  6. 喚醒全部尾流等待者

  (終審修波補釘:帳本清算三步——`inflight`/`resetEpoch`/`pendingTails`——移到
  `opts.reset?.()`/翻旗**之前**。後兩者才會同步通知訂閱者;訂閱者若在通知回呼裡同步重入
  `hydrate()`,清帳若還沒做完就先開了這個窗口,重入會併到重置前那支還在飛的 GET。控制器裁決
  改順序,行為契約不變——帳本清算原本就先於「喚醒等待者」,只是提早到 `opts.reset?.()`/翻旗之前。)
- `loadRun`/`refreshRun` 進場記下 `resetEpoch`,落地比對;不符即不寫——重置之前出發的
  hydrate/refresh 落地一律不寫。`refreshRun` 把同一比對併進 `fetchGenStable` 的 `iterate`
  (`live = isCurrent() && epoch === resetEpoch`),被喚醒的舊 refresh 因此直接收束、不再多發一支
  注定丟棄的 GET(可觀察差異:以前 identity 換人時被喚醒的舊 refresh 會用新身分重抓並套用,現在
  只收束、不寫——沒有既有測試依賴舊行為)。
- `session-gate.ts` 改用 `createHydrationGate({ fetch: epochFetch, apply, reset })`;
  `reset()` = `gate.reset()` + 重置 `reconcileChain`/`writeChain`。`createOwnedHydrationGate`、
  `ownerChanged` 整段退役——`createHydrationGate` 直接是工廠。
- 各模組匯出 `reset…ForTests = gate.reset`:`member/notifications.ts`
  (`resetNotificationsForTests`)、`member/leave.ts`(`resetLeaveRequestsForTests`)、
  `member/waitlist.ts`(`resetWaitlistForTests`)、`mobile-admin/stores.ts`(`resetOpsForTests`、
  `resetMessagesForTests`)。facade(`member/stores.ts`、`mobile/stores.ts`)不轉出。
  **不做 registry**(理由見 `docs/adr/0017` :52-58 與 `docs/adr/0024`「不做 registry 測試縫」)。

**opsGate 的 reset 不還原集合內容**:`resetOpsForTests` 只重置旗標、在飛 GET 和尾流帳,四個 ops
集合的內容不動——與舊的 `opsHydrated.set(false)` 語意最接近;四個集合的開機值是同步 seed(Task 4
之前),brief 沒有要求 ops 還原內容,故未擴大範圍(Task 4 落地誠實開機後,`opsGate` 才補上
`reset: () => applyOps(EMPTY_OPS)`,見下方候選 F-3)。

**測試**:`hydration-gate.test.ts` 新增 describe「reset()」共 4 支(reset 後不借用舊在飛 GET;
重置前出發的 GET 落地時不寫店、不翻旗;reset 會喚醒尾流等待者、舊尾流之後 settle 也不再出帳;
`@ts-expect-error gate.hydrated.set(true)`,執行期斷言丟 `TypeError`)。`import-scan.test.ts`
新增契約「production 原始碼零引用 `*ForTests`」(定義行與註解行除外)。64 處(實測 65 處)模組旗標
直寫改成 `reset…ForTests()`,其中 `set(true)` 16 處改為「fetch 替身回 fixture → `await hydrateX()`
→ `mockClear()`」;閘門單元測試 4 處(不是 brief 估的 7)改用 `markMutated()`/`invalidate()`;
7 處「測試收尾」儀式(`release(new Error('測試收尾'))`)全數刪除——永不 settle 的在飛 GET 由下一個
測試 `beforeEach` 的 `reset…ForTests()` 丟掉,不再需要收尾。

**已知例外(carry)**:全輪驗證清單的 `ydrated.set(` 零命中 grep,唯一命中是紅釘 4 本身的
`gate.hydrated.set(true)`(brief 指定要寫這一行 `@ts-expect-error`),此處記為既知例外。

### 3. 候選 轉手退役 — mobile-admin 測試改走 fakeRouter、`api.ts` 純轉手退役(Task 3a/3b)

**病灶**:`docs/adr/0024` F-3(誠實開機)要刪的種子 builder(`mobile-admin/data.ts` 的
`CLASSES`/`MEMBERS`/`ORDERS`),此刻被 5 個頁面測試的 `vi.mock('$lib/mobile-admin/api', …)`
拿去組回傳值——先動 F-3 會讓這些 mock 連帶炸掉,得改兩次。`mobile-admin/api.ts` 本身也累積了約
40 個零映射轉手(`getStudents`/`getCsettings`/`mapCourse`/`CoachNotFoundError` 等),是
`docs/adr/0022` D2 記錄的張力對象之一。

**決定(3a,production 零改動)**:

- 新增 `src/lib/testing/ops-routes.ts`(`GET /users`/`/courses`/`/coaches`/`/orders` 的 wire
  fixture,形狀取自既有 admin 測試)與 `src/lib/testing/coach-session.ts`(`coach/api.test.ts` 的
  `loginAs` harness 搬過來,不是複製)。19 個測試檔(8 個 overlay、10 個 route、`stores.test`)改成
  `vi.mock('$lib/api/client')` + fakeRouter,寫法照 `member/profile.test.ts` 的既有前例。
  `mobile-admin/api.test` 的組合器釘一併改走 fakeRouter。
- **偏離**:`stores.test.ts` 保留既有的 per-function `vi.mock('./api', …)`/
  `vi.mock('$lib/admin/api', …)` 策略,未整檔改走 fakeRouter——該檔本身測的是 store 層水合/
  mutation-race **機制**(dedupe、在飛共用、卸載競態),與 wire 形狀無關,機制在 mock `./api` 或
  `$lib/api/client` 下驗證的是同一件事;全量轉 wire fixture 只是重複頁面層已有的 mapping-fidelity
  覆蓋,不會多驗到 `stores.ts` 本身的任何新路徑。此為裁決核可的偏離,理由同時寫在檔內。
- C5(狀態/文案解耦)測試簡化:`deriveSessionStatus()` 只回
  `'wait' | 'live' | 'done'`,舊式預先映射 fixture 裡的 `'soon'`/獨立變化的狀態-標籤對在真 wire
  輸入下組不出來,簡化為兩個極端時間窗案例。`CoachesScreen.test.ts` 的 `mapCoach` 顏色改用本地
  `expectedFromWire()` 鏡像,不再直接比對原始 `COACHES` fixture。

**決定(3b,測試零 diff,只刪委派釘)**:

- `mobile-admin/api.ts` 從約 317 行刪到約 215 行,刪除約 40 個純轉手(含 `mapCourse`、
  `CoachNotFoundError`、`getStudents`、`getCsettings`、`ThreadMsg`、`CoachProfile` 型別轉出)。
  保留 5 個組合器:`getMore`、`getCoachHome`、`getAdminHome`、`getOpsCollections`、`getMessages`。
  17 個 production importer 改成直接找擁有者模組(`$lib/admin/api`、`$lib/admin/data`、
  `$lib/admin/components/coach-save`、`$lib/admin/settings-form`、`$lib/coach/api`、
  `$lib/coach/load-error-copy`、`$lib/coach/data`),撞名時在 import 處取別名(照 `docs/adr/0019`
  C4 的前例 `Activity as ActivityRow`)。
- 刪除 9 支同義反覆的委派釘(`api.test` 的 getAttendance/saveAttendance、getStudents、
  getCsettings、createConversation、getSettings/putSettings、getVenues/getTickets)——每支只驗證
  「呼叫轉發到擁有者模組」,re-export 本身已刪,測試因此變成孤兒,而擁有者模組自己的測試檔已覆蓋
  真行為。測試數字 2526(3a 基線)→ 2517(3b 後)= 恰 −9。
- 終審修波發現 `api.test.ts` 的 `getMore`/`getOpsCollections` 兩支斷言精度被削弱(3a 只斷言
  `.length > 0`,漏抓集合互換這類佈線 bug)。修法:鏡像 `admin/api.ts` 的私有 mapper 建本地
  `expectedCoach()`/`expectedVenue()`/`expectedTicket()`/`expectedOrder()` helper(同
  `CoachesScreen.test.ts` 的 `expectedFromWire()` 手法),斷言回到逐鍵 `toEqual`。

**grep 契約**:`grep -rF "vi.mock('\$lib/mobile-admin/api'"` src` 零命中。

### 4. 候選 F-3 — 營運集合誠實開機擴及 mobile-admin(Task 4)

**病灶**:`docs/adr/0024`「已知、刻意遞延」記錄 mobile-admin 的
`members`/`classes`/`orders`/`coaches` 四個 ops 集合仍帶種子開機,`*_BASE` 衍生陣列仍是活種子。
只有兩處在頁面之間讀這些 store(admin 首頁的待付款橫幅、`CoachesScreen` 的副標教練數),水合前顯示
的是假數字。

**決定**:

- 新增 `EMPTY_OPS: OpsCollections`(四個 `[]`,`pages` 全部 `{ total: 0, perPage: 0 }`)。四個
  writable 的開機值改取自它,apply 抽成 `applyOps(d)`。`opsGate` 補上
  `reset: () => applyOps(EMPTY_OPS)`——開機值與 reset 值結構上同源(皆呼叫 `applyOps(EMPTY_OPS)`)。
- `routes/mobile-admin/admin/+page.svelte` 待付款橫幅改為 `$: pending = $orders.filter(...).length`
  (拿掉 `opsHydrated` import);`CoachesScreen.svelte` 副標改為
  `($gate === 'ready' ? $coachesStore.length + ' 位' : '') + '專任教練'`(照 `VenuesScreen.svelte`
  的既有前例)——水合前只顯示「專任教練」,不再先閃出種子數。
- 刪除:`mobile-admin/data.ts` 的 `CLASSES`/`MEMBERS`/`ORDERS` builder;domain 的
  `MemberStatus`/`MemberBase`/`MEMBERS_BASE`、`CLASSES_BASE`、`ORDERS_BASE`,以及整個
  `domain/shared.ts`(其唯一匯出 `CAMPUSES` 已無消費者——`admin/data.ts` 的 `ClassBase`/`OrderBase`
  仍被 `:72,128` 繼承,原地保留)。
- `COACHES` 的值逐字搬到 `src/lib/testing/seed-fixtures.ts`(`Coach` 型別留原處)。核對後實際有
  **10 個**測試檔(非 brief 估的 13)真的 import `COACHES` **值**——改從新位置 import;另有 2 個
  檔案(`members`/`orders` 頁測試)只在一段已隨此次改動失效的手動 store reset 裡用到,直接刪除
  該 import,不是重新指向。

**退役的釘**:`stores.test` 的 `taxFromGross` 釘(`wire.test.ts`/`admin/api.test.ts` 已覆蓋);
`data.test.ts` 裡 `COACHES`、三個 `*_BASE`、`CAMPUSES` 的釘(`VENUES`/`TICKETS`/`LEVELS` 保留)。

**紅釘**:`stores.test`——fresh import 後四個 store 皆 `[]`、`opsPages` 全 0、旗標為 false;
`resetOpsForTests()` 之後四個 store 回到 `[]`。`CoachesScreen.test`——載入中只顯示「專任教練」、
ready 後顯示「N 位專任教練」。`admin/page.test`——水合前待付款為 0、水合後等於 fixture 裡的
pending 數。

### 5. 候選 列型別單源 — 營運列型別以 `admin/data.ts` 為單一來源(Task 5)

**病灶**:`mobile-admin/data.ts` 的 `ClassRow`/`MemberRow`/`OrderRow` 三個型別與桌面
`admin/data.ts` 的 `ClassRow`/`MemberAccount`/`Order` 逐欄相同,是同一份型別的兩份宣告。

**決定**:三個型別本體退役,importer 改成
`import type { ClassRow, MemberAccount as MemberRow, Order as OrderRow } from '$lib/admin/data'`
(不另留 re-export,`docs/adr/0019` C4)。純型別收斂,沒有紅釘,鎖定靠 `npm run check` 與既有測試
全綠。

### 6. 候選 點名文案 — 行動版點名存檔錯誤依狀態碼分流(bug #5 文案對齊,Task 6)

**病灶**:行動版點名存檔失敗一律顯示同一句泛用連線錯誤,不區分 403(無權限)/404(場次不存在)/
422(驗證失敗)——桌面 `coach/attendance/+page.svelte` 早已依狀態碼分流(`attendanceErrorMessage`
inline 常數)。`docs/adr/0022` 審查當時把這條記為「刻意措辭」(檔頭 :20-21 明寫沿用行動版文案),
本輪核對後判定行動版檔頭那句話描述的其實只是「標題不變」,內文理應和桌面一致——本輪改法是「標題照舊、
內文依狀態碼分流」,依 `docs/adr/0011` 決定一稱為「文案對齊」,不是新開一份文案單源。

**決定**:頁內新增 `ATTENDANCE_ERROR_TEXT: Record<number, string>`,內容與桌面
`attendanceErrorMessage` 的三個 status/text 對逐字相同(桌面該表是函式內的行內字面,非具名匯出,
逐字複製而非共用匯出)。失敗 toast 改用 `apiErrorText(outcome.error, ATTENDANCE_ERROR_TEXT)`。
文案仍留呼叫端(`docs/adr/0011` 決定一)。

**紅釘**:`routes/mobile-admin/coach/attendance/page.test.ts` 新增 3 支——fakeRouter 在
`PUT /sessions/{sid}/attendance` 丟 `ApiError(403/404/422)`,斷言 toast 標題仍是「儲存失敗」、
內文為對應繁中句子。原本的網路失敗釘(:111-118)逐字不動。

### 7. 候選 F-4 — `mobile/stores.ts` 只留自有,行動版直取會員 app 模組(含 bug #6,Task 7)

**病灶**:`docs/adr/0024` F6(源自 `docs/adr/0014` §1)重開的張力仍未解——`mobile/stores.ts` 轉出
27 個 `$lib/member/stores` 符號 + 3 個 `member/checkout` 符號,`mobile/auth.ts`/`mobile/api.ts`
另有 5 支純轉手(`getSchedule`/`getPoints`/`getReports`/`getEnrolmentAttendance`/`getAccount`,
連同 `MobileAccountData`),這些轉出的唯一理由是已於 R14 記錄要退役的「import 方向規則」本身。

**決定**:

- `mobile/stores.ts` 只留 `overlay`、`MobilePushId`/`MobileSheetId`、`cart`、`checkout`、
  `toasts` 六個名字。刪除 `mobile/auth.ts` 整檔;刪除 `mobile/api.ts` 的 5 支純轉手與其型別
  `MobileAccountData`。
- mobile 的消費端一律直接 `import { … } from '$lib/member/<concern>'`,不經 barrel。
- **import 方向規則退役**:刪除 `foundation-contracts.test.ts` :60-95 的 mobile import 方向
  it、canary 與檔數釘。`import-scan.ts` 與 dogfood 契約保留(`walk` 由 dogfood 覆蓋,掃超過 100
  個檔,不因這批刪除而失去驗證面)。

**順帶修 bug #6**:`LeaveSheet.svelte`、`MakeupSheet.svelte`、`MyCourseDetail.svelte`、
`routes/mobile/account/+page.svelte` 四則過期註解(仍寫著測試 mock `$lib/member/stores`)改寫為
現況。

**偏離(type fallout)**:`mobile/api.ts` 原本刻意從 `$lib/domain/member-app` 取寬鬆版
`Order`/`ScheduleBlock` 型別(檔頭明文「刻意從 domain 取寬鬆版型別」);一旦 `OrdersScreen.svelte`/
`ScheduleScreen.svelte`/`routes/mobile/account/+page.svelte` 改直取 `$lib/member/api` 的
`AccountData`/`ScheduleData`,便繼承窄的 `Tone` 型別,3 個測試 fixture 的
`status: [...] as [string, string]`/`tone: 'primary'` 字面不再過型別檢查——改為
`import type { Tone } from '$lib/api/wire'` 並標註 `as [Tone, string]`/`as Tone`,純型別修正、
零行為變化。

### 8. 候選 F-2 — 會員 getter 只回資料,頁面自己宣告要暖的 store(Task 8)

**病灶**:`docs/adr/0024`「明確不做」記 F-2 只動 `getMine`/`getAccount`(`getPoints` 的呼叫端本來
就讀 `$points`,順手水合服務自己那頁,照留)。`docs/adr/0012` K7 的殘餘——`getMine` 順手暖候補清單
與我的請假、`getAccount` 順手暖點數與訂閱——讓呼叫端看不出「呼叫這支 getter 就會連帶水合共享
store」這層副作用,而且暖機是**尾端 await**(`getAccount` 主 GET 之後才暖點數/訂閱),不是與主
GET 並行。

**決定**:

- `getMine` 只做 `activeEnrolments()`,不再打 `GET /waitlist/me`、`GET /leave-requests/me`。
  `getAccount` 只打 `GET /orders/me`,不再打 `GET /users/me`、`GET /points/me`、
  `GET /subscriptions/me`。
- 頁面在 load-gate 的 `fetch` 裡讓主 GET 與暖機同時出發(`Promise.all`):
  - `member/mine`:`[getMine(), warmStores('member/mine', [['候補清單', hydrateWaitlist],
    ['我的請假', hydrateLeaveRequests]])]`。
  - `member/account`:`[getAccount(), hydrateProfile()(失敗照拋), warmStores('member/account',
    [['點數', refreshPoints], ['訂閱', refreshSubscriptions]])]`。
  - `mobile/account`:同上,但只暖 `refreshPoints`(warm 標籤 `'mobile/account'`)。
- `getPoints` 照留:呼叫端本來就讀 `$points`,不在本輪範圍。

**偏離**:`member/api.test`brief 列的三個刪除(:384、:401、:629)與一個搬移(:608)之外,`getMine`
describe 內另兩支斷言內部副作用的既有 it(「順手 hydrate waitlist/leaveRequests store」「水合與主
fetch 並行啟動」)與 `getAccount` 主測試裡的 `memberProfile`/`subscriptions` 斷言,前提隨這次改動
一併破產(它們斷言 getter 不再有的內部副作用)。就地改寫為「只打自己的路徑」釘(呼應
`getDashboard` 既有慣例),同時滿足 brief 的紅釘要求,而非留紅或靜默刪除。

### 9. 候選 F-5 — 每個 surface 的結帳由 `createCheckout` 組起來(Task 9)

**病灶**:`checkout-controller.ts` 管付款生命週期,`member/checkout-sync.ts` 的 `placeOrder` 與
`mobile/stores.ts` 的 `placeOrder` 各自手焊「衍生 lines → 委派 submitOrder → 開啟即水合」這套
組裝,兩份逐字雷同,只有注入的 cart store 與要暖的清單不同。

**決定**:

- `member/checkout-controller.ts` 的 `deps.placeOrder` 簽章改為
  `(lines: ChargeableLine[], order: PlaceOrderInput) => Promise<PaidSummary>`(`PlaceOrderInput`
  = `{ coupon, usePoints, idempotencyKey, paymentMethod }`);`confirmPay` 只讀一次 `lines` 並
  往下傳,不再由呼叫端各自重讀一次購物車衍生可計費行。
- 新增 `member/checkout-sync.ts` 的 `createCheckout(w)`(取代原檔的 member 專屬 `placeOrder`):
  ```ts
  createCheckout(w: { cart: Readable<CartItem[]> & { clear(): void };
                      refreshAfterOrder: ReadonlyArray<() => Promise<unknown>>;
                      refreshOnOpen: ReadonlyArray<() => Promise<unknown>> }): CheckoutController
  ```
  內部:`lines = derived([w.cart, subscriptions], … chargeableLines)`;`placeOrder` 委派
  `submitOrder`;`applyCouponCode`/`points` 單源自 member 側模組;`setOpen` 在 `freshCheckout`
  時觸發 `refreshOnOpen`(best-effort,失敗吞掉、沿用現值)。
- 兩個 surface 各自組裝:桌面 `CheckoutDialog` 建
  `createCheckout({ cart, refreshAfterOrder: [refreshSubscriptions, refreshPoints],
  refreshOnOpen: [refreshSubscriptions, refreshPoints] })`;`mobile/stores.ts` 的模組級單例
  `checkout` 建 `createCheckout({ cart, refreshAfterOrder: [refreshPoints],
  refreshOnOpen: [refreshPoints] })`(mobile 購物車只產課程,恆空的 subscriptions 不必水合)。
  兩個原本各自手焊的 `placeOrder` 刪除。
- **偏離**:`mobile/overlays/CartSheet.svelte` 原本在 `onMount` 呼叫 `checkout.setOpen(true)` 後,
  若結果是 `freshCheckout` 還會自己呼叫一次 `refreshPoints()`——這是 `checkout` 單例(mobile
  `stores.ts` 的模組級物件)當時沒有 `refreshOnOpen` 才需要的手焊。改用
  `createCheckout({ refreshOnOpen: [refreshPoints], … })` 組裝後,同一個 `freshCheckout` 邊沿
  已由 factory 內部觸發 `refreshPoints()`,`refresh` 的位置從 `CartSheet` 的 `onMount` 搬進了
  factory 的 `refreshOnOpen`——開啟一次 sheet 前後仍是一支 `GET /points/me`,行為未變,故移除
  `CartSheet` 那份已重複的手動呼叫。

**測試**:新增 `checkout-sync.test.ts`;刪除 `stores.test.ts` 的 `placeOrder — 委派
submitOrder(mobile adapter,C4 首套單測)` describe(:87-181,逐字符合 brief 範圍)與
`checkout-api.test.ts` 的兩個 `placeOrder — …` describe(呼叫序列、失敗路徑,對應
brief 的 :143-330),兩者的內容(:144、:305 對應段落)搬進新檔並改呼叫
`createCheckout(...).confirmPay()`。

### 10. 候選 請假列 VM — `domain/leave-requests.ts` 單源(含新 bug「(undefined)」,Task 10)

**病灶**:member 桌面(`routes/member/mine/+page.svelte`)與 mobile(`MyCourseDetail.svelte`)兩處
「我的請假」列表各自手抄同一份 tone/label 查表(`LEAVE_STATUS`,`docs/adr/0013` Form 3 收窄)、同一段
`when`/`makeupWhen` 格式化呼叫,以及 `docs/adr/0022` 已收斂的 `leaveAction` 動作規則——三者其實是
同一列資料的同一份 view-model。**新發現的 bug**:補課日期或時間任一缺漏時,呼叫端原本以 `?? ''`
後援餵給 `formatSessionDateTime`,畫面因此出現「已預約補課: (undefined)」。

**決定**:`domain/leave-requests.ts` 新增 `LeaveStatus`、私有的 `STATUS_BADGE`(前身
`LEAVE_STATUS`)、`LeaveRowSource`、`LeaveRow { tone, label, when, makeupWhen, action }` 與
`leaveRow()`;`leaveAction` 改為本檔私有實作細節,不再對外匯出。`makeupWhen` 缺漏時回傳 `null`
(不是空字串),呼叫端據此判斷是否渲染該行,而非渲染出 `(undefined)`。刪除 `LEAVE_STATUS`:
`domain/member-app.ts`、`member/data.ts`、`mobile/data.ts` 三處都刪(值/facade 一併退役,常數計數
9→8)。補課開啟方式(Dialog vs sheet)與 toast 文案仍留呼叫端(`docs/adr/0011`/`0012`)。
`STATUS_BADGE[lr.status]` 補回兩個舊呼叫端原有的 `?? ['neutral', lr.status]` 後援,未知 status
一律降級為 neutral 徽章 + 原字串,不炸掉(終審修波補釘)。

**紅釘**:`it.each` 列出各狀態的 tone/label/when 表;「已補課但補課日期缺漏時不渲染 undefined」。
`OrdersScreen.test.ts`、`routes/mobile/account/page.test.ts`、`ScheduleScreen.test.ts` 三個
fixture 補型別標註(`as Tone`/`as [Tone, string]`),對應候選 F-4 的型別 fallout。

**grep 誠實界線(deviation,記錄不動)**:全輪驗證清單要求「`LEAVE_STATUS` 零命中」——字面 grep
仍會命中 6 處**純註解**(`member/data.ts`/`mobile/data.ts`/`domain/member-app.ts`/
`domain/member-app.test.ts`/`domain/leave-requests.{ts,test.ts}` 說明退役緣由),沒有任何活
export/import/宣告。這與本倉既有慣例一致——`NOTIFS_SEED`(37 處註解命中)、`MEMBERS_BASE`/
`CLASSES_BASE`/`ORDERS_BASE`(5 處)等退役識別字都留在「為何退役」的歷史註解裡(`docs/adr/0010`
第 1 節的方法論談的是「消費者」而非「文字提及」)。驗證清單本節以此為準:退役指零 production
消費者,不是零文字提及。

## 明確不做的事(供未來止步)

- **F-1**:不整段委派仍是錯的假設消失後的自然結果,但 load-gate 的重入防護**本體**(`isCurrent`
  的世代/卸載判準)不下沉進 `HydrationCore`——世代帳仍是 `docs/adr/0020` 形 2 否決的「裂腦」理由,
  本輪未重開。
- **F-2**:`getPoints()` 不動——它服務的是所在那一頁自己的讀取,`docs/adr/0012` K7 記的殘餘縮小
  但未清零。
- **F-4**:`mobile/stores.ts` 的會員轉出**已退役**(重開 `docs/adr/0024` F6,見第 7 節),檔案只剩
  mobile 自有的 6 個名字(`overlay`/`MobilePushId`/`MobileSheetId`/`cart`/`checkout`/`toasts`)。
  本輪不做的是:不把 mobile 自有的 overlay/cart/checkout/toasts 也搬進會員模組——那些是 mobile
  surface 自己擁有的東西,不是轉手。
- **F-5**:不合併兩個 surface 的結算(`docs/adr/0003` 的載重理由不變,見該篇增補)。`applyCouponCode`
  仍是 member 模組的匯出,不隨 controller 收編。
- **請假列 VM**:`leaveAction` 私有化後,補課開啟方式(Dialog vs sheet)刻意不統一——兩 surface
  的浮層機制本來就不同,統一會逼出行為選項。
- **不做**registry、全面 `vi.resetModules`、`createPagedLoadGate` 改造(理由同 `docs/adr/0017`)。
- **不刪** `ClassForm.svelte` 裡已經用不到的 `$coachesStore` 後援(只指出來,不刪——它現在因
  `coaches` store 誠實開機而幾乎恆為 `[]`,但這是 F-3 的副作用,不是本輪要處理的目標)。
- **不撤**請假表單與取消 factory 的預設 deps——`global.md` 更正 12:這些 controller 現在只 import
  型別,加預設 deps 會在執行期把它們拖進 API 和 session 閘門,故本輪未在計畫中列入,維持現狀。

## 可見的行為變更(逐條)

1. **CoachesScreen 載入中時副標只顯示「專任教練」**。以前會先閃出種子資料的「9 位專任教練」,水合後
   才換成真人數(F-3)。
2. **行動版點名存檔遇到 403/404/422 時顯示具體原因**,標題不變。網路錯誤的文案也不變(點名文案)。
3. **行動版帳戶頁的訂單、帳戶、首頁、mine 少打側邊 GET**;`mobile/account` 頁不再打
   `GET /subscriptions/me`(F-2)。
4. **桌面帳戶頁的暖機(點數、訂閱)改為與主 GET 並行**,不再是主 GET 落地後才尾端暖機(F-2)。
5. **console 的暖機 log 前綴** 變成 `member/mine`、`member/account`、`mobile/account`(warmStores
   的 `caller` 參數,F-2)。
6. **補課日期缺漏時不再顯示「(undefined)」**(請假列 VM)。
7. **一個之前存在的隱性 bug 消失**:`load-gate.ts` 的 `load()` 路徑「load 在飛 → markMutated →
   invalidate() → 回應落地」不再套用舊快照(F-1,`docs/adr/0024` 記的 bug #3)。
8. **被喚醒的舊 refresh 不再重抓並套用前一身分的資料**:reset() 之後,舊尾流之後才 settle 的
   refresh 直接收束、不再多發一支 GET(閘門重置)。

其餘改動 wire 等價。

## 已知、刻意遞延

- **F-1 的 `undefined` 棄追殘餘**:`hydration-gate.ts` 的 `refreshRun` 在 `iterate` 非恆真時,
  `fetchGenStable` 若因棄追回傳 `undefined`,`opts.apply(data as T)` 理論上會把 `undefined` 當
  `T` 套用並翻旗——舊的頁面 load-gate 路徑在這種情況下維持 `loading`,行為不完全等價。今日所有
  閘門的 payload 皆為物件/陣列,這條路徑不可達;若未來出現 `T` 合法含 `undefined` 的閘門,需要
  補上顯式的哨兵判斷(同 `docs/adr/0020`「兩筆殘餘」第 1 點的既有記帳方式)。
- **F-4 的既有殘留**(繼承自 `docs/adr/0024`,未擴大也未縮小):`ClassForm.svelte` 的
  `$coachesStore` 後援仍在(見上「明確不做」)。
- **F-2 K7 殘餘**:`getMine`/`getAccount` 已不再順手水合(第 8 節),暖機改由頁面在 load-gate 的
  `fetch` 裡用 `warmStores` 宣告。剩下的只有 `getPoints()`——它的順手水合服務所在那一頁自己讀的
  `$points`,照留(見上「明確不做」),`docs/adr/0012` K7 的裁決本身未撤。
- **mobile-admin header total 與「全部」chip 計數不一致**(`docs/adr/0022` 記錄的既有已知項,
  本輪未觸及)。

## ADR 點名的測試:改寫,不刪(舊 → 新)

| ADR | 位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `docs/adr/0016` C1 三決策點 | `load-gate.test.ts`/`hydration-gate.test.ts` | 讀取器經 `pageEntry().hydrate.gen`/`.pendingSettle` 交出,測試直接讀這兩個欄位斷言 | 讀取器已完全退役(`pageEntry()` 只回 `{ source }`,`src/lib/hydration-gate.ts:306-308`);`load-gate.test.ts` 新增 describe「source 選項(pageEntry 整合)」與「LoadSource 契約(假 source)」,改用真 `createHydrationGate(...).pageEntry()` 或假 `LoadSource` 對 `guarded()`/`load(isCurrent)`/`refresh(isCurrent)` 的行為釘(F1/F5 重入、`isCurrent` 於被取代/卸載後回 false、`silentRefresh` 交出 `isCurrent` 且吞錯誤);`hydration-gate.test.ts` 既有的世代穩定重抓與 mutation-settle 釘全部改成呼叫 `gate.refresh()`/`page.refresh()` 之後斷言 fetch 次數與落地值,不再有任何測試直接讀 `pageEntry().hydrate.*` |
| `docs/adr/0020`/`0021` 判準守恆釘 | `mobile-admin/stores.test.ts` | 同步 `markOrderPaid(order)` → `await refreshOps()`,`opsHydrated.set(false)` 重置 | setup 改 `resetOpsForTests()`,斷言(重抓前旗標已真、fetch 恰一次、快照照常套用)逐字不變 |
| `docs/adr/0017` 建構順序契約 | `session-gate.test.ts` | (R14 已改為零觸發,見 `docs/adr/0017` 增補) | 本輪未再變動——`createOwnedHydrationGate`/`ownerChanged` 隨閘門自帶 `reset()` 退役,`session-gate.ts` 內部改呼叫 `gate.reset()`,零測試面變化 |
| `docs/adr/0022`「測試收尾」儀式 | 多個 `checkout-api.test.ts`/`leave-requests-api.test.ts` 等 | `release(new Error('測試收尾'))` + 孤兒 `let release` | 改為 `new Promise(() => {})`,測試結尾不再需要手動釋放(閘門重置) |

對象已退役、隨之刪除的釘(不是改寫):

- **`mobile-admin/api.test.ts` 9 支委派釘**(3a/3b):getAttendance/saveAttendance、getStudents、
  getCsettings、createConversation、getSettings/putSettings、getVenues/getTickets——re-export
  已刪,測試失去對象。
- **`mobile-admin/data.test.ts`(或等價位置)的 `COACHES`/`*_BASE`/`CAMPUSES` 釘**(F-3)——值已
  退役,`VENUES`/`TICKETS`/`LEVELS` 保留。
- **`mobile/stores.test.ts`/`mobile/auth.test.ts` 的身分釘與 `foundation-contracts.test.ts` 的
  import 方向釘**(F-4)——`docs/adr/0024` F6 已退役身分釘與白名單,本輪退役的是 import 方向規則
  本身的 it/canary/檔數釘(白名單已無對象、import 方向掃描也已無守護意義,因為消費端不再繞經
  barrel)。
- **`member/api.test` 的 :384/:401/:629**(F-2)——getter 不再有這些內部副作用,斷言本身失去對象;
  :608 搬到頁面測試。
- **`mobile/stores.test.ts` 的 `placeOrder — 委派 submitOrder` describe** 與
  **`checkout-api.test.ts` 的兩個 `placeOrder — …` describe**(F-5)——`placeOrder` 函式本身
  已刪,搬進 `checkout-sync.test.ts` 並改測 `createCheckout(...).confirmPay()`。
- **`LEAVE_STATUS` 的三層守衛**(domain wiring 釘、facade 收窄釘、row-count canary,請假列 VM)
  ——併入 `leaveRow()` 測試表。

## 關聯 ADR

- **`docs/adr/0003`**:結帳由 `createCheckout` 組仍屬共用純數學/wire 編排,不共用結算(增補)。
- **`docs/adr/0010`**:F-3 的 `*_BASE`/`domain/shared.ts` 退役、F-4 的 seam 死 export、請假列 VM
  的 `LEAVE_STATUS` 退役皆沿其「重新 grep 全部消費者、值/型別分家」方法論(增補)。
- **`docs/adr/0011`**:點名文案分流仍是「文案留呼叫端」的實例,不是新單源;F-2 的暖機仍是
  best-effort、不進 error-text(增補)。
- **`docs/adr/0012`**:F-2 重開 K7、只剩殘餘;`removeCoupon()`/`lines`/`points` 一類唯讀資料來源
  的判準②澄清延伸到本輪的 `placeOrder` 簽章變化(增補)。
- **`docs/adr/0013`**:Form 3 的前例改指 `domain/leave-requests.ts` 的私有 `STATUS_BADGE`(取代
  `LEAVE_STATUS`,增補)。
- **`docs/adr/0014`**:§1 mobile import 方向規則退役(F-4);§3 mobile-admin 那側的 coach
  load-error-copy 理由消失(轉手退役後零額外映射層),桌面那側的理由仍在(增補)。
- **`docs/adr/0016`**:決定一被 F-1 取代;第 1 層測試改成「假 source 契約 + pageEntry 整合」
  (增補)。
- **`docs/adr/0017`**:`ownerChanged` 改由閘門自帶 `reset()` 取代(增補)。
- **`docs/adr/0019`**:C4 套用到 mobile-admin(轉手退役,增補)。
- **`docs/adr/0020`**:形 1 的世代讀取器不再外流;逐點說明為什麼不是形 3;契約 1-5 的現況
  (增補)。
- **`docs/adr/0021`**:`pendingSettle` 讀取器改私有(只經 `pageEntry().hydrate.pendingSettle`
  交出);硬契約改用「靜止時 fetch 同步出發」釘住(增補)。
- **`docs/adr/0022`**:`mobile/stores.ts` 的轉出退役(重開 :186-197 的判定,只退死 export、不改
  seam 本身);`leaveAction` 改私有,由 `leaveRow()` 取代(增補)。
- **`docs/adr/0024`**:結案:F1 潛伏窗(bug #3)、D-F2a、ops 誠實開機、`createOwnedHydrationGate`
  的 minor 記帳。重開:F6「轉出不退役」的結論延續、「不做 F3」的裁決本輪推翻(F-3 已擴及 mobile-admin
  的四個 ops 集合,增補)。

## 增補(2026-09-30,架構深化 R16)

第 10 節寫 `domain/leave-requests.ts` 新增 `LeaveStatus`;R16 Task 7 起 `LeaveStatus` 與
`ApiLeaveRequest` 住 `src/lib/api/wire.ts`(member 與 coach 共用的 wire 形狀,`docs/adr/0007` 增補),
`domain/leave-requests.ts` 改從 wire import、不再匯出。`STATUS_BADGE`/`leaveRow()` 的行為不變。
詳見 `docs/adr/0026` §8。

## 增補(2026-10-03,架構深化 R17,FE-10)

本篇原文不改寫。`docs/adr/0027` §5、§6 讓以下敘述過時:

- **:93 的公開面「`markMutated(tail?)`、`pageEntry()`,以及新增的 `reset()`」**:`write()` 取代 `markMutated(tail?)`。
- **:93-100 的 `reset()` 依序**:在「`pendingTails = 0`」與「`opts.reset?.()`」之間多一步:清和解鏈
  (`reconcileChain = Promise.resolve()`,舊擁有者卡死的和解不得堵住新擁有者)。完整順序:丟在飛合併 GET → `resetEpoch += 1`
  → `pendingTails = 0` → 清和解鏈 → `opts.reset?.()` → 旗標翻 false → 喚醒尾流等待者。
- **:111「`reset()` = `gate.reset()` + 重置 `reconcileChain`/`writeChain`」**:session 的 `reset()` = `gate.reset()`(含和解鏈)+
  重置 `writeChain`。
- **:113-116、:127-131 的 `reset…ForTests = gate.reset`**:`resetNotificationsForTests`/`resetLeaveRequestsForTests`/
  `resetWaitlistForTests`/`resetMessagesForTests` 已刪;只剩身分無關的 `resetOpsForTests`。測試用
  `resetSessionStores()`(真登入 → 登出)。「production 原始碼零引用 `*ForTests`」契約不變。
- **:30、:72、:399 與 :426 的 bug #3 pin 與 `opsHydrated.set(false)`**:見 `0024` 增補;`opsHydrated` 已刪。
- **:300-333、:443 的 `submitOrder`(mobile adapter 委派、`placeOrder — 委派 submitOrder` describe)**:`submitOrder` 已刪,
  序列是 `createCheckout` 的私有 `placeOrder`(`docs/adr/0003` FE-5 增補)。
