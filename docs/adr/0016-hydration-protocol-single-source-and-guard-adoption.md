# 水合協定單源(HydrationCore)與 waitlist/leave guard 採用

> Status: Accepted。源自 2026-07-20 架構深化 Round 5(七候選整合計畫)之 C1;回應 ADR 0014 §5
> 明文「另案裁決」的候補/請假 store 水合 race。同輪 C5(CheckoutDialog 付款 controller)的判準
> 核對與 ADR 0008「有意識保留」之取代裁決一併記於本篇末節。

## 背景

水合協定(guard 短路、post-await「mutation 勝出」重查、mutator 翻旗)自 2026-07-08 起有兩個住所:
`hydration-gate.ts` 的 `createHydrationGate`(store-owned 採用者)與 `load-gate.ts` 的 `hydrate`
選項(page-owned 採用者,ADR 0008 增補)。兩處行為刻意同語意,但詞彙與文件各自維護——同一個協定
被定義了兩次。同時 member 的候補(waitlist)/請假(leave-requests)兩個共享 store 仍無 guard:
ADR 0014 §5 記錄了已知 race(in-flight 水合期間的 mutation 會被舊回應蓋回),當時裁決「另案」。
本篇即該案。

## 決定一:抽 HydrationCore 純核心,不做 gate 互相委派

否決過「load-gate 內部 new `createHydrationGate()` 整體委派」:load-gate 的 F1 重入語意要求
`into()` 後、翻旗前重查 generation,而 `createHydrationGate.hydrate()` 無條件翻旗——整體委派必打紅
`load-gate.test.ts` 的重入釘。改抽共用純核心 **`HydrationCore`**(`guarded()`/`mutationWins()`/
`commit()` 三決策點 + `createHydrationCore(hydrated)`),宣告在 `hydration-gate.ts` 內、不開新檔:

- `createHydrationGate` 改建於 core 之上(hydrate = guarded 短路 → fetch → mutationWins 重查 →
  apply → commit;refresh/markMutated 改呼叫 commit),`HydrationGate` interface 零變動。
- `load-gate.ts` 三決策點換成 core 呼叫;**F1/F5 的 generation/destroyed 重查原地保留**——這正是
  兩個 gate 不能互相委派的原因,也是 core 的邊界:core 只收「協定詞彙」,不收 load-gate 特有的
  重入簿記。
- 價值是協定詞彙與文件的單一住所;行為零變動,由 `load-gate.test.ts` 全綠(含重入釘)守住。

## 決定二:waitlist/leave 採用 gate(比照 notifications 採用形)

caller 佈線(全部落在 store/api 接縫,頁面模板零改動):

| caller | 改後 |
| --- | --- |
| mine 頁 gate | 零變動(水合已收在 getMine 接縫) |
| `getMine` 的 `hydrateSessionStores` | 換 `hydrateWaitlist`/`hydrateLeaveRequests`(= gate.hydrate);Promise.all 並行形不動 |
| `member/courses` onMount | 換 `hydrateWaitlist().catch(() => {})` |
| `MyCourseDetail` onMount | 名稱與呼叫零變動——`refreshLeaveRequests` 綁定改指 gate.refresh(「開詳情刷新最新」語意保留) |
| mobile 委派 | 隨 getMine 自動獲得 guard,零改動 |
| 5 支 mutators(join/cancel waitlist、create/cancel leave、bookMakeup) | 維持直寫 + store 寫入後補 `gate.markMutated()`(未水合時尾隨和解 refresh,見「對抗審後補強」) |

匯出面:

- waitlist 側:`hydrateWaitlist` + `waitlistHydrated`;**刪 `refreshWaitlist`**(YAGNI,notifications
  的 gate.refresh 不匯出同款紀律;2026-07-20 使用者裁決——courses 頁有本地 store + 後端 409 雙保險,
  無真消費場景)。
- leave 側:`hydrateLeaveRequests` + `leaveRequestsHydrated` + **保名 `refreshLeaveRequests` =
  gate.refresh**(MyCourseDetail 呼叫、mobile re-export、identity pin 全繫於此名)。

落地驗證採 TDD 次序:兩條 race 釘(waitlist prepend 存活、leave cancelled 不被蓋回 pending)先打在
現行無 guard 實作上證紅,再落 gate 採用轉綠(commit `fdcf26d`)。

## 兩筆 known-latent(刻意取捨,落字防未來審查誤判)

1. **新鮮度回歸**:採 guard 後 waitlist/leave 每**登入** session 只抓一次(登出即重置,見
   「對抗審後補強」);admin 側變化在 mine/courses 重訪不再自動反映(leave 有 MyCourseDetail 的
   refresh 兜底;waitlist 無)。notifications 既有同款取捨,非本案新發明。
2. **殘留 refresh race**:`gate.refresh` 刻意無 mutation-wins(「無條件真抓」語意連動通知頁與
   load-gate 正典)——MyCourseDetail refresh 窗口內取消請假仍可能被舊回應蓋回。範圍已從「所有
   水合路徑」縮到「refresh 類無條件套用的窗口」——含顯式 refresh 與 mutator 和解重抓兩處
   (帳本閉合輪修正:原「僅顯式 refresh 窗口」的說法漏了和解重抓;和解已序列化,倒序覆寫窗口
   消滅,殘留為「和解/顯式 refresh 快照 vs 後續其他 mutation」一族);不擴 refresh 語意。

## 對抗審後補強(2026-07-20 同日,codex 1×P1+1×P2)

- **登出重置(P1 修)**:兩 store 於模組頂層訂閱 authStore,「登入→登出」邊沿清空 store 並把旗標
  歸 false——SPA 登出走 `authStore.logout() + goto`(無整頁重載),模組級旗標跨帳號存活,無此
  重置則 guard 讓下一個帳號短路讀到前帳號的候補/請假。notifications/points/subscriptions 的
  同型缺口為前存(guard 採用早於本輪),不在本輪寫入集,另卡追蹤。(帳本閉合輪已把布林邊沿
  升級為 identity 鍵 + session epoch,見下節。)
- **水合前 mutation 和解重抓(P2 修)**:五支 mutators 寫入前捕捉 `wasHydrated`;未水合(含
  hydrate 在飛)時的 mutation 於 `markMutated()` 後尾隨 `gate.refresh()` 和解——單發 POST 回應
  只是局部快照,旗標若就此短路,server 上既有列永不補回(同一旗標身兼 mutation epoch 與資料
  完整度的代價)。和解 refresh 的競態窗口與 known-latent 2 同族,不擴 refresh 語意。(帳本閉合
  輪已把捕捉點移到進場、和解改序列化 + 失敗可重試,見下節。)

## 帳本閉合輪補強(2026-07-20 同日,codex 對修正鏈複審 1×P1+2×P2)

對「對抗審後補強」修正 commit(`c6d98f7`)本身的 codex 複審,揪出三個殘留窗口,同日修正
(commit `e5eb6dd`):

- **在飛寫回作廢(P1 修)**:F1 的「登入→登出」布林邊沿只重置**已落地**的狀態——登出前已出發
  的 GET/POST 在重置之後才 resolve,寫回會讓前帳號資料復活並 commit true(重置後旗標 false,
  mutationWins 不擋),下一帳號 hydrate 被短路;且布林邊沿看不見「A→B 直接換帳號」。升級:
  identity 鍵(`member.id`)+ `sessionEpoch`——identity 一變就 epoch+1 並清 store/旗標;fetcher
  與五支 mutators 的跨 await 寫回一律核對出發時 epoch,過期作廢(fetcher throw → gate 不 apply
  不 commit;mutator 棄寫但仍回傳 server 物件,型別面不變。server 端狀態不受影響——作廢的只是
  本地快取寫回)。
- **和解序列化(P2 修)**:`wasHydrated` 原在 POST await 之後捕捉——第一支 mutation
  `markMutated()` 翻旗後,併發的第二支誤以為已水合、不排自己的和解;唯一快照若漏第二筆
  (GET 與第二支 POST 的 server 端 race)即倒序覆寫。改進場捕捉 + `queueReconcile()` 序列化鏈
  (先進先出——晚出發的和解快照必然較新且最後套用)。
- **和解失敗可重試(P2 修)**:原 fire-and-forget 失敗吞掉、旗標卡 true——部分快照永久誤標完整,
  waitlist 又無外部 refresh,F2 原 bug 在一次暫時性 GET 失敗後復活。改:失敗把旗標翻回 false
  (僅限同 epoch,跨登出的失敗交給 session 重置),留下 hydrate 重試路徑。

七支回歸釘(waitlist 4 + leave 3)先紅後綠,涵蓋:hydrate/refresh/POST 在飛期間登出的作廢、
併發雙 mutation 的雙和解與序列化、和解失敗的旗標回退與重試。

### 二段(同輪 codex 複審 4×P2,commit `2674c23`)

「可重試翻回 false」與「單旗標身兼 mutation-wins 訊號」相撞——形狀修正,拆開兩個語意:

- **mutation 世代與完整度分離**:`createHydrationGate` 的 `markMutated()` 帶單調
  `mutationGen`,hydrate 進場捕捉、resolve 後比對——世代變或旗標被直接翻 true 都算 mutation
  勝出;旗標之後被「和解失敗可重試」翻回 false 不再拆掉 in-flight hydrate 的武裝(否則舊快照
  落地、直寫列蒸發)。介面零變動;`HydrationCore`/load-gate 委派不動(load-gate 頁面以「直接
  翻旗」為 mutation 訊號的慣例保留,gate 的 mutationWins 為「世代變 OR 旗標真」)。
- **寫回時重查完整度**:mutator 進場快照 `wasHydrated` 可能在 POST 飛行中失真(和解失敗把旗標
  翻回 false)——寫回時發現旗標已 false 就重新排和解,不把不完整 store 再標成完整。
- **和解鏈 session 化**:排隊的 callback 起跑前核對排隊當下 epoch(舊 session 的幽靈和解不得在
  新 session 發出非預期 refresh);identity 變更時重置鏈(舊 session 卡死的和解不堵住新帳號)。

再 +10 釘:gate 世代釘、勝出/完整度分離釘、再排和解釘、幽靈和解釘、卡鏈釘(TDD 先紅後綠)、
A→B 直接換帳號釘 ×2、cancel/bookMakeup 棄寫釘 ×2、leave 序列化鏡射釘;序列化釘去 vacuous 化
(首和解掛起時斷言次和解未起跑,拿掉串行鏈必紅)。

## 由 ADR 0017 取代(2026-07-22,架構深化 R7 C1)

`src/lib/session-gate.ts`(`docs/adr/0017`)把本篇「決定二」表格(:41)描述的「5 支
mutators……維持直寫 + store 寫入後補 `gate.markMutated()`」,與「帳本閉合輪補強」/「二段」
兩節手焊在 `waitlist.ts`/`leave.ts` 模組頂層的 identity 鍵/`sessionEpoch`/序列化和解鏈骨架
(:87「identity 鍵(`member.id`)+ `sessionEpoch`……fetcher 與五支 mutators 的跨 await 寫回
一律核對出發時 epoch」一段起,含其後「和解序列化」「和解失敗可重試」與「二段」的世代/完整度
分離、寫回時重查完整度、和解鏈 session 化),整段收進 `createSessionGate` 的 `mutate()`——
兩份手焊骨架(waitlist/leave 位元組級雙生)自此由單一工廠吸收,不再各自維護。

以下明確**不受**取代影響、仍然有效:

- **決定一(HydrationCore 三決策點)**:`session-gate.ts` 建於 `createHydrationGate` 之上,
  guarded/mutationWins/commit 三決策點的委派關係不變。
- **「兩筆 known-latent」第 2 則(殘留 refresh race)**:`gate.refresh` 依然刻意無
  mutation-wins,`MyCourseDetail` 顯式 refresh 窗口內的取消請假仍可能被舊回應蓋回——本輪只給
  `refresh()` 加上 P1′ 在飛跨登入作廢(見 `session-gate.ts` 的 `wrappedFetch`),未擴大
  mutation-wins 語意,這則 known-latent 原樣保留。

以下 known-open 病灶自本輪**關閉**:「對抗審後補強」節記錄的「notifications/points/
subscriptions 的同型缺口為前存……不在本輪寫入集,另卡追蹤」——這三者由 `docs/adr/0017` 全數
收掉(notifications 抬升為 `createSessionGate`,修正真缺陷:跨登入的旗標存活導致 guard 短路
讀到前帳號資料;points/subscriptions 抬升為 `createSessionRefresher`,修正殘影窗口:identity
變更清空 + 在飛換帳寫回靜默丟棄),不再是「另卡追蹤」的開放項;mobile notifs 雖未列名在該句
原文,但同根因、同輪由 `onSessionReset` 一併修正。

## 協定測試三層界線(防誤整併)

測試拓樸自 2026-07-22(架構深化 R7,`docs/adr/0017`)起分三層,審查請勿以「重複」為由提整併——
三層觀察面互斥,不是同一份協定測試留了兩份:

1. **load-gate 特有交織**(留在各自頁面/元件所在檔):`load-gate.test.ts` 的 hydrate describe,
   釘的是 phase 收斂/次序/F1 重入/silentRefresh,只此一份。
2. **session-gate 通用協定**(單源於 `session-gate.test.ts`):`createSessionGate`/
   `createSessionRefresher`/`onSessionReset` 三門工廠的協定機器面(F1 登出重置、P1′ 在飛作廢、
   P1″ A→B 直換、`mutate` 在飛丟棄、F2 序列化可重試和解鏈家族等)只在此驗證一次,不逐 adapter
   手抄鏡射。
3. **各 adapter 薄採用釘**(`checkout-api.test.ts`/`leave-requests-api.test.ts` 等):只證明「本
   store 已接上 gate、endpoint/writeBack 接對」——F1 跨登入釘 + 每 mutator happy-path 釘 + 每
   mutator 在飛登出棄寫釘(架構深化 R7 補,防 mutator 被誤改回「直接 await api + store 直寫」
   繞過 `gate.mutate`、兩層測試卻仍皆綠),不重複第 2 層已驗證的協定本體。

waitlist/leave 原本位元組級雙生的深層鏡射家族(完整 epoch/序列化和解鏈釘)已隨 `session-gate.ts`
吸收整段刪除——現況是三層各司其職,不是「同一份協定測試留兩份」。

## 附記:同輪 C5——CheckoutDialog 付款 controller(ADR 0012 第五例)與 ADR 0008 重裁

- 抽 `member/checkout-controller.ts`(`createCheckoutController`):付款生命週期(`step`/`paying`/
  `paid` snapshot + `idempotencyKey`)進 controller;表單/預覽輸入(`code`/`coupon`/`usePoints`/
  `paymentMethod`)留元件、confirmPay 時以引數傳入;deps 只有 `placeOrder` 一支(0012 判準②最緊形)。
  `setOpen` 邊沿偵測回 `freshCheckout | resumedInFlight | noop`;confirmPay 回 kind-tagged outcome
  (`orderPlaced`/`orderFailed`/`alreadyPaying`/`nothingChargeable`,原始拋出物透傳,判準④),
  六句 toast 文案全留頁面。key 生命週期:建構/freshCheckout 換發、失敗重試沿用。
- **非 twin**:mobile CartSheet 付款流結構不同(`mobile/stores.ts` placeOrder 佈線),不做跨
  surface 抽象。
- **ADR 0015 劃界**:0015 否決的是 admin 四對話框**跨元件**共用 reset helper;本案是單頁
  controller、reset 佈線仍本元件私有——不牴觸該裁決。
- **ADR 0003 劃界**:controller 零業務規則,抽的是付款安全機(防重複扣款),結算仍 per-surface。
- **ADR 0008 §「有意識保留」取代裁決**:0008 當年裁定 CheckoutDialog 防重複扣款不抽成純模組
  (理由:收益低於搬動既有測試覆蓋的 churn)。本輪重裁三依據:(a) 0012 四判準已滿足;(b) 使用者
  已裁決 race render its 瘦身,churn 前提不再成立;(c) 抽取 commit 以 13 個 render its 一字不動
  原封全綠證明搬動零 churn。0008 該節已補日期化 cross-ref。
- 等價與覆蓋:兩顆 commit(c1 抽取+render 原封綠;c2 render 瘦身——race 機器面歸 controller
  單元 its,render 留「飛行中 Escape 關不掉」「重開顯示處理中」兩個顯示面)。斷言面帳面零淨減、
  淨增 2 條(失敗重試同 key、resumedInFlight 機器面——render 從未斷言過的);讓渡一條**跨層組合
  路徑**(重開後 resolve 真單至成功畫面的 render 全鏈——機器分件由單元 its、成功畫面由既有
  payThrough render its 各自覆蓋,組合本身不再有單一測試;對抗審記錄在案,屬瘦身裁決的已知代價)。

## 關聯 ADR

- **`docs/adr/0008`**:load-gate hydrate 選項的誕生地;本篇決定一把它的三決策點委派回單一 core;
  其 §「有意識保留」由本篇附記取代(該節留日期化 cross-ref)。
- **`docs/adr/0012`**:單頁 controller 判準;本篇附記之 C5 為第五例。
- **`docs/adr/0014`** §5:本篇決定二回應的「另案」出處。
- **`docs/adr/0015`**:對話框 reset 分散裁決;與 C5 的劃界見附記。
- **`docs/adr/0017`**:「決定二」五 mutator 骨架與「帳本閉合輪補強」/「二段」節手焊的
  identity/epoch/和解機制,由其 session-gate 工廠取代;取代範圍與仍然有效的部分見新增節
  「由 ADR 0017 取代」。
