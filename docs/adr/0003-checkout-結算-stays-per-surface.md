# 結帳的「結算」(commit)為各 surface 自有的深模組,只共用純金額數學

結帳 commit——將購物車算成一次**結算**(金額拆解 + 該次產生的**報名／訂閱**與點數變動)——的歸屬,選擇**每個 surface 各自擁有**,而**非**一個跨 surface 的單一 `commitCheckout`。真正跨 surface 重複的只有純金額數學,已抽成 lib-root 的 `src/lib/checkout-math.ts` 單一來源;會員側的結算邏輯則收斂為 member-local 的純函式 `commitCheckout(cart, ctx) → CheckoutResult`(結算)＋不純的 `applyOrder(result)` store seam。

## 背景與決定

會員結帳最重要的域操作(結帳 →（課程）報名 /（方案）訂閱,per ADR-0001)原本整段藏在 `src/lib/member/components/CheckoutDialog.svelte` 的 `confirmPay()` 裡:算錢、剔除已持有方案、授予 `Subscription`、寫 `pointsLedger`、清車全擠在一個 `.svelte` 元件中——介面不是測試面,域規則只能 `render()` 才測得到。這是 `/improve-codebase-architecture` 架構審查的 Candidate 1。

權衡過兩種深化方向:

- **單一跨 surface commit**:member 與 mobile 共用一個 `commitCheckout`。
- **各 surface 自有 commit ＋ 共用純核心**(採用):會員側 `src/lib/member/checkout.ts` 的純 `commitCheckout`(回 `CheckoutResult`/結算,不寫 store)＋ `src/lib/member/stores.ts` 的 `applyOrder`(不純 seam,鏡像 mobile 既有 `checkout()` 的「store 寫入」角色);唯一跨 surface 共用的是純金額數學 `src/lib/checkout-math.ts`(`checkoutMath`/`lookupCoupon`/`subtotalOf`,與 `checkout-gate.ts` 成對)。

選擇後者。

## 為何不做單一跨 surface commit(載重理由,別再被架構審查重新建議)

- **兩 surface 不共用 store**:會員側用 `member/stores.ts` 的 `cart`／`points`／`pointsLedger`／`subscriptions`;行動版用 `mobile/stores.ts` 自己的 `cart`／`points`。是不同的 store 實例與不同的資料模型。
- **行動版只賣課程,無「訂閱」概念**:`mobile/stores.ts` 沒有 `Subscription`／使用權、沒有 `pointsLedger`(points-only model,且明載「the mobile surface keeps no live ledger」),其 `checkout(redeem, earned)` 只做 `points.update` ＋ `cart.clear()`,**從不授予 Subscription**;`mobile/data.ts` 也無任何 pass／方案／月票產品。會員側則有 ledger ＋ subscriptions ＋ 報名／訂閱文案分支。
- **強做共用會淪為淺模組**:要讓單一 `commitCheckout` 同時服務兩 surface,勢必把兩邊分歧的依賴(不同 stores、有無 ledger／subscription、不同產品模型)全注入介面——依賴爆量、介面變寬,模組變**淺**,與 deepening(小介面、深實作)的初衷相悖。

## 後果(刻意,非 bug)

- **member 與 mobile 各自呼叫各自的結算**:兩邊的 `.svelte`／sheet 各自 render 自己 surface 的結算結果;沒有、也不應有跨 surface 的單一 commit。
- **唯一共用的是純數學**:`checkout-math.ts`。會員側不再 inline 重抄金額公式(原 `CheckoutDialog` 的 6 行 reactive 數學已改呼叫共用 `checkoutMath`);行動版 `CartSheet` 也改 import 同一檔。COUPONS 表一併內聯進此檔,移除 member／mobile 兩份重複副本。
- **報名／訂閱獨立性(ADR-0001)維持不變**:本次只**搬遷** commit 的歸屬與形狀,未耦合兩種產品(方案不自動涵蓋課程報名)。
- **測試金字塔成形**:結算規則改由純函式 `commitCheckout` 單測(`member/checkout.test.ts`)釘住、store 寫入由 `applyOrder` 整合測(`member/stores.test.ts`)釘住,render 測試瘦身為只測文案／顯示分支。
- **若未來架構審查再建議「合併兩 surface 的結帳」**:請先回看本 ADR 的載重理由。

## 附錄(2026-07-08):共享 wire orchestration 不違本 ADR

本 ADR 當年禁止的是跨 surface 共用**結算**——業務規則(金額拆解、報名／訂閱與點數變動的認定)。
該業務規則已隨後端串接(Task 16 前後,見 ADR 0006)整段移入後端;前端原本擔任「結算」角色的
`commitCheckout`／`CheckoutContext`／`CheckoutResult` 已刪除(`member/checkout.ts` 檔頭註解:
「Task 16 前的本地結算 commitCheckout / CheckoutContext / CheckoutResult 已移除(final review
裁定):金額/點數/報名/訂閱的商業規則以後端為準(stores.ts 的 placeOrder),前端不再平行維護
一份會漂移的副本。」)——本 ADR 所護的對象(跨 surface 共用的本地結算邏輯)已不存在於前端。

2026-07-08 落地的 `src/lib/checkout-order.ts` 收斂的只是 **wire 序列**:同步購物車
(`syncCartToServer`)→ `POST /orders` → 呼叫端提供的 `afterOrder` 副作用以 `allSettled` 執行 →
清購物車 → 把後端回應適配成 `OrderConfirmation` 形狀。store 寫入一律由呼叫端以參數注入
(`lines`／`afterOrder`／`clearCart`),模組本身不 import 任何 surface 的 store——
`member/checkout-sync.ts` 與 `mobile/stores.ts` 的 `placeOrder` 都改為委派 `submitOrder` 的薄
adapter,各自傳入自己 surface 的可計費購物車行、後續刷新 store 的 promise、清購物車函式。
per-surface 結算的精神(兩 surface 不共用 store,各自決定要注入什麼)不變。

`member/checkout.ts` 的純函式(`chargeableLines`／`validateCoupon`／`orderErrorMessage`)原地不動,
未被本次收斂觸碰。
