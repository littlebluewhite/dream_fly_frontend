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
| 5 支 mutators(join/cancel waitlist、create/cancel leave、bookMakeup) | 維持直寫 + store 寫入後補 `gate.markMutated()` |

匯出面:

- waitlist 側:`hydrateWaitlist` + `waitlistHydrated`;**刪 `refreshWaitlist`**(YAGNI,notifications
  的 gate.refresh 不匯出同款紀律;2026-07-20 使用者裁決——courses 頁有本地 store + 後端 409 雙保險,
  無真消費場景)。
- leave 側:`hydrateLeaveRequests` + `leaveRequestsHydrated` + **保名 `refreshLeaveRequests` =
  gate.refresh**(MyCourseDetail 呼叫、mobile re-export、identity pin 全繫於此名)。

落地驗證採 TDD 次序:兩條 race 釘(waitlist prepend 存活、leave cancelled 不被蓋回 pending)先打在
現行無 guard 實作上證紅,再落 gate 採用轉綠(commit `fdcf26d`)。

## 兩筆 known-latent(刻意取捨,落字防未來審查誤判)

1. **新鮮度回歸**:採 guard 後 waitlist/leave 每 session 只抓一次;admin 側變化在 mine/courses
   重訪不再自動反映(leave 有 MyCourseDetail 的 refresh 兜底;waitlist 無)。notifications 既有
   同款取捨,非本案新發明。
2. **殘留 refresh race**:`gate.refresh` 刻意無 mutation-wins(「無條件真抓」語意連動通知頁與
   load-gate 正典)——MyCourseDetail refresh 窗口內取消請假仍可能被舊回應蓋回。範圍已從「所有
   水合路徑」縮到「顯式 refresh 窗口」;不擴 refresh 語意。

## 協定測試維持兩份(防整併)

`load-gate.test.ts` 的 hydrate describe 與 `checkout-api.test.ts`/`leave-requests-api.test.ts` 的
gate 採用測試**都留**:前者釘的是 load-gate 特有交織(phase 收斂/次序/F1 重入/silentRefresh),
真正重疊僅 2 條且觀察面不同(load-gate 觀察 phase 與旗標,採用測試觀察 store 內容與 API 呼叫)。
未來審查請勿以「重複」為由提整併——兩處變紅的原因空間不同。

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
  單元 its,render 留「飛行中 Escape 關不掉」「重開顯示處理中」兩個顯示面),覆蓋零淨減、淨增
  2 條(失敗重試同 key、resumedInFlight 機器面——render 從未斷言過的)。

## 關聯 ADR

- **`docs/adr/0008`**:load-gate hydrate 選項的誕生地;本篇決定一把它的三決策點委派回單一 core;
  其 §「有意識保留」由本篇附記取代(該節留日期化 cross-ref)。
- **`docs/adr/0012`**:單頁 controller 判準;本篇附記之 C5 為第五例。
- **`docs/adr/0014`** §5:本篇決定二回應的「另案」出處。
- **`docs/adr/0015`**:對話框 reset 分散裁決;與 C5 的劃界見附記。
