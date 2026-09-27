# Dream Fly 夢飛

夢飛體操與競技啦啦學苑的前端(會員中心 + 管理後台 + 行銷站)。此檔為領域語彙表(glossary),只收錄本專案特有、容易混淆的用語,隨討論逐步補完。

## Language

### 身分 (Identity)

**會員 (Member)**:
已登入的單一帳號;是報名、點數、訂閱 / 使用權的歸屬對象。目前帳號即學員本人,不分家長 / 學員。
_Avoid_: 使用者(指訪客時), 家長

**訪客 (Guest)**:
尚未登入的瀏覽者;可瀏覽、可加入購物車,但**結帳前必須先登入成為會員**(auth-at-checkout)。
_Avoid_: 使用者

**會員資料 (Member Profile)**:
會員本人可檢視、可自行修改的個人資料——姓名、電話、生日(email 只讀、加入年月由後端推導)——以及
本人的通知偏好(課前提醒、教練訊息、活動與優惠、深色模式)。真值在後端 `/users/me`,讀寫單一來源是
`src/lib/member/profile.ts`(member 與 mobile 共用同一顆,換帳號即重置;見 `docs/adr/0023`)。只收後端
真的有欄位的資料:會員編號、家長聯絡人、頭像顏色這類後端沒有的欄位不算會員資料,也不提供輸入。
_Avoid_: 帳號設定(那是含登出、密碼等的整個畫面), 個人檔案(與教練檔案混淆), 系統設定(那是 admin 的全域組態)

### 報名、訂閱與結帳 (Enrolment, Subscription & Checkout)

**課程 (Course)**:
一堂具體的班別(有名額、時段、可候補);會員對它「報名」。
_Avoid_: class(中英混用時)

**報名 (Enrolment)**:
會員確認加入某堂課程、進入該課名單的動作。
_Avoid_: 購買, 下單, signup

**方案 (Pass)**:
一種授予**入場 / 上課資格**的付費產品(單堂體驗、各項月票、無限會員卡等);是「入場資格」,與「報名某一具體課程」是不同概念,且兩者**彼此獨立**(持有方案不自動涵蓋課程報名)。經結帳後使會員取得「使用權」。課程與方案**都需可模擬線上付款成功**。
_Avoid_: 票券(誤導 —— 這不是活動票券), ticket

**訂閱 / 使用權 (Subscription / Entitlement)**:
會員因持有有效「方案」而具備的上課權利與當前狀態;系統需知道會員此刻訂閱了哪些方案。
_Avoid_: 會員卡(指實體卡時例外)

**購物車 (Cart)**:
一個人(訪客或會員)打算結帳的項目集合,可含「課程」與「方案」;從公開瀏覽、跨越登入、直到結帳全程保留。
_Avoid_: basket, 待結帳清單

**結帳 (Checkout)**:
將購物車內項目完成的步驟 —— 課程產生「報名」、方案產生「訂閱 / 使用權」;套用點數 / 優惠碼並確認。目前為**模擬,不接真實金流**。
_Avoid_: 付款, 購買

**結算 (Settlement)**:
一次「結帳」算出的結果——金額拆解(小計、折抵、應付、回饋點數)與該次產生的報名／訂閱及點數變動。「結帳」是動作,「結算」是其產物。
結帳前畫面上的結算預覽由結帳 controller 依輸入(優惠碼、點數折抵)以共用純數學算出,成交金額以後端訂單為準
(見 `docs/adr/0024`)。
_Avoid_: 以「訂單」指金額拆解(訂單是後端保存的紀錄,見下), 帳單

**訂單 (Order)**:
一次結帳送出後、由後端保存的紀錄(`POST /orders` 建立),有訂單編號、金額與狀態(待付款 / 已付款 /
處理中 / 已完成 / 已取消 / 已退款)。狀態只能沿合法轉移前進;已付款、處理中、已完成三者計入營收。
轉移規則、營收口徑與「變更狀態時各錯誤代表什麼」的單一來源是
`src/lib/admin/components/order-status.ts`(見 `docs/adr/0023`)。結算是前端算出的金額拆解,訂單是後端
留下的紀錄;方案購買的訂單產生訂閱,不是報名。
_Avoid_: 結算(指後端紀錄時), 帳單, 報名紀錄(訂單可能是方案購買)

**洽詢 (Enquiry)**:
訪客從公開網站送出、由人員後續**手動聯繫**的請求(一般問題);不產生報名 / 訂閱、也不收款。
_Avoid_: 用「結帳」稱呼此路徑

**試上預約 (Trial Inquiry)**:
洽詢的特化子類——訪客 / 會員預約一次試上體驗;沿用「洽詢」同一個後端端點與資料表送出
(`inquiry_type='trial'`),由人員後續手動聯繫安排,**不佔用課程名額、不產生報名紀錄**。
_Avoid_: 報名(不佔名額、不建報名紀錄), 候補(與名額無關)

**候補 (Waitlist)**:
當課程已額滿(無名額)時,會員登記的候補意願;不等於完成報名。
_Avoid_: 報名, 預約

**請假 (Leave Request)**:
會員針對已報名課程的**某一具體場次**事先申請不出席;狀態為 待審核(pending)→ 已核准(approved)/
已婉拒(rejected),或由會員自行取消(cancelled,僅「待審核」可取消)。請假不是取消報名。
一筆請假可觸發哪個動作(取消 / 預約補課 / 已補課僅顯示 / 無)的規則單一來源是
`src/lib/domain/leave-requests.ts` 的 `leaveAction()`(見 `docs/adr/0022`)。
_Avoid_: 缺席(點名結果,不是事先申請), 取消報名, 候補(與名額無關)

**補課 (Makeup)**:
「已核准」的請假之後,會員另外預約**同一課程的一個未來場次**來補上缺的那堂;是與請假申請分開的
第二個動作(`POST /leave-requests/{id}/makeup`),每筆請假至多補一次,已補課者只顯示、不可再約。
_Avoid_: 請假(申請不出席是請假,補上那堂才是補課), 改期, 報名(補課不是新的一次報名)

### 後台管理 (Admin Operations)

**系統設定 (Settings)**:
admin 專屬的全域組態(場館基本資料、通知開關、雙重驗證等),後端是單純的 key-value 表;跟會員 /
教練各自的個人化偏好是不同層級,不互相涵蓋。
_Avoid_: 偏好設定(那是使用者各自的設定,非全域)

**報表 (Reports)**:
admin(以及 coach / member 各自窄化版)看到的營運彙總數字與趨勢(營收、會員、課程、出席率等),
即時聚合、不落地存成另一份資料。口徑(例如「營收」算折扣前或折扣後、出席率是否排除請假)由後端
`dream_fly_backend` 的 ADR-0004 統一定義,前端不得自創算法。
_Avoid_: 統計(過於籠統)

### 前端技術用語 (Frontend Technical Terms)

**載入閘門 (Load Gate)**:
頁面資料載入的三態(loading/error/ready)機制;單一來源 `src/lib/load-gate.ts` 的
`createLoadGate`/`createPagedLoadGate`(見 `docs/adr/0008`)。共享 store 的水合協定可經
`hydrate` 選項直接收進閘門本身(guard 短路/post-await 重查/mutator 翻旗一次到位),語意同下方
「水合閘門」詞條(見 `docs/adr/0008` 增補);另帶兩個可選欄 `hydrate.gen` 與 `hydrate.pendingSettle`
——在場時 `refresh()`/`silentRefresh()` 分別改走世代穩定重抓與 mutation settle 等待(見下方第四、
第五決策點)。接共享 store 的頁面一律寫 `createLoadGate({ ...gate.pageEntry() })`,兩欄由水合閘門的
頁面進場包一併佈線。重入防護(F1)/(F5)留在本閘門,不委派給水合閘門(見 `docs/adr/0016` 決定一)。
_Avoid_: 手抄 phase 機制、手焊 skip+onData 水合組合、拿 store 的 `hydrate`/`refresh` 那一對當
`fetch`/`refresh`(寫共享 store 的變成 store 閘門,卸載棄追與後發優先都護不到)

**水合閘門 (Hydration Gate)**:
共享 store 的水合協定(guard 短路、post-await 重查「mutation 勝出」、mutator 翻旗);單一來源
`src/lib/hydration-gate.ts` 的 `createHydrationGate`(見 `docs/adr/0008` 註記)。公開面是 `hydrated`/
`hydrate()`/`refresh()`/`invalidate()`/`markMutated(tail?)`/`pageEntry()`。`hydrate()` 與頁面進場包的
`fetch` 共用同一支在飛 GET(只併入同世代出發的那支,settle 即清);refresh 族一律真抓、不合併。
`invalidate()` 只把旗標翻回 false,是 production 翻旗的唯一寫法(見 `docs/adr/0024`)。第四決策點是
**世代穩定重抓**(`fetchGenStable`,refresh 族專用):進場捕捉 mutation 世代、落地比對,期間發生的本地
mutation 讓那份快照作廢並原地重抓;hydrate 路徑刻意不套(見 `docs/adr/0020`)。第五決策點是**mutation
settle 訊號**(`markMutated(tail?)` 記帳、`pendingSettle` 讀取,同為 refresh 族專用):樂觀 mutation 是
「先寫 store 再 await PATCH」,尾流在飛這件事對世代軸不可見——GET 搶跑會拿到 server 舊真值而世代
此刻已穩定。故 refresh 族每次出發前先等未 settle 的尾流全數落地(reject 也算 settle),靜止時
`pendingSettle` **同步**回 `undefined`、零額外成本(見 `docs/adr/0021`)。**等待軸與丟棄軸正交**:
等待只認尾流、丟棄只認進出場世代比對,兩軸不得互換。世代與尾流帳的讀取器只經頁面進場包交出。
_Avoid_: 手抄 *Hydrated 旗標協定;production 直寫 `hydrated`(翻 false 走 `invalidate()`);呼叫端
自己包一層在飛合併;refresh 族以旗標/世代的**當下值**當丟棄判準(正常的「寫入 → markMutated →
await refresh」序列會因此無窮重抓);把等待判準接上世代(同一條正常序列會永久掛住)或把丟棄判準接上
尾流(0020 關掉的窗當場復發)

**頁面進場包 (Page Entry)**:
水合閘門交給頁面載入閘門的進場物——`gate.pageEntry()` 回傳 `{ fetch, refresh, hydrate }`,頁面寫
`createLoadGate({ ...gate.pageEntry() })` 即可。plain 閘門(如 mobile-admin 的 `opsGate`)與 session
閘門都交出同一形(自 `docs/adr/0024` 起住 `HydrationGate`,原本只住 session 閘門)。`fetch` 與閘門的
`hydrate()` 共用在飛 GET,`refresh` 是不合併的另一支;session 閘門餵進來的是 epoch 核對過的 fetch,
所以兩支都自帶核對,頁面結構上拿不到 raw getter。`hydrate.flag` 是閘門自己的 `hydrated` 同一實例、
`hydrate.into` 是同一支 apply,不是複本;`hydrate.gen`/`hydrate.pendingSettle` 同理是閘門的同一支
讀取器——頁面的 refresh 族與 store 閘門讀**同一本**世代帳與**同一本**尾流帳(見 `docs/adr/0020`、
`docs/adr/0021`)。寫共享 store 的是頁面的載入閘門,所以卸載之後或被新一輪取代的回應不會寫進 store。
跨登出/換帳的在飛回應會讓 fetch 拋出,落進 load-gate 既有的 error 態,使用者重試時回落同一支
核對過的 fetch(零新程式路徑;見 `docs/adr/0019`)。
_Avoid_: 通知頁一類頁面以 raw fetch(未經 epoch 核對的 API getter)直入 load-gate;頁面直接讀閘門的
世代/尾流帳(讀取器只經進場包交出)

**session 閘門 (Session Gate)**:
domain store 對「會員身分變更」(登入/登出、或不經整頁重載直接換帳號)的感知與重置協定;單一
來源 `src/lib/session-gate.ts` 兩門——`createSessionGate`(水合閘門 + identity 重置 + epoch 核對 fetch
+ `mutate()` + 寫入鏈 `queueWrite()`,頁面進場包繼承自水合閘門;供 waitlist/請假/通知/會員資料/教練
身分/mobile-admin 訊息——通知自 2026-09-26 起是 member 與 mobile 共用的同一顆閘門,mobile 經自家
`mobile/stores.ts` 轉出取用,見 `docs/adr/0022`;會員資料同樣兩端共用一顆,教練身分住 `coach/api.ts`
內部、每個 session 只解析一次,mobile-admin 訊息換教練帳號即重置,三者見 `docs/adr/0023`)、
`createSessionRefresher`(無條件重抓 + 在飛換帳靜默丟棄,供點數/訂閱)。身分基準在建構當下決定:
restored 與訪客開機一律**零觸發**,只有身分真的變了才重置(reset 值 = 開機值,畫面無差別),宣告順序
不是契約。`queueWrite` 排進同一條寫入鏈:輪到時身分已換就跳過,換帳號即重置這條鏈(見
`docs/adr/0024`)。原第三門 `onSessionReset`(僅重置、閘門所有權留呼叫端)已於 2026-08-03 隨其唯一
消費者(行動版通知)改建完整閘門而退役(見 `docs/adr/0017` 增補與 `docs/adr/0019`)。
_Avoid_: 手抄 epoch/訂閱重置/和解鏈/寫入鏈(單一來源之外的複本)、`*Hydrated` 旗標跨登入存活、
開機時為了「對齊開機值」而觸發 reset

**暖機清單 (Warm Set)**:
一個 surface 的外殼(Topbar/Sidebar/TabBar)在任何頁面之前就要讀的共享 store 清單,由該 surface 的
`+layout.svelte` 宣告,以身分為 key 呼叫 `$lib/store-warm` 的 `warmStores(caller, tasks)`
(best-effort:`Promise.allSettled`,單項失敗只記 log)。member/mobile 暖通知,mobile-admin 只在教練
分區暖訊息。每個身分只打一次 GET:閘門守衛擋重訪、在飛合併擋掉同頁載入的重複、換身分時閘門自己
重置。暖機前 store 是誠實的開機值(空清單,角標不顯示),不是種子(見 `docs/adr/0024`)。
_Avoid_: 用 getter 的副作用水合外殼角標(呼叫端看不出這一層);seed teaser(開機先顯示種子裡的假數字)

**顯示查表 (Display Lookup)**:
狀態/類型 → tone/label(部分為純 tone,狀態字面本身即顯示標籤)對照表;單一來源集中在 `$lib/domain`
各 entity 檔(`members.ts`/`venues.ts`/`tickets.ts`/`classes.ts`/`course-level.ts`/`sessions.ts`)與
`member-app.ts`(member/mobile 雙生的查表與成對常數)。取用形只有兩種:facade 若**真的**攜帶本檔
型別事實(以自身較嚴格或不同形狀的 `Tone` 對同一參照純註記收窄,零 `as` 斷言),消費端經該 facade
取用——mobile-admin/member/mobile 屬此;facade 若只是同源且結構恆等的轉手(admin 這類 `Tone` 與 wire
相容、無可收窄者;facade 端改過名的 alias 亦同),該層已於 2026-08-03 全數退役,消費端改**直取**
`$lib/domain` 各 entity 檔或 `$lib/api/wire`(見 `docs/adr/0013` 與其增補、`docs/adr/0019`)。
報表面板的**呈現素材**(三序列色盤、`{label,color}` 桶表、`REPORT_SCALES` 像素值域)不是域語彙,
單源住 `admin/report-math.ts`、與逐面板 VM 算式同居,兩 surface 直取(見 `docs/adr/0013` 增補)。
_Avoid_: facade 各自複製一份查表、同名異義的表(同一個鍵在不同表裡代表不同語意卻共用一個名字)、
零型別事實的純轉手 re-export(假接縫——只換來一批逐符號同一性守護測試)。mobile 的 store/動作轉手不在此列:
`mobile/stores.ts` 的 seam 管 import 方向,照留;它的逐符號身分釘已於 R14 退役(見 `docs/adr/0024`)

**匯入掃描器 (Import Scan)**:
原始碼層 import 掃描的 test-support 模組;單一來源 `$lib/testing/import-scan.ts`(`walk`/
`importSpecifiers`/`makeReachPredicate` 三支,字串/註解/模板感知、六輪 codex 硬化),供接縫契約
測試掃 production 檔(見 `docs/adr/0014` §1 與 R5 C3 升格)。
_Avoid_: 契約測試檔內重新手焊 regex 掃描;production 檔 import `$lib/testing`(dogfood 契約會紅)

**可計費行 (ChargeableLine)**:
可進「結帳」金額計算與請款的購物車項目;唯一產地 `member/checkout.ts` 的 `chargeableLines()`
(濾除已訂閱方案後打上 brand),`checkoutMath` 與 `submitOrder` 兩終點只收此型別。
_Avoid_: 未過濾清單直餵 checkoutMath/submitOrder(編譯期擋);production 檔於唯一產地之外自行
`as` 斷言打 brand(測試 fixture 的檔內 helper cast 屬受核可例外,見 `checkout-math.test.ts` 檔頭)
