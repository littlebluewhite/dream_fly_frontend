# 頁面進場包歸水合閘門、session 閘門收合併與寫入鏈、誠實開機與暖機清單、結算輸入歸 controller、行動訊息接回雙生

> Status: Accepted。源自 2026-09-27 架構深化工程 Round 14(`/improve-codebase-architecture` 審查的前端
> 候選 F1–F6,2026-09-27 落地)。base `35f6652`;Task 1 `d0a3718`(F6)、Task 2 `8f07f00`(F1)、
> Task 3 `32fbdcc`(F2)、Task 4 `0364eed`(F3)、Task 5 `287fe51`(F4)、Task 6 `e3dabd7`(F5)、
> Task 7(本篇與各 ADR 增補)。使用者於同日裁決:**全部候選照審查建議做**(含要重開 ADR 的 F2、F3、
> F4、F6);**F5**:手機教練開對話時等後端確認已讀才清角標,跟桌面一樣,兩端共用 `messages-controller`。

R14 沿 `docs/adr/0018`/`0019`/`0022`/`0023`「一輪多案、單篇記錄」的體例,不新開架構類別。共同目標仍是
locality:「頁面怎麼接共享 store」「在飛的 GET 與寫入怎麼排隊」「開機時 store 裡是什麼」「結帳輸入住
哪裡」「已讀什麼時候算數」這幾類知識各自只住一處。每個候選都配一條先紅後綠的回歸測試或改前改後都綠的
鎖定測試,測試打在新 interface 上。本篇依序記錄六項決定、明確**不做**的事與理由、可見的行為變更、
刻意遞延的已知項,以及 ADR 點名測試的改寫對照。被既有 ADR 點名的地方,各篇已補 2026-09-27 的 dated
增補指回本篇。

**代號撞名**:load-gate 既有的重入檢查在程式碼與 `docs/adr/0016` 裡叫「F1/F5」。本篇一律寫成「重入
防護(F1)/(F5)」,和候選代號 F1–F6 區分。

設計階段對審查原文有四處更正,記在這裡以免日後重提:

- **F1**:接那一對(`{ fetch: hydrateX, refresh: refreshX }`)的 5 個頁面裡,4 個接的是 `opsGate`——
  plain 的 `createHydrationGate`,**不是** session 閘門。所以 `pageEntry()` 要住在 `HydrationGate`,
  不能只住 `SessionGate`。另外,「整個協定收進一檔」說過頭了:load-gate 的重入防護照 `docs/adr/0016`
  決定一留在原地,實際收穫是 7 個頁面同一條接法、都拿到四項保護。
- **F2**:測試直寫 `hydrated` 旗標的地方,不含閘門單元測試是 63 處/14 檔。`pageEntry()` 必須交
  Writable 給 load-gate 去 commit,ops 閘門又沒有身分可換,單改型別只是表面,所以本輪不收窄成
  Readable(**D-F2a**)。開機重置改成「不觸發」而不是「延後觸發」。
- **F3**:`points` 本來就從 0 開機,帶種子開機的只有 `pointsLedger`。會員首頁沒有讀點數的地方,所以
  `getDashboard` 裡的 `refreshPoints` 沒有讀者,`docs/adr/0012` K7 的前提已經不成立。
- **F6**:只有 3 個手機測試按路徑 mock `$lib/member/stores`。`ALLOWED` 白名單的註解自述是「確保
  `vi.mock` 攔得到」,屬於接線證明,和身分釘同一類。

## 背景與決定

### 1. 候選 F6 — 手機 seam 測試改走 fetch adapter,身分釘與白名單退役(Task 1)

**病灶**:`docs/adr/0014` §1 讓 mobile 經自家 seam 取用 `$lib/member`,再用兩層守衛防「seam 與源頭
分叉」:`mobile/stores.test.ts` 的 `toBe` 同參照釘(R13 時 27 + 3 個 `member/checkout` 符號 = 30 個)、
`mobile/auth.test.ts` 的 2 個,以及 `foundation-contracts.test.ts` 的 `ALLOWED` 源路徑白名單。這些釘
存在的理由是「測試 `vi.mock` 精確源路徑才是佈線證明」。每收斂一對雙生就要「re-export + 身分釘 +
白名單」三檔同改。

**決定**:

- 三個按路徑 mock `$lib/member/stores` 的測試(`LeaveSheet`、`MakeupSheet`、`MyCourseDetail`)改用
  `$lib/api/client` + `fakeRouter`,斷言「打了哪個端點、帶什麼 body」,錯誤情境用 `new ApiError(409,
  …)`。測試不再依賴 mock 的精確路徑,佈線證明改由真端點給。
- 身分釘整段刪除(`mobile/stores.test.ts` 的「卡 3 存量收編 — identity pins」describe:30 個 `toBe`
  加上結帳接線釘;整個 `mobile/auth.test.ts`)。`ALLOWED` 白名單那支 it 刪除。
- **保留**:四個 seam 檔 `mobile/{api,stores,data,auth}.ts`,以及 foundation-contracts 的 import
  方向掃描(mobile production 碼在四個 seam 檔之外零 `$lib/member` import)。

**這一節解掉 `docs/adr/0022` 的 D2 張力**。D2 記的是 `docs/adr/0014` §1(store/動作經 seam 轉出)與
`docs/adr/0019` C4 判準句(零型別事實的純轉手 = 假 seam)對同一種匯出給出相反結論。R14 的答案:

- **`docs/adr/0014` §1 管的是 import 方向**:mobile production 碼只經四個 seam 檔碰 `$lib/member`。
  這條保留,由 import 方向掃描釘住。
- **`docs/adr/0019` C4 判準句仍只適用於 `data.ts` facade**(對 `$lib/domain`/`$lib/api/wire` 的轉手),
  不延伸到 `mobile/stores.ts` 的 store/動作轉手。
- **真正退役的是身分釘和白名單**:它們是「`vi.mock` 攔得到」的接線證明。三個測試改走 fetch
  adapter 之後,沒有測試再靠 mock 精確路徑取得證明,這層守衛失去對象。seam 的轉出本身不退役。

C4 審查當年說的「只換來一批逐符號同一性守護測試」,在 R14 之後不再成立:seam 還在,守護稅沒了。

### 2. 候選 F1 — 水合閘門自己交出頁面進場包(Task 2)

**病灶**:`pageEntry()` 只住 `SessionGate`。mobile-admin 的 4 個 ops 呼叫端(學員/課程/訂單頁與
`CoachesScreen`)接的是 plain 閘門,只能拿 `{ fetch: hydrateOps, refresh: refreshOps }` 那一對接
load-gate;訊息頁也是那一對。寫共享 store 的是 store 閘門,它不知道頁面的存在,所以這 5 處拿不到
`docs/adr/0023`「明確不做」列的四項保護:卸載即棄追、被新一輪取代的回應不寫共享 store、重入防護
(F1)、重入防護(F5)。R13 已把「給 `HydrationGate` 加 `pageEntry()`」記為未來候選。

**決定**:

- `PageEntry<T>` 與 `pageEntry()` 自 `session-gate.ts` 搬進 `hydration-gate.ts`。`HydrationGate<T>`
  改為泛型,公開面只剩 `hydrated`/`hydrate()`/`refresh()`/`markMutated(tail?)`/`pageEntry()`
  (Task 3 再加 `invalidate()`)。`mutationGen`/`pendingSettle`/`clearPendingTails` 退出公開面,
  世代與尾流帳的讀取器**只經** `pageEntry().hydrate.gen`/`.pendingSettle` 交出(`docs/adr/0020` 形 1)。
  `PageEntry` 對 load-gate 的依賴是 `import type`,零 runtime 邊。
- 新增內部工廠 `createOwnedHydrationGate(opts) → { gate, ownerChanged() }`。`ownerChanged` = 翻旗
  false + 清尾流帳(原 `clearPendingTails` 的本體)。它是「資料擁有者換人」,不是 member-auth 維度:
  誰換人、何時換人仍只有 session-gate 知道,所以不違反 `docs/adr/0017`「不把 session 維度深化進
  hydration-gate」。`createHydrationGate(opts)` 就等於 `createOwnedHydrationGate(opts).gate`。
- `session-gate.ts` 改建在 `createOwnedHydrationGate` 上,刪掉自己的 `pageEntry()`。它本來就把
  `epochFetch` 當 fetch 餵給水合閘門,所以繼承下來的進場包自帶 epoch 核對。`SessionGate<T>` 只比
  `HydrationGate<T>` 多 `mutate`(Task 3 再加 `queueWrite`)。
- **消費端**:`mobile-admin/stores.ts` 新增 `opsPageEntry`/`messagesPageEntry`。5 處改寫成
  `createLoadGate({ ...opsPageEntry })`/`createLoadGate({ ...messagesPageEntry })`。`refreshMessages`
  轉出失去 production 消費者,退役;`hydrateOps`/`refreshOps` 保留(首頁與寫後重抓還在用)。
- **不動**:`fetchGenStable`、`HydrationCore`、load-gate 的 `applyLoaded`/`applyRefreshed`/`run()`
  (`docs/adr/0016` 決定一)。`load-gate.ts` 只改註解。

**回歸**:members 頁「首次載入失敗 → 重試在飛時卸載 → `$members` 不被改寫」先紅後綠(舊接線下
`refreshOps` 在卸載後把資料寫進 store)。hydration-gate 新 describe「pageEntry(plain gate)」的
「refresh 在飛時 `destroy()` 不寫 store」「連續兩輪 refresh、先發後到的不寫」同樣先紅。

### 3. 候選 F2 — session 閘門吸收合併、寫入鏈與身分基準(Task 3)

**病灶**:`profile.ts` 與 `coach/api.ts` 各自手抄了閘門私有的東西——在飛合併(`inflight`)、session
世代(`session` 的 `let`)與寫入鏈(`enqueue`)。`docs/adr/0023` 記「若出現第三處,再考慮收進閘門」。
本輪重開這條:那幾個 `let` 重抄的是閘門私有的 epoch 與在飛狀態,跟出現幾次無關。另外,restored 開機
時 `createSessionCore` 的立即回呼會觸發一次 `onChange`,工廠因此有「建構順序契約」,消費端還要寫
「let 必須宣告在前」的註解。

**決定**:

- **hydrate 合併**(`hydration-gate.ts`):私有 `coalescedFetch()` 記 `inflight = { gen, data }`,
  `hydrate()` 與 `pageEntry().fetch` 共用同一支在飛 GET,settle 即清掉。
  - **只併入同世代出發的那支**(join guard,實作時補上,已裁決採納):呼叫端只在
    `inflight.gen === mutationGen` 時併入。否則「hydrate 在飛 → `markMutated` → `invalidate` → 新的
    hydrate/load」會併進 mutation 之前出發的 GET,舊快照通過新呼叫端的世代與旗標檢查,蓋掉那筆
    mutation。代價是罕見競態下多一次 GET。
  - refresh 族不合併:`pageEntry()` 多交一支 `refresh: opts.fetch`,load-gate 的 `refresh`/
    `silentRefresh` 本來就優先用它。
  - `ownerChanged()` 丟掉在飛的合併 GET。
  - 這不是 `docs/adr/0020` 否決的形 3:只是共用同一次 GET,沒有世代迴圈。
- **`invalidate()`**(公開):只把旗標翻 false,不碰世代帳、尾流帳與在飛合併。取代兩處 production
  直寫:`coach/api.ts` 查無教練時、`session-gate.ts` 和解失敗時。
- **身分基準在建構當下決定**:`createSessionCore` 的立即回呼只記 `lastIdentity`,不觸發 `onChange`、
  不推 epoch。restored 與訪客開機一律**零觸發**。`createSessionGate` 與 `createSessionRefresher` 共用
  這顆 core,所以 points/subscriptions 的 refresher 開機也不再跑 reset(已裁決採納:依 `docs/adr/0017`
  「reset 值 = 開機值」,畫面沒有差別)。建構順序契約與兩段「let 必須宣告在前」的註解一併退役。
- **`queueWrite<R>(task: (stale) => Promise<R>, skipped: R)`**:語意逐字取自 `profile.ts` 的
  `enqueue`,掛在 `SessionGate<T>`。前一筆 settle(成敗皆可)才輪到;輪到時 session 已換就回
  `skipped`、task 不執行;task 拿到 `stale()` 判斷失敗處理。`onChange` 重置這條鏈。
- **消費端**:`profile.ts` 刪 `session`/`writeChain`/`inflight`/`enqueue`,`hydrateProfile = gate.hydrate`,
  `setPref`/`saveProfile` 走 `gate.queueWrite`。`coach/api.ts` 刪 `inflight`/`hydrateIdentity`,
  `requireCoach` 改 `await gate.hydrate()`,查無教練時 `gate.invalidate()`。
- **D-F2a**:`hydrated` 型別不收窄,只改介面註解:「production 不得直寫;翻 false 走 `invalidate()`」。

### 4. 候選 F3 — 誠實開機 + 每個 surface 宣告暖機清單(Task 4)

**病灶**:通知、點數明細與 mobile-admin 訊息三個 store 帶種子開機。Topbar/Sidebar/TabBar 的角標
在水合之前顯示種子裡的「3 則未讀」,這是假數字。種子還逼出 `docs/adr/0017`「reset 值必須冪等 = 種子
clone」的條款,以免 restored 開機的重置抹掉角標的 seed teaser。另一面,外殼角標的真資料要靠
`getDashboard` 這類 getter 的副作用「順手」水合(`docs/adr/0012` K7),getter 的呼叫端看不出這一層,
而首頁其實沒有讀點數的地方。

**決定**:

- **誠實開機**:`notifications`、`pointsLedger`、mobile-admin `messages` 的開機值 = reset 值 = `[]`。
  角標不另加旗標:空清單 → 未讀 0 → 既有 UI 在 0 時本來就隱藏。
- **種子退役**(`docs/adr/0010`,刪前逐個 re-grep):`domain/member-app.ts` 的 `NOTIFS_SEED`(連同只為
  它存在的 domain `Notification` interface)與 `POINTS_LEDGER`、`member/data.ts` 的 `NOTIFS_SEED`
  facade、`mobile-admin/data.ts` 的 `MESSAGES`。值逐字搬進測試專用的 `src/lib/testing/seed-fixtures.ts`,
  12 個測試檔改 import。
- **更名**:`refreshNotifications` → `hydrateNotifications`。它本來就是 `gate.hydrate`,改名後與
  `hydrateWaitlist`/`hydrateMessages` 同一族。mobile 的通知轉出塊補上它。
- **暖機清單(Warm Set)**:`member/api.ts` 的私有 `hydrateSessionStores` 升格為 `src/lib/store-warm.ts`
  的 `warmStores(caller, tasks)`,語意與 log 格式逐字不變。各 surface 的 layout 以身分為 key 反應式
  呼叫(已登入且守門不導走時 key 為 `member.id`,否則 null;只在瀏覽器端):
  - `routes/member/+layout.svelte`:`[['通知', hydrateNotifications]]`;
  - `routes/mobile/+layout.svelte`:同上,經 `$lib/mobile/stores` 取用;
  - `routes/mobile-admin/+layout.svelte`:只在**教練分區**(路由的 `currentRole === 'coach'`,不是帳號
    角色)暖 `[['訊息', hydrateMessages]]`。訊息角標只出現在教練分區的 TabBar,端點又是呼叫者自己的
    對話;admin 帳號進教練分區會多打一次 `GET /conversations/me`,與它自己開訊息頁的行為相同(已裁決
    採納)。
- **每個身分只打一次 GET**:閘門守衛擋重訪;F2 合併擋掉同頁的重複(Svelte 子頁 `onMount` 先於
  layout,暖機與頁面載入必然同時水合);換身分時閘門自己重置。
- **`getDashboard`** 刪掉整行水合,不再打 `/points/me`、`/notifications`。

### 5. 候選 F4 — 結算輸入與預覽跟著 checkout controller 活(Task 5)

**病灶**:`checkout-controller` 管付款生命週期,但結算輸入(優惠碼、點數折抵、付款方式)與預覽
(`checkoutMath`)留在元件裡,`confirmPay(input)` 再以引數傳回去。mobile `CartSheet` 是 mount 級
元件,單例 controller 活得比它久:付款在飛時關掉再開,付款狀態延續,輸入與預覽卻歸零,畫面上的預覽
不再是正在送出的那一單。

**決定**:

- **deps**:`{ placeOrder, applyCouponCode, lines: Readable<ChargeableLine[]>, points: Readable<number> }`。
  注入的是唯讀資料來源,不是行為旗標,前例是 attendance-controller 的 `now`(`docs/adr/0012` 判準②的
  澄清,見該篇增補)。
- **`checkout.form`**:Writable `{ code, usePoints, paymentMethod }`,元件 `bind:` 到它。
- **快照**:`derived([內部, form, lines, points])`,多發 `coupon`、`codeErr`、`preview`
  (= `checkoutMath(lines, coupon, points, usePoints)`)、`hasChargeable`(= `lines.length > 0`)。
- **coupon/codeErr 的寫入者**有四個:`applyCode()`、`clearCodeErr()`、`removeCoupon()` 與 freshCheckout
  重置。`removeCoupon()` 是實作時補的(已裁決採納):桌面「移除」連結要清掉已套用的優惠碼與輸入框,
  而 `applyCode()` 對空輸入刻意 no-op。元件自此不直接寫 coupon。
- **`applyCode()`** 帶序號守衛:freshCheckout 會推進序號,之後才落地的回應丟棄。同一次結帳裡兩次
  重疊的 `applyCode` 仍是後落地者勝,與改前相同。
- **`confirmPay()`** 不收引數,讀自己那份;`ConfirmPayInput` 刪除。
- **重置規則**:`freshCheckout` 重置 form 與 coupon/codeErr;`resumedInFlight` 全部保留。
- controller 仍零 import toast 與錯誤文案(判準④),`codeErr` 的文字來自注入的 `applyCouponCode`。
- **adapter**:`mobile/stores.ts` 的單例補齊 deps(`lines = derived([cart, subscriptions], …chargeableLines)`)。
  `CartSheet`/`CheckoutDialog` 刪掉本地輸入、預覽與 `applyCode` 本體,改讀 `$checkout.preview`;toast
  與 `close()` 守衛留在元件。seam 的 `applyCouponCode`/`chargeableLines`/`subscriptions` 三個轉出失去
  唯一消費者,依 `docs/adr/0010` 退役。

### 6. 候選 F5 — 行動訊息對話串改接 messages-controller,已讀等後端確認(Task 6)

**病灶**:mobile-admin `MessageThread.svelte` 自管一台 getThread/sendMessage 本地狀態機,和桌面
`coach/messages` 的 `messages-controller` 是同一套編排的雙生。已讀是樂觀的:訊息頁點開就清未讀,
`markMessageRead` 再 fire-and-forget 打 `markRead`,失敗了角標也不回來。

**決定**(照 R10 B 案 `718844b` 的前例):

- `mobile-admin/api.ts` 補轉出 `createConversation`,deps 與桌面逐字相同,符合 `docs/adr/0014` §2 的
  三條件,controller 不加行為旗標。
- `MessageThread.svelte` 改建 `createMessagesController({ getThread, sendMessage, markRead,
  getStudents, createConversation })`,`onMount` 呼叫 `ctrl.selectThread(m.id)`。`threadReady` 失敗顯示
  可重試的 ErrorState;**`badgeCleared` 為 true 才呼叫 `markMessageRead(m.id)`**(使用者裁決)。送出走
  `ctrl.send`,`sending` 防連點與失敗 toast 留在 adapter。
- `markMessageRead` 只做兩件事:本地標已讀、`messagesGate.markMutated()`(不帶尾流)。fire-and-forget
  那段刪除。訊息頁 `openThread` 只做 push,不再樂觀清未讀。
- **終審修波追加**:`badgeCleared.then(...)` 落在 await 之後,原無身分核對——`load()` 開始時捕捉
  身分(同 `session-gate.ts`/`messagesGate` 的 identity 源:`authStore` 的 `loggedIn`/`member.id`),
  ack 落地時若身分已變則不呼叫 `markMessageRead`,ack-gated 語意(F5)不變。

## 明確不做的事(供未來止步)

- **F1**:
  - **不整段委派**:load-gate 不改成委派 `createHydrationGate`,理由仍是 `docs/adr/0016` 決定一。
  - **重入防護留在 load-gate**:`applyLoaded`/`applyRefreshed` 的重入防護(F1)/(F5)原地不動。
  - **世代帳不下沉到 core**:仍是 `docs/adr/0020` 形 2 的裂腦理由。
- **F2**:
  - **不收窄 `hydrated`**(D-F2a,理由見開頭更正)。
  - **不做 registry 測試縫**:測試照舊直寫旗標來重置閘門,不另建一個集中登記全部閘門、供測試一次重置的
    registry。那會違反零模組副作用的憲章;八個 `authStore` 訂閱也仍是每次 factory call 各一個
    (`docs/adr/0016` 定案 3)。
- **F3**:
  - **mock 角標不動**:沒有後端的外殼角標照舊(見「已知、遞延」)。
  - **`getMine`/`getAccount` 不動**:它們的順手水合服務所在那一頁自己的讀取,記為 K7 殘餘。
  - **ops 集合不動**:四個集合照留種子。讀它們的地方都在 load-gate 骨架後面,而退役會牽動約
    20 個測試檔。
- **F4**:**不加身分 hook**。第三門 `onSessionReset` 已在 R9 退役(`docs/adr/0019`);結帳跨登入的
  窗口記為遞延。
- **F5**:**桌面 `convos` 不併進 store**。桌面外殼沒有讀未讀數的地方(`coach/nav.ts` 的角標是
  mock),`Conversation` 與 `MessageRow` 的形狀也不同。
- **F6**:**seam 的轉出本身不退役**。`mobile/stores.ts` 的純轉手照留,`docs/adr/0014` §1 的 import
  方向規則照舊有效。

## 可見的行為變更(逐條)

1. **通知與訊息角標**:開機時空白,暖機後顯示真數,不再顯示種子裡的假 3 則。點數明細開機為空。
2. **會員首頁**:不再打 `/points/me`,通知改由 layout 暖機。
3. **mobile-admin 教練開對話**:後端確認已讀才清未讀;失敗就維持未讀。
4. **CartSheet**:付款中重開時,優惠碼、點數折抵與預覽都不變。
5. **mobile-admin 的 5 頁**(學員/課程/訂單頁、`CoachesScreen`、訊息頁):已水合時同步 ready。卸載之後
   或被新一輪取代的重整,不再寫入共享 store。
6. **永不 settle 的 hydrate GET 會擋住同一閘門之後的 `hydrate()`/`load()`**(F2 合併的固有代價,已
   裁決接受)。擋到那支 GET settle、有 mutation 推進世代,或擁有者換人為止;適用 ops 閘門與全部 session
   閘門。改前頁面重掛會另發一支新 GET。重試鈕仍然有效,因為 load-gate 的重試走不合併的 `refresh`;
   但載入骨架上沒有重試鈕。api client 沒有逾時。日後若要處理,方向是逾時,或讓重試改併入新的一支。

其餘改動的畫面與 wire 等價。

## 已知、刻意遞延

- **`hydrated` 唯讀化**(D-F2a):production 已無直寫(翻 false 只走 `invalidate()`,內部的
  `ownerChanged()` 也翻),但型別仍是 Writable,測試照舊直寫。
- **ops 誠實開機與 `*_BASE` 退役**:mobile-admin 的 `members`/`classes`/`orders`/`coaches` 仍帶種子
  開機,`mobile-admin/data.ts` 的 `*_BASE` 仍是活種子(`docs/adr/0010`「已知後續」)。
- **K7 殘餘**:`getMine`(候補清單 + 我的請假)與 `getAccount`(點數 + 訂閱)仍經 `warmStores` 順手
  水合,服務的是所在那一頁自己的讀取。
- **桌面 `convos`**:桌面教練訊息頁的對話列表仍是頁內狀態,不是 `messages` store。
- **mock 角標**:沒有後端的外殼角標照舊寫死:coach Topbar 的 `NOTIFS`、`coach/nav.ts` 訊息中心的
  `badge: 3`、admin Topbar 的「目前有 3 則新通知」、mobile-admin 的 `ADMIN_NOTIFS`/`COACH_NOTIFS`。
- **結帳跨登入窗口擴大**:`docs/adr/0023` 記的「A 付款在飛時登出、B 打開購物車看到 A 的付款狀態」,
  自 F4 起帶過去的還有優惠碼、點數折抵與預覽。
- **load-gate `applyLoaded` 只查旗標、不比世代(潛在問題)**:`gate.hydrate()` 進場捕捉 mutation 世代、
  落地比對;load-gate 的 `load()` 路徑只看旗標。「load 在飛 → `markMutated` → `invalidate()` → 回應
  落地」時,`load()` 會套用那份舊快照。5 個 mobile-admin 頁面自 F1 起走這條路;ops 與訊息閘門今天
  沒有 `invalidate()` 呼叫者,走不到。
- **其他 minor**:
  - 登出發生在暖機途中時,會記一筆無害的「通知 hydrate 失敗」log。
  - 沒有測試釘住「admin 進教練分區會暖訊息」這條裁決。**已解**(R14 補修 `56806b4`:
    `src/routes/mobile-admin/layout.test.ts` 新增此釘)。
  - 兩個 TabBar 的「開機沒有角標」測試依賴執行順序,應改 `vi.resetModules` 後重新 import。**已解**
    (R14 補修 `56806b4`)。
  - `createOwnedHydrationGate` 是公開匯出,「只給 session-gate 用」只寫在註解。
  - controller 內部名為 `machine` 的 store 現在也帶 coupon/codeErr。**已解**(R14 補修 `93d65a6`:更名 `state`)。
  - `confirmPay` 與 `hasChargeable` 各查一次 `lines.length`。**已解**(R14 補修 `93d65a6`:同讀一支
    `hasChargeable(lines)`)。
  - `hydration-gate.test.ts` 的 gen/pendingSettle 釘與改寫過的舊釘有部分重疊。**已解**(R14 補修 `73f0f34`:
    刪除重覆的兩支,斷言由 `docs/adr/0020`/`0021` 的讀取器探針涵蓋)。

## ADR 點名的測試:改寫,不刪(舊 → 新)

| ADR | 位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `docs/adr/0017` restored 開機 | `src/lib/session-gate.test.ts` | 「restored 開機單觸發」:reset 恰一次 | 「restored 開機零觸發」:reset 不觸發、store 保留開機值;另加「reset 讀的 let 宣告在 factory 之後也不炸」 |
| `docs/adr/0019` C3 進場包釘 | `session-gate.test.ts` → `src/lib/hydration-gate.test.ts` | `hydrate.flag`/`into`/`gen`/`pendingSettle` 的同參照釘、spread 整合釘 | 行為釘:`markMutated()` 之後 `hydrate.gen()` +1、`hydrate.pendingSettle()` 有尾流回 promise、靜止回 `undefined`(修補輪併入下一列的讀取器探針,不另留重覆的兩支);spread 整合釘搬來 describe「pageEntry(plain gate)」。session-gate 只留 epoch 專屬的 stale/retry 兩支,另加「session 閘門的 `pageEntry().fetch` 帶 epoch 核對」 |
| `docs/adr/0021`/`0020` 讀取器探針 | `src/lib/hydration-gate.test.ts` | 直接讀 `gate.mutationGen()`/`gate.pendingSettle()` | 改經 `pageEntry().hydrate.gen`/`.pendingSettle` 讀,斷言不變 |
| `docs/adr/0016` C5 付款機 | `src/lib/member/checkout-controller.test.ts` | `confirmPay(input)` 以引數餵輸入 | 改用 `form` + writable 的 `lines`/`points` 驅動,斷言不變;另加 describe「結算輸入與預覽」 |

對象已退役、隨之刪除的釘(不是改寫):

- **身分釘 30 + 2**:`mobile/stores.test.ts` 的 27 個 `$lib/member/stores` 收編符號與 3 個
  `member/checkout` 符號同參照釘,以及整個 `mobile/auth.test.ts`(2 個)。
- **`ALLOWED` 白名單**:`mobile/foundation-contracts.test.ts` 的源路徑白名單 it。
- **結帳接線釘**:`mobile/stores.test.ts` 的「checkout 單例以本檔的 `{ placeOrder }` 接線建構」。
  `CartSheet.test.ts` 的 C3 describe 已從行為面覆蓋同一件事。
- **`NOTIFS_SEED` 接線與計數釘**:`domain/member-app.test.ts` 的 `NOTIFS_SEED`/`POINTS_LEDGER` 字面、
  列數與 `toBe` 接線釘(常數計數 11 → 9)。
- **`refreshMessages` 釘**:`mobile-admin/stores.test.ts` 的「`refreshMessages()` 一律重新 fetch」。
  `docs/adr/0020` 的兩支釘逐字不變。
- **markRead best-effort 釘**:`mobile-admin/stores.test.ts` 的「best-effort 呼叫真 markRead(id)」。

## 關聯 ADR

- **`docs/adr/0003`**:預覽進 controller 仍屬共用純數學(增補)。
- **`docs/adr/0008`**:`pageEntry()` 改由任何水合閘門供給(增補)。
- **`docs/adr/0010`**:三個種子退役(增補)。
- **`docs/adr/0012`**:K7 重開與殘餘;判準②的澄清;`removeCoupon()`(增補)。
- **`docs/adr/0013`**:Form 3 前例改指 `LEAVE_STATUS`(增補)。
- **`docs/adr/0014`**:§1 身分釘與白名單退役;§2 新增雙生(增補)。
- **`docs/adr/0016`**:決定一「interface 零變動」被取代;C5 被推翻(增補)。
- **`docs/adr/0017`**:建構順序契約失效;seed teaser 條款消失(增補)。
- **`docs/adr/0018`**:C7 已決(增補)。
- **`docs/adr/0019`**:C3 下移到水合閘門;C4 張力已解(增補)。
- **`docs/adr/0020`**:讀取器只經 `pageEntry()` 交出(增補)。
- **`docs/adr/0021`**:`markMessageRead` 改為送完再寫(增補)。
- **`docs/adr/0022`**:D2 已解(增補)。
- **`docs/adr/0023`**:兩條未來候選已關閉(增補)。

## 增補(2026-09-28,架構深化 R15)

`docs/adr/0025` 是本輪的接棒 ADR。以下逐項結案或重開:

**結案**:

- **F1 的潛伏窗(bug #3)**:「已知、刻意遞延」記的「load 在飛 → markMutated → invalidate() →
  回應落地時套用舊快照」已修——`mutationWins` 判準改為 `entered !== mutationGen || get(flag)`,
  與 `gate.hydrate()` 同一判準,5 個 mobile-admin 頁面連帶受益。
- **D-F2a**:`hydrated` 型別收窄完成——公開介面型別改為 `Readable<boolean>`(非
  `Writable<boolean>`),測試直寫旗標的 71 處(核對後實為 65+4)全數改用各模組新增的
  `reset…ForTests()`/水合真流程,`gate.hydrated.set(true)` 只剩型別釘一處(以
  `@ts-expect-error` 明志)。
- **ops 誠實開機**:「明確不做」F3 記的「ops 集合不動」推翻——mobile-admin 的
  `members`/`classes`/`orders`/`coaches` 四個集合改走誠實開機(`EMPTY_OPS`),見下方「重開」。
- **`createOwnedHydrationGate` 的 minor 記帳**:「已知、刻意遞延」記的「只給 session-gate 用只寫在
  註解,不是型別」——因整段函式退役而失去對象:`session-gate.ts` 改用
  `createHydrationGate({ fetch, apply, reset })` + 通用 `gate.reset()`,`ownerChanged`/
  `createOwnedHydrationGate` 不再存在,無需再管「只給誰用」。

**重開**:

- **F6「seam 的轉出本身不退役」**:結論**延續**,不是推翻——`mobile/stores.ts` 這個 seam 本身仍在,
  `docs/adr/0014` §1 的 import 方向規則本輪才真正退役(因消費端已直取 `$lib/member/*`,規則失去
  適用對象,見 `docs/adr/0014` 增補)。seam 檔案不刪,只是零消費者的死轉出(27 個 store 符號 + 3
  個 checkout 符號中的相當部分)被清空,詳見 `docs/adr/0022` 增補「D2 重開一半」。
- **F3「ops 集合不動」的裁決推翻**:當年不做的理由是「讀它們的地方都在 load-gate 骨架後面」+
  「退役牽動約 20 個測試檔」。本輪(候選 F-3,Task 4)判斷這兩個理由不足以繼續遞延——兩處讀取點
  (admin 首頁待付款橫幅、`CoachesScreen` 副標教練數)水合前顯示假數字本身就是使用者可見的誠實性
  缺口,測試改動的規模本輪實際發生且已完成(19 個測試檔改走 fakeRouter,另有 10 個 `COACHES`
  值消費者改指向 `testing/seed-fixtures.ts`)。詳見 `docs/adr/0025` 候選 F-3、轉手退役。

## 增補(2026-10-03,架構深化 R17,FE-10)

本篇原文不改寫。以下敘述被 `docs/adr/0027` §5、§6 取代:

- **:76 的公開面「`hydrated`/`hydrate()`/`refresh()`/`markMutated(tail?)`/`pageEntry()`」、:86 的「`HydrationGate<T>` 多
  `mutate`」**:公開面是 `hydrated`/`hydrate()`/`refresh()`/`invalidate()`/`write()`/`pageEntry()`/`reset()`;`mutate` 已退役。
- **:110、:262、:323 的 pin 序列「load 在飛 → `markMutated` → `invalidate()` → 回應落地」**:由「未水合 `write()` 直寫 →
  和解失敗把旗標翻回 false」驅動同一個狀態;load-gate 的 `load()` 只看旗標的潛伏窗(bug #3)仍由
  `source.load` 的世代比對關閉。
- **:202-208 的 `badgeCleared` 為 true 才呼叫 `markMessageRead(m.id)`、只做本地標已讀 + `messagesGate.markMutated()`、
  終審修波追加的 `load()` 身分核對**:現為立即呼叫 `markMessageRead(id, badgeCleared)`,`write()` 等 ack 為 true 才翻
  已讀,身分改變由閘門 `stale` 取代手寫核對(`MessageThread` 的核對已刪)。
- **:328 的 `reset…ForTests()` 與「`gate.hydrated.set(true)` 只剩型別釘」**:各 store 的 `reset…ForTests` 已刪
  (只剩 `resetOpsForTests`),測試用 `resetSessionStores()`。
