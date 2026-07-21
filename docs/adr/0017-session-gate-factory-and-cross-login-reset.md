# session 閘門工廠(session-gate)與跨登入洩漏修正

> Status: Accepted。源自 2026-07-22 架構深化 Round 7(八候選收斂批次)之 C1。回應
> `docs/adr/0016`「登出重置(P1 修)」節明文『另卡追蹤』的 notifications/points/subscriptions
> 同型缺口,並把該篇 waitlist/leave 手焊的 identity epoch/和解鏈骨架收斂為單一工廠。

## 背景

六個 member/mobile domain store 對「會員身分變更」(登入→登出,或不經整頁重載直接換帳號)的
處理方式各自為政,可分三類:

- **waitlist、leave**(`member/waitlist.ts`、`member/leave.ts`):`docs/adr/0016` 讓兩者採用
  `createHydrationGate` 之餘,還各自手焊了一套 identity epoch/序列化和解鏈骨架(登出即清空
  store、在飛寫回核對出發時 epoch、和解重抓可重試)——兩份骨架位元組級雙生,同一段邏輯被抄了
  兩次,五個 mutator(join/cancel waitlist、create/cancel/bookMakeup leave)各自手抄同一套
  進場快照/epoch 核對/寫回重查的樣板。
- **member notifications、mobile notifs**(`member/notifications.ts`、`mobile/stores.ts`):
  `notificationsHydrated`/`notifsHydrated` 旗標**跨帳號存活**——SPA 登出走
  `authStore.logout() + goto`,沒有整頁重載,模組層旗標不會被重置。真缺陷:B 帳號登入後第一次
  觸發水合(例如 `getDashboard()`)時被 `guarded()` 短路,直接讀到 A 帳號留在 store 裡的通知。
  `docs/adr/0016`「登出重置(P1 修)」節已指出這是「同型缺口」,但當時裁決「不在本輪寫入集,
  另卡追蹤」。
- **points、subscriptions**(`member/points.ts`、`member/subscriptions.ts`):兩者的重抓是無條件
  語意(`getDashboard`/`getAccount`/`getPoints`/`checkout-sync afterOrder`/`CheckoutDialog`/
  `CartSheet` 開啟時都依賴每次真抓),沒有守衛可短路,但也完全沒有 session 感知——換帳號當下
  沒有任何重置動作,舊帳號的數字要等下一次自然重抓才會換新;且在飛的重抓若剛好跨過換帳號邊界,
  舊帳號的回應會被無條件套用,蓋掉新帳號應有的起點。

三類問題本質相同:**store 層不知道「現在是誰登入」何時改變**。本輪把它們收斂進單一模組
`src/lib/session-gate.ts`。

## 決定:三門工廠,不深化 hydration-gate 本身

`src/lib/session-gate.ts` 提供三個工廠,座落在 authStore 與 domain store 之間:

- **`createSessionGate<T>({ fetch, apply, reset })`** —— waitlist / leave / member notifications。
  建於 `createHydrationGate` 之上,多加 identity 重置、epoch 核對 fetch,以及吸收五份 mutator
  骨架的 `mutate()`(見下節)。
- **`createSessionRefresher<T>({ fetch, apply, reset })`** —— points / subscriptions。保留「無
  條件重抓」語意(不套 guard),只加 identity 變更清空 + 在飛換帳**靜默丟棄**(`return`,非
  `throw`——`redeemReward` await `refreshPoints`、`placeOrder` 的 `afterOrder` 都會把 rejection
  往外傳播,若改成 throw 等於新增一個「換帳號」失敗模式打進那兩條既有傳播鏈)。
- **`onSessionReset(reset)`** —— mobile notifs。閘門所有權(`notifsHydrated` 這顆 plain
  `Writable<boolean>`)留在呼叫端,本工廠只在 identity 變更時呼叫 `reset`。

**刻意不把 session 維度深化進 `hydration-gate.ts` 本身**:後者被全 surface(含 `staff`)約 49
個頁面消費,其中 `staff`/`mobile-admin` 的身分來源不是 member 的 `authStore`。把 member-auth
維度打進 repo 裡最寬的共用 seam,會是一條錯誤方向的依賴。`session-gate.ts` 明確依賴
`authStore`,但仍守住零 import-time 副作用的紀律:訂閱發生在工廠**被呼叫**時(呼叫點在各
store 模組頂層,與現行 waitlist/leave 同位置),不是模組被 import 時。

每次工廠呼叫各自開一個獨立的 `authStore` 訂閱(六個模組級訂閱,與改動前同量級),不共用
registry——registry 需要新的 reset 測試接縫才能測,且 epoch 目前只跟自己比較、沒有跨模組消費者
需要它。

`createSessionGate` 的**內部建構順序為契約**:1) `createHydrationGate` 先建(其 wrapped fetch
對 `core.epoch()` 是 closure 前向參照——fetch 只在 hydrate/refresh 時才被呼叫,屆時 core 已就
緒)→ 2) `reconcileChain` 宣告 → 3) `createSessionCore` 訂閱。順序不可倒:restored session
(`localStorage` 快取還原)開機時,訂閱的**立即回呼**會當場觸發 `onChange`,而 `onChange` 讀
gate 與 reconcileChain,兩者屆時必須已存在,否則炸在 module-load。waitlist/leave 原本各自靠
「reconcileChain 宣告在 subscribe 之前」的 TDZ 註解手動維持這條隱性約束,工廠把它收成單一稽核
點,構造性消滅(`src/lib/session-gate.ts` 檔內契約註解)。

## `mutate()` 吸收五份手焊骨架

waitlist 的 `joinWaitlist`/`cancelWaitlist`、leave 的 `createLeaveRequest`/`cancelLeaveRequest`/
`bookMakeup`,這五個 mutator 原本各自手抄同一套骨架。`gate.mutate(request, writeBack)` 把它收成
一次:

1. 進場(`await` 之前)snapshot `wasHydrated` 與當下 `epoch`——捕捉點必須在 `await` 之前,否則
   第一支 mutation 的 `markMutated()` 會誤導併發的第二支以為已水合、不排自己的和解。
2. `await request()`。
3. 若 epoch 已變(跨登出/換帳號):server 端事實已成立,結果原樣回傳,但本地**棄寫**
   (`writeBack` 不執行)——呼叫端元件多半已隨登出卸載。
4. 若 epoch 未變:重查 `stillIncomplete`(進場後旗標可能被「和解失敗可重試」翻回 false,進場
   快照已失真),執行 `writeBack`、`gate.markMutated()`。
5. 若進場未水合、或重查後發現仍不完整,`queueReconcile()` 尾隨一次和解 refresh——序列化(先進
   先出,消滅倒序覆寫)、失敗可重試(旗標翻回 false,同 epoch 才生效)、支援幽靈取消(排隊當下
   的 session 若在起跑前已結束則整支跳過)。

樂觀 mutator(notifications 的 `markRead`/`markAllRead`:先寫後 `await`、失敗不還原)刻意不走
`mutate()`,繼續直接呼叫 `gate.markMutated()`——故 `markMutated` 仍留在 `SessionGate` 介面上。

reset 值必須**冪等**:restored session 開機時,`createSessionCore` 的立即回呼會觸發一次
`onChange`(=呼叫一次 `reset`),因此 `reset()` 的結果必須與開機初值相同(store 帶 seed 開機 →
`reset` 也要還原成 seed clone;開機空陣列 → `reset` 也回空陣列),否則首次繪製會被自己的重置
機制抹掉(例如通知角標的 seed teaser)。

## 修正兩個真缺陷,關閉 ADR 0016 的「另卡追蹤」項

`member/notifications.ts` 抬升為 `createSessionGate`、mobile 的 `notifsHydrated` 抬升為
`onSessionReset` 後,identity 變更即重置 store 內容(回 boot 態:notifications 為
`NOTIFS_SEED` clone、mobile notifs 同款)並把旗標翻回 `false`——`docs/adr/0016`「登出重置
(P1 修)」節記錄的「notifications/points/subscriptions 同型缺口,不在本輪寫入集,另卡追蹤」
自本輪關閉:notifications/mobile notifs 的跨登入洩漏修正,points/subscriptions 的殘影窗口
(舊帳號數字停留到下次自然重抓 + 在飛換帳寫回被無條件套用)一併由 `createSessionRefresher`
收掉。

## Known-latent(對稱列冊,非本輪修復範圍):通知頁/畫面自身的 load-gate 入口仍無 identity epoch

`member/notifications/+page.svelte` 與 `mobile/notifications/+page.svelte` 各自的
`createLoadGate({ fetch: getNotifications, hydrate: { flag, into } })` 呼叫,`fetch` 直接打
`getNotifications()`(原始 API getter),**不經過** store 匯出的 `gate.hydrate`/`gate.refresh`
——也就不受 `wrappedFetch` 的 P1′ epoch 核對保護,只共用同一顆 `*Hydrated` 旗標與 store setter。

- **guard 短路主病已殺**:identity 變更會把旗標同步翻回 `false`(本 ADR 的核心修正),所以下
  一次 `gate.load()`(不論是同一個頁面實例呼叫、還是頁面重新掛載後的新實例呼叫)不會被
  `guarded()` 誤判為「已水合」而短路過去。
- **導頁路徑已覆蓋**:登入/登出目前都會離開通知頁(登入走另一個路由),頁面卸載時
  `load-gate.ts` 的 `destroy()` 把 `destroyed` 標 true,`run()` 內的
  `if (destroyed || gen !== generation) return` 會丟棄任何遲到回應;重新掛載時的新 gate 實例
  讀到的旗標已經是重置後的 `false`,會正常重抓。
- **唯一殘窗**:若使用者**不離開該頁**、identity 卻在頁面自己觸發的 `getNotifications()`
  **在飛期間**改變(A→B),這支未經 epoch 包裝的 raw fetch 仍可能在 store 已被重置之後才
  resolve,依 `applyLoaded` 的邏輯把 B 剛清空的 store 又寫回 A 的資料、旗標重新翻真。這個窄窗
  在 `member`(desktop)通知頁與 mobile 通知畫面對稱存在,成因相同(頁面各自持有一個獨立於
  session-gate 的 `createLoadGate` 實例)。留待未來另案評估是否值得讓 `LoadGateHydrateOptions`
  也接受 epoch 感知的 fetch。

## 關聯 ADR

- **`docs/adr/0008`**:`HydrationGate`/`LoadGate` 誕生地;`session-gate.ts` 建於
  `createHydrationGate` 之上,`mutate()` 的 `markMutated`/`commit` 語意逐字沿用,`refresh()`
  無 mutation-wins 的「無條件」設計亦沿用不變。
- **`docs/adr/0016`**:「決定二」表格中五 mutator「維持直寫 + `markMutated()`」的實作描述、
  「帳本閉合輪補強」節手焊的 identity 鍵/`sessionEpoch` 核對邏輯,由本篇 `session-gate.ts`
  取代——decision 本身(採用 gate、`refreshWaitlist` 依 YAGNI 刪除、`refreshLeaveRequests`
  保名為 `gate.refresh`)不變,亦不受影響。「兩筆 known-latent」第 1 則(每登入 session 只抓
  一次的新鮮度回歸)與第 2 則(`gate.refresh` 無 mutation-wins 的殘留 refresh race)皆不受
  本輪影響,依然有效——`session-gate.ts` 的 `gate.refresh` 沿用同一顆底層
  `createHydrationGate.refresh`,只新增 P1′ 在飛跨登入作廢,未新增 mutation-wins 重查。
  「登出重置(P1 修)」節記錄的「notifications/points/subscriptions 同型缺口,不在本輪寫入集,
  另卡追蹤」由本篇關閉,見上節。
