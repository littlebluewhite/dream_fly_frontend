# 登入狀態單一 owner 與跨分頁同步、點名選項單源、結帳 relay 收合、mobile 表單新增/編輯分開、閘門單一寫入動詞 write()、store 測試只留接線

> Status: Accepted(§1–§10)。源自 2026-10-03 架構深化工程 Round 17(前端部分)。base `15789d4`;
> FE-1 `539e7ef`(點數原因標籤)、FE-2 `eba9ab1`(跟隨分頁 refresh)、FE-3 `25be1da`+`19112e2`(登入狀態
> + 跨分頁同步)、FE-4 `c1e9dfc`(點名選項)、FE-5 `fe7efec`(結帳收合、購物車總額)、FE-6
> `b575a3f`+`4abca5b`(mobile 表單)、FE-7 `a21f424`(`write()`)、FE-8 `b1a525b`(退役 `markMutated`/
> `mutate`)、FE-9 `1c5244a`+`56eb88c`(store 測試)、FE-10(本篇 §1–§6 與各 ADR 增補)。§7–§10 為本輪 wire 型別
> 採用:W-4 `cb3ff10`(`scripts/wire.mjs`、首次匯入 bindings)、W-5 `58586fd`+`46cec3f`(點數、今日場次)、W-6
> `f46080e`+`8966b99`+`daed224`(請假、訂單、移除待付款→已付款)、W-7 `e95d141`..`73beb9d`(其餘 surface、ADR-0007
> 增補)、W-8 `49ac883`..`f59cc2f`(admin 頁 HTTP seam、ADR-0026 增補)、FE-11(本節與 CONTEXT/architecture 同步)。

R17 沿 `docs/adr/0018`/`0019`/`0022`/`0023`/`0024`/`0025`/`0026`「一輪多案、單篇記錄」的體例,不新開架構
類別。共同目標仍是 locality:「這個分頁登入的是誰」「點名有哪幾種狀態」「結帳送單的序列」「mobile 表單
怎麼送出」「寫入共享 store 的協定」「store 測試測什麼」各自只住一處。本輪修掉的真 bug:退款點數被標成
「會員點數調整」、手機點名「遲到」默默變「出席」、token 失效後畫面仍顯示登入(含跨分頁)、跟隨分頁拿舊
refresh token 換新而 401、購物車總額把已持有方案算進去。本篇依序記錄十項決定(§1–§6 為 R17 前端本體,§7–§10 為 wire 型別採用)、明確**不做**的事、可見的
行為變更、刻意遞延的已知項、被取代的舊 ADR 句子,以及 ADR 點名測試的新舊對照。被既有 ADR 點名的地方,
各篇已補 2026-10-03 的 dated 增補指回本篇;`CONTEXT.md` 與 `docs/architecture.md` 直接改成現況。

## 背景與決定

### 1. 登入狀態收成一個 module,跨分頁與過期都走同一條身分邊(FE-2、FE-3)

**病灶**:(a) refresh 單飛在 Web Lock 內有「`before` 快照捷徑」:跟隨分頁等到鎖後直接回 `true`、沒有
自己的 access token,隨後第一個請求 401;失敗路徑無條件清 token,會把別的分頁剛換上的新 session 一起清掉。
(b) refresh 失敗只清 token,`authStore` 沒人通知,畫面仍顯示登入,要等整頁重載才發現(`docs/adr/0006` §1
寫的「並導回登入頁」其實沒發生)。(c) 別的分頁登出或換帳號,本分頁毫無感知。(d) `sessionIdentity()` 住在
`session-gate.ts`,但身分的 owner 是 `authStore`。

**決定**(細節已寫在 `docs/adr/0006`/`0017`/`0026` 的 R17 增補與 `CONTEXT.md`「登入狀態」,此處只列骨架):

- **只有一個清除點**:`client.ts` 的 `performRefresh()`。進鎖後一律讀「當下」的 refresh token 去換
  (`exchangeRefreshToken()`,純傳輸、從不清),結果三分:成功 / 拒絕(400/401/403,或根本沒有 refresh token
  可送)/ 不可用(網路錯誤、其他非 2xx 如 408/429/5xx、200 但 body 讀不出來)。`/auth/refresh` 與登入共用後端每 IP
  每分鐘 10 次的限流桶,429 不是對 token 的判決,當成拒絕會把整個瀏覽器的分頁一起登出(最終檢視 I-1)。只有「拒絕」走 compare-and-clear——storage 裡的 refresh
  token 仍是這次送出的那顆,**或 storage 已空**(別的分頁登出了)才清,並呼叫 `onSessionExpired` 訊號。
  「不可用」回 false、不清、不發訊號。「成功」同樣 compare-and-set:storage 裡仍是送出的那顆才寫入輪替結果;
  否則(飛行中有新登入或登出)丟棄結果、回 false——較新的 token 勝出。
- **`authStore` 收訊號**:`onSessionExpired(() => set(LOGGED_OUT))`。守門導向、session 閘門重置、結帳導向
  都沿用既有的身分改變那條邊,沒有新路徑。`hydrate()` 的 `/users/me` 失敗不再無條件清 token(真的 401
  已經走 `api()` → refresh 那條路)。
- **跨分頁**:`authStore` 在瀏覽器端聽 `storage` 事件(`dreamfly_auth`、`dreamfly_refresh`、`key: null`),
  **只看「目前 storage」決定**:沒有 refresh token → `forgetAccess()` + `LOGGED_OUT`;快取身分是另一位已登入
  者 → `forgetAccess()` + `hydrate()`,`hydrate()` 結束後若本分頁身分仍不是**事件當下** storage 快取的那位(refresh
  成功但 `/users/me` 失敗、或 refresh 暫時不可用),再 `forgetAccess()` + `LOGGED_OUT`。比對的是事件當下的身分快照、
  不重讀快取:別的分頁遲到的 `syncUser` 可能已把共用快取改寫回舊身分——不得用舊身分頂著新帳號的 token
  打 API(最終檢視 M-3);其餘(含 refresh token 被別的分頁輪替)不動。listener 永不寫共用的
  refresh key。(Controller 裁決 9:若「refresh key 變了」就重新水合,每個等待鎖的分頁都會各輪替一次、互相
  觸發,永不停止。)
- **session 世代**:`authStore` 內部計數,登入、登出、過期、跨分頁登出/換身分時 +1,refresh token 輪替不動。
  `hydrate()` 進場記下世代,`/users/me` 落地時世代已變就不套用(舊 session 的回應不得蓋掉新身分);不用 refresh
  token 相等比對——別的分頁或 `api()` 401 重試的輪替不是換 session。
- **`sessionIdentity()` 搬進 `stores/authStore.ts`**;`$lib/testing/auth-mock` 兩個家族轉手真實作。

**測試**:`client.test.ts`(跟隨分頁 POST 剛好一次且用輪替後的 token、兩分頁競態的假後端偵測重用、在飛期間
被換掉不清、暫時性錯誤不清——含 408/429 不可用不清、不發訊號、401 清且發一次訊號、在飛期間換上新登入時成功的
舊輪替結果被丟棄)、`authStore.test.ts`(過期 → `LOGGED_OUT` + 閘門 reset 恰一次;`StorageEvent`:別分頁登出、
換成 B、換成 B 但 `/users/me` 失敗 → `LOGGED_OUT`、換成 B 而水合期間遲到的 A 快取寫入落地且水合失敗 →
`LOGGED_OUT`(絕不停在 A)、只輪替、`key: null`、登出後立刻同一人重登;`/users/me` 503 與 refresh 429 不動 token;
換成 B 時較早水合的 A `/users/me` 遲到不套用;輪替不擋套用:重載時別分頁輪替、`/users/me` 401 重試、三分頁換 B 時
兄弟分頁輪替仍停在 B)。

### 2. 點名選項單一來源 `ATT_CHOICES`;點數原因標籤補齊(FE-4、FE-1)

**病灶(FE-4)**:教練點名的「遲到」與 `docs/adr/0026` R6 同病灶——能點,但後端 `attendance_status` 只有
present/absent/leave,送出時 `coach/api.ts` 把 late 併成 present,手機版 `onSave` 還忽略 `hadLate`。桌面
`AttSegment`、桌面統計 chips、手機分段鈕與統計卡各手抄一份狀態清單(顏色、順序、是否含「請假」都不一致)。
Controller 裁決 1:遲到刪除,桌面/手機共用一份,手機補「請假」。

**決定**:`coach/data.ts` 匯出 `AttDefault = 'present' | 'leave' | 'absent'` 與 `ATT_CHOICES`(三筆,色用
success/info/error)。`coach/api.ts` 的 late→present 映射、controller 的 `draftHadLate`/`SaveOutcome.hadLate`、
桌面成功 toast 的折疊說明一併刪除;`tally()` 回傳零初始化的 `Record<AttDefault, number>`;手機點名頁的
「已請假」徽章判準改 `r.def === 'leave'`(只看名冊,與桌面一致)。

**病灶(FE-1)**:`describeLedgerReason` 只認三個 reason,退款沖回與管理員調整都落到 default,畫面標成「會員
點數調整」。**決定**:後端 `PointReason` 六值全數列出——`refund_restore`/`refund_clawback` 的 type 是
`refund`(desc「訂單退款・退回折抵點數」/「訂單退款・收回回饋點數」),`admin_adjust` 是 `adjust`(「會員點數調整」,
可正可負);default(日後新增、前端未認得)同歸 `adjust`。`LedgerType = earn | redeem | adjust | refund`,
`expire` 退役;member `PT_TYPE` 補 `adjust`/`refund`,**mobile 的 `PT_TYPE` 刪除**(零讀者,與 `docs/adr/0022`
「PT_TYPE 雖零消費者仍保留」衝突,計劃明列刪除,見被取代句子表)。

### 3. 結帳 relay 收合進 `createCheckout`;購物車總額只算可計費行(FE-5)

**決定**(`docs/adr/0003`、`0004` 已有 FE-5 增補):`checkout-order.ts` 的 `submitOrder`/`OrderConfirmation` 與
兩個死預設值刪除,序列(`syncCartToServer` → `POST /orders` + Idempotency-Key → `allSettled` 的
`refreshAfterOrder`(每個 rejection `console.error`)→ `cart.clear()`)成為 `member/checkout-sync.ts` 內
`createCheckout` 的**私有** `placeOrder`,直接回 `PaidSummary`;`checkout-order.ts` 只留 wire 型別與
`syncCartToServer`。`member/checkout.ts` 的 `validateCoupon` 併入 `applyCouponCode`(唯一呼叫端,無 export)。
購物車頁與 `CartDropdown` 的總額改走 `subtotalOf(chargeableLines($cart, $subscriptions))`,已持有方案的行顯示
「已持有，不計費」(不顯示單價/小計),並 best-effort `refreshSubscriptions()`(下拉:開啟且已登入時;購物車頁:
`onMount`)。沿用 `chargeableLines`,不另寫第二個判準。

### 4. mobile-admin 表單:新增與編輯分開、送出時驗證(FE-6)

**決定**(`docs/adr/0023` 已有 R17 增補,此處是骨架):`MemberForm`/`ClassForm`/`CoachForm` 的
`onSave(body, isNew)` 拆成 `onCreate(body)`/`onUpdate(body)`,回 `Promise<boolean>`(`true` 才關);頁面端的
`as` 與 `'email' in body` 刪除;無對應 handler 時不送出也不關閉。驗證改**送出時**跑與桌面同一份 `checkX`,
錯誤用 `<Input error>` 顯示在欄位上(Class 的教練欄走 `Select` helper),按鈕只在存檔中停用。教練新增
的重試:`CoachForm.onCreate` 回 `'saved' | 'kept' | 'bind-failed'`,`bind-failed`(帳號已建、綁定失敗)留著並鎖住
email/姓名/密碼;`addCoach(v, pendingUserId)` 把哨兵傳進 `saveNewCoach`,`CoachesScreen` 在每個新增 sheet 工作
階段持有 `{userId, email, name}`,重試只再打 `POST /coaches`,toast 指名第一次建立的帳號。

### 5. 閘門單一寫入動詞 `write()`;退役 `markMutated`/`mutate`(FE-7、FE-8)

**病灶**:寫入協定散在三處——`HydrationGate.markMutated(tail?)`(樂觀路徑,記尾流、推世代、翻旗)、
`SessionGate.mutate(request, writeBack)`(await-then-write 路徑,另帶跨身分作廢與和解鏈)、各 mutator 手焊的
失敗復原(rollback/resync)與 `MessageThread` 手寫的身分核對。`markMutated` 的「呼叫端義務」(`tail` 必須是
純網路尾流,不得是內部會等本閘門 refresh 的 promise)只靠註解守。

**決定**:`createHydrationGate` 的介面只有一個寫入動詞:

```ts
write<R>(w: { optimistic?: () => (() => void) | void; send: () => Promise<R>;
              commit?: (r: R) => void; onFailure?: 'keep' | 'rollback' | 'resync' }):
  Promise<WriteOutcome<R>>   // written{result} | stale{settled} | failed{error, recovery: kept|rolledBack|resynced}
```

另匯出 `resultOf(o)`(`written`/成功的 `stale` 給值,失敗原樣拋出,給「回傳 server 結果、失敗即拋」的
mutator)。語意:

- **進場**記 `owner = resetEpoch` 與 `wasHydrated`。
- **樂觀路徑**(有 `optimistic`)整段同步:`optimistic()` → `send()` → 尾流入帳(`then(done, done)`,reject 也算
  settle)→ 世代 +1 並翻旗,**再** await。記帳順序仍是契約(`docs/adr/0021`):尾流先入帳,才推世代/翻旗。
  尾流**就是** `send()`,`commit`/復原在尾流之外——`markMutated` 的「純網路尾流」義務從呼叫端自律變成型別形狀。
- **非樂觀路徑**:await `send()` 之後才 `commit` → 推世代翻旗。
- **owner 變了**(閘門在 `send` 在飛期間被 reset)→ `stale`,**不碰 store**;`settled` 照實交付 `send` 的結局
  (server 端事實可能已成立)。
- **失敗**:`keep` 不動;`rollback` 呼叫 `undo`;`resync` 整包重抓,重抓也失敗退回 `undo`,重抓期間 owner 變了
  → `stale`(不謊報 `resynced`、不 undo 到新擁有者身上)。沒有 undo 可呼叫(非樂觀,或 `optimistic` 沒回傳)
  → `recovery: 'kept'`。`send` 同步拋出等同回傳 rejected promise(走失敗路徑,`write` 本身不 reject)。
- **和解**:寫入翻了旗而 store 可能不完整(寫入前未水合,或寫回時旗標已被和解失敗翻回 false)→ 排和解重抓。
  **和解鏈自 `session-gate.ts` 搬進基礎閘門**,軸由 session 世代換成 `resetEpoch`,`reset()` 一併清;因此 plain
  閘門(`opsGate`)也有了和解。
- 丟棄軸(`fetchGenStable`)與等待軸(尾流帳)**不動**(`docs/adr/0020`/`0021` 的決定原樣成立,只是入口換名)。

`markMutated` 自 `HydrationGate` 介面移除(內部留 `track`/`bump` 兩個只有 `write` 呼叫的具名步驟),`mutate` 自
`SessionGate` 移除;`session-gate.ts` 只剩身分核心、`epochFetch` 與 `queueWrite`。mutator 遷移:

| mutator | 現在 |
| --- | --- |
| `notifications.markRead`/`markAllRead` | `write({ optimistic, send, onFailure: 'keep' })`;`markAllRead` 以 `resultOf` 讀 allSettled 結果 |
| `waitlist.joinWaitlist`/`cancelWaitlist`、`leave.createLeaveRequest`/`cancelLeaveRequest`/`bookMakeup`、`self-account.patchMe` | `write({ send, commit })` + `resultOf` |
| `self-account.setPref` | 寫入鏈內 `write({ optimistic, send: PATCH, commit: applyMe, onFailure: 'resync' })`;PATCH 尾流首次入帳。寫前水合失敗仍是先 `gate.refresh()`(`resynced`),再失敗才單鍵回滾 |
| `mobile-admin.markOrderPaid` | FE-7 時遷成 `opsGate.write({ send, commit: applyStatusChange })` + `resultOf`;**W-6 已刪**(§9),`opsGate.write()` 此後沒有 production 呼叫者 |
| `mobile-admin.markMessageRead(id, ack)` | `messagesGate.write({ send: await ack(false 則拋), commit: 本地標已讀 })`;`MessageThread` 把 `badgeCleared` 直接交進來,手寫的身分核對與 `authStore`/`sessionIdentity` import 刪除 |

不動:ops 的 create/save(寫後無條件重抓,不走 `write`)、`saveSelfAccount` 本體、`requireCoach`。production
已無 `markMutated(`/`.mutate(` 呼叫。**`docs/adr/0018` C7 結案**:C7 問的「member 樂觀 mutator 與 mobile-admin 非
樂觀 mutator 是否同構」,答案是它們是同一個動詞的兩條路徑(有無 `optimistic`),差異在**參數**而非形狀——
協定單源,不再需要「各自歸隊」。

**行為變更(演算法本身帶來、非使用者可見)**:(i) 未水合時的寫入現在**到處**都會排和解(此前只有 session 閘門
的 mutate 會;樂觀 mutator 與 ops 只翻旗,store 永遠不完整)——production 的呼叫都來自已渲染、已水合的列表,
通常是 no-op;(ii) `setPref` 的 PATCH 入尾流帳、世代與旗標在 PATCH 之前宣告;(iii) 測試的 `gate.reset()` 現在也
讓在飛的 write 變 stale、取消排隊中的和解。

### 6. store 測試只留接線;刪 `*Hydrated` 與 `reset…ForTests`(FE-9,含 F8a 收緊)

**病灶**:閘門協定(guard 短路、mutation 勝出、換身分重置、尾流等待)已有 `hydration-gate.test.ts`/
`session-gate.test.ts`/`load-gate.test.ts` 在協定層驗一次(`docs/adr/0016` 的三層測試分工),但每個 store 測試又各
測一遍,而且靠 production 匯出的測試專用出口達成:`waitlistHydrated`/`leaveRequestsHydrated`/
`notificationsHydrated`/`opsHydrated`/`messagesHydrated` 與 `reset…ForTests`。

**決定**:

- 刪 5 個 `*Hydrated` 與 `member/stores.ts` 的轉出;刪 `resetWaitlist/LeaveRequests/Notifications/Messages
  ForTests`。只留身分無關的 `resetOpsForTests = opsGate.reset`(`import-scan.test.ts` 契約仍守 production 不得
  import)。
- 新增 `src/lib/testing/session-reset.ts` 的 `resetSessionStores()`:真實 `authStore.login` 再 `logout`(`api` 被
  mock 時暫時換一個 fakeRouter 實作,結束還原),讓 session 閘門經 production 的身分改變路徑重置。放在
  `beforeEach` 最前面。
- store 測試只留**接線**:每個 mutator 一條「用對了哪個政策」的釘(markRead 的 PATCH 未 settle 擋住 refresh、
  markMessageRead 在飛 hydrate 時不被舊快照蓋(FE-9 時另有一條 markOrderPaid 的,隨 W-6 刪除)、
  cancelLeaveRequest 未水合會和解成完整清單……),
  只斷言可觀察結果。協定層重複的案例刪除(見下方測試表)。`member/checkout-api.test.ts` 依主題拆進
  `waitlist.test.ts`/`points.test.ts`/`subscriptions.test.ts`/`notifications.test.ts`。
- F8a 的四個測試收緊併入:記帳順序 pin 改精確次數、清帳同拍新尾流計數、resync 在飛期間 reset 後才 reject → stale、
  load-gate 在飛 mutation 後的 `{ v: 2 }` 正向斷言。

**淨效果**:全套 2568 → 2530 個測試(2 skipped 不變),檔數 237 → 239。

### 7. wire 型別改由後端產生並逐位元鏡像;response `Api*` 手寫型別退場(W-4、W-7)

**病灶**:前端的 response 型別全是手抄,後端改名、刪欄、加欄時 `svelte-check` 不會紅(`docs/adr/0007` 增補
記了一例:教練請假 PATCH 回應的 `user_name` 缺了約 12 週,check 全程綠)。

**決定**:

- 後端 Rust DTO 經 ts-rs 產生 TypeScript,committed 在後端 `bindings/`(後端 `docs/adr/0016`)。
  `scripts/wire.mjs`(只用 node 內建模組)`sync` 把它**逐位元組鏡像**到 `src/lib/api/generated/`(多的檔會刪),
  `check` 回報 stale/missing/extra 並 exit 1;找不到後端目錄或其下沒有 `bindings/` 時印 skipped、exit 0。
  `npm run check` 先跑 `wire:check` 再跑 `svelte-kit sync && svelte-check`(`package.json`)。`generated/` 不得手改、
  不得 reformat;後端有改 DTO 時在後端重新產生,再回前端 `npm run wire:sync`。後端目錄由 `DREAMFLY_BACKEND_DIR`
  指定。
- 手寫 response `Api*` 型別刪除:`ApiPage` 刪(各 `*ListResponse` 取代),`ApiTodaySession`、`ApiLeaveRequest`、
  `ApiLedgerEntry`/`ApiPointsMe`、admin/member/coach/public 各 `api.ts` 內的 `ApiOrder*`、`ApiCoupon*` 等一併換成
  產生型別。窄化投影改寫成產生型別的 `Pick<…>`:`ApiUser`(`AuthUserResponse` 的 4 欄)、`ApiMe`、
  `ApiUserAccount`(`UserResponse` 的 6 欄),後端改名或刪欄時在前端變紅。
  **保留**手寫的 `ApiStudioProfile`/`ApiNotificationFlags`/`ApiSecuritySettings`:它們描述的是後端刻意留 `JsonValue`
  的 settings 值上、前端依契約做的形狀斷言,在映射處 cast 進來。
- **Ruling W7a**:只准 `import type` 自 `$lib/api/generated`(`export type { … } from './generated'` 亦可),直接
  import 或經 `wire.ts` 轉出皆可,**沒有「單一入口」規則**;`wire.ts` 不得有自 `./generated` 的 runtime import。
- **Ruling W7b**:request body 與 UI 目標(view)型別仍手寫——bindings 只含 response(後端 `docs/adr/0016`)。
- 以窮舉守住值域:`Record<GeneratedEnum, …>` 查表(`ORDER_STATUS: Record<OrderStatus, …>`、
  `NOTIF_TYPE_MAP: Record<NotificationType, …>`、`TODAY_STATUS: Record<SessionStatus, …>`),
  `describeLedgerReason` 的 `default` 以 `reason satisfies never` 在編譯期卡新增的 `PointReason`
  (執行期仍 fallback 到「會員點數調整」,不讓整頁帳本因新值崩);fixtures 與 mock 用 `satisfies` 讓缺欄位編譯就紅。
- 測試用 fixture 住 `src/lib/testing/wire-fixtures.ts`:每個 builder 回傳完整的產生型別、帶預設值、收 `Partial<T>`
  覆寫(W-6 起 `orderSummary`/`adminOrderSummary`/`orderResponse`/`leaveRequest`/`adminLeaveRequest`/`pointsMe`,
  W-8 增 venue/product/coupon/settings/adminReport/activityItem/todaySession/coach/user/course)。後端新增欄位時
  只加一個預設值。
- 邊界上的值域收窄:`preferences` 在後端是 `JsonValue | null`、沒有形狀驗證,`prefsObject()` 只認 JSON 物件,
  其餘視為未設定。
- `docs/adr/0007` 的放置規則(「≥2 surface 才進 `wire.ts`」)被取代,已在該篇 2026-10-03 增補(W-7)寫明,
  此處不重寫。

### 8. 點數「本月累積」與今日場次狀態改讀後端(W-5)

**病灶**:(a) 會員點數頁的「本月累積」是前端把帳本**第一頁**的正向 delta 加總,以 UTC 日期切月:第 2 頁以後
的入帳不算,台灣月初也會切錯,且把 `refund_restore`/`admin_adjust` 的正值也算進去。(b) 今日場次的狀態由
前端用瀏覽器牆上時鐘推導(`deriveSessionStatus`、`wallClockTime`),另有沒人產生的 `'soon'`/`prep`。

**決定**:

- `GET /points/me` 多回 `earned_this_month`(後端:工作室月份、只算 `reason = checkout_earn`)。前端新增
  `pointsEarnedThisMonth` store,由 `refreshPoints` 的 `apply` 寫入,**隨 session 閘門的身分改變邊重置**
  (沿用既有 `reset`,沒有新路徑);點數頁直接顯示 `+{$pointsEarnedThisMonth}`,刪第一頁加總與 UTC 切法。
- 今日場次改讀後端 `status`:`TODAY_STATUS: Record<SessionStatus, TodayStatus>`
  (`upcoming`→`wait`、`ongoing`→`live`、`done`→`done`)。刪 `deriveSessionStatus`、`wallClockTime`、
  `TodayStatus`/`SESSION_STATUS`/`CLASS_STATUS` 的 `'soon'`、admin 的 `TodayState`(5 值 union,含 prep);
  `toTodaySession(s)` 不再收 `now`,`mapTodaySession`/`mapTodayClass`/`mapAttendanceClass` 一併去掉 `now` 管線。
  狀態仍是頁面載入當下的值,與以前一樣不輪詢。編譯期 `Record<SessionStatus, …>` 在 bindings 同步後擋新值;
  後端先上線、前端未同步時的未知 `status` 在 `toTodaySession` 退回 `'wait'`(最終檢視 M-1),否則下游
  `SESSION_STATUS`/`CLASS_STATUS` 查表會 throw,admin 儀表板整頁、手機教練首頁與桌面教練畫面都會壞
  (同 `describeLedgerReason` 與活動 `kind` 的執行期 fallback)。

**可見變更**見下方清單第 10、11 條。

### 9. 訂單付款時間來自後端;前端不再有待付款 → 已付款(W-6、Ruling W6b)

**病灶**:admin 訂單的「收款時間」是前端造的:`pending` 以外一律取建立日 `isoDate(created_at)`,
`applyStatusChange` 則用 `o.date`——不是真的付款時間。同時,後端 BE-3 已拒絕待付款 → 已付款(400),執行期也沒有
路徑產生 pending 訂單(`create_order` 寫死 `'paid'`),前端卻仍提供這條轉移與手機「標記已付款」。

**決定**:

- `AdminOrderSummary.paid_at` 為真值來源。`$lib/api/wire.ts` 的 `paidAtLabel(status, paidAt)`(原放 `admin/components/order-status.ts`,後移到 wire 讓 `admin/api.ts` 不依賴 components):
  `paid_at` 為 null 時,pending 顯示「—（待付款）」,其餘顯示「—」;否則 `isoDate(paid_at)`(與訂單日期同格式)。
  `mapAdminOrder` 與 `applyStatusChange(rows, id, status, paidAt)` 都用它;`PATCH /orders/{id}/status` 的
  回應(`OrderResponse`)帶 `paid_at`,`changeOrderStatus` 的 deps 型別是
  `Pick<OrderResponse, 'status' | 'paid_at'>`,順帶刪掉 `as OrderStatus` 轉型。後端 `update_status_tx` 不動
  `paid_at`,所以退款/取消的訂單保留原付款時間。
- **移除待付款 → 已付款**:`LEGAL_NEXT.pending = ['cancelled']`,刪 mobile-admin `markOrderPaid` 與
  `OrderSheet` 的「標記已付款」按鈕(連同 `saving`、`STATUS_ERROR_TEXT` 等孤兒)。此後沒有任何 ops mutator 走
  `opsGate.write()`(寫入動詞維持「寫後無條件重抓」);`write()` 路徑由 mobile-admin 的 `markMessageRead` 與
  `hydration-gate.test.ts` 的協定測試驗證。
- **可見變更:手機後台訂單頁唯讀;待付款訂單只能在桌面取消。**手機 `OrderSheet` 的 pending 頁尾是「發送催繳」(本機
  toast,無後端呼叫)與「關閉」,其他狀態只有「關閉」。
- `docs/adr/0022` 已加一行增補指回本篇;`docs/adr/0018`/`0020`/`0021`/`0023` 提到 `markOrderPaid` 的歷史敘述見
  「被取代的 ADR 句子」。

### 10. admin 頁面測試走 HTTP seam(W-8、Ruling W8a)

**病灶**:十個 `routes/admin/**/page.test.ts` 整支 mock `$lib/admin/api`,等於跳過真 mapper;回應型別改由後端
產生後,型別漂移與 mapper bug 在頁面測試裡看不到,fixture 還出現 wire 沒有的欄位(訂單頁假列的
`method: '信用卡'`)。

**決定**(細節見 `docs/adr/0026` 的 W-8 增補,此處只列骨架):

- 新增 `src/lib/testing/admin-routes.ts`:`ADMIN_ROUTES = { ...OPS_ROUTES, … }`,補 venues、products、coupons、
  settings、reports/admin、reports/admin/activity、sessions/today 的預設回應(全由 `wire-fixtures.ts` builders
  組出),另附 `apiCalls`/`apiBody` 兩支呼叫檢視 helper;重用既有 `fakeRouter`,沒有第二個 router。
- 十個 admin 頁測試改 `vi.mock('$lib/api/client')` + `fakeRouter(overrides, ADMIN_ROUTES)`,斷言 HTTP 路徑、方法與
  JSON body;案例數逐檔不變(147 → 147)。
- **Ruling W8a**:`import-scan.test.ts` 新增契約「零整支 `vi.mock('$lib/admin/api')`」。「整支」指 automock 或
  零參數 factory;帶 `importOriginal` 的部分替換不在此列。後續收緊:契約改為零 mock `$lib/admin/api`／`$lib/mobile-admin/api`
  (含 `importOriginal` 部分替換、`vi.doMock`、解析後落在兩者的相對路徑),`mobile-admin/stores.test.ts` 改走同一個 HTTP seam。
- **淨效果**:W-4 基線 2530 → W-8 結束 2528 個測試(2 skipped 不變);W-8 本身 2527 → 2528(+1,新契約)。

## 明確不做的事(供未來止步)

(Controller 裁決 10;未來檢視勿重提。)

- **早核准請假讓場次算「已點名」**:`docs/adr/0008` 決定 6 已接受。
- **報表區段宣告 3 次**:`CONTEXT.md`「報表組裝」記為刻意。
- **`hydrated` 唯讀探針留在 `HydrationGate` 介面**:各 store 不再匯出 `*Hydrated`;介面上的 `hydrated` 保留當唯讀
  探針,production 僅 `self-account.ts` 的 `setPref` 讀它一處(記錄寫入前是否已水合),其餘是測試。不為此再加介面。
- **`sessionIdentity` 不做 derived store**(`docs/adr/0026` §6 原決定不變)。
- **登入狀態不改成「看 refresh key 變了就重新水合」**(見 §1)。
- **不另立 `WriteRecovery` 的 `'none'`**:沒有 undo 時回 `'kept'`。

## 可見的行為變更(逐條)

1. **退款與管理員調整的點數明細有正確標籤**:退款顯示「訂單退款・退回折抵點數」/「訂單退款・收回回饋點數」(標
   籤「退款」),管理員調整顯示「會員點數調整」(標籤「調整」)(FE-1)。
2. **token 失效後畫面真的登出並導回登入頁**,不再等整頁重載(FE-3)。
3. **別的分頁登出或換帳號,本分頁即時跟上**;別的分頁只是輪替 refresh token 時本分頁不動(FE-3)。
4. **跟隨分頁不再先 401 一次**:等鎖後用目前的 refresh token 換出自己的 access token(FE-2)。
5. **網路錯誤、408/429 或 5xx 不再把使用者登出**:只有後端明確拒絕 refresh(400/401/403)才清 token(FE-3、最終檢視 I-1)。
6. **點名沒有「遲到」;手機點名多了「請假」**,手機「出席」由主色改綠,統計格 4 → 3 欄;桌面存檔 toast 不再追加
   「遲到已併為出席」類說明(FE-4)。
7. **購物車頁與購物車下拉的總額扣除已持有方案**,該行顯示「已持有，不計費」(FE-5)。
8. **mobile-admin 表單送出時才驗證**,錯誤顯示在欄位上(不再只是按鈕灰掉);建立失敗表單留著重試(FE-6)。
9. **教練新增:綁定失敗後 email/姓名/密碼鎖住**,toast 改「請直接再按一次「建立教練」重試綁定。」,並指名第一次
   建立的帳號(FE-6)。

10. **會員點數頁「本月累積」改讀後端 `earned_this_month`**:工作室月份、只算 `checkout_earn`、涵蓋所有頁。以前是第一頁
    帳本的正向 delta 加總(UTC 切月),所以現在會多算第 2 頁以後的本月入帳,不再算 `refund_restore`/`admin_adjust`
    的正值,台灣月初也正確(W-5)。
11. **今日場次狀態跟後端時鐘走**,不再用瀏覽器本地牆上時鐘;不同時區或時鐘偏差的檢視者看到的是工作室的狀態(W-5)。
    「即將開始」(`soon`)隨查表刪除,但沒有任何畫面實際產生它,所以沒有畫面失去狀態。
12. **admin 與 mobile-admin 訂單「收款時間」顯示後端真正的 `paid_at`**;尚無付款時間時 pending 顯示「—（待付款）」、其餘
    「—」(W-6)。
13. **桌面訂單狀態下拉:待付款只剩「已取消」**(W-6)。
14. **手機後台訂單頁唯讀**:移除「標記已付款」;待付款訂單只能在桌面取消(W-6,Ruling W6b;後端 BE-3 本就拒絕這條轉移)。
15. **活動紀錄的未知 `kind` 有 fallback**,不再因新值而壞掉(W-7,`728bdda`)。

其餘改動 wire 等價。

## 已知、刻意遞延

- ~~**購物車頁訂閱暖身只在 `onMount` 且已登入時跑**:auth 晚水合則先顯示未過濾總額;`CartDropdown` 是 reactive 不受影響。~~
  已修:`2aad98a` 起購物車頁暖訂閱隨登入狀態反應,`280d5ad` 起購物車頁與下拉都以登入身分為 key 暖機
  (R18 再收進根 layout,見 `docs/adr/0028` §3)。
  購物車頁的「項目總數」仍計全部行(FE-5)。
- **`ChargeableLine` brand 的 `it.skip` 編譯期反例隨 `submitOrder` 刪除**;`checkout-math.test.ts` 仍有反例(FE-5)。
- **`ClassForm` 的教練錯誤走 `Select` helper**,樣式可能不像錯誤(FE-6)。
- **`CoachForm` 重試只鎖三欄**;`bind-failed` 以外的狀態不鎖(FE-6)。
- **登入狀態(FE-2/FE-3)**:
  - 無 Web Locks 時並發背景 `hydrate` 會重放 refresh token(既有行為)。
  - ~~舊的 in-flight refresh 成功會覆寫新登入的 token(`setTokens` 無條件),回彈一次。~~ 已修:`a1c71d2` 起
    成功也做 compare-and-set(§1 已寫成現況)。
  - 換會員時一個分頁可能 `hydrate` 兩次(多一次輪替)。
  - 無鎖 fallback 或中途新登入時 compare-and-clear 回 false → 該請求 401。
  - refresh 2xx 但 body 解析失敗 → `unavailable`,留舊 token(延後失敗)。
  - `auth-mock.ts` 用 `importActual` 讓六個 mock 測試檔註冊真 listener(無害);
    ~~`client.test.ts` in-flight 測試未釘 fetch 次數與 `getAccess()` 狀態。~~ 已修:`cc7ae82` 補釘。
- **點數**:`seed-fixtures.ts` 的 desc「管理員點數調整」與 production「會員點數調整」不一致;`admin_adjust` 與 default
  共用文案,未知的新 reason 會顯示「會員點數調整」(窮舉 `never` 檢查可解)(FE-1)。
- **`track`/`bump` 各只有 `write` 一個呼叫者**,保留具名步驟因為記帳順序讀起來更清楚(FE-8)。
- **`setPref`/教練 `CoachNotFound` 重試/序列化測試保留**(模組專屬行為,非閘門協定),若審查要刪是各自獨立的區塊(FE-9)。
- **`mobile-admin/stores.test.ts` fresh-import 測試標題殘留「、」**已於 `56eb88c` 修正;`tsc --noUnusedLocals` 在
  4 個未動檔案的既有 unused-local 警告未碰(FE-9)。

- **wire 型別採用(W-4～W-8)**:
  - **member/mobile/public 頁面測試仍 mock 各自的 api 模組**(`docs/adr/0026` 的遞延,W-8 只對 admin 重開並結案)。
  - **`ADMIN_ROUTES` 部分預設回應目前沒有測試命中**(各頁都覆寫自己的主路由);保留是依任務要求,屬預備(W-8)。
  - **「發送催繳」仍在手機 `OrderSheet` 的 pending 頁尾**:純本機 toast、無後端呼叫;若「唯讀」也要拿掉它是一行刪除(W-6)。
  - **`wire:check` 在沒有 `DREAMFLY_BACKEND_DIR` 或後端無 `bindings/` 時 skipped、exit 0**:CI 若沒設就不擋漂移(W-4)。

## 被取代的 ADR 句子(舊 → 新)

被取代的是**歷史敘述**,各篇原文不改寫;以下列表加上各篇的 R17 增補為準。`CONTEXT.md`、
`docs/architecture.md` 已直接改成現況,不在表內。

| ADR(位置) | 舊句子 | 現況 |
| --- | --- | --- |
| `0006` §1 | 「失敗則清 token」 | 只有後端明確拒絕才 compare-and-clear;見 §1 與該篇 R17 增補 |
| `0014` :258-260 | `joinWaitlist`/`cancelWaitlist` 是 `gate.mutate(request, writeBack)` 的薄呼叫,進場快照、`markMutated()`、和解都在工廠內 | 是 `write({ send, commit })` + `resultOf`,同樣的步驟住在基礎閘門的 `write()`(§5) |
| `0014` :299-303 | 「`validateCoupon` 保留 export,三條單測釘 404 與其他錯誤分類」 | 併入 `applyCouponCode`,無 export;分類契約由 `applyCouponCode` 的案例釘住(§3) |
| `0014` :438、`0018` :481、`0024` :202、`0021` :319 | 「`badgeCleared` 為 true 才呼叫 `markMessageRead(m.id)`」 | 立即呼叫 `markMessageRead(id, badgeCleared)`,`write()` 等 ack 為 true 才翻已讀(§5) |
| `0016` :24、:41、:105、:122-126 | mutator「維持直寫 + 補 `gate.markMutated()`」;`markMutated()` 帶單調世代;整段收進 `createSessionGate` 的 `mutate()` | `markMutated`/`mutate` 已退役;世代由 `write()`(經 `bump`)遞增(§5) |
| `0016` :325、`0024` :76、`0025` :93 | 公開面 `hydrated`/`hydrate`/`refresh`/`invalidate`/`markMutated(tail?)`/`pageEntry`/`reset` | 公開面把 `markMutated(tail?)` 換成 `write()`;另匯出 `resultOf`、`WriteOutcome`、`Write`、`WriteRecovery` |
| `0017` :41、:67-85、:130 | `gate.mutate()` 吸收五份手焊骨架,五步驟;`queueReconcile` 在 session-gate | 五步驟是 `write()` 的演算法;和解鏈住基礎閘門(§5) |
| `0017` :85、:175 | 「樂觀 mutator 直接呼叫 `gate.markMutated()`,故 `markMutated` 仍留在 `SessionGate` 介面上」 | 樂觀 mutator 走 `write({ optimistic })`;`markMutated` 兩個介面都沒有 |
| `0017` :61-64、:283、`0025` :111 | `reset()` = `gate.reset()` + 重置 `reconcileChain`/`writeChain`;工廠內宣告順序 `reconcileChain` 先於訂閱 | 和解鏈在 `gate.reset()` 內清;session 的 `reset()` 只再重置 `writeChain` |
| `0018` §7(:239 起)、:242-248、:339 | C7 遞延:兩族 mutator 的 mutate 語意是否同構待確認 | **C7 結案**(§5):同一動詞的兩條路徑,差異在參數 |
| `0020` :20、:24、:111-114、:200-201 | `queueReconcile`「零 diff」,住 `session-gate.ts`,檢查軸是 session 世代 | 該函式搬進 `hydration-gate.ts`,軸是 `resetEpoch`;`mutate()`/和解鏈已併入 `write()` |
| `0020` :59、:231、:259、:274、:246 | 「寫入 → `markMutated` → `await refreshOps()`」;「遞增仍只走 `markMutated()`」;`opsGate.markMutated()` | 「`await write()` → `await refresh`」判準反例成立;遞增經 `write()` 內的 `bump()`;`markOrderPaid` 曾走 `opsGate.write()`,W-6 已刪(§9),ops 寫入動詞全是寫後無條件重抓 |
| `0021` :9-10、:19、:66-67、:73 | 「先寫 store + `markMutated()`」;`markMutated(tail?: Promise<unknown>)` 介面,「呼叫端義務:`tail` 必須是純網路尾流」 | 樂觀 `write()` 同序做;尾流就是 `send()` 的 promise,commit/復原在尾流之外(義務成為型別形狀) |
| `0021` :150、:153、:273、:285-286 | 機制表 `markMutated(tail?)`;呼叫點「4 點」`markMutated(patch)`/`markMutated(settled)`;`then(done, done)` 在 `markMutated` | `then(done, done)` 在 `write()` 的尾流入帳;入帳呼叫點是 `markRead`、`markAllRead`、`setPref` 三處(經 `write`) |
| `0021` :160-162、:229-230、:266、:296-298、:320-321 | 「`session-gate.mutate()` 本體零 diff,那四支刻意不走 `mutate()`」;`markOrderPaid`/`markMessageRead` 無尾流、`markMutated()` 在 PATCH 落定後 | `mutate` 已退役;`markMessageRead` 仍不入尾流帳,走非樂觀 `write()`(`commit` 在 `send` 落定後),無 `markMutated()`;`markOrderPaid` W-6 已刪(§9) |
| `0022` :26 | 三個 mobile 表單的 `onSave(body, isNew)` 簽章不變,由頁面分派 | `onCreate`/`onUpdate`,見 §4 與 `0023` R17 增補 |
| `0022` :31、:35、:303 | 寫入動詞「不呼叫 `markMutated()`」;`markOrderPaid` 最後 `opsGate.markMutated()` | 寫入動詞不走 `write()`(仍是寫後無條件重抓);`markOrderPaid` 曾走 `opsGate.write()`,W-6 已刪(§9) |
| `0022` :181 | 「`PT_TYPE` 雖零消費者仍保留」 | member `PT_TYPE` 保留(`/member/points` 使用,補 `adjust`/`refund`);**mobile `PT_TYPE` 已刪**(§2) |
| `0023` :53、:191、:433 | `gate.mutate(PATCH, …)`(本人帳號資料、教練設定) | `gate.write({ send, commit })`(`patchMe`);教練 `saveSettings` 本就不走 gate |
| `0023` :150、:200 | `changed` 才 `applyStatusChange` + `markMutated()`;`markMessageRead → markMutated` 不變 | 都是 `write()` 的 `commit`(§5) |
| `0024` :110、:262、:323 | pin 序列「load 在飛 → `markMutated` → `invalidate()`」 | 「未水合 `write()` 直寫 → 和解失敗翻回 false」(同一個閘門路徑,由真的 write 驅動) |
| `0024` :204-208 | `markMessageRead` 只做本地標已讀 + `messagesGate.markMutated()`;`load()` 終審修波的身分核對 | `markMessageRead(id, ack)` 走 `write()`;身分核對由閘門 stale 取代,`MessageThread` 的手寫核對已刪 |
| `0025` :30、:72、:399 | bug #3 與 pin「load 在飛 → markMutated → invalidate → 回應落地」 | 以未水合 `write()` + 和解失敗重現同一個狀態 |
| `0025` :93-100 | `reset()` 依序:丟在飛 GET → `resetEpoch` → `pendingTails = 0` → `opts.reset()` | 在 `pendingTails = 0` 與 `opts.reset()` 之間多一步:清和解鏈(`reconcileChain = Promise.resolve()`) |
| `0025` :113-116、:127-131 | 各模組匯出 `reset…ForTests = gate.reset`(`resetNotificationsForTests` 等),測試 `beforeEach` 呼叫;`*Hydrated.set(true)` 改 `reset…ForTests()` | 只剩 `resetOpsForTests`;其餘用 `resetSessionStores()`(§6) |
| `0025` :426、`0023` :346 | 判準守恆釘的 `opsHydrated.set(false)`、`opsHydrated` 皆不動 | 改 `resetOpsForTests()`;`opsHydrated` 不存在 |
| `0025` :300-333、:443 | `submitOrder` 為 mobile adapter 委派目標;`placeOrder — 委派 submitOrder` describe | `submitOrder` 已刪(§3);序列覆蓋改走 `confirmPay` |
| `0007`(R13/R16 增補)「≥2 surface 才進 `wire.ts`」、`ApiUser` 窄化投影「不會漂移」 | 手寫 response 型別住 `wire.ts`,窄化投影不漂移 | 回應形狀只有 `$lib/api/generated` 一個來源;窄化投影必須是產生型別的 `Pick<…>`(§7;該篇 W-7 增補) |
| `0018`/`0020`/`0021`/`0022`/`0023` 中 `markOrderPaid` 的敘述 | `markOrderPaid` 是 mobile-admin 的待付款 → 已付款 mutator(走 `opsGate.write`) | 已刪;手機訂單頁唯讀,`LEGAL_NEXT.pending = ['cancelled']`(§9);歷史敘述原文不改 |
| `0026` 的「明確不做」/「已知遞延」列 | admin 頁測試整支 mock `$lib/admin/api` | 走 HTTP seam + `ADMIN_ROUTES`(§10;`0026` W-8 增補) |
| `0016` :159-164 第 3 層「各 adapter 薄採用釘」 | 每 mutator 的 F1 跨登入釘、在飛登出棄寫釘、F2 完整性釘 | 每個 mutator 一條接線釘,只斷言可觀察結果(哪個政策、結果對不對);跨登入/在飛登出/序列化屬協定層,只在 `hydration-gate.test.ts`/`session-gate.test.ts` 驗一次(§6) |

## ADR 點名的測試:改寫,不刪(舊 → 新)

| ADR | 位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `0020`/`0021` 判準守恆釘(「寫入 → 重抓」) | `mobile-admin/stores.test.ts`、`hydration-gate.test.ts`、`load-gate.test.ts` | 手動 `markMutated()` 後 `await refresh` | 經 `write()`;無尾流的路徑逐字等價(一次 fetch、快照照常套用) |
| `0021` 記帳順序契約 | `hydration-gate.test.ts` | `markMutated(tail)` 後 subscriber 重入 `refresh()` 不發 GET | `write({ optimistic })` 版;F8a:另斷言 `fetch` 精確 2 次、`apply` 以 `['server']` 呼叫 |
| `0021` 清帳不沖新帳、清帳同拍新尾流 | `session-gate.test.ts` | `markMutated(tail)` | 樂觀 `write()`;同拍新尾流改精確計數(refresh 一次 + 一次和解),`apply` 次數斷言 |
| `0017` 和解家族(7 支)與 `mutate` 在飛丟棄 | `session-gate.test.ts` → `hydration-gate.test.ts` | session 閘門的 `mutate()` | 搬到 `hydration-gate.test.ts`「write() › 和解家族」,以 plain 閘門 + `gate.reset()` 代替登出/換帳號;session-gate 只留「寫入中換身分 → stale」 |
| `0024`/`0025` bug #3 pin(load 在飛 → 旗標翻回 false) | `hydration-gate.test.ts`、`load-gate.test.ts` | `markMutated(); invalidate()` 手動模擬失敗和解 | 未水合 `write()` + 和解 GET reject(真的和解失敗) |
| `0025` `reset…ForTests` 與 `*Hydrated.set(true)` | member/mobile/mobile-admin 各 store 與頁面測試、layout 測試 | `reset…ForTests()`、`*Hydrated` 斷言 | `resetSessionStores()`;`*Hydrated` 斷言刪除,改斷言可觀察結果 |
| `0024` MessageThread 身分守衛 | `MessageThread.test.ts` → `mobile-admin/stores.test.ts` | 元件層的「身分切換 guard」 | store 層「ack 落地前換身分 → 不碰新身分的 store」(對 `markMessageRead` 做過 mutation 檢查:繞過閘門即紅);元件測試改釘接線 `markMessageRead('conv-1', badgeCleared)` |
| `0023` `markOrderPaid` 與 `opsHydrated` | `mobile-admin/stores.test.ts` | 同步 seed + `opsHydrated` | FE-9 改成先 `hydrateOps()`、「mutation 勝出」兩支把和解 GET 當 server 真值;這兩支已隨 `markOrderPaid` 在 W-6 刪除(§9) |

對象已退役、隨之刪除的釘:點名「遲到」的 `hadLate` 案例與桌面 late toast 案例(`attendance-controller.test`、`attendance-tally.test`、`routes/coach/attendance/page.test`,FE-4;late fixture 改 absent,沒有任何 ADR 點名它們)。FE-9(協定層已各驗一次):`coach/api.test` 的 getter-dedupe/concurrent-share/A→B 身分(58 → 55)、
`leave-requests-api.test`(22 → 14)、`notifications.test`(15 → 9,含 1 支搬入的 mapping)、`mobile-admin/stores.test`
的 guard-shortcut/resetOps 自測/整個「mutator → gate.write」describe(48 → 41)、`self-account.test` 的
once-per-identity/A→B/logout-reset/queued-write-skip(22 → 18)、兩個通知頁的「首次成功載入會把守衛設為 true」。

## 關聯 ADR

- **`docs/adr/0007`**:response 型別改由後端產生、放置規則被取代(W-7 增補,已有;§7)。
- **`docs/adr/0022`**:`markOrderPaid` 移除(W-6 修正 1 增補,已有;§9)。
- **`docs/adr/0026`**:admin 頁測試 HTTP seam 遞延重開並結案(W-8 增補,已有;§10)。
- 後端 **`docs/adr/0016`**:wire 型別產生(ts-rs、`bindings/`)。

- **`docs/adr/0003`**:`createCheckout` 收合 relay(FE-5 增補,已有)。
- **`docs/adr/0004`**:購物車總額改走 `chargeableLines`(FE-5 增補,已有)。
- **`docs/adr/0006`**:compare-and-clear、只有明確拒絕才清、`onSessionExpired`、跨分頁(R17 增補,已有)。
- **`docs/adr/0014`**:ATT_CHOICES(R17 增補,已有);另補 `write()`/`validateCoupon`/`badgeCleared` 增補。
- **`docs/adr/0016`**、**`0017`**、**`0018`**(C7 結案)、**`0020`**、**`0021`**、**`0022`**、**`0023`**、**`0024`**、
  **`0025`**:各補 2026-10-03 增補,指回本篇對應小節。
- **`docs/adr/0026`**:§6 的住所與 §1 staff 登出的延伸(R17 增補,已有)。

## 增補(2026-10-05,架構深化 R18)

本篇原文不改寫,以下各點以本節為準。

- **§1 的延伸**:refresh 換出別人的憑證時,`onSessionRefreshed(user)` 讓 `authStore` 同一拍換身分(世代 +1);
  `api()` 的 401 只替發出當下的畫面身分重送,身分在 refresh 前或後變了就丟 `ApiError(401)`。:44-46 的「水合後仍不是
  事件當下的身分 → 登出」只剩 refresh 不可用時會走到;:58 的「換成 B 但 `/users/me` 失敗 → `LOGGED_OUT`」改為停在 B。
  見 `docs/adr/0028` §1。
- **§3 的訂閱暖機**(:89-91):改由根 layout 的行銷外殼以 `$sessionKey` 為 key 暖一次,購物車頁與下拉不再各自觸發;
  三處的總額推導收成 `chargeableCart(cart)`。見 `docs/adr/0028` §3。
- **:346「member/mobile/public 頁面測試仍 mock 各自的 api 模組」已結案**:走 HTTP seam,import-scan 契約禁 mock。
  見 `docs/adr/0028` §4。
