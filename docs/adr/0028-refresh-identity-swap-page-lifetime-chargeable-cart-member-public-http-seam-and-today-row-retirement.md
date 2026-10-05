# refresh 換主同拍換身分、頁面壽命 = 登入身分、可計費購物車單一衍生、member/mobile/public HTTP seam 結案、退役 `TodayRow`

> Status: Accepted(§1–§5)。源自 2026-10-05 架構深化工程 Round 18(前端部分)。base `8312b46`;
> W1 `25549d7`(refresh 換主、401 重送規則)、W2 `7656e74`(`lastSessionKey`、四個 layout `{#key}`)、W3
> `7754536`+`463d338`(`chargeableCart`、訂閱暖機收進根 layout)、W5 `925cc38`(退役 `TodayRow`)、W4
> `24f7d65`..`d076f1f`(public/member/mobile 頁面測試走 HTTP seam,其中 `aaabc12` 修週課表星期索引、`7bb2e50`
> 修剪 `MEMBER_ROUTES`、`8c6d9d6` import-scan 契約擴充)、D0–D2(本篇、各 ADR 增補、CONTEXT/architecture 同步)。

R18 沿 `docs/adr/0018`/`0019`/`0022`–`0027`「一輪多案、單篇記錄」的體例,不新開架構類別。共同目標仍是
locality:「token 屬於誰、畫面就是誰」「頁面活多久」「購物車哪幾行要收錢」「頁面測試經過哪條 seam」「今日課表
的列型別」各自只住一處。本輪修掉的真 bug:換登空檔裡 A 畫面的寫入被 401 重試以 B 的憑證送出、換人後頁面沿用
A 的資料、mobile 週課表週一的課消失且其餘錯一天(同天兩堂課整頁炸掉)。本篇依序記錄五項決定、明確**不做**的事、
可見的行為變更、刻意遞延的已知項,以及被取代的舊 ADR 句子。被既有 ADR 點名的地方,各篇已補 2026-10-05 的
dated 增補指回本篇;`CONTEXT.md` 與 `docs/architecture.md` 直接改成現況。

測試總數收尾為 241 檔、2578 passed | 2 skipped。

## 背景與決定

### 1. refresh 換出別人的憑證時畫面同拍換身分;401 只替發出當下的身分重送(W1,`25549d7`)

**病灶**:R17(`docs/adr/0027` §1)讓別的分頁換登時,本分頁靠 `storage` 事件追上。但事件到達之前有一段
空檔:本分頁某個請求先遇到 401,`api()` 走 refresh,讀到的是**共用 storage 裡 B 的** refresh token,換回 B 的
access token,再用它重送 A 畫面發出的請求——A 的寫入默默落在 B 的帳號上。refresh 的回應本來就帶 `user`,
`exchangeRefreshToken()` 卻把它丟掉,`authStore` 只能等 `/users/me` 才知道 token 屬於誰;畫面因此有一段
「token 是 B、畫面是 A」的時間。

**決定**:

- **`exchangeRefreshToken()` 保留 `user`**:`RotatedPair = Pick<AuthResponse, 'access_token' | 'refresh_token' | 'user'>`。
- **`onSessionRefreshed(user)` 訊號**:`performRefresh()` 在 compare-and-set 成功、`setTokens` 之後**同步**呼叫;
  別處都不發(拒絕、不可用、CAS 失敗皆不發)。
- **`authStore` 收訊號**:`user.id` 與目前 `sessionIdentity()` 不同就 `beginSession(); applyUser(user)`——世代 +1、
  同一拍換畫面身分,守門、session 閘門重置都走既有的身分改變那條邊。同一人只是輪替,不動。
- **`bindSessionIdentity(fn)`**:`client.ts` 不 import `authStore`(會成環),由 `authStore` 註冊讀法;未註冊時
  恆回 `null`。
- **`api()` 的 401 重送規則**:發請求前記下 `issuedBy = currentIdentity()`。遇 401 時,身分已變就**不 refresh**、
  直接丟 `ApiError(401)`;refresh 之後身分變了(refresh 換出了別人)也丟 `ApiError(401)`,不重送。只有 refresh 前後
  身分都等於 `issuedBy` 才用新 token 重送一次。

**附帶效果**:跨分頁 listener 的「水合後仍不是事件當下的身分 → 登出」收尾,在「refresh 成功但 `/users/me` 失敗」
這條路上不再觸發——refresh 一落地身分就已經是 B(`onSessionRefreshed` 推進世代,`hydrate()` 的收尾因世代不符
直接返回)。這條收尾現在只剩「refresh 暫時不可用」會走到:listener 只在 `hydrateSession()` 回報 refresh 失敗時
才比對快照登出——refresh 成功即伺服器已確認身分,別的分頁遲到寫回的舊身分快照不得把它登出(codex 審查)。

**測試**:`client.test.ts`(refresh 換出 B、請求是 A 發的 → `ApiError(401)`,從不帶 B 的 Bearer 重送;401 落地前
身分已變 → 不 refresh、只有 1 次 fetch;`onSessionRefreshed` 只在 CAS 成功時觸發並帶後端回的 `user`)、
`authStore.test.ts`(換成 B 時 refresh 一落地就是 B、不等 `/users/me`;換成 B 而 `/users/me` 失敗 → 停在 B;換登空檔
A 畫面的 PATCH 遇 401 → `ApiError(401)`;storage 已是 B 的 refresh token、沒收到 `storage` 事件時遇 401 → 最後是 B)。

### 2. 頁面壽命 = 登入身分:`lastSessionKey` 與四個 layout 的 `{#key}`(W2,`7656e74`)

**病灶**:session 閘門換人會重置共享 store,但頁面元件自己的 `let data`(load-gate 的結果、表單草稿、本地
狀態)不屬於任何閘門。A→B 不經整頁重載時,頁面不重掛載,畫面繼續顯示 A 的資料,直到使用者自己離開那頁。

**決定**:

- `authStore.ts` 新增 `lastLoggedIn(key)`:對 `key` 的 derived,**`null` 時不通知**,保留上一個身分;
  `lastSessionKey = lastLoggedIn(sessionKey)`。第一次有身分之後永不再發出 `null`。
- member / mobile / coach / mobile-admin 四個身分相依 layout 以 `{#key $lastSessionKey}<slot />{/key}` 包住 slot:
  A→B、null→A 重掛載(頁面以新身分重抓,舊頁面的 load-gate 隨 `destroy()` 丟掉遲到回應);A→null **不**重掛載。
  登出是先 `logout()` 再 `goto()`,若登出就重掛載,頁面會在導頁前以沒有 token 的狀態再讀一次——導頁交給 guard。
- mobile 與 mobile-admin 的 overlay 在 slot 外面,也會讀個人資料:`$lastSessionKey !== null` 變化時
  `overlay.closeAll()`。
- admin layout 不動(只有 staff 單一身分語境,沒有會員資料頁)。
- **閘門不得用 `lastSessionKey`**:它刻意吞掉登出,閘門必須在登出時重置;身分 key 仍是 `sessionIdentity()` /
  `sessionKey`(`docs/adr/0026` §6 的決定不變)。
- 測試 helper `src/lib/testing/page-lifetime.ts` 的 `describePageLifetime(name, Layout, baseRoutes?)`:四個 layout
  共用同一組情境(A→B 以 B 重抓且 A 遲到的回應不顯示;同身分再設一次只讀 1 次;登出不重掛載)。

### 3. 可計費購物車單一衍生;訂閱暖機收進根 layout 的行銷外殼(W3,`7754536`、`463d338`)

**病灶**:R17 FE-5(`docs/adr/0027` §3)讓購物車頁、`CartDropdown` 與 `createCheckout` 都經 `chargeableLines`,
但三處各自再寫一次 `chargeableLines($cart, $subscriptions)` → `Set` → `subtotalOf` 的推導;訂閱暖機也分兩處觸發
(購物車頁以身分為 key、下拉在每次打開時)。

**決定**:

- `member/checkout-sync.ts` 匯出 `chargeableCart(cart)` → `{ lines, billable, total }`(三個 derived store,`lines` 是
  `chargeableLines` 的結果,`billable` 是它的 `Set`,`total` 是 `subtotalOf`);購物車頁、`CartDropdown` 與
  `createCheckout` 共用,預覽合計 ≡ 實際請款。`member/stores.ts` 轉出。
- 根 `+layout.svelte` 在**行銷外殼**(非 app surface)以 `$sessionKey` 為 key 呼叫
  `warmStores('root +layout', [['訂閱', refreshSubscriptions]])`;購物車頁與下拉不再自己觸發。app surface 自帶 layout,
  不在此暖。
- 結帳結算仍由各 surface 自己做(`docs/adr/0003`、`docs/adr/0025` F-5),本節只動預覽與暖機。

### 4. member / mobile / public 的 HTTP seam 遞延重開並結案(W4,`24f7d65`..`d076f1f`)

**病灶**:`docs/adr/0026`「明確不做」與「已知遞延」、`docs/adr/0027` 已知遞延都把 member/mobile/public 留在
「頁面測試整支 mock 各自的 api 模組」。這等於跳過真 mapper,mapper 與畫面之間的約定在測試裡看不到。
**證據**(`aaabc12`):member/api 的 mapper 給 `day` 0=週一…6=週日,但 mobile `ScheduleScreen` 篩 `1..7`、
`mobile/mine` 用 `WEEK[s.day - 1]` 且以 `s.day` 當 each key——週一的課消失、其餘錯一天、同天兩堂課觸發
`each_key_duplicate` 整頁炸掉。mock getter 的測試直接餵 1..7 的假資料,所以一直是綠的;改走 HTTP seam 後立刻紅。

**決定**:

- public / member / mobile 的頁面與 api 測試一律 `vi.mock('$lib/api/client')` + `fakeRouter`(重用既有 router,
  沒有第二個),斷言 HTTP 路徑、方法與 body。
- 新增 `src/lib/testing/member-routes.ts` 的 `MEMBER_ROUTES`,`7bb2e50` 修剪到只剩真的有測試靠預設值的
  `GET /enrolments/me`、`GET /reports/me`;其餘端點由各測試自己交代,沒交代就讓 `fakeRouter` 丟錯。
- `wire-fixtures.ts` 新增 `myScheduleEntry`/`myEnrolment`/`memberReport`/`reportCard`/`certificate`/
  `attendanceEntry`/`rewardResponse` builders。
- `import-scan.test.ts` 的 SEAMS 加 `member: ['$lib/member/api', '$lib/mobile/api']` 與
  `public: ['$lib/public/api']`,禁 mock 的形式與 coach/admin 相同(automock、零參數 factory、`importOriginal`
  部分替換、`vi.doMock`、解析後落在 seam 的相對路徑),並附正反自證 fixture(例如 `src/lib/mobile-admin` 下的
  `vi.mock('./api')` 不算 member)。
- **沒有 `PUBLIC_ROUTES`**:每支 public getter 只打一個端點,各測試自己交代就夠。
- 週課表修正:`ScheduleScreen` 篩 `0..6`、`WEEK[d]`;`mobile/mine` 的 `today = (getDay() + 6) % 7`、`WEEK[s.day]`、
  each key 改用 index;`ScheduleBlock.day` 的型別註解改為 `0=Mon … 6=Sun`。

### 5. 退役 mobile-admin `TodayRow` 與兩支轉抄 mapper(W5,`925cc38`)

**病灶**:mobile-admin 的 `TodayRow` 是桌面 `TodayClass` 的又一份宣告,`mapAdminTodayRow` 逐欄轉抄桌面已算好的
欄位、`mapTodayClassToRow` 重新查一次 `SESSION_STATUS`;`taken` 欄位沒有任何真實訊號,恆為 `undefined`。

**決定**:`TodayRow`、`mapTodayClassToRow`、`mapAdminTodayRow` 刪除。`getAdminHome().today` 直接是 admin 的
`TodayClass[]`(`$lib/admin/data`),`getCoachHome().coachToday` 直接是 coach 的 `TodayClass[]`(以
`CoachTodayClass` alias import);頁面讀 `t.start`(coach)/`t.tone`(admin,刪掉 `as Tone`)。mobile-admin 不再
直接消費 `SESSION_STATUS`(`docs/adr/0013` 增補)。admin 與 coach 的 `TodayClass` **維持兩個型別**
(`docs/adr/0022`/`0023`)。

## 明確不做的事(供未來止步)

- **在 `pageEntry` / load-gate 處理身分**:改成四個 layout 的 `{#key}`——頁面本地狀態不全經過 load-gate,而且
  每個頁面各自處理會散成幾十處。
- **直接以 `$sessionKey` 當 `{#key}`**:登出時會在 `goto()` 之前先重掛載,頁面以沒有 token 的狀態再讀一次。
- **合併 admin/coach 的 `TodayClass`**:`docs/adr/0022`/`0023` 決定兩者各自獨立,本輪不重開。
- **`PUBLIC_ROUTES`**:見 §4。

## 可見的行為變更(逐條)

1. **換登空檔裡 A 畫面的寫入變成 401 錯誤訊息**,不再默默寫進 B 的帳號(W1)。
2. **別的分頁換成 B、本分頁 refresh 成功但 `/users/me` 失敗**:停在 B,不再登出(W1)。
3. **重載時有 refresh token 但沒有 `dreamfly_auth` 快取**:`hydrate()` 自己的 `/users/me` 結果因世代已被 refresh
   推進而丟棄,身分來自 refresh 回的 `user`——最終狀態相同,只是多打的那次 `/users/me` 不再套用(W1)。
4. **A→B 不經整頁重載**:member/mobile/coach/mobile-admin 的頁面重掛載、以 B 重抓;mobile/mobile-admin 開著的
   overlay 關閉。登出不重掛載(W2)。
5. **購物車下拉每次打開不再重抓訂閱**;從 `/member` 等 app 介面回到行銷外殼會再打一次 `GET /subscriptions/me`(W3)。
6. **mobile 週課表**:週一的課出現、其餘不再錯一天、同天兩堂課不再炸頁(W4,`aaabc12`)。

其餘改動 wire 等價(mobile-admin 教練首頁的「已點名」徽章分支本來就走不到,刪除後畫面不變)。

## 已知、刻意遞延

- **refresh 200 但 body 沒有 `user`**:`onSessionRefreshed` 會帶 `undefined` 進 `authStore`,沒有防護;後端契約保證
  `AuthResponse.user` 必有(W1)。
- **overlay 的反向案例沒有測試**:同身分再設一次、登出時 overlay 不關,目前沒有釘(W2)。
- **`src/lib/domain/status-lookups.test.ts:20-21` 註解仍提到 `mapTodayClassToRow()`/`TodayRow`**:純註解,已退役(W5)。
- **從 app 介面回行銷外殼會多一次訂閱 GET**:根 layout 的暖機 key 隨 `isAppSurface` 重算;可接受(W3)。

## 被取代的 ADR 句子(舊 → 新)

被取代的是**歷史敘述**,各篇原文不改寫;以下列表加上各篇的 R18 增補為準。`CONTEXT.md`、
`docs/architecture.md` 已直接改成現況,不在表內。

| ADR(位置) | 舊句子 | 現況 |
| --- | --- | --- |
| `0006` R17 增補(:286-287)、`0027` :44-46 | 水合後身分仍不是快取那位(例如 refresh 成功但 `/users/me` 失敗)就登出 | refresh 成功時 `onSessionRefreshed` 已同拍換成 B,`/users/me` 失敗也停在 B;這條收尾只剩 refresh 不可用時會走到(§1) |
| `0027` :50 | session 世代在登入、登出、過期、跨分頁登出/換身分時 +1 | 另加:refresh 換出別人的憑證時 +1(`beginSession`) |
| `0027` :58 | 測試「換成 B 但 `/users/me` 失敗 → `LOGGED_OUT`」 | 改為 → 停在 B(§1) |
| `0006` §1(:28-29) | 401 觸發 single-flight refresh,「成功後全部重放」 | 只有 refresh 前後畫面身分都等於發出當下的身分才重送,否則 `ApiError(401)`(§1) |
| `0027` :89-91 | best-effort `refreshSubscriptions()`(下拉:開啟且已登入時;購物車頁:`onMount`) | 根 layout 行銷外殼以 `$sessionKey` 為 key 暖一次;總額經 `chargeableCart`(§3) |
| `0013` :33、R13 增補 §2 | mobile-admin 是 `SESSION_STATUS` 的第三個消費端(`mapTodayClassToRow`) | mobile-admin 直接沿用 admin/coach 的 `TodayClass`,不再消費(§5) |
| `0026` :177-178、:216;`0027` :346 | member/mobile/public 頁面測試仍 mock 各自的 api 模組 | 走 HTTP seam,import-scan 契約禁 mock(§4) |

## 關聯 ADR

- **`docs/adr/0006`**:refresh 換主同拍換身分、401 重送規則(增補)。
- **`docs/adr/0013`**:mobile-admin 不再消費 `SESSION_STATUS`(增補)。
- **`docs/adr/0017`**:通知頁殘窗之外,頁面本身隨身分重掛載(增補)。
- **`docs/adr/0025`**:§5 列型別單源延伸到今日課表(增補)。
- **`docs/adr/0026`**:member/mobile/public HTTP seam 遞延結案;§6 與 `lastSessionKey` 的界線(增補)。
- **`docs/adr/0027`**:§1 的延伸、:346 遞延結案(增補)。
- **`docs/adr/0003`**、**`0025`** F-5:結帳結算仍由各 surface 自己做(§3,不動)。
- **`docs/adr/0022`**、**`0023`**:admin/coach `TodayClass` 各自獨立(§5,不動)。
