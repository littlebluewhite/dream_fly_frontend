# 會員資料 module、逐 entity 寫入 module、訂單狀態變更 module 與 R13 其餘加深

> Status: Accepted。源自 2026-09-26 架構深化工程 Round 13(架構審查候選 01–07 + 同輪確認的小 bug,
> 2026-09-26 落地)。base `157a70d`;Task 1 `e4598aa`、Task 2 `1053b00`、Task 3 `2f9a2f7`(T0 前置)
> + `987d1e7`、Task 4 `f3ceaaa`、Task 5 `ebed995`、Task 6 `17ccf00`、Task 7 `38edd3c`。
> 使用者於同日定案兩項裁決:**D1**(會員改姓名/電話接真後端)、**D2**(後端沒有的欄位一律拿掉輸入)。

R13 沿 `docs/adr/0018`/`0019`/`0022`「一輪多案、單篇記錄」的體例,不新開架構類別。共同目標仍是
locality:「會員本人的資料」「一個 entity 的寫入規則」「訂單狀態碼的意思」「今日場次的 wire 形狀」
「教練是誰」這幾類知識各自只住一處,並順手修掉審查確認的 bug(每個都附回歸測試)。本篇依序記錄
六項決定與兩項裁決、明確**不做**的事與理由、可見的行為變更,以及刻意遞延的已知項。被既有 ADR
點名的地方,各篇已補 2026-09-26 的 dated 增補指回本篇。

設計階段對審查原文有四處更正,記在這裡以免日後重提:

- 「未知 level 被改寫成 intermediate」不成立:後端 `level` 是 PG enum,`?? '基礎'` 走不到,不動。
- 候選 07 方向反了,不改碼,只記結論(見「明確不做」)。
- 課程年齡編輯是真 bug:後端 `update_course` 以 `req.min_age.unwrap_or(existing.min_age)` 合併
  舊的上下限,「8–14 歲」改成「12 歲以上」實際存成 12–14。歸到 C2 修。
- mobile-admin `messagesGate` 換帳號不重置,第二個教練會看到前一個教練的對話列表。歸到 C6 修。

## 背景與決定

### 1. D1、D2 — 兩項使用者裁決

- **D1**:會員改姓名/電話接真後端。`PATCH /users/me` 本來就收 `name`(2–100 字)與 `phone`
  (8–20 字);`docs/adr/0006` 殘餘表「無可寫後端欄位」的描述已過時。
- **D2**:後端沒有的欄位一律**拿掉輸入**,不假裝能存。涉及:會員編號、家長聯絡人、頭像顏色、
  課程的場地/本期期別/本期堂數。課程的招生狀態由後端按人數推導,改成唯讀顯示。

### 2. 候選 C1 — 會員資料 module `src/lib/member/profile.ts`(Task 3)

**病灶**:會員本人的資料有三個住所——mock 種子 `ME`(真會員一登入就看到「王承恩」)、
`member/api.ts` 的 `mapProfile`/`saveBirthDate`,以及 mobile 的本地 `profile`/`prefs` store 加
`pref-sync.ts`。三個已確認的 bug 由此而來:假身分、把假電話預填進 `POST /contact`、偏好在水合前
切換會被遲到的 GET 整包蓋回。prefs/profile 也跨登入存活。

**前置(T0,`2f9a2f7`)**:`authStore.syncUser(user)` 只在 `loggedIn && member.id === user.id` 時以
`toMember(user)` 更新 `member`(`dreamfly_auth` 快取經既有訂閱跟上)。identity key 不變,所以不會
觸發任何 session 閘門重置。C6 也用它。

**決定**:新增 `src/lib/member/profile.ts`,經 `$lib/member/stores` barrel 轉出,mobile 再經
`mobile/stores.ts` 轉出(foundation-contracts 的 `ALLOWED` 不變)。

- **interface**:`memberProfile`(`Readable<MemberProfile | null>`,`{name, initial, email, phone,
  birth, since}`)、`prefs`、`hydrateProfile()`、`setPref(k, v)` → `saved | resynced | rolledBack`、
  `saveProfile(edit)` → `saved | failed{error}`,外加純函式 `profileEditError(edit, current)`(兩個
  編輯表單即時顯示原因並停用按鈕,`saveProfile` 內部也再擋一次,規則只住一處)。
- **閘門**:`createSessionGate<ApiMe>`(`ApiMe` = authStore 的 `ApiUser` + `preferences` +
  `birth_date`)。每個 identity 水合一次,換帳號/登出即重置;`apply` 呼叫 `authStore.syncUser`。
  `hydrateProfile()` 自帶 `inflight` 合併,同一 identity 下併發呼叫共用一支在飛的 GET。
- **單一寫入鏈**:所有 PATCH 排同一條鏈。每一筆輪到時:session 變了就跳過 → `await
  hydrateProfile()`(「寫前先水合」由結構保證,不再是呼叫端義務)→ `gate.mutate(PATCH, …)`。
- **`preferences` 送出 = 後端原始物件 + 本地 4 鍵**。後端對 `preferences` 整包覆寫,這樣前端不認識的
  鍵也保得住。
- **`setPref`** 先樂觀更新;切換若發生在水合落地之前,水合 apply 之後把這次切換補回去(回歸修正)。
  失敗先整包 resync(`resynced`),resync 也失敗才單鍵回滾(`rolledBack`)。寫回只同步 me 與名字,
  不覆蓋 prefs,以免吃掉同時排隊中的切換。語意移植自已退役的 `pref-sync.ts`。
- **`saveProfile`** 不做樂觀更新;由 module 對目前值做 diff、只送改過的欄位,沒有改動就不發請求;
  `birth` 為 `''` 送 `null`;偏好有改時送整包。表單規則照後端:姓名 2–100、電話 8–20。後端
  `update_profile` 沒有清空電話的路徑,所以原本有電話的人不能留白。
- **消費端**:桌面 `getAccount()` 只回 `{orders, ordersTotal}`,並 `Promise.all` 等
  `hydrateProfile()`(fail-hard);帳戶頁讀 `$memberProfile`;`ProfileEditDialog` props 定型,
  「課前提醒/活動與優惠」接真的 `classReminder`/`promo`;首頁問候、mobile hero、`TrialScreen` 預填、
  `CartSheet` 持卡人改讀 authStore 的名字(電話讀 `$memberProfile?.phone`)。mobile `SettingsScreen`/
  `EditProfileSheet` 改走 module,後者加 busy 鎖、失敗不關。
- **退役**:domain 的 `ME`;`member/api.ts` 的 `AccountProfile`/私有 `ApiUser`/`mapProfile`/
  `saveBirthDate`/`me()`/`DashboardData.me`;mobile 的 `Prefs`/`PREFS_DEFAULT`/`prefs`/`profile`
  本地 store、`getPreferences`/`savePreferences`/`mapPreferences`;`src/lib/mobile/pref-sync.ts`
  與其測試整檔刪除。`Member` 型別保留(authStore 在用)。
- **連帶**:`mobile/api.ts` 自此不再 import `mobile/stores.ts`。`docs/adr/0019` C3 當年成環的前提
  (`./api` 需要本檔的 `PREFS_DEFAULT`/`Prefs`)徹底消失。

### 3. 候選 C3 — mobile 結帳 controller 升為與購物車同生命週期(Task 2)

**病灶**:mobile `CartSheet` 每次掛載都 `new` 一個 `createCheckoutController`,而 overlay host 的
`{#if}` 每次開啟都重建 sheet。付款在飛時關掉再開,拿到的是新 controller、新的一把
Idempotency-Key、`paying` 也歸零,可能重複下單。

**決定**:`src/lib/mobile/stores.ts` 在 `cart` 旁新增模組級單例 `export const checkout =
createCheckoutController({ placeOrder })`,兩者同生命週期。原本對工廠的純轉出失去唯一消費者,退役。

- `CartSheet` 掛載時 `checkout.setOpen(true)`、`onDestroy` 時 `setOpen(false)`;只在 `freshCheckout`
  時 `refreshPoints()`,同桌面 `CheckoutDialog`。
- 新增 `close()`(`paying` 時直接 return)傳給 `<Sheet>`,擋住 X、遮罩與 Esc。
- 導航觸發的 `closeAll()` 仍會卸載 sheet,但重開走 `resumedInFlight`:同一把 key,`paying` 繼續鎖住。
- `checkout-controller.ts` 只改檔頭說明,邏輯零 diff。兩個 surface 自此都用 `setOpen` 邊沿驅動
  key;R11 記載的「mobile 是 mount 級、永不呼叫 `setOpen`」不再成立。

### 4. 候選 C2 — 每個 entity 一個寫入 module(Task 4)

**病灶**:課程/學員/教練的「表單值 → 驗證 → request body」散在桌面 dialog 與 mobile 表單各自手寫,
已經漂移(驗證規則兩邊不同,mobile 甚至自己 `get(coaches)` 解 `coach_id`),課程年齡還因後端合併而
悄悄丟資料。

**規則**:後端有的欄位保留輸入;後端推導的(招生狀態)唯讀;後端沒有的(D2)拿掉。驗證文案以
exported const 住 module,toast 與 API 錯誤文案留頁面(`docs/adr/0012` 判準④、`docs/adr/0011`)。
每個 entity 各自一套型別與私有 helper,不跨 entity 共用(`docs/adr/0018` C6);新增與編輯是兩支
函式,不用 `isNew`(`docs/adr/0022`)。

- **課程**:加深 `src/lib/admin/components/course-request.ts`。
  - 新增 `CourseDraft`(只含可寫欄位,人數/季費/時長為文字緩衝)、`courseDraftOf(row)`、
    `checkCourseDraft(d, coaches)` → `valid{course: ValidCourse} | invalid{errors}`、
    `buildCreateCourseBody(c)`、`buildUpdateCourseBody(c)`。`blankClassRow` 保留。
  - `levelToApi`/`scheduleTextOf`/`parseAgeRange`/`coachIdOf` 收為私有;舊 `buildCourseBody` 退役。
  - 驗證照後端 DTO:名稱 trim 後 1–100 字;教練必須在清單裡;人數 1–10000、季費 0–1,000,000、
    時長 1–1440(皆為整數文字);年齡收 `N–M 歲`/`N 歲以上`/`N 歲以下`,範圍分隔另收 `-`/`~`,
    0–150 且下限不大於上限,空字串 = 不限,認不出的格式報錯。
  - **兩支 builder 都把每個欄位放進 body**(共用私有 `courseFields`),可清空欄位送 `null`。編輯時
    年齡上下限一律兩個都送,缺的送 `null`——這就是年齡合併 bug 的修法。**`coach_id` 永不送 `null`**:
    `GET /coaches` 只回在職教練,送 `null` 會悄悄解除綁定。
  - `admin/api.ts` 的 `CourseWriteBody` 拆成 `CreateCourseBody`/`UpdateCourseBody`
    (`mobile-admin/api.ts` 的同名轉出原本就無消費者,一併移除)。
  - 桌面 `ClassEditDialog` 工作副本改 `CourseDraft`;刪場地/期別/堂數輸入;招生狀態改唯讀
    `StatusBadge`;驗證不過顯示逐欄錯誤、不呼叫 `onSave`;`onSave(course: ValidCourse)`。
  - mobile-admin `ClassForm` 刪場地與招生狀態 Select,主按鈕依驗證結果 disabled;mobile store 動詞
    改為 `addCourse(course)`/`saveCourse(id, course)`,不再自己解 `coach_id`。
  - `admin/data.ts` 的 `CLASS_STATUS` 失去最後消費者,退役。
- **學員**:新增 `src/lib/admin/components/member-request.ts`,`checkNewMember`/`checkMemberEdit` →
  `valid{body} | invalid{errors}`。email 必填;姓名 2–100;電話 8–20 或留空(留空省略欄位);密碼
  8–128;生日留空省略。`MemberCreateDialog`/`MemberEditDialog`/mobile `MemberForm` 共用;
  `MemberCreateDialog` 的 `onSave` 型別修成 `void | Promise<void>`,`EditModal` 的防連點鎖在型別上
  才成立。
- **教練**:擴充 `src/lib/admin/components/coach-save.ts`,加 `checkNewCoach`/`checkCoachEdit` →
  `valid{values} | invalid{errors}`,標籤拆分(`、,，` 分隔)收成私有 `splitTags`。新增 email 必填、
  密碼 8–128;兩者姓名 2–100、職稱必填且不超過 100 字。`saveNewCoach`/`saveCoachEdit` 不變。

### 5. 候選 C4 — 訂單狀態變更 module `order-status.ts`(Task 5)

**病灶**:訂單狀態轉移表、營收口徑與「狀態碼代表什麼」散在 `orders-filter.ts`、桌面訂單頁與 mobile
`OrderSheet`。兩端對 400/409 的解讀相反:`docs/adr/0011` 記「桌面判 400、OrderSheet 判 409」是兩條
後端路徑的現況——核對後端後,這個前提不成立(見下)。

**後端事實**(`dream_fly_backend` `orders/service.rs::update_order_status`、`refund.rs::decide_transition`):
兩端打的是**同一支** handler。400 = `!current.can_transition_to(target)`,涵蓋非法轉移與「讀到的狀態
已被別人改掉」的並發;409 只出現在退款/取消的點數扣回違反 `users_points_balance_check`(整筆交易
回滾)。`OrderStatus::is_revenue` = `paid | processing | completed`。

**決定**:新增 `src/lib/admin/components/order-status.ts`。

- 自 `orders-filter.ts` 原樣搬入 `LEGAL_NEXT`/`legalNextStatuses`/`applyStatusChange`。
- `isRevenueStatus(status)`,與後端 `is_revenue` 同口徑;`revenueTotal(rows)` 取代 `paidRevenue`
  (舊版只算 `paid`)。
- `changeOrderStatus(id, next, { updateOrderStatus })` → `changed{status} | illegalTransition`(400)
  `| pointsShortfall`(409)`| failed{error}`,同 `coach-save.ts` 的 deps 注入 + `kind` outcome 形狀。
  非 `ApiError` 與其他狀態碼原樣放進 `failed`,文案仍由呼叫端挑(`docs/adr/0011`)。
- **呼叫端**:桌面 `illegalTransition` 用既有那句 400 文案;`pointsShortfall` 新增「會員已使用本單回饋
  點數，餘額不足以扣回，無法退款或取消。」;403 與其他錯誤仍走 `apiErrorText(outcome.error, {403: …})`;
  成功 toast 改用 `orderStatusBadge`。mobile-admin `markOrderPaid(order)` 改**回傳 outcome、不再丟出**,
  只有 `changed` 才 `applyStatusChange` + `markMutated()`(仍不帶尾流、不重抓);`OrderSheet` 把
  「訂單狀態已變更，請重新整理後再試。」移到 `illegalTransition`,錯誤表只剩 `{403}`。
- 新增 `src/lib/domain/order-detail.ts` 的 `orderDetailRows(o)` → `[label, value, mono][]`(13 列,
  有退款原因時第 14 列),照 `domain/class-detail.ts` 前例。`OrderDialog`/`OrderSheet` 共用。
- 桌面「本月已收/本月訂單」改「本頁已收/本頁訂單」,mobile-admin 訂單頁「本月已收」改「本頁已收」:
  兩個數字都只算已載入的這一頁,舊標籤不誠實。

### 6. 候選 C5 — 今日場次 wire 單源(Task 6)

**決定**:

- `src/lib/api/wire.ts` 追加 `ApiTodaySession`(`id, course_id, course_name, coach_name|null,
  start_time, end_time, enrolled_count, venue|null`)。後端 `GET /sessions/today` 的 admin 與 coach
  分支是同一支 service、同一個 `TodaySessionResponse`,形狀沒有分歧。
- `src/lib/domain/sessions.ts` 新增 `TodaySession` 與 `toTodaySession(s, now)`:內部 `hhmm`,空值給
  `'—'`,狀態仍委派 `deriveSessionStatus`。
- `admin/api.ts` 刪本地 `ApiAdminTodaySession`,`mapTodaySession` 改為 `toTodaySession` 加
  `SESSION_STATUS[t.state]` 的投影。
- `coach/api.ts` 刪本地 `ApiTodaySession`,改 import wire;`mapTodayClass`/`mapAttendanceClass` 的
  `room` 改讀真 `venue`(原本寫死 `''` 加「P2 無場地欄位」註解)。`deriveSessionStatus` 的活 re-export
  失去消費者,退役(R13 終審修波起,`mapTodayClass`/`mapAttendanceClass` 兩支 mapper 改經
  `toTodaySession` 投影,不再直接呼叫 `deriveSessionStatus`)。coach 兩支 mapper 的目標形狀另帶
  `level`/`cat`,疊在 `toTodaySession` 投影結果上,不重算 hhmm/venue 預設值/狀態。
- mobile-admin:`TodayRow` 加 `state`(型別 `TodayState`,自 `$lib/admin/data` type-only import——
  admin 的 `TodayClass.state` 本來就是這個 5 值超集,避免窄化 cast);`mapTodayClassToRow` 收窄鍵
  `TodayStatus` 直接索引 `SESSION_STATUS`,不再做寬鍵 fallback;`mapAdminTodayRow` 把 `state` 帶過去;
  首頁 `liveNow` 改為 `today.find((t) => t.state === 'live')`,不再比對標籤字面。

### 7. 候選 C6 — 教練身分每個 session 只解析一次;mobile-admin 訊息換帳號重置(Task 7)

**病灶**:`coach/api.ts` 每個 getter 都重打 `GET /users/me` + `GET /coaches` 找「我是哪個教練」;
`saveSettings` PATCH 成功後還要重抓,重抓失敗就顯示「儲存失敗」;`getThread` 為了自己的 id 再打一次
`/users/me`。mobile-admin 的 `messagesGate` 是 `createHydrationGate`,換教練帳號不重置。

**決定**:

- `coach/api.ts` 內部加私有 `createSessionGate<CoachIdentity>`(`{user, coach|null}`,`fetch` 用
  `fetchMe`)。私有 `requireCoach()`(原 `requireMyCoach`)先水合再讀快取;`coach` 為 `null` 時把
  `gate.hydrated` 翻回 `false` 再丟 `CoachNotFoundError`,管理員綁定之後重試就會重新解析。因為
  `gate.hydrate()` 本身不合併併發呼叫,這裡同樣自帶 `inflight`(同 `hydrateProfile`)。對外 interface
  不變;死的 `myCoachProfile` 退役。本地窄化的 `ApiUser` 改用 authStore 的完整 `ApiUser`。
- `saveSettings`:先 `requireCoach()`(命中快取),再 `gate.mutate(PATCH /users/me, writeBack)`;
  `writeBack` 以 PATCH 回應(後端回完整 `UserResponse`)更新快取並 `authStore.syncUser`,不再重抓。
  教練檔案改在 PATCH **之前**解析,冷快取時若 `/coaches` 失敗,會在送出任何資料之前就報錯,不會出現
  「已寫入卻顯示失敗」。
- `getThread` 的自己 id 改讀 `get(authStore).member?.id`。
- `ProfileTab.svelte` 加必填 `onSaved(coach)`,設定頁 header 跟著更新;toast 改「個人資料已儲存」。
- 兩個點名頁(`routes/coach/attendance`、`routes/mobile-admin/coach/attendance`)補上既有的
  `coachLoadErrorCopy` 接法。不做 `createCoachLoadGate` 包裝。
- `mobile-admin/stores.ts` 的 `messagesGate` 改 `createSessionGate`,`reset` 回 `MESSAGES` 種子
  (boot-parity)。對外匯出與 `markMessageRead → markMutated` 不變。`opsGate` 不動:ops 是全機構資料,
  不是個人隱私。

### 8. 小 bug 與死碼包(Task 1)

- **重複加入同一門課**:member 課程頁的 `bumped` 分支改用公開頁文案「`{課名}` 已在購物車中」(info);
  mobile 首頁、課程頁、`CourseDetailSheet` 各補 `bumped` 分支(原本落到 else 假報「已加入購物車」)。
  不抽共用序列(`docs/adr/0018` R11 C6)。
- **出席年份**:`AttRecord` 加 `year`,`mapAttendanceEntry` 填 `session_date.slice(0, 4)`;
  `MyCourseDetail` 不再寫死 `2026 /`。
- **mobile-admin 首頁假橫幅**:`onMount` 觸發 `hydrateOps()`;`$opsHydrated` 為真之前待付款數為 0。
  `$orders` 同步帶 seed,水合前直接讀會數到種子裡的假訂單。
- **admin 全域搜尋跨頁殘留**:`routes/admin/+layout.svelte` 加 `afterNavigate(() => search.set(''))`,
  同 coach layout 既有先例。
- **會員訂單只拿到 20 筆**:`getAccount()` 改打 `/orders/me?per_page=100` 並回傳 `ordersTotal`;
  mobile `OrdersScreen` 與帳戶頁改顯示後端 total。
- **點名頁假文案**:刪「支援離線暫存與多裝置衝突處理，資料不遺失」與「已自動暫存於本機 14:30」。
- **死碼**(`docs/adr/0010`,刪前逐符號 re-grep):`MemberDialog` 的 `member` 分支、`onEdit` prop 與
  `ProgressBar` import;`admin/data.ts` 的 `Member`/`PAY_STATUS`/`PayStatus`/`ATT_MARK`/`AttMark`;
  `StatusBadge` 的 `member`/`pay` case;`domain/members.ts` 的 `MEMBER_STATUS`。`MemberStatus`
  型別保留(mobile-admin 的 `MEMBERS_BASE` 還在用)。

## 明確不做的事(供未來止步)

- **候選 07:`pageEntry()` 不改交 store 自持的那一對**。審查提議讓 `pageEntry()` 改交
  `{ fetch: hydrateX, refresh: refreshX }`,退役 load-gate 的 `hydrate` 選項,讓頁面作者只學一種接法。
  方向反了:決策點留在 store 閘門、頁面只拿那一對時,load-gate 的 `run()` 只護得住頁面自己的
  `phase`,寫共享 store 的是 store 的 `hydrate`/`refresh`,它們不知道頁面的存在。會丟掉四項保護:
  1. **卸載即棄追**:頁面 refresh 族的 `fetchGenStable` 帶 `iterate: !destroyed && gen === generation`,
     頁面卸載就停止世代穩定重抓;store 的 `refresh()` 不傳 `iterate`,會抓到穩定為止。
  2. **被新一輪取代即丟棄(後發優先)**:`hydrate` 選項下,被新一輪 run 取代的回應不寫進共享 store;
     store 自持的 `refresh()` 落地就無條件 `apply`,先發後至的舊快照照樣寫入。
  3. **F1**:`applyLoaded` 在 `into()` 之後、翻旗之前重查 generation,`into()` 的 subscriber 同步重入
     `load()` 時,舊一輪不翻旗(`docs/adr/0016` 決定一)。
  4. **F5**:`applyRefreshed` 的同款重入防護。

  `docs/adr/0016` 否決過反方向的「load-gate 整段委派 `createHydrationGate`」,理由是 F1;本案是
  同一個理由的另一面。目前沒有已知 bug,只有複雜度,所以不動碼。未來若要收斂成一種接法,方向是
  反過來給 `HydrationGate` 加 `pageEntry()`(見「已知、遞延」)。
- **不做教練名 join helper**:課程的「教練 id → 名字」在各 mapper 各一行,`docs/adr/0020` 前例。
- **不抽共用加購序列**:重複加入同一門課只改文案,`docs/adr/0018` R11 C6 已否決抽 module。
- **本輪不採用後端的 `status` 欄位**:`TodaySessionResponse` 帶後端推導的 `status`,前端仍以
  `deriveSessionStatus` 依本地時間推導。改用後端值是行為變更,記為後續。
- **row 型別不合併**:`ClassRow`/`MemberRow`/`OrderRow` 各 surface 各留(`docs/adr/0007`、
  `docs/adr/0019` C4 批3)。`orderDetailRows` 以結構型別 `OrderDetailSource` 同時吃兩種 row。
- **不用 `isNew`、不做跨 entity CRUD**:C2 的三個 module 逐 entity、新增/編輯分開;共用的只有
  entity 內部的私有 helper(member 的 `checkNamePhone`、coach 的 `checkNameTitle`、course 的
  `courseFields`)。
- **不做 `createCoachLoadGate` 包裝**:兩個點名頁照既有 `onError: coachLoadErrorCopy(e)` 接法補齊。
  包一層只省兩行,又牽動 `docs/adr/0008`/`0011` 的界線。

## 可見的行為變更(逐條)

1. **重複加入同一門課**:member 課程頁顯示「X 已在購物車中」(不再是「已更新數量」);mobile 三處不再
   假報「已加入購物車」。
2. **mobile 課程詳情出席紀錄**顯示場次的真實年份。
3. **mobile-admin 首頁**:進場就水合營運資料;水合前不出現待付款橫幅,之後數的是真訂單。「上課中」
   橫幅改依場次狀態判斷,與標籤文字無關。
4. **admin 換頁會清空全域搜尋**。
5. **會員訂單**:一次最多抓 100 筆;mobile 訂單數與帳戶頁顯示後端 total。
6. **桌面點名頁**不再宣稱離線暫存、不再顯示假的「已自動暫存於本機 14:30」。
7. **mobile 結帳**:付款中 X/遮罩/Esc 關不掉購物車;付款中導航離開再打開,沿用同一把
   Idempotency-Key、仍鎖在付款中,不會重複下單;付款成功後重開是全新流程。
8. **會員名字是真的**:member 首頁問候、mobile hero、試上預約預填、結帳持卡人都讀登入帳號的名字;
   帳戶頁「加入年月」讀後端建立時間。
9. **個人資料可寫**(D1):member 帳戶頁與 mobile `EditProfileSheet` 改姓名/電話/生日會真的
   `PATCH /users/me`,Topbar 名字立即更新;存檔失敗時對話框不關;email 改唯讀。mobile 也能改生日了。
10. **D2 欄位消失**:會員編號、家長聯絡人、頭像顏色;mobile 設定頁的會員編號列與假的「儲存變更」鈕;
    桌面個人資料對話框的「僅本機預覽」提示。桌面「課前提醒/活動與優惠」開關改接真偏好。
11. **偏好**:設定頁一打開就切換,不會再被遲到的水合蓋回;換帳號後 profile/prefs 重置,不殘留上一位
    會員的資料。
12. **個人資料表單規則**:姓名 2–100 字、電話 8–20 字;原本有電話的人不能清空。
13. **`EditProfileSheet`**:水合失敗改為錯誤 toast 並關閉(舊版吞掉錯誤、用 mock 值繼續);水合前
    姓名/生日/電話輸入也停用;存檔中按鈕鎖住。
14. **admin 課程編輯**:年齡「8–14 → 12 歲以上」存完就是 12 歲以上;清空時段/年齡/分類會真的清空;
    場地/期別/堂數輸入拿掉;招生狀態只讀;驗證不過逐欄顯示錯誤、不送出;教練必填且須為在職教練。
15. **mobile-admin 課程表單**拿掉場地與招生狀態;驗證不過時儲存鈕 disabled,適合年齡多一個格式
    placeholder。
16. **學員/教練表單**驗證照後端規則(姓名 2–100、電話 8–20 或留空、密碼 8–128、職稱必填且不超過
    100 字);桌面逐欄顯示錯誤,mobile 按鈕 disabled。
17. **訂單狀態錯誤**:桌面收到 409 顯示點數不足那句;mobile「標記已付款」收到 400 顯示「訂單狀態已
    變更，請重新整理後再試。」(舊版落到泛用連線錯誤)。
18. **營收 KPI** 改按後端營收口徑加總(含處理中/已完成,舊版只算已付款);標籤改「本頁已收」「本頁
    訂單」。
19. **教練今日場次與點名卡**顯示真實場地(無場地時為「—」)。
20. **教練端**:每個 session 只解析一次身分,換頁少兩個 GET;設定頁存檔後 header 立即更新,toast 不再
    寫「下次登入時生效」;PATCH 成功後不會因重抓失敗誤報儲存失敗;兩個點名頁查無教練檔案時顯示專屬
    文案。
21. **mobile-admin 換教練帳號**後訊息列表是新帳號的;換帳號當下在飛的載入會轉錯誤態,重試即恢復。

## 已知、刻意遞延

- **結帳跨登入在飛窗口**:`checkout` 是模組級單例。A 付款途中登出、B 立刻登入並在請求落地前打開
  購物車,會看到 A 的付款狀態(`paying` 鎖住),直到該請求落地。
- **mobile-admin 首頁待付款橫幅只算第 1 頁**:`getOpsCollections()` 只抓第 1 頁訂單,超過一頁時少算。
- **會員訂單超過 100 筆時截斷**:`ordersTotal` 仍顯示真實總數,列表本身只有前 100 筆,沒有分頁。
- **場地/期別/堂數的顯示清理**:輸入已拿掉,但列表卡與明細(`ClassCard`/`ClassDialog`/mobile 卡片)
  仍顯示空值。
- **mobile 表單不等存完就關**:mobile-admin 的三個表單送出後即關閉,不等寫入結果。
- **mobile 表單沒有逐欄錯誤**:驗證不過只 disabled 按鈕,新規則(如姓名 1 字、電話 7 字)會讓按鈕
  無聲停用。
- **電話清空需要後端改**:`PATCH /users/me` 與 `PATCH /users/{id}` 都沒有清空電話的語意,會員資料與
  學員編輯都不能把電話改成空白。
- **停用教練綁定的課程**:`GET /coaches` 只回在職教練,這類課程的教練欄映成空字串,編輯時必須先改選
  一位在職教練才能存(舊版省略 `coach_id` 保留原綁定)。桌面的教練錯誤經 `Select` 的 `helper`
  顯示,不是紅字(`Select` 沒有 `error` prop)。
- **教練身分快取到登出為止**:管理員改了教練資料,本人要重新登入才看得到。身分切換的同一個
  microtask 窗內,理論上可能誤報一次 `CoachNotFoundError`(旗標翻回 false,下次多抓一次,無害)。
- **身兼會員的教練,改名後 `$memberProfile` 顯示舊名**:`coach/saveSettings` 存檔成功後呼叫
  `authStore.syncUser`,`Topbar` 等讀 authStore 的地方立刻更新;但 `member/profile.ts` 自己快取的
  `me` 沒有被同步刷新,若這位教練同時也用會員 app,`$memberProfile` 要等重新登入或整頁刷新(重新
  水合)才會看到新名字。兩個 module 的快取各自為政,同上一點的 gate 去重收斂候選,一併留待日後。
- **會員資料的幾個小缺口**:
  - `EditProfileSheet` 送出的是開啟時快照的 4 個偏好,期間若在別處切過偏好,存檔可能把舊值寫回。
  - ~~`profileEditError` 也檢查沒改的欄位:舊資料裡不合規的姓名/電話會擋住只改生日的存檔。~~
    已修:R13 終審修波(F3)起只在 trim 後的值真的與目前值不同時才驗證。
  - 試上預約的電話預填只在會員資料已水合時才有值(本畫面刻意不為預填多打一支 GET)。
  - 存檔失敗一律顯示連線錯誤,422 也一樣;生日輸入沒有 `max`。
  - 換帳號後被跳過的寫入,`setPref` 回 `rolledBack`、`saveProfile` 回 `failed`(outcome 型別沒有
    skipped,呼叫端此時通常已卸載)。
- **`gate.hydrate()` 不合併併發呼叫**:`profile.ts` 與 `coach/api.ts` 各自加了 `inflight`。若出現
  第三處,再考慮收進 session 閘門。
- **未來候選:把在飛 hydrate 去重收進 `createSessionGate`**(緊接下方 `pageEntry()` 候選)。
  `profile.ts` 的 `hydrateProfile()` 與 `coach/api.ts` 的 `hydrateIdentity()` 各自手寫了一份一模
  一樣的 `inflight` 包裝(見上一點);若閘門本身直接吃下這段去重,兩處呼叫端都能刪掉自己的
  wrapper。
- ~~**`toTodaySession` 只有一個 production 呼叫端**(admin 的 `mapTodaySession`);coach 兩支 mapper
  仍自行投影同樣的欄位。wire 型別已單源,投影是否再收斂留待日後。~~ 已收斂:R13 終審修波起
  `coach/api.ts` 的 `mapTodayClass`/`mapAttendanceClass` 改經 `toTodaySession` 投影,三 surface
  同源。
- **`OrderSheet` 的 `pointsShortfall` 分支目前走不到**(`pending → paid` 不做點數扣回),為 outcome
  窮盡而保留。
- **mobile-admin `data.ts` 新增對 `$lib/admin/data` 的 type-only import**(`TodayState`),理由見 §6。
- **桌面帳戶卡寫死的「競技啦啦隊 進階班」徽章**不在本輪範圍。
- **其他 minor**:課程季費等數字欄收整數文字,小數會被判不合法;admin classes 頁 `edit?.id ?? ''`
  後備值;`course-request.test.ts` 的「每個 draft 鍵進 body」以寫死的鍵清單比對。
- **未來候選:給 `HydrationGate` 加 `pageEntry()`**。目前 4 個 `hydrateOps` 呼叫端(mobile-admin
  學員/課程/訂單頁與 `CoachesScreen`)與 mobile-admin 訊息頁以那一對接法接 load-gate,拿不到上面
  「明確不做」列的四項保護。讓 store 閘門也交出 `pageEntry()`,這 5 個呼叫端就能改走 `hydrate` 選項。

## ADR 點名的測試:改寫,不刪(舊 → 新)

| ADR | 位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `docs/adr/0020` 判準守恆釘 | `src/lib/mobile-admin/stores.test.ts` | `await markOrderPaid(order)` → `await refreshOps()` | 同名同斷言,**逐字不變**(走成功路徑,回傳的 outcome 不讀) |
| `docs/adr/0020` mutation-wins 競態釘 | 同上 | `hydrateOps()` 在飛時 `markOrderPaid()` → mutation 勝出 | 同上,逐字不變 |
| `docs/adr/0022`「PATCH 失敗 → 丟出」 | 同上 | PATCH 失敗 → `markOrderPaid` 丟出 | 「PATCH 400 → 回傳 illegalTransition,store 與 opsHydrated 皆不動」:同 fixture,改斷言 resolve 成 `{ kind: 'illegalTransition' }` |
| `docs/adr/0015` reset 釘 ×2 | `src/lib/admin/components/ClassEditDialog.test.ts` | 換實體不殘留;關閉重開丟棄髒草稿且不污染原實體 | 第一支刪掉 `本期堂數` 那一行斷言(D2 拿掉了該輸入),其餘逐字;第二支完全不變 |
| `docs/adr/0014` 身分釘 | `src/lib/mobile/stores.test.ts` | 21 個收編符號同參照 | 27 個(+`memberProfile`/`prefs`/`hydrateProfile`/`setPref`/`saveProfile`/`profileEditError`) |
| `docs/adr/0014`/`0012` 結帳工廠身分釘 | 同上 | `createCheckoutController` 與 member 同參照 | 接線釘「checkout 單例以本檔的 { placeOrder } 接線建構」:`vi.doMock` 工廠,斷言以 `{ placeOrder }` 呼叫 |
| `docs/adr/0012`/`0014` mount 級生命週期 | `src/lib/member/checkout-controller.test.ts` | describe「mount 級生命週期（不呼叫 setOpen 的消費者）」 | 改名「建構期即備妥可用 key（不呼叫 setOpen 的消費者）」;原 :208 改名「每個實例各持一把 key：不同建構彼此獨立，互不影響」,意圖不刪 |
| `docs/adr/0012` R11 pref-sync 單元 | `src/lib/mobile/pref-sync.test.ts`(已刪) | 三種 outcome、交錯競態 | 移到 `src/lib/member/profile.test.ts` 的「setPref 三種 outcome(移植自 pref-sync.test.ts)」「交錯競態(移植自 pref-sync.test.ts)」,斷言語意不變(body 改 snake_case 並多保未知鍵) |

對象已退役、隨之刪除的釘(不是改寫):

- `docs/adr/0018` R8 C4 的 coach `deriveSessionStatus` 活 re-export 同參照釘(`coach/api.test.ts`):
  re-export 退役;推導本身由 `domain/sessions.test.ts` 覆蓋,另加 `toTodaySession` 5 支。
- `docs/adr/0013` 的 `MEMBER_STATUS` 三支(字面快照、與 `MEMBER_ACCOUNT_STATUS` 的同名異義守衛、
  鍵數 canary,`status-lookups.test.ts`):表本身退役。

## 關聯 ADR

- **`docs/adr/0006`**:殘餘表「帳戶設定/會員帳戶頁個人資料」一列關閉;新增 `syncUser`;D2 拿掉的課程
  欄位與 coach 場地(增補)。
- **`docs/adr/0007`**:`ApiTodaySession` 進 wire;「`ApiUser` 三處窄化投影」只剩 authStore 一份(增補)。
- **`docs/adr/0010`**:本輪退役清單(增補)。
- **`docs/adr/0011`**:400/409 分歧的前提不成立,狀態碼語意改住 `order-status.ts`(增補)。
- **`docs/adr/0012`**:pref-sync 退役、語意併入會員資料 module;coach-save 加驗證(增補)。
- **`docs/adr/0013`**:`MEMBER_STATUS` 退役;`SESSION_STATUS` 消費形改變;`toTodaySession`、
  `order-detail.ts` 入列(增補)。
- **`docs/adr/0014`**:seam 轉出與身分釘 21 → 27;結帳由工廠轉出改為模組級實例(增補)。
- **`docs/adr/0015`**:`ClassEditDialog` 工作副本改 `CourseDraft`,reset 釘少一行(增補)。
- **`docs/adr/0016`**:候選 07 的結論(增補)。
- **`docs/adr/0017`**:`createSessionGate` 消費者 3 → 6(增補)。
- **`docs/adr/0018`**:C6 否決仍然成立;R12 增補的「PATCH 失敗則丟出」已被取代;§4 的 coach 活
  re-export 與 mobile-admin 寬鍵 fallback 退役(增補)。
- **`docs/adr/0019`**:C3 的成環論證完全失效(增補)。
- **`docs/adr/0022`**:undo 那條已在 `157a70d` 修掉;防連點項關閉;`markOrderPaid` 改回傳 outcome;
  `CLASS_STATUS`/`buildCourseBody`/`prefSync` 的現況(增補)。

## 增補(2026-09-27,架構深化 R14):兩條未來候選已關閉,及三處現況

完整背景見 `docs/adr/0024`。本篇原文不改寫,以下各點以本節為準。

### 1. 「已知、刻意遞延」的兩條未來候選已落地

- **「未來候選:給 `HydrationGate` 加 `pageEntry()`」**:R14 Task 2(候選 F1)照做。`pageEntry()` 住
  `HydrationGate`,mobile-admin 的 4 個 `hydrateOps` 呼叫端與訊息頁改寫成
  `createLoadGate({ ...opsPageEntry })`/`createLoadGate({ ...messagesPageEntry })`,拿到「明確不做」
  節列的四項保護。該節的否決(`pageEntry()` 不改交 store 自持那一對)原樣有效,這正是它指出的方向。
- **「未來候選:把在飛 hydrate 去重收進 `createSessionGate`」**(連同上一條「`gate.hydrate()` 不合併
  併發呼叫」):R14 Task 3(候選 F2)收進閘門,而且住在 `HydrationGate`——`hydrate()` 與
  `pageEntry().fetch` 共用在飛 GET,只併入同世代出發的那支。`profile.ts` 與 `coach/api.ts` 的
  `inflight`、`hydrateIdentity` 刪除。本篇寫的是「若出現第三處再說」;R14 重開的理由是那幾個 `let`
  重抄的是閘門私有的 epoch 與在飛狀態,跟出現幾次無關。寫入鏈同批收成 `gate.queueWrite`。

### 2. 三處現況校正

- **§2 會員資料**:「`hydrateProfile()` 自帶 `inflight` 合併」與「單一寫入鏈」自 R14 起由閘門提供
  (`hydrateProfile = gate.hydrate`,`setPref`/`saveProfile` 走 `gate.queueWrite`),語意逐字不變。
- **§7 教練身分與訊息**:查無教練時「把 `gate.hydrated` 翻回 `false`」改走 `gate.invalidate()`;
  `messagesGate` 的 `reset` 回 `[]`,不再是 `MESSAGES` 種子(R14 Task 4 誠實開機,`docs/adr/0010` 增補)。
- **「結帳跨登入在飛窗口」擴大**:R14 Task 5(候選 F4)起結算輸入住 `checkout` 單例,付款中重開保留
  優惠碼、點數折抵與預覽。A 付款在飛時 B 打開購物車,帶過去的除了付款狀態,還有這三樣。仍記為遞延
  (`docs/adr/0024`)。

## 增補(2026-09-30,架構深化 R16):兩條遞延項關閉;會員資料 module 改名搬家;教練閘門只快取教練檔案

完整背景見 `docs/adr/0026` §2、§3。本篇原文不改寫,以下各點以本節為準。

### 1. 「已知、刻意遞延」兩條已關閉

- **「身兼會員的教練,改名後 `$memberProfile` 顯示舊名」**(兩個 module 的快取各自為政):R16 Task 1b
  起教練端不再自己快取 `/users/me`。教練閘門的 fetch 是 `Promise.all([hydrateSelfAccount(),
  listCoaches()])`,`saveSettings` 改經 `saveSelfAccount` 寫入,教練頁與會員 app 讀的是同一份
  `$selfAccount`,改名後兩邊同時更新。
- **「場地/期別/堂數的顯示清理」**:R16 Task 2b 把 `ClassBase.room/term/sessions` 從型別拿掉,
  `classDetailRows` 12 → 6 列,`ClassCard` 第三列只顯示年齡,mobile-admin 班級卡的空白教室列拿掉。
  列表卡與明細不再顯示空值。

### 2. §2 會員資料 module:改名搬家為本人帳號資料

`src/lib/member/profile.ts` 搬到 `src/lib/self-account.ts`(R16 Task 1a,不留舊名 alias):
`memberProfile`→`selfAccount`、`MemberProfile`→`SelfAccount`、`hydrateProfile`→`hydrateSelfAccount`、
`saveProfile`→`saveSelfAccount`、`ProfileEdit`→`SelfAccountEdit`、`ProfileSaveOutcome`→
`SelfAccountSaveOutcome`、`profileEditError`→`selfAccountEditError`;偏好相關的名字不變。
`member/stores.ts` 的轉出刪除。`SelfAccount` 另加 `id` 與 `lastLogin`。本篇與 R14 增補提到的舊名,
自此都讀作新名。

### 3. §7 教練身分:閘門只快取 `ApiCoach | null`

- 私有 `createSessionGate<CoachIdentity>` 改成 `createSessionGate<ApiCoach | null>`;`CoachIdentity`、
  `fetchMe`、`identity` 刪除。`requireCoach()` 回 `{ account, coach }`,`account` 讀自 `$selfAccount`。
- `saveSettings` 不再走 `gate.mutate(PATCH /users/me, writeBack)`:`requireCoach()`(在 PATCH 之前
  解析教練檔案的保證不變)→ `saveSelfAccount(edit)` → `failed` 時丟出。只送改過的欄位,所以電話為
  `null` 的教練只改姓名時不再送 `phone: ''` 撞 422。
- §6 寫的「coach 兩支 mapper 的目標形狀另帶 `level`/`cat`」不再成立:`TodayClass.level/cat` 隨 R16
  Task 2a 拿掉(後端沒有這兩個欄位)。
- 「教練身分快取到登出為止」仍然成立(閘門仍快取 `ApiCoach` 到換帳號為止)。

## 增補(2026-10-03,架構深化 R17):§4 的 mobile 表單現在與桌面一致

§4 寫「mobile `ClassForm` 主按鈕依驗證結果 disabled」「`MemberForm`/`CoachForm` 共用驗證」,但 mobile
三個表單仍是單一 `onSave(body, isNew)`,呼叫端要靠 `as` 與 `'email' in body` 收窄,且驗證不過只是
把按鈕停用、不告訴使用者哪一欄錯。R17 Task FE-6 補齊,本篇原文不改寫,以本節為準:

- **新增與編輯分開**:`MemberForm`/`ClassForm`/`CoachForm` 的 `onSave(body, isNew)` 拆成
  `onCreate(body: CreateX) => Promise<boolean>` 與 `onUpdate(body: UpdateX) => Promise<boolean>`
  (`true` = 已存,表單才 `onClose()`;`false` = 失敗,表單留著重試)。頁面端的 `as` 與 `'email' in body`
  刪除。沒有對應 handler 時不送出也不關閉。
- **送出時驗證(同桌面)**:不再依驗證結果 disabled。送出時跑同一份 `checkX`,無效就把 module 既有
  常數(如 `MEMBER_PASSWORD_ERROR`)用 `<Input error=…>` 顯示在欄位上、不呼叫 handler;按鈕只在存檔中
  停用,防連點。
- **教練新增重試**:`CoachForm` 的 `onCreate` 回 `Promise<'saved' | 'kept' | 'bind-failed'>`(Member/Class
  仍是 boolean):`saved` 關閉、`kept` 留著、`bind-failed`(帳號已建、綁定失敗)留著**並鎖住 email/姓名/
  密碼**到 sheet 關閉——同桌面 `CoachEditDialog` 的 `pendingUserId` 鎖,因為重試不再建帳號,這三欄改了
  也會被忽略。`addCoach(v, pendingUserId)` 把哨兵傳進 `saveNewCoach`;`CoachesScreen` 在每個新增 sheet
  工作階段內持有 `{userId, email, name}`(第一次送出的身分),重試只再打 `POST /coaches`、沿用同一個
  user id,toast 指名實際建立的帳號而非重試時表單帶的值。重新開啟新增 sheet 時重置。這取代
  CoachesScreen 檔頭原本「儲存即關 sheet、哨兵刻意丟棄、請換一個 email」的設計。

## 增補(2026-10-03,架構深化 R17,FE-10)

在上一則增補(§4 的 mobile 表單)之外,`docs/adr/0027` §5 讓以下敘述過時:

- **:53、:191、:433 的 `gate.mutate(PATCH, …)`**:`mutate` 已退役。本人帳號資料的 `patchMe` 現為
  `gate.write({ send, commit })` + `resultOf`;`setPref` 走寫入鏈內的 `write({ optimistic, send, commit, onFailure:
  'resync' })`(PATCH 入尾流帳;寫前水合失敗仍先 `gate.refresh()`、再失敗才單鍵回滾)。教練 `saveSettings` 本來就不經 gate
  寫入(:433 已記)。
- **:150、:200 的 `applyStatusChange` + `markMutated()`、「`markMessageRead → markMutated` 不變」**:`markOrderPaid`
  的 PATCH 是 `opsGate.write()` 的 `send`、`applyStatusChange` 是它的 `commit`;`markMessageRead(id, ack)` 走
  `messagesGate.write()`。對外匯出仍是這兩支。
- **:346 與 :210 的 `opsHydrated`**:該匯出已刪(`0027` §6);測試改用 `resetOpsForTests()`/先 `hydrateOps()`。
