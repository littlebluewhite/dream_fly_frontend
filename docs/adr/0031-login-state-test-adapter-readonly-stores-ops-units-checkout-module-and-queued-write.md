# 登入狀態測試 adapter、共享 store 內容唯讀、ops 集合三個水合單位、結帳收成一個 module、單一排隊寫入

> Status: Accepted(§1–§5)。源自 2026-10-16 架構深化工程 Round 22(前端部分,parent issue #41)。base `735010e`;
> 登入狀態測試 adapter `eb94564`(#42);store 內容唯讀 `7ffc3d4`(點數、訂閱,#45)、`5e5dd7b`(候補、請假、通知,#44);
> ops 集合 `1c6ec9d`(#46);結帳 module `71f289f`(#43);單一排隊寫入 `fe98001`(#47);本篇與各 ADR 增補(本 commit)。
> 各 ticket 平行開發、經 merge commit 併入 `r22-architecture`,合入順序是 §4 → §5 → §3 → §1 → §2。

R22 沿 `docs/adr/0027`–`0030`「一輪多案、單篇記錄」的體例,不新開架構類別。共同主題:核心 module(閘門、登入狀態核心、
結帳 controller)已經 deep,摩擦在周邊——測試怎麼準備狀態(假 authStore、store 的 `.set()` 後門)、幾個 interface 太寬
(ops 一個水合單位管四個集合、`queueWrite` 要呼叫端手寫復原)。目標是測試走真的 interface、每條規則只住一處。本輪沒有
推翻既有 ADR 的明文裁決。被既有 ADR 點名、措辭已變假的地方,各篇已補 2026-10-16 的 dated 增補指回本篇;`GLOSSARY.md`
與 `docs/architecture.md` 已由各 commit 直接改成現況。

測試總數:base 247 檔、2657 passed | 2 skipped → 收尾 246 檔、2669 passed | 2 skipped(−1 檔、+12 個)。逐節:
§1 `import-scan.test.ts` +1;§2 ±0(契約擴在既有的 `it` 裡);§3 +6(`mobile-admin/stores.test.ts` 32 → 38、
`routes/mobile-admin/admin/page.test.ts` 12 → 13、`mobile-admin/api.test.ts` 7 → 6);§4 −2、−1 檔(`checkout-sync.test.ts` +5,
`checkout.test.ts` 的 applyCouponCode 區塊 −4,`checkout-order.test.ts` 整檔 −3);§5 +7(`self-account.test.ts` +3、
`session-gate.test.ts` 的 queueWrite 區塊 3 → 7)。

## 背景與決定

### 1. 登入狀態測試 adapter:兩套假 authStore 收成真核心 + HTTP fake(`eb94564`)

**病灶**:18 個元件/頁面測試檔經 `src/lib/testing/auth-mock.ts` 的兩個家族(A:方法驅動;B:`__set` 後門)mock 掉
`$lib/stores/authStore`。假的 authStore 自己重做一份身分推導,身分範圍、暖機、頁面壽命因此只在假的登入狀態上被驗;
`docs/adr/0026` §6 也把「15 個 mock authStore 的測試檔都得跟著改」列為不做 derived store 的成本之一。

**決定**:

- `testing/auth-fixtures.ts` 新增 `loginRoutes(rolesFor = () => ['member'])`:回 `POST /auth/login`(`user.id = email`)
  與 `POST /auth/logout` 兩條 route。呼叫端併進自己的 fakeRouter route 表,再 `await authStore.login(email, pw)`。
  教練身分照用 `testing/coach-session.ts` 的 `loginAs`。
- 每個檔的 `beforeEach` 先 `await resetSessionStores()`。B 家族的 `__set` 換成真登入;「呼叫了 `logout`」換成兩個斷言:
  `loggedIn === false`,加上恰好一次 `POST /auth/logout`。沒有 api mock 的檔補 `vi.mock('$lib/api/client')`。
- `testing/page-lifetime.ts` 的 probe 表把 `loginRoutes()` **放在最前面**,呼叫端的 route(含自帶 `rolesFor` 的
  `loginRoutes`)可以覆寫它;`SessionScope.test.ts` 與四個 `describeKeyedSlot` 因此跑在真核心上。
- 根 layout 測試 stub `fetch` 回 503:根 layout 的 `hydrate()` 走 global `fetch`,503 時狀態不變。
- 刪 `auth-mock.ts`。`import-scan.test.ts` 新契約:零 `vi.mock`/`vi.doMock` `$lib/stores/authStore` 與
  `$lib/stores/login-state`(`vi.importActual` 不算),附 POSITIVE/NEGATIVE fixture。

**和計畫的差異**:計畫裡 A 家族的三步(同拍斷言的 `login()` 前補 `await`、`roleFor` → `rolesFor`、斷言 mock `login` 被呼叫
改查 `POST /auth/login` body)沒有對象——A 家族沒有任何檔斷言 mock 的 `login` 或用 `roleFor`,所以是空條件。

### 2. 共享 store 內容唯讀(`7ffc3d4`、`5e5dd7b`)

**病灶**:`member/` 的 waitlist、leave、notifications、points(三顆)、subscriptions 對外匯出 `Writable`,測試靠 `.set()`
灌狀態,繞過水合閘門與 session 閘門;production 也沒有東西擋住閘門以外的寫入。

**決定**:

- 五個 module 照 `coach/conversations.ts` 的形狀改成私有 writable + 匯出 `Readable`;內容只有閘門的 apply/reset(與
  寫入動詞的 commit)能寫。`unreadCount` 照常 derived。
- `subscriptions` 的開機值與重置值共用一個私有空常數,刪 `SUBS_SEED`;測試夾具 `POINTS_LEDGER` 跟著成孤兒,一併刪除。
- `testing/wire-fixtures.ts` 新增 `waitlistResponse`、`notificationResponse`、`subscriptionResponse` 三個 builder
  (`docs/adr/0028` §4)。
- 28 個測試檔改成 `resetSessionStores()` → route 水合用的 GET → 呼叫 `hydrateX()`/`refreshX()` → `mockClear()`,原有的
  呼叫次數斷言不變。局部 mock 換成 route。通知頁的「哨兵」寫入改成在 load 在飛期間呼叫 `markRead`。
- §1 的 import-scan 契約擴到 `$lib/member/{waitlist,leave,notifications,points,subscriptions,stores}` 與 `$lib/self-account`
  (barrel `$lib/member/stores` 由 `5e5dd7b` 補進)。`$lib/mobile/stores` 不納入:`TrialScreen` 只 mock toasts。

### 3. ops 集合:一個水合單位 → 三個(`1c6ec9d`)

**病灶**:mobile-admin 的 `members`/`classes`/`coaches`/`orders` 由一顆 `opsGate` 經 `getOpsCollections()` 一次抓三支端點。
任一支失敗,四個集合一起失敗,每一頁都顯示錯誤;任何寫入之後三支端點全部重抓;首頁的待付款 banner 只要訂單,也得等三支。

**證據**(哪些寫入會波及別的單位):後端的訂單列表與教練列表都即時 JOIN `users.name`——`dream_fly_backend`
`src/modules/orders/repository.rs:238-247`(`JOIN users u ON u.id = o.user_id`,`u.name AS user_name`)、
`src/modules/coaches/repository.rs:7-14`(`JOIN users u ON u.id = c.user_id`)。課程列的教練名又來自同一份教練列表
(`coachNameById`)。所以改名會波及三個單位,其餘寫入只波及自己。

**決定**:

- `mobile-admin/stores.ts` 三顆 `createHydrationGate`:**會員**(`getMembers(1)`)、**課程·教練**(`getClasses(1)`,一次填
  classes 與 coaches)、**訂單**(`getOrders(1)`)。每個單位只寫、只重置自己那格 `opsPages`;開機值等於重置值
  (`docs/adr/0025` F-3)。四個集合改 `Readable`。`PageInfo`/`OpsPages` 從 `mobile-admin/api.ts` 搬到 `stores.ts`。
- 匯出 `membersPageEntry`/`classesPageEntry`/`ordersPageEntry` 與 `hydrateOrders`。三頁各用自己的進場包,`CoachesScreen`
  用 `classesPageEntry`,首頁只呼叫 `hydrateOrders()`。`resetOpsForTests` 一次重置三個單位。
- 刪 `hydrateOps`、`refreshOps`、`applyOps`、`getOpsCollections`、`OpsCollections`。
- 寫後刷新表(受影響單位同時 `refresh()`,`Promise.allSettled`;失敗只 `console.error`、不丟出,`docs/adr/0022` §1):

| 動詞 | 刷新 |
|---|---|
| `addMember` | 會員 |
| `saveMember`(名字沒變) | 會員 |
| `saveMember`(改名) | 會員、課程·教練、訂單 |
| `addCourse`/`saveCourse` | 課程·教練 |
| `addCoach`(`created`) | 會員、課程·教練(新教練也是一個 user) |
| `saveCoach`(名字沒變) | 課程·教練 |
| `saveCoach`(改名) | 會員、課程·教練、訂單 |

- **改名判準**:`saveMember` 比 `body.name` 與 store 裡那筆的名字,store 裡找不到那筆就當作改名(寧可多刷);`saveCoach`
  用 trim 後比對,與 `saveCoachEdit` 決定要不要 PATCH `/users` 的判準相同。
- **測試**:動詞測試改成逐 endpoint 計數(19 條先紅後綠),加失敗隔離(`GET /orders?page=1` 拋錯時會員頁照樣 ready)、
  首頁只打 `GET /orders?page=1`、兩條改名波及的釘。`docs/adr/0020` 的「寫後 await 的 refresh 恰好抓一次」釘保留,改成逐單位算。

### 4. 結帳收成一個 module(`71f289f`)

**病灶**:`src/lib/checkout-order.ts` 在 FE-5(`docs/adr/0003`、`0027` §3)之後只剩 `PaymentMethod` 與 `syncCartToServer`,
`member/checkout.ts` 還有 `applyCouponCode`。兩者都只有 `createCheckout` 一個呼叫端,卻各有公開 interface 與自己的測試,
結帳的規則散在 lib 根目錄與 member 兩處。

**決定**:

- `syncCartToServer`、`applyCouponCode` 改成 `member/checkout-sync.ts` 的私有函式;`PaymentMethod` 搬到
  `member/checkout-controller.ts`,`member/stores.ts` 的 re-export 改指向它(`docs/adr/0019` 的 barrel 照留)。
  沒有呼叫端的 `ApplyCouponResult` 型別刪除。
- `chargeableLines`、`orderErrorMessage` 留在 `member/checkout.ts`(GLOSSARY「可計費行」的唯一產地不變);
  `checkout-math.ts` 不動。
- 刪 `src/lib/checkout-order.ts`、`checkout-order.test.ts` 與 `checkout.test.ts` 的 applyCouponCode 區塊。
- **characterization test**(舊碼即綠,放 `checkout-sync.test.ts`,經 `createCheckout` 與手做的 cart 驅動):課程 qty 3 送出是 1、
  方案 qty 2 送出是 2;空車回 `nothingChargeable` 且 0 個請求;優惠碼經 `applyCode()`:空白不送、命中時 trim 再轉 `ntd`、
  404 與網路錯誤顯示同一句文案。
- **丟掉的測試**:舊的「空購物車 → 只呼叫 `DELETE /cart`、沒有 POST」從 interface 走不到。`confirmPay` 在沒有可計費行時
  先回 `nothingChargeable`,根本不會進 `syncCartToServer`;`syncCartToServer` 改成私有之後也沒有別的路徑能拿空陣列呼叫它。
  這條測試釘的是一個不存在的使用情境,所以刪除而不搬家;取代它的是「空車回 `nothingChargeable`、0 個請求」。

### 5. 單一排隊寫入:`queueWrite` 先水合、共用 `write()` 的復原步驟(`fe98001`)

**病灶**:`SessionGate.queueWrite(task, skipped)` 只管排隊與身分核對;寫前水合、樂觀套用、失敗復原(resync/rollback)都由
兩個使用者(`self-account.ts` 的 `setPref`、`saveSelfAccount`)手寫,而且各自讀 `get(gate.hydrated)`。同一套復原規則
因此住在 `write()` 與兩個使用者三處。

**決定**(`SessionGate` 成員名與成員數不變,`WriteOutcome` 不加種類,`Write` 不加欄位):

```ts
type QueuedWrite<R> = Omit<Write<R>, 'send'> & { send: () => Promise<R> | null }; // null = 不用送
queueWrite<R>(w: QueuedWrite<R>): Promise<WriteOutcome<R | null>>
```

1. 入列當下(同步)記 session 世代與 `wasHydrated`,執行 `undo = w.optimistic?.()`。
2. 輪到時身分已換 → `stale`,`settled` 是「session 已變更,未送出」的 rejected;`send` 不執行。
3. `await gate.hydrate()` 失敗:已 stale 就回 stale;否則走 `recoverWrite(onFailure, undo, gate.refresh, stale)`——從 `write()`
   抽出的復原步驟,`hydration-gate.ts` 只多這一個匯出。不送出、不推世代。
4. 水合後再比一次身分;入列時還沒水合就再套一次 `optimistic`(水合的 apply 蓋掉了它,所以它必須冪等)。
5. `send()` 回 `null` → `written(null)`;否則交給 `gate.write({ ...w, optimistic: w.optimistic && (() => undo), send: () => p })`。
   沒有 `optimistic` 的寫入照樣走非樂觀路徑,不會被誤當成樂觀寫入。

使用者:`setPref` 只剩 optimistic、send、commit、`onFailure: 'resync'` 與結果對應;`saveSelfAccount` 的驗證、diff 與 `null`
都收進 `send`。兩邊都刪掉手寫的寫前水合與復原分支,也不再讀 `gate.hydrated`。`hydration-gate.test.ts` 一字未改。

計畫的四條停止條件(第二個 `SessionGate` 成員/新的 `WriteOutcome` 種類/新的 `Write` 欄位;`hydration-gate.ts` 多於一個
新匯出;既有的 `self-account.test.ts` 或 `hydration-gate.test.ts` 斷言要改;任一使用者還需要自己的 resync/rollback 分支)
都沒有觸發,所以本節記成「已做」,不是「明確不做」。

**測試**:`self-account.test.ts` 補三條 characterization test(舊碼即綠):排隊中途換帳號時 `setPref` 回 `rolledBack`、
`saveSelfAccount` 回 `failed`,都不送 PATCH;寫前水合時換帳號 `setPref` 回 `rolledBack`,不發 resync GET。
`session-gate.test.ts` 的 queueWrite 區塊改寫成新形狀(3 → 7)。

## 明確不做的事(供未來止步)

- **衍生的 `sessionIdentity` store**:`docs/adr/0026` §6 照舊。§1 只拿掉它列的一項成本(mock authStore 的測試檔要跟著改);
  主要理由——所有 session 閘門的重置時機會往後延一拍——不變。
- **手機後台拿寫入回應就地 patch 列**:`docs/adr/0022` 照舊,寫後重抓才是真值。改名要刷的列住在別的單位,回應裡沒有
  JOIN 過的名字;§3 只把「重抓什麼」縮到受影響的單位。
- **頁面自己擁有 ops 閘門**:集合跨頁共用——教練畫面與課程頁讀同一份 coaches,首頁 banner 與訂單頁讀同一份 orders,寫入
  動詞在別頁觸發也要刷新同一份。閘門留在 store。
- **搬 `chargeableLines`、合併結帳純數學**:`chargeableLines` 留在 `member/checkout.ts`(可計費行的唯一產地,mobile 也用);
  `checkout-math.ts` 是 `docs/adr/0003` 決定的兩 surface 共用純數學,不併進 checkout module。
- **把 401 重送規則收進登入狀態核心**:401 只替發出當下的畫面身分重送(`docs/adr/0028` §1)屬於 `api()` 的請求生命週期,
  核心只決定身分與 token;本輪沒有因這條規則而生的摩擦。
- **清理沒改到的檔頭**:只改本輪改到的檔;沒改到的檔頭(例如仍提到已退役 `POINTS_LEDGER` 的 `member/data.ts`、
  `mobile/data.ts`、`domain/member-app.ts` 退役清單)不動。

## 可見的行為變更(逐條)

1. **ops 失敗按單位隔離**(§3):會員、課程·教練、訂單任一支端點失敗,只有讀那個單位的頁面顯示錯誤,其他頁照常。
2. **寫入後少打幾支 GET**(§3):例如 `addMember` 由重抓三支端點變成只重抓 `GET /members?page=1`;只有改名才刷新三個單位。
3. **首頁只抓訂單**(§3):mobile-admin 首頁的待付款 banner 只打 `GET /orders?page=1`。
4. §1、§2、§4、§5 wire 等價:測試換了準備狀態的方式,production 的請求序列與畫面不變(§5 的 characterization test 在舊碼上即綠)。

## 已知、刻意遞延

- **`coachBindFailed` 之後會員列表沒刷新**:`addCoach` 只在 `created` 時刷新;綁定失敗時 user 已經建立,會員列表要等下次
  重新整理才看得到。跟改前一樣。
- **首頁 banner 只算第 1 頁**:訂單單位只抓第 1 頁(行動版不能換頁),第 2 頁以後的待付款訂單不計入 banner。
- **queueWrite 的寫入在 resync 成功後不排和解重抓**:沿用 `write()` 的現行行為(resync 已是整包快照),§5 不另加。

## 關聯 ADR

- **`docs/adr/0003`**:FE-5 增補說的 `checkout-order.ts` 已刪(§4,增補)。
- **`docs/adr/0017`**:`queueWrite` 的形狀與 R17 增補說的 `auth-mock` 現況(§1、§5,增補)。
- **`docs/adr/0019`**:barrel 轉出 `PaymentMethod` 的先例改指 `checkout-controller`(§4,增補)。
- **`docs/adr/0020`**:「寫後 `await refreshOps()`」守恆改成逐單位(§3,增補)。
- **`docs/adr/0022`** §1:寫後重抓縮到受影響單位、`getOpsCollections` 退役(§3,增補)。
- **`docs/adr/0024`** §3:`queueWrite` 的簽章與語意(§5,增補)。
- **`docs/adr/0025`** F-3:`EMPTY_OPS`/`applyOps` 的形狀改成三個單位各自重置(§3,增補)。
- **`docs/adr/0026`**:§1 的 `makeAuthMockB` 已刪;§6 的成本少一項,決定不變(§1,增補)。
- **`docs/adr/0027`**:§3、§5、§6、§9 與 `auth-mock` 兩處(§1、§3、§4、§5,增補)。
- **`docs/adr/0028`** §4:新 wire 形狀走 builder(§2,不動)。
