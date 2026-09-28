# 認證提交家族擴充、購物車工廠上移、頁面進場包收口與 facade 純轉手退役

> Status: Accepted。源自 2026-08 架構深化工程 Round 9(C1–C4 四張卡,2026-08-03 落地)。
> C1/C2/C3 各一顆程式碼寫入 commit(`8619691`、`81b1c1b`、`9fb7b15`);C4 分四批、各一顆
> (`ec1187f` mobile、`ae7632f` member、`89ad3f1` mobile-admin、`5dd0cbb` admin),base `0b415c0`。

Round 9 沿 `docs/adr/0018`「一輪多案、單篇記錄」的先例,同樣不新開架構類別——四案都是對既有單一
來源的**加深或收口**:C1 把 member 三頁手寫的 auth submit 骨架併進 `login-submit.ts` 既有家族;
C2 把購物車工廠從 member surface 上移到 lib-root 共用層;C3 以 `pageEntry()` 關閉 `docs/adr/0017`
明載的 known-latent 殘窗,並退役零消費者的第三門工廠;C4 以一條判準句退役四個 surface facade 的
純轉手匯出,連帶讓 `docs/adr/0013` 的 facade 第一形(admin 活 re-export)在倉內絕跡。本 ADR 依序
記錄 C1–C4 四項決定及其裁決理由。

## 背景與決定

### 1. C1 — `login-submit.ts` 擴為四函式家族:register / reset-password / forgot 三頁併入

commit `8619691`。`src/lib/login-submit.ts` 原是「`submitLogin` 單函式 + 3 個文案常數」,是四個
surface 登入頁 submit 骨架的單一來源(2026-07-22,R7 C8)。member 的註冊、重設密碼、忘記密碼三頁
各自手寫同款「busy 再入守衛 → 清錯/上鎖 → await → 成功副作用 → catch → finally 解鎖」骨架,本卡
把三者併入同檔,成為四函式家族:新增 `REGISTER_FAILED_ERROR`/`RESET_LINK_INVALID_ERROR` 兩個文案
常數(逐字取自三頁現行 catch 分支,標點未動)、`RegisterSubmitIO`/`PasswordResetSubmitIO`/
`ForgotSubmitIO` 三個**各自獨立的窄 IO 介面**,與 `submitRegister`/`submitPasswordReset`/
`submitForgot` 三支函式。

**裁決一:不抽私有共用核心。** 四支函式的骨架看似同構,但核心化省下的約 10 行,代價是把各函式
互異的 `order[]` 時序契約藏進參數化路徑——`submitLogin`/`submitRegister` 的 `navigate` 與
`submitPasswordReset` 的 `onSuccess` 在 `finally` 解鎖**前**呼叫(保留「導航發生於 `busy=true`
時」的可觀測順序),而 `submitForgot` 的 `onSettled` 刻意在解鎖**後**呼叫(逐字複刻原頁
`finally { busy = false; submitted = true; }` 的順序)。deletion test 不過:抽出的核心無法在不新增
選項的前提下同時服務兩種相反時序。這與 `docs/adr/0018` C2「單工廠不拆 `createFormCore`」是同一條
判準的兩個面向——多消費領域才值得拆 core,單一領域(或時序互異的多領域)不值得。

**裁決二:不做泛化 `submitAuthAction`。** 要讓四支合流成一支通用提交器,必須把「成功副作用」與
「catch 策略」注入為參數——那正是行為旗標寬介面,是 `docs/adr/0011`「否決:list-page controller
factory」(寬介面、淺框架)與 `docs/adr/0018` C6(admin 三頁 CRUD 提交同構)已否決過的同款形狀。
四函式各自持有窄 IO、名字直接說出自己服務哪一頁,是刻意的。

**anti-enumeration 由型別結構保證。** `ForgotSubmitIO` **刻意沒有 `setError`**:忘記密碼的 catch
必須靜默吞錯(成功與失敗兩條路徑對外**無文案、無例外分支之別**,否則洩漏帳號是否存在),這條語意
不是靠註解或呼叫端自律,而是靠介面上根本不存在錯誤出口——呼叫端在編譯期就無從誤設錯誤文案。
這句宣稱到此為止,不含計時:`busy` 時長等於請求時長,計時側信道仍可分辨「快速拒絕」與「慢速成功」
——那是分支前的既有頁面行為,C1 逐位保留、未加也未減。計時側信道的 enumeration 防護屬後端統一
回應時間之職責;前端若要加固,可另設最小完成時間(本輪未做)。`submitPasswordReset`
的 `token` 同理採單源讀取(`const token = io.token` 一次讀值,守衛判斷與後續 `reset(token)` 共用),
讓 TypeScript 的窄化落在區域 `const` 上,不依賴「屬性存取窄化能否跨函式呼叫存續」這種模糊規則。

**零風險邊界**:`submitLogin` 本體與既有三個常數一個位元組未動(6 個既有測試零風險);
`src/lib/member/login-flow.test.ts` 既有 8 個 render 測試逐行未動——三頁的可觀測行為必須
byte-identical,這 8 個測試就是證明。三頁只置換 `submit()` 函式本體 + 加一行 import,markup、
`let` 宣告、`$: token` 反應式全未動;IO 字面量一律在 `submit()` 函式**內**建構(提升到模組頂層
會把 `$page`/`token` 凍結成 stale 值)。

### 2. C2 — 購物車工廠上移 `$lib/cart.ts`:共用 factory ≠ 共用 store 實例

commit `81b1c1b`。購物車(購物車 / Cart)本來就是全域概念——訪客可加購、跨登入保留(`docs/adr/0001`
的 auth-at-checkout),但工廠一直住在 `src/lib/member/cart.ts`,而 `mobile/stores.ts` 另有一份行為
孿生(twin)。本卡把工廠整檔上移為 lib-root 單檔共用模組 `src/lib/cart.ts`,與
`cart-item.ts`/`checkout-gate.ts`/`checkout-math.ts`/`load-gate.ts` 同格(`docs/adr/0004` 記錄的
共用 shelf 慣例)。

**逐字搬遷,一個位元組不改**:`createCart(persist = false)` 簽章、`dreamfly_cart_v3` storage key、
module-init `loadCart`、課程 `qty` clamp、舊 `waitlist` 欄位忽略邏輯、`AddResult` 唯一宣告,連同
app-wide 單例 `export const cart = createCart(true)` 與 `cartCount` derived 一併同檔上移。搬遷後以
`diff` 與 git rename 偵測雙重確認 byte-identical(原檔三個 import 無一為相對路徑——兩個 `$lib`
絕對路徑加一個 `svelte/store` 套件裸規格,連相對化調整都不需要)。

**裁決:共用 factory ≠ 共用 store 實例。** member/public 用的是持久化單例 `cart`(guest→login→
checkout 全程保留),mobile 用的是自己的**非持久**實例——兩者共用同一個工廠,但絕不是同一顆 store。
這條界線是 `docs/adr/0003`「兩 surface 不共用 store」的直接延伸:上移的是工廠(機制),不是結算或
store(業務與狀態)。

**裁決:mobile 不在 factory 收窄,收窄在 mobile seam。** 讓 `createCart` 多吃一個「mobile 模式」
選項就是行為旗標淺化;改為 mobile 在自家 seam 建 `const cartBase = createCart()` 後,只對外露出
**四個成員**(`subscribe`/`add`/`remove`/`clear`),`icon` 覆寫由 mobile 自組 `addItem` 輸入表達
(`{ ...courseToCartItem(course), icon: course.icon }`)。介面不膨脹是刻意的:mobile 消費端實際
用到的就是這四個,`addItem`/`updateQty` 不轉出。

**裁決:`member/cart.ts` 刪除不留殼,但 member barrel 保留轉出。** 兩件事看似矛盾,理由不同——
留一個 `member/cart.ts` 殼是新造轉運站,且殼內若重複 `createCart(true)` 會產生**雙持久化單例**、
雙寫 `localStorage`,是真缺陷;而 `member/stores.ts` barrel 只是把來源從 `'./cart'` 改成
`'$lib/cart'` 一行,五個混拿消費端(Topbar/CheckoutDialog/tickets/member-courses/courses,各自在
同一個 import 子句裡同時取 cart 與其他 member 符號)因此零 churn,同檔已有
`PaymentMethod from '$lib/checkout-order'` 的先例。`src/lib/cart.test.ts` 有一則 identity pin,
斷言 barrel 轉出的 `cart` 與 `$lib/cart` 的 `cart` 是**同一參照**。

**死出口直刪**:mobile 原本的 `cartCount` 純函式與 `cartTotal` derived 零消費者(TabBar badge 走
inline `$cart.reduce`),依 `docs/adr/0010`「死值不留死出口」精神隨 twin 一併刪除。

### 3. C3 — `pageEntry()` 關閉 ADR 0017 的 known-latent 殘窗;三門 → 兩門

commit `9fb7b15`。`docs/adr/0017` 在「Known-latent(對稱列冊)」節記下一個未修的窄窗:member 與
mobile 兩個通知頁各自的 `createLoadGate({ fetch: getNotifications, hydrate })` 直接拿 **raw API
getter** 當 fetch,不經 store 的 `gate.hydrate`/`gate.refresh`,因此不受 `wrappedFetch` 的 P1′
epoch 核對保護——使用者不離開該頁、identity 卻在該頁自己觸發的 fetch 在飛期間變更時,舊帳號的
回應仍可能在 store 已被重置之後才 resolve、把資料寫回去。當時的判準是「不深化最寬的 seam、epoch
知識留在 session-gate」,故列冊不修。

本卡的收口方式維持那條判準不變——epoch 知識**仍然只住在 `session-gate.ts`**,改變的是它怎麼
交付給頁面:`SessionGate<T>` 新增 `pageEntry(): PageEntry<T>`,把「帶 epoch 核對的 fetch + hydrate
選項」整包吐給頁面,頁面寫 `createLoadGate({ ...gate.pageEntry() })` 即可,**不再有機會拿到 raw
getter**。`PageEntry<T>` 的 `hydrate` 型別直接引用 `load-gate` 的 `LoadGateHydrateOptions<T>`,
是 type-only import,零 runtime 邊。

**零新程式路徑**(本卡的核心裁定):stale → `epochFetch` throw → load-gate 既有的 catch → error 態
→ 使用者按重試 → load-gate 的 `refresh()` 回落**同一支** `epochFetch` → 新 epoch 下成功。整條鏈
沒有任何一段是新寫的;換帳當下 identity 重置(`onChange`)已同步清空 store,新帳號永不見舊帳號
資料。實作上把原 `wrappedFetch` 的 inline closure **抽名**為 `epochFetch`(不是複製第二份判斷
邏輯),`createHydrationGate` 與 `pageEntry()` 引用同一支;建構順序契約因此補上第 0 步(`epochFetch`
的純 const 宣告在 gate 之前,對 `core` 與原本相同是 closure 前向參照)。

**mobile 通知搬葉模組 `src/lib/mobile/notifications.ts`。** 通知段改建 `createSessionGate` 之後需要
`getNotifications`(來自 `mobile/api.ts`),而 `mobile/api.ts` 反過來 import `mobile/stores.ts` 的
`PREFS_DEFAULT`/`Prefs`——留在 `stores.ts` 即 `stores ⇄ api` 成環。故整段搬出成葉模組,依賴鏈
`notifications → api → stores` 無環。同一理由,**`stores.ts` 不得 re-export 本模組**(re-export 會
讓 `api → stores → notifications → api` 繞回成環),消費端(TabBar、mobile 首頁、mobile 通知頁)
一律直接 import `$lib/mobile/notifications`——這與 member 側經 `member/stores` barrel 轉出是
**刻意的不對稱**,理由記在新模組檔頭。mutator 內原本的 `notifsHydrated.set(true)` 改為
`gate.markMutated()`:後者是前者的嚴格超集(多遞增閘門內部的 `mutationGen`),旗標既已歸閘門所有,
繼續繞過協定直寫會讓閘門自己的帳本落後於旗標。

**門 (c) `onSessionReset` 退役,三門 → 兩門。** 該門原本的存在理由是「閘門所有權留呼叫端、工廠只做
重置」,而它唯一的消費者正是 mobile notifs;mobile 通知改建完整 `createSessionGate` 後,這門的
production 消費者歸零。落地前後兩次 grep 重驗(含 `.svelte`)確認只剩註解與測試 describe 命中,
函式與對應 describe 一併刪除。`src/lib/session-gate.ts` 自此是兩門工廠:`createSessionGate`
(waitlist / leave / member notifications / mobile notifs)與 `createSessionRefresher`
(points / subscriptions)。

### 4. C4 — 四個 `data.ts` facade 的純轉手匯出退役(四批)

commits `ec1187f`(批1 mobile)/`ae7632f`(批2 member)/`89ad3f1`(批3 mobile-admin)/
`5dd0cbb`(批4 admin)。四個 surface 的 `data.ts` facade 累積了大量「純轉手」匯出:不攜帶本檔型別
事實、不做值變形,只是把 `$lib/domain`(或 `$lib/api/wire`)的**同源且結構恆等**符號再賣一次
(facade 端改過名的也算——`EnrolledCourse as MyCourse` 這類,退役後由消費端以 import-site alias
承接舊名)。這種假 seam 本身沒有語意,卻逼出了一整套逐符號 `toBe` 同一性的守護測試稅——為了證明
「facade 沒有偷偷複製一份」而存在的測試,只在 facade 真的攜帶型別事實時才有意義。

**判準句(每個匯出行逐條覆核,四批共用同一句):**

> 匯出行若**不**攜帶本檔型別事實(收窄註記 / `as` 斷言 / 本地 interface)、**不**做值變形
> (mapper / `.map` builder),且來源是 `$lib/domain` 或 `$lib/api/wire` 的**同源且結構恆等**符號
> (含 facade 端改過名者,退役後以 import-site alias 承接)→ 退役;
> 凡 ADR 0013 Form 2/3 收窄、真變形、ADR 記名邊界 seam → 保留。

**「結構恆等」的操作定義**:兩側宣告型別逐構造相同——facade 側沒有附加任何註記、`as` 斷言或
變形;`any`、`readonly`、多載這類逐構造比對本身就有歧義的情況,一律回到「facade 側是否新增任何
型別事實」這句裁決,有新增就保留。判準句刻意**不**寫「同名」:本輪退役的
`EnrolledCourse as MyCourse`、`ChatMessage as ThreadMsg`、`Activity as ActivityRow` 三個 facade
端改名的純轉手,照「同名」字面反而不符退役條件,但它們既同源又結構恆等,是不折不扣的假 seam
——名字換了沒有讓那層轉手多帶一絲型別事實。

四批範圍與結果:

| 批 | facade | 退役 | 保留(判準句裁定的本檔真內容) |
| --- | --- | --- | --- |
| 1 | `mobile/data.ts` | 十組(`ME`/`Member`、`AttRecord`、`EnrolledCourse as MyCourse`、`CONTACT_THREAD`、`ChatMessage as ThreadMsg`、`NOTIFS_SEED`、`Notification as NotifItem`、`WEEK`、`COACH_REPLIES`、`NOTIF_CATS`) | 本地 `Tone` tuple 型別、`ATT_STATE`、`LEAVE_STATUS`(Form 3)、`Course` interface、`LEVEL_TONE`、`Announce`/`ANNOUNCE`、`NOTIF_TONE_BG`/`FG`、`PT_TYPE` |
| 2 | `member/data.ts` | 十一組純轉手 +`LedgerType`(刪 export 留 import)+ 零消費者的 `Tone` 轉出直刪 | 8 個本地 interface/type、`SUBS_SEED`、`UPCOMING`(`as` 斷言真收窄)、`ATT_STATE`、`LEAVE_STATUS`/`NOTIFS_SEED`(Form 3)、`LEVEL_TONE`、`ANNOUNCE`、`NOTIF_TONE_BG`/`FG`、`ApiNotification`、`mapNotification`、`PT_TYPE` |
| 3 | `mobile-admin/data.ts` | 七個(`COACHES`/`Coach`、`Venue`、`Ticket`、`ActivityRow`;`MemberAccountStatus`/`OrderStatus` 為刪 export 留 import) | 本地 `Tone`、**`LEVEL_TINT`/`Student`(ADR 0014 §1 記名邊界 seam,逐位元組未動)**、8 個本地 interface + 其 `.map` 投影常數、5 張 Form 2 查表 |
| 4 | `admin/data.ts` | 二十個(六張狀態查表 + `ORDER_STATUS`/`LEVELS` + `Coach`/`Venue`/`Ticket`/`Activity` 等型別;`Tone`/`MemberAccountStatus`/`VenueStatus`/`TicketType`/`ClassStatus` 五個為刪 export 留 import) | `mapMemberAccount`(真變形 mapper)、8 個本地 interface、3 個本地型別別名、`PAY_STATUS`/`ATT_MARK`/`CATS`/`CLASS_STATUS`/`TICKET_TYPES`/`VENUE_STATUSES`/`MEMBER_COLORS` |

**「刪 export 留 import」處置**:某些型別在 facade 本檔內部仍有消費者(例如 `admin/data.ts` 的
`MemberAccount.status: MemberAccountStatus`、`mobile-admin/data.ts` 的 `OrderRow.status: OrderStatus`、
`member/data.ts` 的 `PT_TYPE: Record<LedgerType, …>`),但對外那行 `export type {…} from` 是額外的、
可獨立刪除的轉出——`export {X} from 'Y'` 語法本身不建立本檔可用的本地綁定,兩者互不相干。這批一律
只刪對外 export,檔頭的 `import type` 原樣保留。

**灰色地帶只有一處,已用型別實測釐清**:批1 的 `NOTIF_CATS` 原型式是
`export const NOTIF_CATS: Tone[] = NOTIF_CATS_BASE;`,語法上神似 Form 2 的純註記 re-assert。但
`domain/member-app.ts` 對它是**顯式標註** `[string, string][]`(不是靠 `satisfies` 保字面推斷),
mobile 本地 `Tone = [string, string]` 與之結構恆等,零型別事實被附加——判定 Form 1、一併退役,並以
`npm run check` 對唯一消費檔改直取後零錯誤實測背書。對照組是同檔的 `LEAVE_STATUS`:domain 端用
`satisfies` 鎖住 tone 字面 union、不下顯式標註,facade 端以自己的型別重新宣告才真的改變了型別,保留。

**鑑別法因此落字:分水嶺是「facade 宣告型別與 domain 宣告型別是否結構恆等」,不是 `satisfies`。**
結構恆等 → 零型別事實被附加 → Form 1 假 seam → 退役;不恆等(facade 以本檔可見型別重新宣告,無論
收窄或放寬)→ 真的攜帶本檔型別事實 → Form 2/3 → 保留。`satisfies` **只是** `domain/member-app.ts`
那套「寬鬆結構型別」章程(見 `docs/adr/0013`「member-app 章程部分重開原文」)下、讓 facade 得以零
斷言收窄的手段,是該檔情境的線索,不是通用判別式——**倉內反例俯拾即是**:`domain/venues.ts` 的
`VENUE_STATUS`、`domain/members.ts` 的 `MEMBER_ACCOUNT_STATUS`、`domain/tickets.ts` 的
`TICKET_TYPE`、`domain/classes.ts` 的 `STATUS_TONE`、`domain/course-level.ts` 的 `LEVEL_TONE`
五張表在 domain 端**全是顯式 `Record<窄鍵, 值>` 標註、零 `satisfies`**,而它們的 facade re-assert
(mobile-admin 五張 Form 2、member/mobile 的 `LEVEL_TONE`)在本輪全數保留——因為 facade 端是以本檔
可見型別重新宣告的(依表而異:鬆散 `string` 鍵配本檔 tuple `Tone`、保留具名 union 鍵、或 plain-tone
`Record<string, string>`),與 domain 端的窄鍵配 wire `Tone` 都不結構恆等。若照「`satisfies` vs
顯式標註」字面套,這五張會被誤判成假 seam,與上方保留欄直接相反。

**這條鑑別法只裁「型別事實」這一項**,不取代判準句的其餘部分:值變形(`.map` 投影、
`mapMemberAccount` 一類 mapper)與 ADR 記名的邊界 seam 各自獨立成立。`mobile-admin` 的
`LEVEL_TINT`/`Student` 就是最好的提醒——它是零重新宣告的 `export {…} from`(結構當然恆等),卻**不**
進退役側,因為判準句的前提「來源是 `$lib/domain` 或 `$lib/api/wire`」對它就不成立(來源是
`$lib/coach/data`),且 `docs/adr/0014` §1 已記名它為邊界 seam。

**守護測試稅大部退場,留下的是 domain 本體契約。** 四批合計讓四個守護測試檔淨減 113 行(刪 130、
增 17):`src/lib/mobile/data.test.ts` 94 行整檔退場(其 `LEAVE_STATUS` 字面契約另有
`domain/member-app.test.ts` 的雙釘 + 獨立字面快照 + row-count canary 三層覆蓋,刪除零損失);
`member-app.test.ts` 第 1 層 wiring check 減為只釘 `UPCOMING`(`as` 斷言真收窄)與 `NOTIFS_SEED`
(純註記收窄),兩者都是 facade 側續存收窄的同參照;`status-lookups.test.ts` 刪掉整個 admin wiring
describe、mobile-admin 三層守衛逐字未動;`course-level.test.ts` 刪兩發 admin 同一性釘,
F_LEVELS / mobile-admin / member / mobile 四發
全留。**留下的釘全是「domain 自身的獨立不變量」與「續存收窄的同參照證明」**——前者(字面快照、
row-count canary)本來就與 facade 現況無關,後者才是這類釘真正該守的東西。

**`docs/adr/0013` facade 第一形自此在倉內絕跡**:該篇記載的三形中,第一形「admin 活 re-export」
(admin 端 `Tone` 與 wire 相容、不需收窄,直接轉手)正是本卡判準句要退役的形狀;批4 之後 admin
消費端一律直取 `$lib/domain` 各 entity 檔與 `$lib/api/wire`,倉內只剩第二形(mobile-admin 純註記
re-assert)與第三形(member/mobile 以自身較嚴格型別純註記收窄)。三形的**判準**不變、記載仍然
有效——消失的是第一形的實例,不是這條分類本身:若未來有新 facade 的 `Tone` 恰好與 wire 相容,判準
句會直接判它「不必存在這層轉手」,而不是判它「該用第一形」。

## 後果(刻意,非 bug)

- **消費端 import 面變寬,是刻意的**:批4 之後 `admin/components/StatusBadge.svelte` 一支元件同時
  import `$lib/domain/members`/`venues`/`tickets`/`course-level`/`classes` 與 `$lib/api/wire` 五、六
  行,比原本經 `$lib/admin/data` 一行取用「看起來更散」。這是把假 seam 拆掉後的真實依賴形狀——原本
  那一行並沒有讓依賴變少,只是讓它隱形。改源後每一行都指向該符號真正的產地。
- **facade 仍然存在,而且應該存在**:四個 `data.ts` 沒有一個被整檔刪除。它們留下的是本地 interface、
  `.map` 投影、真變形 mapper、Form 2/3 收窄查表與 ADR 記名的邊界 seam——這些才是 facade 的本體。
  日後新增匯出前請先過一次判準句:純轉手不再是這裡的合法居民。
- **mobile 通知與 member 通知的取用路徑不對稱,是成環迫出的**:member 經 `member/stores` barrel、
  mobile 直取 `$lib/mobile/notifications`。看到這個不對稱時請先回看 C3 的成環證據,勿為了「對稱」
  把葉模組再 re-export 回 `mobile/stores.ts`。
- **`member/stores.ts` barrel 的檔頭仍寫「8 個關切模組」,但 `cart.ts` 已不在其列**:barrel 現在
  轉出的是 7 個同層關切模組 + 一個 lib-root 的 `$lib/cart`。這是 C2 的已知記帳,轉出面本身零變化。
- **`src/lib/domain/member-app.test.ts` 檔頭原有一句指向已刪除的 `src/lib/mobile/data.test.ts`**
  (批1 遺留,批2 落地時記帳)。純註解陳舊、不影響任何斷言,已於 R9 終審修波順手改為現況記載
  (該檔隨批1 整檔退場,mobile 側僅存的 `LEAVE_STATUS` 同參照釘續存於本檔)。

## 測試守衛

- **C1**:`src/lib/login-submit.test.ts` 追加 3 個 describe(10 個 it),沿用檔內既有的 vi.fn IO +
  `order[]` 紀錄手法——`submitRegister` 的成功時序(navigate 在解鎖之前)、`submitPasswordReset` 的
  `token: null`/`''` 兩條短路(`order` 為空 = 未清錯未上鎖)、`submitForgot` 的**成功與失敗兩條
  `order[]` 以 `toEqual` 斷言同型結局**(anti-enumeration 的可證偽形式)。`member/login-flow.test.ts`
  既有 8 個 render 測試零改動,是三頁行為 byte-identical 的活證明。
- **C2**:新 `src/lib/cart.test.ts` 收納原 `member/stores.test.ts` 的 5 個 cart describe(15 個 it)
  與其 fixtures,斷言逐字未動(零回歸的活證明),另加 barrel identity pin。
  `mobile/stores.test.ts` 的三個 cart 行為 describe 換成「mobile seam 收窄接線」describe:icon 覆寫
  釘、delegation smoke(額滿課 → `'waitlisted'`、重複加 → `'bumped'`)、**實例分離釘**(mobile cart
  的項目不出現在持久化單例中,反之亦然)。
- **C3**:`session-gate.test.ts` 新增「pageEntry 頁面進場包」describe 5 支——`hydrate.flag` 與
  `gate.hydrated` 同一實例、`hydrate.into` 即 `opts.apply`、fetch 只回傳不 apply、stale rejects、
  retry 在新 epoch 成功、真 `createLoadGate({ ...gate.pageEntry() })` 走一輪 loading→ready;
  `onSessionReset` describe 隨門退役刪除。兩個通知頁各加一支「在飛換帳」render 釘(pending fetch →
  換帳 → resolve 舊資料 → 斷言頁面呈現載入失敗且共享 store 未被 stale 資料覆寫);把 `pageEntry()`
  改回 raw fetch 會讓其中 4 支轉紅,可證偽性已實測。新 `src/lib/mobile/notifications.test.ts` 收
  `stores.test.ts` 的通知三個 describe,幾乎逐字搬、斷言不變。
- **C4**:見上節「守護測試稅」。一般消費端的既有測試只改 import 來源,斷言邏輯逐字未動——新舊來源
  下是同一個物件參照(facade 原本就是純轉手),比對基準不變。

## 關聯 ADR

- **`docs/adr/0003`**:C2 上移的是購物車**工廠**,不是結算——per-surface 結算與「兩 surface 不共用
  store」的裁決不變,member/public 用持久化單例、mobile 用自己的非持久實例正是它的體現(該篇已補
  dated 增補指回本篇)。
- **`docs/adr/0004`**:C2 讓 `cart.ts` 加入 lib-root 單檔共用模組的 shelf 之列(同
  `cart-item`/`checkout-gate`/`load-gate`)。
- **`docs/adr/0010`**:C2 刪除 mobile 零消費者的 `cartCount`/`cartTotal` 沿其「死值不留死出口」精神;
  C4 之後 `admin/data.ts` 對 `Coach`/`Venue`/`Ticket` 的型別轉出(該篇 §4 記錄值退役、型別留)一併
  退役,值/型別分家的帳自此結清。
- **`docs/adr/0011`**:C1 裁決二(不做泛化 `submitAuthAction`)直接引用其「寬介面、淺框架」的否決
  理由。
- **`docs/adr/0013`**:C4 判準句的保留側逐字引用其 facade 三形;第一形(admin 活 re-export)的實例
  自批4 起在倉內絕跡,§1 現況表已補 dated 增補。
- **`docs/adr/0014`**:C4 批3 重驗並保留 `LEVEL_TINT`/`Student` 這個記名邊界 seam(單複本無分歧、
  搬 domain 只是搬家),逐位元組未動。
- **`docs/adr/0016`**:C3 退役的 `onSessionReset` 是其「登出重置(P1 修)」缺口當年的修法之一;
  協定測試三層界線的第 2 層(session-gate 通用協定)因此少一門,三層架構本身不變。
- **`docs/adr/0017`**:C3 關閉其明載的 known-latent 殘窗,並把三門收斂為兩門——「不深化
  hydration-gate 本身、epoch 知識留在 session-gate」的原判準不變,改變的只是交付形狀
  (`pageEntry()` 而非讓頁面自取 raw getter)。
- **`docs/adr/0018`**:本篇沿其「一輪多案、單篇記錄」的體例;C1 裁決二與其 C6(admin 三頁 CRUD
  提交同構否決)是同一條「行為旗標寬介面不收」的判準,C1 裁決一與其 C2「單工廠不拆 core」互為表裡。

## 增補(2026-09-26,架構深化 R12):mobile 通知葉模組退役,C3 的取用不對稱消失

完整背景見 `docs/adr/0022` §2。

### C3 的葉模組與「刻意的不對稱」已不存在

C3 記載的兩件事都是被成環迫出的:

- mobile 通知搬成葉模組 `src/lib/mobile/notifications.ts`。
- `mobile/stores.ts` 不得 re-export 該模組,消費端一律直接 import。

成環的原因是:葉模組需要 `mobile/api.ts` 的 `getNotifications`,而 `mobile/api.ts` 又 import
`mobile/stores.ts` 的 `PREFS_DEFAULT`/`Prefs`。

R12 Task 5 起的現況:

- 該葉模組與其測試刪除,member 與 mobile 共用 `src/lib/member/notifications.ts` 這一顆通知閘門。
- 伺服器端本來就是同一份已讀真值。
- mobile 經 `mobile/stores.ts` 從 `$lib/member/stores` 轉出六個通知符號,消費端(TabBar、mobile
  首頁、mobile 通知頁)改讀自家 seam。
- **不成環**:來源是完全獨立的 `$lib/member/stores`,`member/*` 零 `$lib/mobile` import;兩個
  `getNotifications()`(mobile 轉手與 member 本體)也一併退役。
- 「後果」節那條「mobile 直取 `$lib/mobile/notifications`,勿為了對稱把葉模組 re-export 回
  `mobile/stores.ts`」的警語隨之失效:對稱已經以合一的方式達成,不是靠 re-export 葉模組。

### C3 其餘內容不受影響

`pageEntry()` 的交付形狀、零新程式路徑、「epoch 知識只住 `session-gate.ts`」的判準都原樣有效。
兩門工廠也不變,只是 `createSessionGate` 的消費者由四個變為三個(waitlist / leave / notifications)。

### 「測試守衛」節的路徑

- 該節記的新檔 `src/lib/mobile/notifications.test.ts` 已刪除。
- 其中 mobile 獨有的兩條(不登出直接換帳號、`markAllRead` 的 `allSettled` 尾流)移到
  `src/lib/member/notifications.test.ts`。
- mobile 通知頁的「在飛換帳」render 釘仍在 `src/routes/mobile/notifications/page.test.ts`,改以
  `vi.mock('$lib/api/client')` + `fakeRouter` 接線。

### C4 與 `docs/adr/0014` 的張力

C4 判準句的適用範圍是 `data.ts` facade。R12 審查曾提議把同一條判準延伸到 `mobile/stores.ts` 的
store/動作純轉手(候選 07),與 `docs/adr/0014` §1 的 seam 規則衝突。使用者裁決 D2 暫不處理,
張力記在 `docs/adr/0022`。

## 增補(2026-09-26,架構深化 R13):C3 的成環論證完全失效

完整背景見 `docs/adr/0023` §2。

R12 增補寫的是「通知這一段」不再成環。C3 當年的成環前提有兩半:葉模組需要 `mobile/api.ts` 的
`getNotifications`,**而** `mobile/api.ts` 又 import `mobile/stores.ts` 的 `PREFS_DEFAULT`/`Prefs`。
R12 拿掉了前一半;R13 Task 3 拿掉了後一半:

- mobile 本地的 `Prefs`/`PREFS_DEFAULT`/`prefs` 退役,偏好改由 `$lib/member/profile` 擁有。
- `mobile/api.ts` 的 `getPreferences`/`savePreferences`/`mapPreferences` 隨 `pref-sync.ts` 退役,
  連帶刪掉它對 `./stores` 的 import。

`mobile/api.ts` 自此**零** `mobile/stores.ts` import,`stores ⇄ api` 這條邊不存在。C3「葉模組、不得
re-export」那段論證因此沒有任何殘餘前提;日後若有 mobile 模組想從 `stores.ts` 轉出,不必再為這個環
另開葉模組。`pageEntry()` 的交付形狀與「epoch 知識只住 `session-gate.ts`」的判準不受影響。

## 增補(2026-09-27,架構深化 R14):C3 的進場包下移到水合閘門;C4 與 `docs/adr/0014` 的張力已解

完整背景見 `docs/adr/0024` §1、§2。本篇原文不改寫,以下各點以本節為準。

### 1. C3:`pageEntry()` 自 `SessionGate` 下移到 `HydrationGate`

R14 Task 2(候選 F1)把 `PageEntry<T>` 與 `pageEntry()` 搬進 `src/lib/hydration-gate.ts`。原因是
mobile-admin 的 ops 頁接的是 plain 閘門,進場包若只住 session 閘門,它們只能拿那一對接 load-gate,
拿不到 `hydrate` 選項才有的四項保護。

- **交付形狀**:`{ fetch, refresh, hydrate: { flag, into, gen, pendingSettle } }`。`refresh` 是 R14
  Task 3 加的不合併那支;`fetch` 與閘門的 `hydrate()` 共用在飛 GET。
- **epoch 知識仍只住 `session-gate.ts`**:它把 `epochFetch` 當 fetch 餵給水合閘門,繼承下來的進場包
  `fetch`/`refresh` 都自帶 epoch 核對。「零新程式路徑」原樣成立。`PageEntry` 對 load-gate 的依賴仍是
  `import type`,只是住所換到 `hydration-gate.ts`。
- C3 所記「建構順序契約補上第 0 步」已隨 R14 Task 3 的「身分基準在建構當下決定」失效(`docs/adr/0017`
  增補)。
- **測試守衛的改寫**:C3 的「pageEntry 頁面進場包」describe 裡,flag/into/gen/pendingSettle 的同參照
  釘改寫為 `hydration-gate.test.ts` describe「pageEntry(plain gate)」的行為釘(`markMutated()` 之後
  `hydrate.gen()` +1;`hydrate.pendingSettle()` 有尾流回 promise、靜止回 `undefined`),spread 整合釘
  一併搬過去。`session-gate.test.ts` 只留 epoch 專屬的 stale/retry 兩支,另加「session 閘門的
  `pageEntry().fetch` 帶 epoch 核對」(真 load-gate、在飛登出 → error 態、store 不被寫)。

### 2. C4 與 `docs/adr/0014` 的張力:已解

R12 增補把「C4 判準句是否延伸到 `mobile/stores.ts` 的 store/動作純轉手」記為張力(`docs/adr/0022` D2)。
R14 Task 1(候選 F6)的答案:**C4 判準句仍只適用於 `data.ts` facade**;`docs/adr/0014` §1 管的是 import
方向,保留;真正退役的是身分釘與源路徑白名單——它們是「`vi.mock` 攔得到」的接線證明,三個按路徑 mock
的測試改走 fetch adapter 之後失去對象。seam 的轉出本身不退役,判準句的適用範圍不必擴大。

## 增補(2026-09-28,架構深化 R14 補修):進場包行為釘併入讀取器探針

R14 增補 §1「測試守衛的改寫」記的兩支行為釘(`markMutated()` 之後 `hydrate.gen()` +1;
`hydrate.pendingSettle()` 有尾流回 promise、靜止回 `undefined`)已自 describe「pageEntry(plain gate)」
刪除(`73f0f34`):斷言完整併入同檔 `docs/adr/0020`/`0021` 的讀取器探針(同樣經 `pageEntry().hydrate`
讀)。spread 整合釘仍住該 describe。見 `docs/adr/0024`「ADR 點名的測試」表。

## 增補(2026-09-28,架構深化 R15)

C4 的判準套用到 mobile-admin:`docs/adr/0025` 轉手退役(Task 3b)。`mobile-admin/api.ts` 從約
40 個純轉手刪到只剩 `getMore`/`getCoachHome`/`getAdminHome`/`getOpsCollections`/`getMessages`
5 個組合器,17 個 production importer 改直接找擁有者模組,撞名時在 import 處取別名——與 C4 當年
對 `data.ts` facade 的判準句(「零映射的純轉手退役,importer 改直取擁有者模組」)完全同一套規則,
本輪只是把適用範圍從 `data.ts` 擴到 `api.ts` 的組合器層。
