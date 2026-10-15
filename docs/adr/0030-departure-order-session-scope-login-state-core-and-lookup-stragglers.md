# 水合閘門出發序帳(後發優先)、身分範圍 `SessionScope`、登入狀態核心 `login-state.ts`、查表漏網三處

> Status: Accepted(§1–§4)。源自 2026-10-15 架構深化工程 Round 21(前端部分,parent issue #34)。base `35cf8bc`;
> 查表漏網 `7eb6fa1`;出發序帳 `aaa0dfe`(水合閘門)、`1cb67d1`(退役 `refreshSeq`)、`eff92ec`(session refresher);
> 身分範圍 `c37a055`;登入狀態核心 `62209be`;本篇與各 ADR 增補(本 commit)。各 ticket 平行開發、經 merge commit
> 併入 `r21-architecture`,所以 F1 的 refresher 那支(`eff92ec`,計畫裡是 F1 第 2 支)在 F3、F2 之後才合入。

R21 沿 `docs/adr/0027`/`0028`/`0029`「一輪多案、單篇記錄」的體例,不新開架構類別。四項決定都是把散在多個 caller 的
規則收進一處:「哪支 GET 的落地算數」(§2)、「身分相依 surface 的外殼怎麼守門、暖機、決定頁面壽命」(§3)、「token 換了,
畫面身分怎麼跟著換」(§4),以及 R20 總查表原語漏掉的三處(§1)。本輪沒有推翻既有 ADR 的明文裁決:§2 補上
`docs/adr/0016` R13 增補與 `docs/adr/0023`「明確不做」候選 07 承認的缺口;§4 完成 `docs/adr/0027` §1,並以相同語意退役
`docs/adr/0028` §1 的 hook。被既有 ADR 點名、措辭已變假的地方,各篇已補 2026-10-15 的 dated 增補指回本篇;`GLOSSARY.md`
與 `docs/architecture.md` 已由各 commit 直接改成現況。

測試總數:base 245 檔、2640 passed | 2 skipped → 收尾 247 檔、2654 passed | 2 skipped(+2 檔、+14 個;計畫預估約 +12)。
逐項:§1 +3;§2 `hydration-gate.test.ts` +10、`session-gate.test.ts` +1、`coach/conversations.test.ts` −1;§3 新檔
`SessionScope.test.ts` +14、四個 layout 測試 38 → 24;§4 新檔 `login-state.test.ts` 的 17 個全由 `client.test.ts` 搬來
(31 → 14),`import-scan.test.ts` +1。

## 背景與決定

### 1. 查表漏網三處改用 `lookupOr`(`7eb6fa1`)

**病灶**:R20(`docs/adr/0013` R20 增補、`docs/adr/0029` §3)把總查表收成 `lookupOr`,但以後端字串為鍵的查表漏了三處,
仍寫 `表[鍵] ?? 後備`。後端送來 `constructor`、`toString` 這類 `Object.prototype` 上的鍵時,會取到繼承來的函式,畫面顯示
函式原始碼或空標籤。

**決定**(後備值都不變):

- **報表分桶**:`admin/reports-api.ts` 的 `resolveBucket` → `lookupOr(table, key, { label: key, color: 'var(--df-text-muted)' })`。
- **付款方式**:`admin/report-math.ts` 的 `paymentMethodLabel` → `lookupOr(PAYMENT_METHOD_LABEL, method, method)`。
  `report-math.ts` 的「零外部依賴」章程(檔頭與 `REPORT_KPI_CARDS` 註記)改寫:唯一例外是 `$lib/api/wire` 的 `lookupOr`。
  `wire.ts` 本身是零 `$lib` 依賴的純葉,引它不帶進任何 store 或接縫,本檔仍可用字面量獨立測試。
- **課表時段狀態**:`ScheduleCalendar`(公開課表頁 `/schedule`)的 `STATUS_LABEL` 型別由 `Record<string, string>` 收成
  `Record<SlotStatus, string>`(產生的 wire 聯集,缺鍵在編譯期就紅),渲染改 `lookupOr(STATUS_LABEL, slot.status, slot.status)`。

**測試**(先紅):`reports-api.test.ts`(桶名 `constructor`、tier `toString` → 原字串 + 中性色)、`report-math.test.ts`
(`paymentMethodLabel('toString')`)、`routes/schedule/page.test.ts`(時段狀態 `constructor`)。

### 2. 出發序帳:水合閘門第六決策點,session refresher 共用(`aaa0dfe`、`1cb67d1`、`eff92ec`)

**病灶**:水合閘門的 refresh 族與 session 閘門的 refresher 都沒有「後出發者贏」的規則。兩支 store 層的 `refresh()` 重疊時,
依落地順序套用,先出發的較晚落地就蓋回較新的快照;`hydration-gate.test.ts` 甚至有一支測試釘住這個行為(在飛那份最後
落地、最後被套用)。後發優先只存在於單一頁面的 load-gate 實例內(run 世代),換一個頁面或由 store 呼叫就沒有。

- `d6b729b`(2026-10-11)是第一個真 bug:教練在工作台與訊息之間快速切換,離開時還在飛的那支對話列表重抓比再次進頁那支
  晚回來,蓋回舊列表與未讀數。修法是 `coach/conversations.ts` 手寫 `refreshSeq`,借頁面進場包的 `source.refresh` 注入自家
  的棄追判準。`docs/adr/0023` 寫「目前沒有已知 bug」,這正是它自己寫的重開條件。
- session refresher(點數、訂閱)只查 epoch。會員開啟結帳後很快付款時,開啟結帳那支 GET 比付款後那支晚落地,付款前的
  快照蓋回來,已持有的方案又變成計費行。
- 請假(`refreshLeaveRequests`)、ops(`refreshOps`)、本人帳號資料的 resync 也是沒有排序的 store 層 refresh。

**決定**:

- **規則**:`src/lib/hydration-gate.ts` 匯出 pure helper `createDepartureLedger()` → `{ depart(), overtaken(seq) }`。
  每支可能套用資料的 GET 出發時**同步**取號(`depart()`,單調遞增)。落地、確定要套用的那一刻問 `overtaken(seq)`:
  `seq` 小於已落地的水位就回 true,呼叫端**靜默返回**(不等、不重抓、不拋);否則把水位推到 `seq`、回 false,接著套用。
  同號不算超車。
- **取號者**:合併後的 hydrate GET(號碼記在 `inflight` 上,加入者共用一號)與 refresh 族全部——store `refresh()`、頁面
  `source.refresh`、世代重抓輪(每一次真正出發都重新取號,補抓那發才是這份快照的出發點)、和解、resync。
- **判定位置**:`refreshRun` 在 `fetchGenStable` 回來之後 `if (!live() || ledger.overtaken(seq)) return;`;`loadRun` 在
  `mutationWins` 之後獨立一行。`overtaken` 會推水位,所以只在其他判準都放行、下一行就要套用時才問;因 epoch、卸載或
  mutation 勝出而作廢的落地,以及 reject,都不問。
- **不變的部分**:世代軸(`docs/adr/0020`)與 `fetchGenStable` 不動;`write()`/`invalidate()`/`reset()` 不碰這本帳(號碼只增
  不減,重置之後出發的必然較新,重置前出發的落地已由 `resetEpoch` 作廢);`depart()` 是同步的,靜止時 refresh 同步出發的
  契約(`docs/adr/0021`)不變;等待軸仍然只有尾流。**三軸互相獨立**:世代軸管丟棄、尾流軸管等待、出發序帳只管誰的落地算數。
- **語意細節**:先出發的先落地照常套用,之後再被後出發的蓋過(不扣住)。後出發的 reject 時,先出發的照常套用,各 caller
  拿自己的結果。被超車的和解不 `invalidate()`,旗標維持 true。被超車的 resync 仍回報 resynced。`invalidate()` 之後才落地的
  舊 hydrate 不套用:旗標維持 false,下次 hydrate 重抓;頁面 load-gate 仍進 ready,store 裡已是較新的快照。
- **session refresher**:每個 refresher 一本帳,建在 `core` 旁邊。每次呼叫在 `opts.fetch()` 之前同步取 `epoch` 與 `seq`;
  落地後先查 epoch、再問 `overtaken`,兩種丟棄都是靜默 `return`(理由同 `docs/adr/0017`:`redeemReward`、`afterOrder` 會傳播
  rejection)。帳本不隨身分重置:換帳前出發的落地先被 epoch 擋下,碰不到帳。
- **教練對話列表**:`refreshSeq` 退役,`refreshConversationsIfHydrated` 變成「已水合才 `await gate.refresh()`」。
- **coding-standards**:`references/review.md` 的「Last-started wins」改成「交給閘門(出發序帳),不要手寫序號或自訂
  `isCurrent`」。

**否決:「被取代者等贏家落地」**。三個理由:

1. 它是第二條等待軸,`docs/adr/0021` 只許尾流一條。
2. 贏家所在的頁面卸載時(頁面的 `source.refresh` 隨 load-gate 棄追),等它的人會卡住。
3. 贏家 reject 時,等它的人只能跟著丟掉手上那份好的舊快照。

用水位線就沒有這些問題:被超車的那一刻,較新的快照**已經落地**。所以 `await refresh()` 的 caller(`redeemReward`、
`placeOrder` 的 `afterOrder`)即使自己那支被超車,拿到的仍是新鮮的 store;被超車的和解不呼叫 `invalidate()` 也是對的。

**測試**(`hydration-gate.test.ts` 先紅,describe「出發序帳(第六決策點,R21)」10 支):helper 本身;兩支 store `refresh()`
舊的後到;store `refresh()` 對頁面 `source.refresh`;refresh 先出發、hydrate 後出發且先落地;`invalidate()` 之後的舊 hydrate;
被超車的和解;被超車的 resync;先到的先套用再被蓋;後出發的 reject;世代重抓輪重新取號。原本釘「在飛那份照常套用」的世代
測試改寫為 fetch ×3、最後套用 `{v:2}`(世代意圖保留)。`session-gate.test.ts` +1:開啟結帳的 GET 在付款後那支之後才落地
→ resolve `undefined`、不重抓、store 停在付款後的快照。`conversations.test.ts` 刪「兩次重抓交錯」(閘門測試已涵蓋)。
兄弟測試已搜過:mobile-admin stores、leave、points、subscriptions、checkout-sync、rewards-api、CartSheet、PointsScreen、
`routes/member/points`、`routes/mobile/account` 都沒有釘「舊的後到會贏」。

### 3. 身分範圍 `SessionScope`:四個身分相依 layout 的守門、暖機與頁面壽命收進一處(`c37a055`)

**病灶**:member、mobile、coach、mobile-admin 四個 layout 各自手抄同一組反應式步驟:守門 → `goto`、暖機 key +
`warmStores(...)`、`{#key $lastSessionKey}<slot/>{/key}`,以及 mobile/mobile-admin 換人時 `overlay.closeAll()`。暖機 key 有
三種寫法(member/mobile 只看 `$sessionKey`;coach 與 mobile-admin 各自把 guard 再算一次,mobile-admin 另加教練分區條件)。`fd56535` 修 coach 在導走非教練之前
先替他打了 `GET /conversations/me`,修法是抄 mobile-admin 的規則;`7656e74` 的頁面壽命是一個 14 檔同步改的 commit;
`describePageLifetime` 是同一個行為對四份複本各測一次。

**決定**:

- 新元件 `src/lib/components/SessionScope.svelte`(舊語法 `$:`/`<slot/>`,跟 layout 一致)。props:`guard(url, auth) →
  導向目標 | null`、`caller`、`warm: WarmSet`(`store-warm.ts` 匯出這個型別,`warmStores` 本身不變)、`warmIn?(url)`(預設
  true;mobile-admin 傳「是否在教練分區」)、`overlay?`。
- 它負責四件事:guard 回傳目標就 `goto`(反應式);暖機准入 `warmKey = guard(…) === null && warmIn(url) ? $sessionKey : null`,
  有值才 `warmStores`(每個身分一次、A→B 重暖、登出與被導走的身分不暖);`{#key $lastSessionKey}<slot/>{/key}`;
  `$lastSessionKey` 非 null 時 `overlay?.closeAll()`。
- 四個 layout 只留自己的宣告與特有部分:`GUARD`、`WARM`(mobile-admin 另有 `IN_COACH_SECTION`)寫在
  `<script context="module">`;member 的結帳接收;各自的 `afterNavigate`;key 外面的外框(CheckoutDialog、TabBar 等)。
  member 的守門寫成 `wantsCheckout(url) ? null : memberGuardTarget(...)`,與原本「`?checkout=1` 時跳過守門、交給結帳接收」
  相同。
- root 與 admin layout 不動(`docs/adr/0028` §2)。閘門仍不得用 `lastSessionKey`(`docs/adr/0026` §6、`docs/adr/0028` §2)。
- **與 `docs/adr/0024`「明確不做」的核對**:它不是被否決的 registry(沒有 module-level 清單,import 沒有副作用),也不是
  新的身分 hook(不提供訂閱 API,只讀 `sessionKey` 與 `lastSessionKey`)。

**測試**:新 `SessionScope.test.ts` 14 支(先紅):guard ×2、暖機准入 `it.each` ×4、同身分只暖一次、A→B 重暖、登出不暖、
overlay ×2(A→B 關、登出不關)、頁面壽命 ×3。測試 helper `testing/page-lifetime.ts`:

- `describePageLifetime(name, Component, props?)` 多了 `props` 參數、拿掉唯一呼叫端只傳 `{}` 的 `baseRoutes`,**只在 `SessionScope.test` 跑一次**。
- 新的 `describeKeyedSlot(name, Layout, baseRoutes?)` 是**一支** A→B 重掛載情境,四個 layout 測試各跑一次,只證明該 layout
  把 slot 交給了身分範圍,不是把頁面壽命整組再跑四遍(計畫只寫了這個名字,沒寫它的意思,以此為準)。
- `layout-probe.fixture.svelte` 改收 `props`。render 時要寫 `render(LayoutProbe, { props: { Layout, props } })`:Testing Library
  會把頂層的 `props` 鍵當成 mount options。

各 layout 測試 38 → 24:刪掉 shell 行為的重複(每個 layout 的「未登入零次」與頁面壽命 ×3;coach 另刪「A 換 B 共 2 次」與
「layout 暖機與頁面同時 hydrate 合併」),留下守門、結帳接收、一次暖機 GET、coach 的非教練零次、mobile-admin 兩個分區、
overlay A→B,以及 `describeKeyedSlot`。

### 4. 登入狀態核心 `src/lib/stores/login-state.ts`(`62209be`)

**病灶**:`docs/adr/0027` §1 的標題是「登入狀態收成一個 module」,GLOSSARY 也說 `authStore.ts` 是單一 owner,但拒絕表、
compare-and-set/clear 與 401 重送規則住在 `client.ts`。兩半靠三支 callback hook 接線(`onSessionExpired`、`onSessionRefreshed`、
`bindSessionIdentity`),每支都只有 `authStore` 一個註冊者;兩個 module 都會寫 token 對;「session 是不是在我底下換了」有三種
問法(refresh token 相等、`issuedBy` 身分、`authStore` 的世代);跨分頁路徑在兩個 module 之間來回跳。2026-10-03..05 有
10 個 `fix(auth)` commit,其中 `e0841a5`、`25549d7` 同時改了兩個 module 與兩份測試;`client.test.ts` 還手寫了一個假 `authStore`。

**決定**:

- **核心擁有**:`AuthState` writable 與 `dreamfly_auth` 快取;`sessionIdentity`、`toMember`、`ApiUser`;session 世代;refresh
  單飛 + Web Lock + 拒絕表 + compare-and-set/clear(從 `client.ts` 原樣搬來);compare-and-set 成功、而 refresh 回的 `user` 是
  別人時同一拍換身分;唯一的清除點直接設 `LOGGED_OUT`;`hydrateSession` 與跨分頁 `storage` listener。
- **給 `client.ts` 的介面**:`accessToken()`、`currentIdentity()`、`refreshFor(issuedBy)`。「只替發出請求的身分重送」搬進
  核心:發出後身分已變、或 refresh 換出了別人,`refreshFor` 都回 false,`api()` 丟 `ApiError(401)`。
- **給 `authStore.ts` 的介面**:`loginState`、`startSession(res)`(原 `authStore` 私有的 `applySession`)、`endSession()`
  (回傳被丟掉的 refresh token,給 best-effort revoke)、`hydrateSession(fetchMe)`、`watchOtherTabs(fetchMe)`、`syncUser`。
  `fetchMe = () => api('/users/me')` 是 transport port,既有的 client mock 照樣攔得到。
- **依賴**:核心只 import `svelte/store`、`api/tokens`、新的 `api/base-url`(`apiUrl(path)`,從 client 拆出來避免循環)、
  `api/wire` 與型別;不 import client,也不 import `authStore`。`tokens.ts` 留著,當核心私有的儲存 adapter。
- **import-scan 契約 +1**:production 中 import `api/tokens` 的只能是 `stores/login-state.ts`;核心不得 import client 或
  `authStore`。兩條斷言都做過 mutation 檢查(改壞即紅)。
- **刪除**:`refreshTokens`、`onSessionExpired`、`onSessionRefreshed`、`bindSessionIdentity`。`authStore.ts` 退成門面,匯出面
  完全不變(`sessionIdentity`/`toMember`/`ApiUser`/`AuthState` 以原名轉出),所以沒有任何 importer 或 mock 要改。

**與既有 ADR 的關係**:這完成 `docs/adr/0027` §1。`docs/adr/0028` §1 的兩支 hook 以相同語意退役:compare-and-set 成功時
「id 不同就 `beginSession` + 換 user」原本由 `onSessionRefreshed` 回呼 `authStore` 做,現在在核心的同一個函式裡做;
`bindSessionIdentity` 提供的身分讀法變成核心的 `currentIdentity()`。`docs/adr/0007` R13/R16 增補(「`ApiUser` 倉內只有
authStore 一個宣告處」)與 `docs/adr/0026` R17 增補(「`sessionIdentity()` 搬到 `authStore.ts`」)說的宣告處現在是核心,
`authStore` 以原名轉出,import 路徑不變,所以這兩篇不另補增補。

**測試**:新 `login-state.test.ts` 先紅。從 `client.test.ts` 搬來 16 個 `it`(17 個案例):refresh 族 7 個 `it`(含 408/429 的
`it.each`,共 8 案例)、Web Locks 8 個(含兩分頁)、「只有 compare-and-set 成功才換身分」1 個。計畫寫的是 15 個(refresh ×6),
實際 refresh 族有 7 個,全部搬過來,沒有刪。搬來的測試改用 `startSession` 布置;原本的 `expired` spy 改成斷言 `LOGGED_OUT`
(沒發訊號的案例改斷言仍登入)。`client.test.ts` 留 12 個 `api()` + 2 個身分測試,改由真的 `startSession` 驅動,手寫的假
`authStore` 刪除。`authStore.test.ts` 48 個只改名稱(`(onSessionExpired)` → `(refresh rejected)`、`applySession` →
`startSession`),當作「行為不變」的驗收。

## 明確不做的事(供未來止步)

- **教練對話串與對話列表合併**:`docs/adr/0029` 已決定不做;重開的理由只有 `7730ff5` 一個 bug,而它正是 0029 的起因。
- **顯示查表改成進站時正規化**:`docs/adr/0013` R19/R20 選了顯示端的「任何字串都能查」函式;本輪只補漏網三處。
- **`StatusBadge` 的 `as` 轉型**:兩處索引的值都由布林推導,目前安全。
- **revisit 時的 revalidation**(先顯示快取、背景重抓一次)收進閘門:仍由呼叫端組裝;本輪只收「誰的落地算數」。
- **扣住先落地的舊快照不顯示**:本輪是先顯示、再被蓋。扣住就得知道之後會不會有更晚出發的落地,等於「等贏家」(§2 否決)。
- **root 與 admin layout 改用身分範圍**:`docs/adr/0028` §2 的界線不變。
- **衍生的 `sessionIdentity` store**:`docs/adr/0026` §6、`docs/adr/0027` 的決定不變。
- **refresh key 一變就重新水合**:`docs/adr/0027` §1 的決定不變(分頁會互相觸發 refresh,永不停止)。
- **refresh 之後不打 `/users/me`**:水合序列不動;§4 只搬家,行為不變。
- **把 token 儲存 adapter 併進核心**:`tokens.ts` 留作核心私有的 adapter,由 import-scan 契約守住。
- **任何後端變更與 wire 型別變更**:後端那一輪(`dream_fly_backend#23`)不改 DTO 形狀,不需要 `wire:sync`。

## 可見的行為變更(逐條)

1. **查表遇到原型鍵時顯示原字串**:報表分桶(桌面與 mobile-admin,另配中性色)、付款方式圖例、公開課表的時段狀態,
   不再顯示函式原始碼或空標籤(§1)。
2. **先出發的舊快照較晚落地,不再蓋掉較新的**:請假、ops(mobile-admin)、教練對話列表、本人帳號資料、點數、訂閱。開啟
   結帳後很快付款,已持有的方案不再變回計費行(§2)。
3. **先出發的先落地時仍先顯示**,之後被較新的蓋過;慢網路下不用乾等(§2)。
4. **`invalidate()` 之後才落地的舊 hydrate 不套用**,旗標維持 false,下次 hydrate 會再打一次 GET(§2)。
5. §3、§4 wire 等價:守門、暖機次數、頁面壽命、跨分頁同步與 401 重送都與改前相同。

## 已知、刻意遞延

- **剩下的 `表[鍵] ?? 後備`,鍵都不是後端字串**:`reports-api.ts` 的 `WEEKDAY_LABEL[w.weekday]`(數字陣列索引)、`CoachTag` 的
  `TONE_STYLE[tone]`、`IconButton`/`Avatar` 的 `SIZES[size]`/`STATUS[status]`(型別化 props)、member `+layout.svelte` 的
  `TITLES[pathname]`(pathname 以 `/` 開頭)。
- **refresh 200 但 body 沒有 `user`**:核心讀 `outcome.user.id`,會在已寫入輪替後的 token 之後丟 `TypeError`(以前是
  `onSessionRefreshed` 帶 `undefined` 進 `authStore`,見 `docs/adr/0028` 已知遞延)。後端契約保證 `AuthResponse.user` 必有,
  仍不加防護;測試裡沒有 `user` 的 `/auth/refresh` stub 現在會拋出。
- **session refresher「先查 epoch、再問 `overtaken`」的順序沒有專屬測試**:從公開介面觀察不到(換身分之後出發的號碼一定
  比舊的大,舊落地即使推了水位也擋不到有效的那支),只是契約衛生。既有「在飛換帳靜默丟棄」測試照綠。
- **overlay 的反向案例只補了一半**:登出不關已由 `SessionScope.test` 釘住;同身分再設一次不關仍沒有釘(`docs/adr/0028` 已知遞延)。
- **計畫裡的手動驗收沒有在本輪跑**(Slow 3G 下的結帳付款、教練工作台⇄訊息、`MyCourseDetail` 重開、mobile-admin 連存兩次;
  各 surface 登出導頁、暖機次數、另一分頁換帳號、`?checkout=1`;兩分頁登入/登出同步):需要後端 server,而 dev DB 不得用來跑。

## ADR 點名的測試:搬家/刪除(舊 → 新)

| ADR | 舊位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `0027` §1(跟隨分頁 POST 剛好一次、兩分頁競態、在飛期間被換掉不清、暫時性錯誤含 408/429 不清、401 清且發一次訊號、成功的舊輪替結果被丟棄) | `api/client.test.ts`「refreshTokens()」與「refreshTokens() cross-tab exclusivity (Web Locks)」 | 呼叫 `refreshTokens()`,以 `expired` spy 斷言有沒有發訊號 | 搬到 `stores/login-state.test.ts`「refreshFor() — refresh single-flight」與「refreshFor() cross-tab exclusivity (Web Locks)」,經 `refreshFor()` 驅動;「發訊號」改斷言 `LOGGED_OUT`,「不發訊號」改斷言仍登入 |
| `0028` §1「`onSessionRefreshed` 只在 CAS 成功時觸發並帶後端回的 `user`」 | `api/client.test.ts` | hook spy | `stores/login-state.test.ts`「只有 compare-and-set 成功才換身分」:斷言換成後端回的 user;CAS 失敗、拒絕、不可用都不換 |
| `0028` §1 兩支 401 重送(refresh 換出 B → `ApiError(401)`;401 落地前身分已變 → 不 refresh) | `api/client.test.ts` | 手寫假 `authStore`(`identity` 變數 + `refreshed` spy)驅動 | 原地保留,改由真的 `startSession` 驅動 |
| `0028` §1 `authStore.test.ts` 的換身分測試 | `stores/authStore.test.ts` | — | 原地不動,只改名稱(48 個) |
| `0028` §2 `describePageLifetime(name, Layout, baseRoutes?)` | 四個 `routes/*/layout.test.ts` 各跑三個情境(共 12 支) | 對四份複本各測一次 | `components/SessionScope.test.ts` 跑一次三個情境;四個 layout 改跑 `describeKeyedSlot`(各 1 支 A→B) |
| `0029` §1 coach layout「與頁面同時 hydrate 仍 1 次」 | `routes/coach/layout.test.ts` | layout 層 | 刪;合併由 `coach/conversations.test.ts:113`、`:131` 釘住 |
| `0029` §1 coach layout「登出 0 次」「A 換 B 共 2 次」 | `routes/coach/layout.test.ts` | layout 層 | 刪;暖機准入(未登入、登出不暖、A→B 重暖)在 `SessionScope.test.ts` 驗一次 |

沒有被 ADR 點名、一併刪除或改寫的釘:member/mobile/mobile-admin 三個 layout 的「未登入零次(守門導走)」(`SessionScope.test`
的暖機准入涵蓋);`coach/conversations.test.ts`「兩次重抓交錯」(`d6b729b` 加的,閘門的出發序帳測試涵蓋);
`hydration-gate.test.ts`「mutation 世代只有 write() 推進」的斷言由最後套用 `{v:1}` 改為 `{v:2}`(fetch ×3,世代意圖不變)。

## 關聯 ADR

- **`docs/adr/0006`**:R17/R18 增補裡 `client.ts` 的 `performRefresh()`、`onSessionExpired`/`onSessionRefreshed` 與 `authStore`
  的 `storage` listener 改住核心(§4,增補)。
- **`docs/adr/0009`**:§4「零外部依賴」多一個例外 `lookupOr`(§1,增補)。
- **`docs/adr/0016`**:R13 增補「後發優先只有 load-gate 路徑才有」不再成立(§2,增補)。
- **`docs/adr/0017`**:refresher「只加兩件事」多了後發優先;R17/R18 增補的 `onSessionExpired` 與四個 layout `{#key}` 改由核心
  與身分範圍承擔(§2–§4,增補)。
- **`docs/adr/0020`**:否決紀錄「丟棄之後必須補抓」只對世代軸成立(§2,增補)。世代軸本身不動。
- **`docs/adr/0021`**:等待軸仍只有尾流;「等贏家」因此被否決(§2,不動)。
- **`docs/adr/0023`**:「明確不做」候選 07 的第 2 項保護與「目前沒有已知 bug」(§2,增補)。
- **`docs/adr/0024`**:§4 暖機清單的呼叫點改在身分範圍;「不做 registry」「不加身分 hook」仍成立(§3,增補)。
- **`docs/adr/0026`** R17 增補、**`0007`** R13/R16 增補:`sessionIdentity`/`ApiUser` 的宣告處改在核心,`authStore` 原名轉出(§4,不另增補)。
- **`docs/adr/0027`**:§1 由核心完成(§4,增補)。
- **`docs/adr/0028`**:§1 的 hook 退役、§2 的 `{#key}` 與測試 helper 改住身分範圍、兩條已知遞延的現況(§3、§4,增補)。
- **`docs/adr/0029`**:§1 點名的 coach layout 測試搬家(§3,增補)。
- **`docs/adr/0013`** R20 增補:總查表原語(§1 補完漏網,不另增補)。
