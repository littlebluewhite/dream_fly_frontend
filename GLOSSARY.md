# Dream Fly 夢飛

夢飛體操與競技啦啦學苑的前端(會員中心 + 管理後台 + 行銷站)。此檔為領域語彙表(glossary),只收錄本專案特有、容易混淆的用語,隨討論逐步補完。

## Language

### 身分 (Identity)

**會員 (Member)**:
已登入的單一帳號;是報名、點數、訂閱 / 使用權的歸屬對象。帳號即學員本人,不分家長 / 學員。
_Avoid_: 使用者(指訪客時), 家長

**訪客 (Guest)**:
尚未登入的瀏覽者;可瀏覽、可加入購物車,但**結帳前必須先登入成為會員**(auth-at-checkout)。
_Avoid_: 使用者

**登入狀態 (Login State)**:
這個分頁此刻是不是登入、登入的是誰——`$authStore` 的 `{ loggedIn, member, roles }`,單一 owner 是登入狀態核心
`src/lib/stores/login-state.ts`(token 對、refresh 單飛與跨分頁鎖、拒絕表、compare-and-set/clear、session 世代、
身分 key `sessionIdentity()`、水合與 `storage` listener 都住這裡);`authStore.ts` 是對外門面,打 `/auth/*` 後把結果交給
核心(`startSession`/`endSession`/`hydrateSession(fetchMe)`/`watchOtherTabs(fetchMe)`/`syncUser`),`$authStore` 就是核心的
`loginState`。`api()` 只是向核心要憑證的 transport(`accessToken()`/`currentIdentity()`/`refreshFor(issuedBy)`);核心不
import client 與 authStore(`/users/me` 由 authStore 以 `fetchMe` 傳入),production 只有核心能 import token 儲存 adapter
`api/tokens.ts`(import-scan 契約)。真相是共用的 refresh token
(`dreamfly_refresh`);`dreamfly_auth` 只是首屏快取。四種事件會改變它,全都只是 `set` 這顆 store,
守門導向、session 閘門重置與結帳導向都沿用既有的身分改變那條邊:本分頁登入/登出;後端明確拒絕 refresh(400/401/403)而
核心真的清掉 token(網路錯誤、408/429 與 5xx 不清、不登出)(只在 `performRefresh()` 的唯一清除點登出);別的
分頁改了 storage(`storage` listener,只看**目前 storage**:沒 refresh token → 登出;快取身分是另一位
已登入者 → 重新水合,水合後仍不是那位(refresh 暫時不可用)就登出;refresh token 只被輪替 → 不動,否則分頁會互相觸發 refresh)。access token 只住
各分頁記憶體,跨分頁變化時用 `forgetAccess()` 丟掉本分頁那顆,不碰共用的 refresh token(見
`docs/adr/0006` R17 增補)。第四種:refresh 換出**別人**的憑證(別的分頁已換登、本分頁還沒收到 `storage` 事件)——
核心在 compare-and-set 成功時發現 refresh 回的 `user` id 不同,就同一拍換成那位,
token 與畫面身分永不分頭換(refresh 成功但 `/users/me` 失敗也停在新身分)。**401 重送規則**:`api()` 發請求時記下
當下的畫面身分(核心的 `currentIdentity()`),遇 401 交給核心的 `refreshFor(issuedBy)`,只有 refresh 前後身分都沒變
才重送,否則丟 `ApiError(401)`——舊畫面的寫入不得以新身分的憑證送出。**頁面壽命**:`lastSessionKey`
(`lastLoggedIn(sessionKey)`,登出時不通知、保留上一個身分)是身分範圍 `{#key}` 的 key(member/mobile/coach/mobile-admin
layout 把 slot 交給它),換人即重掛載頁面、登出不重掛載(交給 guard 導頁);閘門不得用它(見 `docs/adr/0028` §1–§2)。
_Avoid_: 登入態(混用時統一用「登入狀態」), 看 `dreamfly_auth` 判斷是否登入(那是快取), 在 listener 裡
因為 refresh key 變了就重新水合, 畫面身分與 token 分頭換(token 已是 B、畫面仍是 A;或 401 重試以 B 的憑證替 A 的
畫面重送), 閘門以 `lastSessionKey` 為 key(它吞掉登出), client 與 authStore 之間的 callback hook(`onSessionExpired`/
`onSessionRefreshed`/`bindSessionIdentity` 已退役), 在核心以外寫 token

**本人帳號資料 (Self Account)**:
任何已登入者(會員、教練或其他 staff)自己的帳號資料——姓名、電話、生日、email(只讀)、加入年月與
上次登入時間——連同本人的通知偏好。真值在後端 `/users/me`,讀寫單一來源是 `src/lib/self-account.ts`
(`selfAccount`/`hydrateSelfAccount`/`saveSelfAccount`/`selfAccountEditError`,建在 session 閘門上,
換帳號即重置)。member、mobile 與教練端(`coach/api.ts` 的教練閘門與 `saveSettings`)共用同一顆,
所以同一位登入者在同一個頁面 session 裡從任何一端改名,各端讀到的都是新名字。存檔只送與目前值
不同的欄位,全部相同就不發請求(見 `docs/adr/0023`、`docs/adr/0026`)。教練檔案(`GET /coaches`)是另一份資料,不屬於本人帳號資料。
_Avoid_: 個人檔案(與教練檔案混淆), 教練檔案(那是 `/coaches` 的那一列), 對 staff 說「會員資料」

**會員資料 (Member Profile)**:
本人帳號資料在會員端的視角:會員在 member 帳戶頁與 mobile 設定頁可檢視、可自行修改的姓名、電話、
生日,以及通知偏好(課前提醒、教練訊息、活動與優惠、深色模式)。沒有自己的 module,讀寫都經
`src/lib/self-account.ts`。只收後端真的有欄位的資料:會員編號、家長聯絡人、頭像顏色這類後端沒有的欄位
不算會員資料,也不提供輸入(見 `docs/adr/0023`)。
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
將購物車內項目完成的步驟 —— 課程產生「報名」、方案產生「訂閱 / 使用權」;套用點數 / 優惠碼並確認。付款為**模擬,不接真實金流**。
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
留下的紀錄;方案購買的訂單產生訂閱,不是報名。「付款時間」是後端的 `paid_at`(沒有時顯示「—」,待付款顯示
「—（待付款）」),前端不推算。前端不提供待付款 → 已付款(後端拒絕,待付款只能取消),所以手機後台訂單頁唯讀
(見 `docs/adr/0027` §9)。
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
一筆請假的顯示(狀態 tone/label、場次與補課時間文字)與可觸發哪個動作(取消 / 預約補課 / 已補課僅顯示 /
無)的規則單一來源是 `src/lib/domain/leave-requests.ts` 的 `leaveRow()`(對外唯一公開 API;內部的
`leaveAction()`/`STATUS_BADGE` 為模組私有實作細節,見 `docs/adr/0022`、`docs/adr/0025`)。補課日期或
時間缺漏時 `leaveRow().makeupWhen` 回 `null`,呼叫端據此不渲染該行,不會顯示「(undefined)」。
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
`createLoadGate`/`createPagedLoadGate`(見 `docs/adr/0008`)。只管 phase、run 世代、掛載首載、卸載與
`onError`(元件初始化期建構即於掛載時自動首載,頁面不寫 `onMount(() => gate.load())`;元件外或較晚
才建構的不自動 load、也不自動 destroy);
`LoadGateOptions<T>` 是判別聯集——plain 頁面給 `{ fetch, onData?, onError? }`,接共享
store 的頁面給 `{ source: LoadSource, onError? }`(`source` 與 `fetch` 互斥)。`LoadSource` 是水合
閘門交出的 port(`guarded()`/`load(isCurrent)`/`refresh(isCurrent)`),`isCurrent` 是 load-gate 給
source 的棄追判準(未卸載且仍是最新一輪 run);guard 短路、post-await 重查「mutation 勝出」、mutator
翻旗一次到位這些決策全歸 source 那一側(水合閘門)做,load-gate 只負責呼叫並尊重 `isCurrent()`。接共享
store 的頁面一律寫 `createLoadGate({ ...gate.pageEntry() })`。重入防護(F1)/(F5)留在本閘門,經
`isCurrent` 交給 source 尊重,不下沉給水合閘門(見 `docs/adr/0016` 決定一、`docs/adr/0025` F-1)。
_Avoid_: 手抄 phase 機制、手焊 skip+onData 水合組合、消費端直讀共享 store 的旗標當 `fetch`/`refresh`
(寫共享 store 的變成 store 閘門,卸載棄追護不到;後發優先改由水合閘門的出發序帳負責,見該詞條)

**水合閘門 (Hydration Gate)**:
共享 store 的水合協定(guard 短路、post-await 重查「mutation 勝出」、mutator 翻旗);單一來源
`src/lib/hydration-gate.ts` 的 `createHydrationGate`。公開面是
`hydrated: Readable<boolean>`/`hydrate()`/`refresh()`/`invalidate()`/**`write()`**/
`pageEntry()`/**`reset()`**(`markMutated` 與 session 閘門的 `mutate()` 已退役,`write()` 是唯一寫入動詞)。`hydrated` 唯讀,production 翻旗只能經 `invalidate()`(翻
false)或水合/重置流程(翻 true);型別層擋直寫(見 `docs/adr/0024` D-F2a、`docs/adr/0025`「閘門
重置」)。`pageEntry()` 交出 `{ source: LoadSource }` 給 load-gate,`hydrate()` 與 `source.load`
共用同一支在飛 GET(只併入同世代出發的那支,settle 即清);refresh 族(`refresh()`/`source.refresh`)
一律真抓、不合併。第四決策點是**世代穩定重抓**(`fetchGenStable`,模組私有、refresh 族專用):進場
捕捉 mutation 世代、落地比對,期間發生的本地 mutation 讓那份快照作廢並原地重抓;hydrate 路徑刻意不套
(見 `docs/adr/0020`)。第五決策點是**mutation settle 訊號**(樂觀 `write()` 把 `send()` 記成尾流、
`pendingSettle` 內部讀取,同為 refresh 族專用):樂觀 mutation 是「先寫 store 再 await PATCH」,尾流
在飛這件事對世代軸不可見——GET 搶跑會拿到 server 舊真值而世代此刻已穩定。故 refresh 族每次出發前先等
未 settle 的尾流全數落地(reject 也算 settle),靜止時同步出發、零額外成本(見 `docs/adr/0021`)。
**等待軸與丟棄軸正交**:等待只認尾流、丟棄只認進出場世代比對,兩軸不得互換。第四、第五決策點只住
`hydration-gate.ts` 內部,load-gate 與消費端只看得到黑箱的 `source.refresh(isCurrent)`。第六決策點是
**出發序帳**(`createDepartureLedger`,同檔匯出供 session refresher 共用):後出發者贏。hydrate 的合併 GET
(加入者共用一號)與 refresh 族(`refresh()`/`source.refresh`/世代重抓輪/和解/resync)出發時同步取號,
落地時已有更晚出發的落地就靜默返回(不等、不重抓、不拋)——先出發的快照較晚落地不再蓋回較新的,不分
是哪個 caller 出發的。先出發的先落地照常套用、之後再被蓋過;後出發的 reject 時先出發的照常套用;被超車的
和解不 invalidate,被超車的 resync 仍回報 resynced。**三軸互相獨立**:世代軸管丟棄、尾流軸管等待、出發
序帳只管誰的落地算數;`write()`/`invalidate()`/`reset()` 不碰這本帳。`write()` 失敗後的復原步驟(keep/rollback/resync,重抓也失敗才退回 undo、重抓期間擁有者換人回 stale)是同檔匯出的 **`recoverWrite`**,session 閘門的 `queueWrite` 在寫前水合失敗時共用同一支。**`reset()`**(選配 `opts.reset`):依序丟棄在飛 GET、換尾流帳本(`resetEpoch += 1`)、清尾流計數與和解鏈、還原內容、
旗標翻 false、喚醒全部尾流等待者;重置前出發的
load/refresh 落地時因 `resetEpoch` 比對不符而不寫、不翻旗。session 閘門(waitlist/leave/notifications/教練對話列表)不再匯出測試專用的重置,測試用真的登入 → 登出
(`$lib/testing/session-reset`)讓身分走一圈;只剩身分無關的 `resetOpsForTests`(三個 ops 水合單位一起 reset)與 `resetAnnouncementsForTests = announcementsGate.reset`,
production 不得 import(`import-scan.test.ts` 契約守)。各 store 不再匯出 `*Hydrated`(`hydrated` 只留在閘門介面當唯讀探針)。
_Avoid_: 手抄 *Hydrated 旗標協定;production 直寫 `hydrated`(型別已擋,執行期丟 `TypeError`);呼叫端
自己包一層在飛合併;refresh 族以旗標/世代的**當下值**當丟棄判準(正常的「`await write()` →
`await refresh()`」序列會因此無窮重抓);把等待判準接上世代(同一條正常序列會永久掛住)或把丟棄判準接上
尾流(0020 關掉的窗當場復發);消費端手寫出發序號(`refreshSeq` 一類)替共享 store 排後發優先;讓被超車
的落地等贏家(第二條等待軸)

**頁面進場包 (Page Entry)**:
水合閘門交給頁面載入閘門的進場物——`gate.pageEntry()` 回傳 `{ source: LoadSource }`,頁面寫
`createLoadGate({ ...gate.pageEntry() })` 即可(見 `docs/adr/0025` F-1)。plain 閘門(如
mobile-admin ops 集合的三個水合單位,各交出 `membersPageEntry`/`classesPageEntry`/`ordersPageEntry`)與 session 閘門都交出同一形(住 `HydrationGate`)。`source.guarded()`
是 guard 短路,`source.load(isCurrent)`/`source.refresh(isCurrent)` 內部各自委派
`loadRun`/`refreshRun`——`load` 與閘門的 `hydrate()` 共用在飛 GET,`refresh` 是不合併的另一支;
session 閘門餵進來的是 epoch 核對過的 fetch,所以兩支都自帶核對,頁面結構上拿不到 raw getter。
`isCurrent` 由 load-gate 交給 source,是「未卸載且仍是最新一輪 run」的棄追判準——source 只能讀它,
拿不到 phase 或世代的寫入權。世代帳與尾流帳的讀取器只住
`hydration-gate.ts` 內部,`refreshRun` 自己讀(見 `docs/adr/0020`、`docs/adr/0021`)。
寫共享 store 的仍是頁面的載入閘門,所以卸載之後或被新一輪取代的回應不會寫進 store。跨登出/換帳的在飛
回應會讓 fetch 拋出,落進 load-gate 既有的 error 態,使用者重試時回落同一支核對過的 fetch(零新程式
路徑;見 `docs/adr/0019`)。閘門 `reset()` 之後,重置前出發的 load/refresh 落地一律不寫(見上方
「水合閘門」詞條)。
_Avoid_: 通知頁一類頁面以 raw fetch(未經 epoch 核對的 API getter)直入 load-gate;頁面直接讀閘門的
世代/尾流帳

**ops 集合 (Ops Collections)**:
mobile-admin 跨頁共用的四個集合 `members`/`classes`/`coaches`/`orders`(住 `mobile-admin/stores.ts`,對外只匯出
`Readable`),拆成三個水合單位,各是一顆 plain 水合閘門:**會員**(`getMembers(1)`)、**課程·教練**(`getClasses(1)`,
一次填 classes 與 coaches——課程列的教練名來自同一份教練列表)、**訂單**(`getOrders(1)`)。三個單位**只抓第 1 頁**
(行動版不能換頁,分頁 meta 進 `opsPages`,超過一頁時 `searchCapHint()` 提示搜尋範圍)。**開機值等於重置值**
`EMPTY_OPS`(集合 `[]`、分頁 meta 0/0,`docs/adr/0025` F-3),每個單位只寫、只重置自己那一格 `opsPages`。單位之間互不
牽連:一支端點壞掉只有那一頁顯示錯誤。頁面經各自的 `*PageEntry` 進場(教練畫面用 `classesPageEntry`),首頁的
待付款 banner 只呼叫 `hydrateOrders()`。寫入動詞成功後只刷新受影響的單位,同時發出(`Promise.allSettled`)、某單位
失敗只記 log 不丟出(`docs/adr/0022` §1);後端的訂單列表與教練列表都即時 JOIN 使用者名字,所以改名波及三個單位:

| 動詞 | 刷新的單位 |
|---|---|
| `addMember`、`saveMember`(名字沒變) | 會員 |
| `saveMember`(改名)、`saveCoach`(改名) | 會員、課程·教練、訂單 |
| `addCourse`、`saveCourse`、`saveCoach`(名字沒變) | 課程·教練 |
| `addCoach`(created) | 會員、課程·教練 |

_Avoid_: 一個單位整包抓四個集合(一支壞掉全頁陪葬、寫一筆重抓全部);頁面自建 ops 閘門(集合跨頁共用);改名
只刷新自己那個單位(其他集合上的名字會停在舊值)

**session 閘門 (Session Gate)**:
domain store 對「會員身分變更」(登入/登出、或不經整頁重載直接換帳號)的感知與重置協定;單一
來源 `src/lib/session-gate.ts` 兩門——`createSessionGate`(水合閘門 + identity 重置 + epoch 核對 fetch
+ 寫入鏈 `queueWrite()`,寫入動詞 `write()` 與頁面進場包都繼承自水合閘門;供 waitlist/請假/通知/本人帳號資料/
教練身分/教練對話列表——通知是 member 與 mobile 共用的同一顆閘門,mobile 經自家
`mobile/stores.ts` 轉出取用,見 `docs/adr/0022`;本人帳號資料由 member、mobile 與教練端共用一顆,教練
身分住 `coach/api.ts` 內部、每個 session 只解析一次(只快取教練檔案,見 `docs/adr/0026`),教練對話列表
換教練帳號即重置,三者見 `docs/adr/0023`、`docs/adr/0029`)、
`createSessionRefresher`(無條件重抓 + 在飛換帳靜默丟棄 + 後發優先,供點數/訂閱:與水合閘門共用出發序帳,
先查 epoch 再問 `overtaken`,被超車的落地一樣靜默丟棄——開啟結帳的舊快照較晚落地,不再蓋回付款後的、
把已持有的方案又變成計費行;帳本不隨身分重置,換帳前出發的落地先被 epoch 擋掉)。「身分」的 key 由 `authStore.ts`
(轉出登入狀態核心 `login-state.ts`,見「登入狀態」)匯出的純函式 `sessionIdentity()` 單一持有(未登入為 `null`,登入時為 `member.id`,缺 id 退化為空字串);
閘門內部與身分範圍的暖機 key(`$sessionKey`)都呼叫它,
不各自手抄公式(見 `docs/adr/0026`)。身分基準在建構當下決定:
restored 與訪客開機一律**零觸發**,只有身分真的變了才重置(reset 值 = 開機值,畫面無差別),宣告順序
不是契約。`queueWrite(w)` 是排進同一條寫入鏈的單一寫入:`w` 與 `write()` 收的寫入同形,只差 `send` 可回
`null`(不用送,回 `written(null)`)。入列當下同步記身分與是否已水合並套用 `optimistic`;輪到時身分已換回
`stale`;寫前先 `hydrate()`,失敗走水合閘門的 `recoverWrite`(不送出、不推世代);水合後再比一次身分,
入列時未水合就再套一次 `optimistic`(所以它必須冪等),再交給 `write()`。消費端只交 optimistic/send/commit/
onFailure 並對應結果,不自己讀旗標、不手寫 resync/回滾。換帳號即重置這條鏈(見 `docs/adr/0024`)。`reset()` 呼叫水合閘門通用的
`gate.reset()`(連和解鏈一起清),再重置 `writeChain`(見 `docs/adr/0025`「閘門重置」、`docs/adr/0027` §5);
「誰換人、何時換人」這個 session 專屬判斷只住本檔。
閘門管的 store **內容唯讀**:擁有者模組持有私有 `writable`、只匯出 `Readable`(點數三顆、訂閱已是這個形狀),只有閘門的 apply/commit
(與 reset)能寫;測試不 `.set()`,而是 route 水合用的 GET 再呼叫 `hydrateX()`/`refreshX()` 取得狀態。
_Avoid_: 手抄 epoch/訂閱重置/和解鏈/寫入鏈/身分 key 公式(單一來源之外的複本)、`queueWrite` 消費端自寫的寫前水合或復原分支、`*Hydrated` 旗標跨登入存活、
開機時為了「對齊開機值」而觸發 reset、從擁有者模組外寫 store 內容

**教練對話列表 (Coach Conversation List)**:
登入教練本人的對話摘要(`GET /conversations/me`)的唯一 owner,`src/lib/coach/conversations.ts`,建在
`createSessionGate` 上(換教練帳號即重置,在飛舊回應作廢)。持有列表本身、`unreadConversationCount`
(有未讀的**對話數**,不是未讀則數加總),以及作用在列表上的三個非樂觀 mutator:`markConversationRead(id,
badgeCleared)`、`recordSent(id, ctrl.send(text))`、`recordCreated(ctrl.confirmCompose())`——呼叫端在 await
之前把 `messages-controller` 的 promise 交進來,`write()` 當下記住身分,落地前換人即 stale;controller 不認識
列表。讀者:桌面訊息中心與工作台、桌面側欄角標、mobile-admin 訊息頁／對話串／TabBar(教練首頁不讀列表,見
`docs/adr/0029`)。再次進頁先顯示已有的列表、背景再真抓一次;第一次進頁只抓 1 次。
_Avoid_: 訊息列、`MessageRow`(已退役的 mobile-admin 列投影)、頁面自持的 `convos`;在頁面或 store 手寫
已讀／送出／新對話的列表更新;`getDashboard()` 這類 getter 順手抓對話

**暖機清單 (Warm Set)**:
在任何頁面之前就要讀的共享 store 清單(型別 `WarmSet`),以身分為 key 呼叫 `$lib/store-warm` 的
`warmStores(caller, tasks)`(best-effort:`Promise.allSettled`,單項失敗只記 log)。有兩層宣告點:
一個 surface 的外殼(Topbar/Sidebar/TabBar)由該 surface 的 `+layout.svelte` 宣告成 module-level 常數、交給身分範圍暖
(只替守門放行的身分暖;member/mobile 暖通知,coach 桌面與 mobile-admin 的教練分區暖教練對話列表);**個別頁面也可以宣告自己的暖機清單**,與該頁的主 GET 一起
用 `Promise.all` 並行出發——`member/mine`(候補清單、我的請假)、`member/account`(點數、訂閱)、
`mobile/account`(點數)三頁這麼做(見 `docs/adr/0025` F-2、
`docs/adr/0012` K7)。行銷外殼也有一份:根 `+layout.svelte` 在非 app surface 以身分為 key 暖訂閱,供購物車頁與
`CartDropdown` 的「已持有,不計費」(見 `docs/adr/0028` §3);另起一行暖行銷公告(`hydrateAnnouncements`,
公開端點與身分無關,不看 `$sessionKey`,Header 鈴鐺角標 `unreadAnnouncements` 吃它,失敗時閘門維持未水合、下次可重試)。教練對話列表(`hydrateConversations`)由 coach layout 與 mobile-admin layout 暖,桌面側欄與手機 TabBar 的訊息角標吃它。每個身分只打一次 GET:閘門守衛擋重訪、在飛合併擋掉同頁
載入的重複、換身分時閘門自己重置。暖機前 store 是誠實的開機值(空清單,角標不顯示),不是種子(見
`docs/adr/0024`)。
_Avoid_: 用 getter 的副作用水合外殼角標或別的 store(呼叫端看不出這一層);seed teaser(開機先顯示
種子裡的假數字)

**身分範圍 (Session Scope)**:
身分相依 surface 的外殼機制,單一來源 `src/lib/components/SessionScope.svelte`;member/mobile/coach/mobile-admin
四個 layout 把 slot 交給它,只交出自己的宣告:守門函式 `guard(url, 登入狀態) → 導向目標 | null`、暖機清單
(兩者寫成 layout 的 module-level 常數)、`caller`、可選的 `warmIn(url)`(預設 true;mobile-admin 傳「是否在教練分區」)
與 `overlay`。它負責四件事:guard 回傳目標就 `goto`(反應式,session 中途過期也抓得到);暖機准入——
`warmKey = guard(…) === null && warmIn(url) ? $sessionKey : null`,有值才暖,所以每個身分暖一次、A→B 重暖、
登出與被導走的身分不暖;頁面壽命——`{#key $lastSessionKey}<slot/>{/key}`;`$lastSessionKey` 非 null 時
`overlay?.closeAll()`。結帳接收(member)、`afterNavigate` 與 key 外面的外框(CheckoutDialog、TabBar…)留在各 layout。
root 與 admin layout 不用它(見 `docs/adr/0028` §2)。它不是集中登記的 registry(沒有 module-level 清單,import
無副作用),也不是身分 hook(不提供訂閱 API,只讀 `sessionKey`/`lastSessionKey`)。
_Avoid_: 在 layout 手抄守門 → `goto`、暖機 key 或 `{#key $lastSessionKey}`;外殼(shell)統稱這套機制(外殼指 Topbar/Sidebar/TabBar 那層畫面)

**顯示查表 (Display Lookup)**:
狀態/類型 → tone/label(部分為純 tone,狀態字面本身即顯示標籤)對照表;單一來源集中在 `$lib/domain`
各 entity 檔(`members.ts`/`venues.ts`/`tickets.ts`/`classes.ts`/`course-level.ts`/`sessions.ts`)與
`member-app.ts`(member/mobile 雙生的查表與成對常數)。取用形只有兩種:facade 若**真的**攜帶本檔
型別事實(以自身較嚴格或不同形狀的 `Tone` 對同一參照純註記收窄,零 `as` 斷言),消費端經該 facade
取用——mobile-admin/member/mobile 屬此;facade 若只是同源且結構恆等的轉手(admin 這類 `Tone` 與 wire
相容、無可收窄者;facade 端改過名的 alias 亦同)不設這一層,消費端**直取**
`$lib/domain` 各 entity 檔或 `$lib/api/wire`(見 `docs/adr/0013` 與其增補、`docs/adr/0019`)。
以後端 enum 為鍵的查表另提供一支「任何字串都能查」的函式(`domain/tickets.ts` 的 `ticketTypeBadge`、
`domain/attendance.ts` 的 `attStateBadge`、`$lib/api/wire` 的 `orderStatusBadge`),未知值後備(中性 tone +
原字串)收在查表所在檔,消費端不自己補 `?? …`、不用 `as` 強轉鍵型別(見 `docs/adr/0013` 增補)。
課程等級與招生狀態同形:`courseLevelLabel`／`courseLevelTone`(`course-level.ts`)、`classStatusTone`
(`classes.ts`),消費端呼叫函式、不索引 `LEVEL_TONE`／`STATUS_TONE`。「總查表」(任何字串都不會取到
`undefined`、也不會取到 `Object.prototype` 上的繼承成員)只有一種寫法:`$lib/api/wire` 的 `lookupOr(表, 鍵,
後備)`,查表函式與一次性的後備查詢都用它,不另寫 `Object.hasOwn(…) ? … : …` 或 `表[鍵] ?? 後備`(見
`docs/adr/0013` R20 增補)。R20 漏網的三處同走它:報表分桶(`admin/reports-api.ts` 的 `resolveBucket`,未知鍵
→ `{ label: 原鍵, color: 'var(--df-text-muted)' }`)、付款方式標籤(`admin/report-math.ts` 的
`paymentMethodLabel`,未知回原字串)、課表時段狀態(`ScheduleCalendar` 的 `STATUS_LABEL`,型別
`Record<SlotStatus, string>`,渲染 `lookupOr(STATUS_LABEL, status, status)`)。
報表面板的**呈現素材**(三序列色盤、`{label,color}` 桶表、`REPORT_SCALES` 像素值域)不是域語彙,
單源住 `admin/report-math.ts`、與逐面板 VM 算式同居,兩 surface 直取(見 `docs/adr/0013` 增補)。
_Avoid_: facade 各自複製一份查表、同名異義的表(同一個鍵在不同表裡代表不同語意卻共用一個名字)、
零型別事實的純轉手 re-export(假接縫——只換來一批逐符號同一性守護測試)。mobile 的 store/動作轉手不在此列:
`mobile/stores.ts` 的 seam 管 import 方向,照留(見 `docs/adr/0024`)

**匯入掃描器 (Import Scan)**:
原始碼層 import 掃描的 test-support 模組;單一來源 `$lib/testing/import-scan.ts`(`walk`/
`importSpecifiers`/`makeReachPredicate` 三支,字串/註解/模板感知),供接縫契約
測試掃 production 檔,例如 production 原始碼零引用 `resetOpsForTests` 這類 `*ForTests` 重置匯出
(見 `docs/adr/0025`「閘門重置」)。
_Avoid_: 契約測試檔內重新手焊 regex 掃描;production 檔 import `$lib/testing`(dogfood 契約會紅)

**可計費行 (ChargeableLine)**:
可進「結帳」金額計算與請款的購物車項目;唯一產地 `member/checkout.ts` 的 `chargeableLines()`
(濾除已訂閱方案後打上 brand),`checkoutMath` 與 `createCheckout` 的私有 `placeOrder` 兩終點只收此型別。
購物車頁、`CartDropdown` 與 `createCheckout` 共用同一個衍生 `member/checkout-sync.ts` 的 `chargeableCart(cart)` →
`{ lines, billable, total }`(`lines` = `chargeableLines(cart, subscriptions)`,`total` = `subtotalOf(lines)`),已持有
的方案行標「已持有,不計費」且不計入總計,預覽合計 ≡ 實際請款(見 `docs/adr/0028` §3)。兩個 surface 的
`placeOrder` 住在 `member/checkout-sync.ts` 的 `createCheckout(w)` 工廠內,經 `chargeableCart(w.cart)` 算出
lines 之後往下傳一次;`checkout-controller.ts` 的 `deps.placeOrder`
簽章因此是 `(lines: ChargeableLine[], order: PlaceOrderInput) => Promise<PaidSummary>`,呼叫端不
各自重讀第二份(見 `docs/adr/0003`、`docs/adr/0025` F-5)。
_Avoid_: 未過濾清單直餵 checkoutMath/placeOrder(編譯期擋);購物車總額直接加總整車(會把已持有方案算進去);在 `chargeableCart` 之外各自再推導一次 billable/total;production 檔於唯一產地之外自行
`as` 斷言打 brand(測試 fixture 的檔內 helper cast 屬受核可例外,見 `checkout-math.test.ts` 檔頭)

**星期 (Weekday)**:
兩套星期索引並存,混用就差一天(`aaabc12` 曾讓週課表錯了 3 個月)。後端 `day_of_week` 是 0=日 … 6=六
(與 JS `Date.getDay()` 同序);週課表欄位 `WeekColumn` 是 0=一 … 6=日(週一起頭的 UI 版面,
`ScheduleBlock.day` 用它)。單一來源 `src/lib/domain/weekday.ts`:`DAY_KEYS`/`WEEKDAY_ZH` 以 `day_of_week`
為 index,`WEEK` 以 `WeekColumn` 為 index,兩者之間只經 `toWeekColumn(dow)` 換算;`ScheduleBlock.day` 的型別
就是 `WeekColumn`,沒換算的數字塞不進去(見 `docs/adr/0028` 增補、`docs/adr/0013` 增補)。
_Avoid_: 手寫 `(getDay()+6)%7`、各檔自帶星期陣列(唯一有文件的例外:`admin/report-math.ts` 的
`WEEKDAY_LABEL`,報表純函式層除 `lookupOr` 外零外部依賴,見 `docs/adr/0009`、`docs/adr/0028` 增補)、用註解約定 day 的編號
