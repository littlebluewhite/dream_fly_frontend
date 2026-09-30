# 死種子退役：seed 值/型別分家 + 測試自帶 inline fixture

> Status: Accepted。源自 2026-07 架構深化工程 Round 1 commit 1/4（Task 1 · C2 死種子退役，
> 2026-07-10 架構審查 8 候選中的首推項目）。

Round 4 把 dashboard 統計、單堂出勤明細、試上洽詢、行動版偏好設定、admin 儀表板 today/activity
面板、admin coach/venue/ticket/coupon/system-settings 寫入、admin 報表頁 13 面板等大批頁面接上了
真後端，但每次「頁面改吃真 API」的收尾往往只刪頁面自己的呼叫端，沒有回頭清掉被頂替的那份 mock
種子——`src/lib/domain/` 與 `admin`/`member`/`mobile`/`coach` 四個 facade 的 `data.ts` 因此累積了
一批「型別還留著、但具體陣列/物件已經沒有任何 production 消費者」的死值，部分甚至還在轉出鏈裡
逐層 re-export，靠著各自檔案裡零星的「TEST-FIXTURE ONLY」註解提醒後人別在頁面裡 import。本 ADR
記錄退役這批死值時建立的兩個慣例（值/型別分家、測試自帶 inline fixture），以及 Task 1 實際落地的
範圍；mobile-admin 的種子維持不動（見「已知後續」）。

## 背景與決定

### 1. 死活判定：對每個候選符號重新 grep 全部消費者，不採信既有註解的斷言

即使原始碼裡已經寫著「TEST-FIXTURE ONLY」或「僅供既有測試當 fixture 用」，落地前仍對每個候選
符號重新 `git grep` 一次全部消費者（production 呼叫端 + 測試），原因是：

- **同一個 domain 值在不同 facade 可能一邊活、一邊死**：`STATS`/`SKILLS` 在 `member/data.ts`
  的轉出鏈上還活著（`member/api.ts` 的 dashboard 組字串會讀），但 `mobile/data.ts` 對同一個
  domain 常數的再轉出，除了自己的測試檔外沒有任何 mobile 端呼叫端——同一個物件參照，一邊留、
  一邊砍。
- **型別別名可能比對應的值更長壽**：`mobile/data.ts` 把 `MY_COURSES`（值）與
  `EnrolledCourse as MyCourse`（型別別名）寫在相鄰兩行，粗看像是「一起死」的一對，實際上
  `MyCourse` 型別被 `LeaveSheet`/`MyCourseDetail`/`mine` 頁等多個 overlay 元件當標註用，值死了
  型別仍活著——本 task brief 原始的行號範圍把這兩者算在同一段落，落地時憑符號名逐一核實才發現
  需要拆開處理（brief 開頭即言明「行號是導航提示，實作一律以符號名定位」，這正是此類落差的
  設計理由）。
- **一個值死亡可能連帶讓它的「唯一消費者」的匯入也變成死碼**：`admin/data.ts` 的 `CAMPUSES`
  只在被刪除的 `ORDERS` 衍生式裡用到；`ORDERS` 死亡後 `CAMPUSES` 的 import 本身也失去意義，
  一併清掉，即使 brief 原始清單沒有明列這行。

### 2. 值/型別分家：interface 是否仍在背書某處的型別標註，決定它跟著值一起死還是留下

退役分兩種深度：

- **整段退役（值 + interface 一起砍）**：確認 interface 本身也沒有任何型別標註消費者。例如
  `domain/member-app.ts` 的 `CatalogCourse`/`MakeupSlot`/`Reward`/`Report`/`Certificate`——
  對應的頁面（課程介紹、補課、兌換、成績單、證書）全部已經改吃各自 `api.ts` 的真實回傳型別，
  domain 這份 mock 形狀不再是任何人的標註來源。
- **只砍值、留 interface**：`EnrolledCourse`/`ScheduleBlock`/`Order`——具體的示範陣列
  （`MY_COURSES`/`SCHEDULE`/`ORDERS`）沒有 runtime 消費者了，但 interface 本身仍替
  `mobile/api.ts` 的回傳型別、或 `member`/`mobile` facade 自己宣告的本地 interface 背書，
  刪掉會直接讓那些型別標註炸掉。

`coach/data.ts` 是後者的極端例子：9 組具體示範資料（`TODAY_CLASSES`/`STUDENTS`/`ATT_CLASS`/
`ATT_ROSTER`/`ATT_TODAY_CLASSES`/`THREAD`/`SHARED_FILES`/`SCHED_DAYS`/`SCHED_COURSES`）全部
退役，對應的 9 組 interface 裡有 8 組還在 `coach/api.ts` 或某個 `.svelte` 元件的型別標註裡
使用，原樣保留（`SharedFile` 除外——終審重新 `grep` 全 src 反證零型別消費者，依本 ADR 第 2 節
的判準隨值整段退役）。

### 3. 測試自帶 inline fixture，取代「借道 production 種子」的既有慣例

被砍值的既有測試原本大量 `import { CLASSES } from '$lib/admin/data'` 這類「借用 production
種子當測試資料」的寫法。退役後這些測試改為在測試檔內宣告一個型別標註為對應 interface 的
2–4 筆最小 literal（例如 `const CLASSES: ClassRow[] = [...]`），不再依賴 domain 層是否還留著
一份示範資料。這個轉向有兩個好處，不只是「不得不」：

- **測試意圖與種子生命週期解耦**：往後即使某個 domain 值因為其他原因被搬移或改名，不會連帶
  讓一堆不相干元件的測試變紅。
- **覆蓋率有時反而更完整**：`coach/data.test.ts` 原本借道 `STUDENTS`（12 筆）驗證
  `LEVEL_TINT` 是否涵蓋每個 `StudentLevel`，但真實種子裡從沒出現過 `level: '啟蒙'` 的學員
  （`coach/students/page.test.ts` 的既有註解也印證這點）——換成直接列舉 `StudentLevel` 的
  全部 4 個字面值做 inline fixture 後，`LEVEL_TINT['啟蒙']` 才第一次真正被斷言涵蓋到。

`coach/attendance/page.test.ts` 是這個轉向裡最需要小心的一個：`dirtyCount` 的既有斷言
（「初始 3 筆變更」）依賴名冊裡「非 present 筆數剛好 3」這個組成特徵，inline fixture 刻意保留
1 筆 late + 1 筆 leave + 1 筆 absent（各一筆、不多不少）才能讓既有斷言在不改動的情況下繼續
成立——inline fixture 不是「隨便塞幾筆資料」，仍要回頭核對測試斷言依賴的具體組成。

### 4. 本次落地範圍（Task 1，Round 1 commit 1/4）

- `src/lib/domain/member-app.ts`：8 個死值（`CATALOG`/`MAKEUP_SLOTS`/`REWARDS`/`REPORTS`/
  `CERTS` 整段退役；`MY_COURSES`/`SCHEDULE`/`ORDERS` 只退值）。
- `src/lib/domain/activity.ts`：`ACTIVITY` 退役，`Activity` 型別留。
- `src/lib/domain/shared.ts`：`ENROLL_SOURCES`、`tierOf` 退役，`CAMPUSES` 留（mobile-admin
  仍在用）。
- `src/lib/coach/data.ts`：9 個死值退役，interface 除 `SharedFile`（隨值退役，見上）外全留；
  檔頭「Mock-only」註解改為誠實描述「活查表 + 活種子 + 型別」混合的現況。
- `src/lib/admin/data.ts`：`CLASSES`、`ORDERS`、`tierOf` 轉出退役（`COACHES`/`VENUES`/
  `TICKETS` 轉出留——仍是活值）。
- `src/lib/member/data.ts`：`SCHEDULE`（值）、`MAKEUP_SLOTS`（轉出）退役，`MY_COURSES` 降級為
  只轉出型別。
- `src/lib/mobile/data.ts`：`STATS`/`SKILLS`/`SCHEDULE`/`ORDERS`/`MAKEUP_SLOTS`/`REWARDS`/
  `REPORTS`/`UPCOMING`/`MY_COURSES`/`POINTS_LEDGER`/`CERTS`/`CATALOG` 十二個值連同各自的
  死型別別名退役（`MyCourse`/`ThreadMsg`/`NotifItem`/`AttRecord`/`Member` 五個型別因仍有
  overlay 元件或測試消費而保留）。
- 25 個測試檔（11 個 lib 層、14 個 route 層）改吃 inline fixture；`docs/architecture.md` 的
  domain 段更新常數計數（15 → 7）並移除一處已經指向不存在檔案的幽靈引用（`src/lib/admin/
  facade-type-exports.test.ts`——型別回歸守衛的機制本身還在，現在只剩 `mobile/data.test.ts`
  一份，不再是需要點名的獨立慣例）。

## 後果（刻意，非 bug）

- **這批清理是純型別擦除層的變更，不影響任何 runtime 行為**：被刪除的除 `SharedFile`
  interface（零型別消費者，見上）外一律是「值」，且事前已逐一驗證零 production 消費者——`npm run check && npm run test && npm run build` 三綠即是
  完整驗收，不需要額外的行為回歸測試。
- **同一個 domain 常數在不同 facade 呈現不同的匯出面，是設計使然、不是不一致**：日後新增
  facade 消費 `$lib/domain/member-app` 時，不能假設「domain 有這個值、其他 facade 也轉出，
  這個新 facade 就該照樣轉出」——要重新核實這個新 facade 自己是否有消費者，比照本 ADR 第 1 節
  的方法論。
- **`facade-type-exports` 不再是需要點名的獨立慣例**：型別回歸守衛（把每個轉出型別綁定一個
  活值，讓漏轉型別在 `npm run check` 就編譯失敗）的技巧本身沒有變，但 `src/lib/admin/` 那份
  獨立測試檔早在 ADR 0009 隨報表 domain 退役時一起清掉了，現在唯一還需要這層保護的是
  `mobile/data.test.ts`（member-app 型別轉出量最多的一個 facade）——`docs/architecture.md`
  同步改為描述現況，不再假裝這是一個橫跨多檔案的具名慣例。

## 連帶：mobile-admin 報表複本的跨 surface 收斂（Round 2 乙批次，同一工程）

與死種子同根的另一種重複——mobile-admin 把桌面已測的純邏輯逐字 re-inline——在同一工程的
Round 2 收斂，決定記在這裡（ADR 0009 對這些點沉默，反轉的都是**局部註解慣例**而非任何 ADR）：

- **`donutStops` 跨 surface 單源**：`ReportsScreen.svelte` 原持有
  `admin/components/reports/donut.ts` 的逐字未匯出複本，且複本上方一行局部註解自稱「不跨
  surface 引入該檔」。複本刪除、改 import 桌面原檔——先例是 classes 頁早已跨 surface import
  `course-request.ts`；被反轉的只是那行局部註解，ADR 0009 全篇並無此限制。
- **逐面板 view-model 純函式**：`admin/report-math.ts` 新增 11 支 `*VM`（只做數字→數字；
  `normalizeBars` 的 maxScale 由呼叫端傳參，桌面/行動各自保留既有值域），桌面 11 個 report
  元件與 ReportsScreen 的 29 個 `$:` 改共用同一支——這是 ADR 0009「共用純邏輯」既定現況的
  擴充，元件本身維持 per-surface。
- **三個 mobile-admin admin 頁改接桌面 filter 模組**（`*-filter.ts`，ADR 0002 的單源）：
  查詢字串前置 `trim()` 是桌面模組的既定已測語意，收斂後 mobile-admin 的退化查詢（純空白、
  帶前後空白）行為與桌面對齊；正常查詢逐字不變。cats chips 字面量保留（admin `CATS` 不含
  「全部」且順序相異，不可互換）。

## 已知後續

- **mobile-admin 的種子退役是獨立後續任務，不在本批範圍**：`mobile-admin/data.ts` 的
  `*_BASE` 衍生陣列目前仍是活種子（ADR 0006 §5 記錄的 P2 mock 清單——身分晶片、page-1-only
  清單擷取、唯讀場地畫面、demo 票券編輯 toast——尚未有對應後端端點）；等這些畫面陸續接上真
  後端後，才會出現與本 ADR 第 1、2 節同類型的死值候選，屆時另開任務比照本 ADR 的方法論處理，
  不現在預先動它。
- **error-mapper 單源與否決紀錄另見 `docs/adr/0011`**：2026-07-10 架構審查 8 候選中，本 ADR
  記錄 C2（死種子退役）與上節的 C3 連帶；error-mapper 收斂（C4）、controller factory 否決、
  明文不收清單在 ADR 0011。其餘候選（`CartItem` 型別上移、wire 乙線、通知 gate 化、mobile
  候補接 seam、出席草稿 reducer）的落地紀錄在 `docs/architecture.md` 對應段落與各 commit。

## 增補（2026-08-03）：值／型別分家的**記帳結案**

第 2 節「只砍值、留 interface」留下的那批「值已死、型別仍在 facade 轉出鏈上」的漂移註記，自架構
深化 R9 C4（`docs/adr/0019`）四批 facade 純轉手退役後**全數結清**。結清的方式不是重新評估「型別
該不該留」——那條判準原樣有效（型別仍在替某處的標註背書就留），而是把**轉出這一層**拿掉：

- `admin/data.ts` 對 `Coach`／`Venue`／`Ticket` 的型別轉出（掛在第 4 節「值先退役、型別轉出續留」
  名下的三筆漂移；註記實體不在本篇 §4 內文，而是寫在退役前版本 `admin/data.ts` 的各匯出行旁，
  已隨該批匯出一併移除，要翻請查 git history），以及同區塊 Task F11 留下的 `Activity` 型別轉出
  （其唯一消費者 `ActivityPanel` 早已改吃 props），經 0019 判準句重驗皆為零附加型別事實的純轉手，
  已一併退役——消費端改直取 `$lib/domain/coaches`／`venues`／`tickets`／`activity`。四個型別本身
  仍然活著、仍在替 `admin/api.ts`
  與各對話框元件的標註背書，只是不再需要繞經 facade 借道。
- `mobile/data.ts` 的 `EnrolledCourse as MyCourse`／`ScheduleBlock`／`Order` 家族同理：第 2 節記載
  「值死型別活」的那批型別別名，自 C4 批1 起由 overlay／頁面以 import-site alias 直取
  `$lib/domain/member-app`（範式沿 `mobile/api.ts` 既有的 `EnrolledCourse as MyCourse` 寫法）。

**第 1 節的方法論不因此鬆動**：「對每個候選符號重新 grep 全部消費者，不採信既有註解的斷言」在 C4
四批裡逐批執行，而且真的攔到了落差——批3 的 `COACHES` 原被靜態量測為「test-only 消費」，重驗才發現
`mobile-admin/stores.ts` 經相對路徑 `./data` 拿它當 `coaches` store 的同步種子值（生產消費者）。
第 2 節同時新增一條姊妹處置：**「刪 export 留 import」**——當某個型別在 facade 本檔內部仍有標註
消費者、對外卻已無人取用時，只刪那行 `export type {…} from`，檔頭的 `import type` 原樣保留
（`export {X} from 'Y'` 語法本身不建立本檔可用的本地綁定，兩者互不相干）。C4 四批共 8 個型別採此
處置：`member` 的 `LedgerType`，`mobile-admin` 的 `MemberAccountStatus`／`OrderStatus`，`admin` 的
`Tone`／`MemberAccountStatus`／`VenueStatus`／`TicketType`／`ClassStatus`。

**「同一個 domain 常數在不同 facade 呈現不同的匯出面，是設計使然」仍然成立**（「後果」節原文）——
C4 之後這句話的含意更精確：差異不再來自「哪個 facade 順手轉出了什麼」，而只來自該 facade 是否真的
攜帶本檔型別事實（`docs/adr/0013` 的 Form 2／3 收窄）、是否真的做值變形。純轉手不再是任何 facade
的合法居民。

**第 4 節與「後果」節提到的型別回歸守衛已完全退場**：兩處記載「現在唯一還需要這層保護的是
`mobile/data.test.ts`」，指的是「把每個轉出型別綁定一個活值，讓漏轉型別在 `npm run check` 就編譯
失敗」的技巧。那份檔案守的正是 mobile facade 的型別轉出，而型別轉出已於 C4 批1 全數退役——守衛
失去守護對象，整檔（94 行）一併刪除，`admin` 的同款檔早在 ADR 0009 那輪就走過同一條路。技巧本身
沒有錯，只是倉內不再有任何 facade 需要它；`docs/architecture.md` 的 domain 段同步改寫為現況。

## 增補（2026-09-26，架構深化 R13）：本輪退役清單

完整背景見 `docs/adr/0023`。每個符號刪除前都照第 1 節重新 grep 全部消費者，不採信既有註解。

- **Task 1**（死碼）：`MemberDialog` 的 `member` 分支、`onEdit` prop 與 `ProgressBar` import；
  `admin/data.ts` 的 `Member`（連同 `MemberBase` import）、`PAY_STATUS`／`PayStatus`、`ATT_MARK`／
  `AttMark`；`StatusBadge` 的 `member`／`pay` case；`domain/members.ts` 的 `MEMBER_STATUS`。
  **型別留下**：`MemberStatus` 仍替 mobile-admin 的 `MEMBERS_BASE` 背書（第 2 節判準）。
- **Task 2**：`mobile/stores.ts` 對 `createCheckoutController` 的轉出——唯一消費者 `CartSheet` 改讀
  模組級單例 `checkout`。
- **Task 3**：domain 的 `ME`；`member/api.ts` 的 `AccountProfile`、私有 `ApiUser`、`mapProfile`、
  `saveBirthDate`、`me()`、`DashboardData.me`（以及因此變成孤兒的 import）；mobile 本地的 `Prefs`／
  `PREFS_DEFAULT`／`prefs`／`profile` store；`mobile/api.ts` 的 `getPreferences`／`savePreferences`／
  `mapPreferences`；`src/lib/mobile/pref-sync.ts` 整檔。**型別留下**：`Member`（authStore 在用）。
- **Task 4**：`buildCourseBody`；`admin/api.ts` 的 `CourseWriteBody`（拆成 `CreateCourseBody`／
  `UpdateCourseBody`）與 `mobile-admin/api.ts` 的同名零消費者轉出；`admin/data.ts` 的 `CLASS_STATUS`。
  `levelToApi`／`scheduleTextOf`／`parseAgeRange`／`coachIdOf` 不是退役，是收為 `course-request.ts`
  私有。
- **Task 5**：`paidRevenue`（由 `revenueTotal` 取代，口徑同時改為後端 `is_revenue`）。`LEGAL_NEXT`／
  `legalNextStatuses`／`applyStatusChange` 是搬家到 `order-status.ts`，不是退役。
- **Task 6**：admin 的 `ApiAdminTodaySession`、coach 的本地 `ApiTodaySession`（兩者收進 wire）；
  `coach/api.ts` 對 `deriveSessionStatus` 的活 re-export（production 零消費者，只剩自己的測試釘）。
- **Task 7**：`coach/api.ts` 的 `myCoachProfile`（只剩自己的測試）與本地窄化 `ApiUser`。

「死值不留死出口」照舊：上列轉出一律與其值同批移除，不留空殼 re-export。

## 增補(2026-09-27,架構深化 R14):三個 store 種子退役

完整背景見 `docs/adr/0024` §4。R14 Task 4(候選 F3,誠實開機)把 `notifications`、`pointsLedger`、
mobile-admin `messages` 的開機值與 reset 值都改成 `[]`,三組種子因此失去 production 讀者。每個符號刪除前
都照第 1 節重新 grep 全部消費者:

- **`domain/member-app.ts`**:`NOTIFS_SEED`(連同只為它存在的 domain `Notification` interface)與
  `POINTS_LEDGER`。**型別留下**:`LedgerEntry`/`LedgerType`,仍替 `member/points.ts` 背書(第 2 節判準)。
  常數計數 11 → 9。
- **`member/data.ts`**:`NOTIFS_SEED` 的收窄 facade(`NOTIFS_SEED as NOTIFS_SEED_BASE` import 與轉出)。
- **`mobile-admin/data.ts`**:`MESSAGES`。**型別留下**:`MessageRow`。

三組值逐字搬進測試專用的 `src/lib/testing/seed-fixtures.ts`,供測試 `store.set(fixture)` 灌一份有未讀、
有明細的狀態。這是第 3 節「測試自帶 fixture」的延伸:夾具集中在 `$lib/testing`,production 檔不得 import
它。同輪另有兩批死出口,同樣與其值同批移除:

- **Task 2**:`mobile-admin/stores.ts` 的 `refreshMessages` 轉出(訊息頁改經 `messagesPageEntry`)。
- **Task 5**:`mobile/stores.ts` 的 `applyCouponCode`/`chargeableLines`/`subscriptions` 轉出(`CartSheet`
  的優惠碼套用與預覽收進 checkout 單例)。

「已知後續」的 mobile-admin 種子只退了 `MESSAGES`。ops 四個集合與 `*_BASE` 仍是活種子,記為
`docs/adr/0024` 的遞延。

## 增補(2026-09-28,架構深化 R15)

上一節記的「已知後續」關閉:mobile-admin 的 `members`/`classes`/`orders`/`coaches` 四個 ops 集合
改走誠實開機(空陣列開機,`EMPTY_OPS`),`mobile-admin/data.ts` 的 `CLASSES`/`MEMBERS`/`ORDERS`
builder、`domain` 的 `MemberStatus`/`MemberBase`/`MEMBERS_BASE`/`CLASSES_BASE`/`ORDERS_BASE` 隨之
退役;`domain/shared.ts` 唯一匯出的 `CAMPUSES` 已無消費者,整檔一併刪除(`admin/data.ts` 自己的
`ClassBase`/`OrderBase` 繼承點原地保留,不受影響)。`COACHES` 的值搬到
`src/lib/testing/seed-fixtures.ts`,原倉的 10 個真消費者(非原估的 13,另 2 個估錯的檔案其實只是
失效的手動 store reset,直接刪除該行 import)逐一改指向新位置。詳見 `docs/adr/0025` 候選 F-3。

## 增補(2026-09-30,架構深化 R16)

完整背景見 `docs/adr/0026` §3。本篇原文不改寫,以下各點以本節為準。

- **§3 的 `LEVEL_TINT` 例子失去對象**:R16 Task 2a 拿掉後端沒有的 `Student.level`,`StudentLevel`
  與 `LEVEL_TINT` 一併退役,`coach/data.test.ts`「every StudentLevel value resolves in LEVEL_TINT」
  隨之刪除(同批刪除的還有 `CAT_COLOR` 涵蓋率測試)。§3 的論點(測試自帶 inline fixture,不借用
  production 種子)不受影響,同檔剩下的 `CLASS_STATUS` 涵蓋率測試仍是它的實例。
- **本輪退役清單**(型別欄位與只為它們存在的值,沿本篇「重新 grep 全部消費者、值/型別分家」的方法):
  - coach:`StudentLevel`、`LEVEL_TINT`、`SchedCat`、`SchedVenue`、`CAT_COLOR`,以及設定頁寫死的
    `STATS`;`Student.level/skill/pct/att`、`TodayClass.level/cat`、`Conversation.kind`、
    `Coach.en/gender/emergency` 等欄位。
  - admin:`ClassBase.room/term/sessions`、`ClassRow.startDate/checkinRate/makeup`、
    `OrderBase.invoice/handler`、`Order.campus/taxId`。
  - member/mobile:`EnrolledCourse.cat/coach/room/next/term/remain`、`DashboardData.track`、
    `MobileHomeData.myCourses`。
  - mobile-admin:`role` store 與 `switchRole`(Task 4,角色改由 URL 推導)。
