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
_Avoid_: 訂單, order, 帳單

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
「水合閘門」詞條(見 `docs/adr/0008` 增補)。
_Avoid_: 手抄 phase 機制、手焊 skip+onData 水合組合

**水合閘門 (Hydration Gate)**:
共享 store 的水合協定(guard 短路、post-await 重查「mutation 勝出」、mutator 翻旗);單一來源
`src/lib/hydration-gate.ts` 的 `createHydrationGate`(見 `docs/adr/0008` 註記)。
_Avoid_: 手抄 *Hydrated 旗標協定

**顯示查表 (Display Lookup)**:
狀態/類型 → tone/label(部分為純 tone,狀態字面本身即顯示標籤)對照表;單一來源集中在 `$lib/domain`
各 entity 檔(`members.ts`/`venues.ts`/`tickets.ts`/`classes.ts`/`course-level.ts`)與
`member-app.ts`(member/mobile 雙生的查表與成對常數)。facade 端依自身型別需要收斂為兩形之一:
admin 這類 Tone 型別相容的 facade 直接活 re-export;mobile-admin/member/mobile 這類自帶較嚴格或
不同形狀 `Tone` 型別的 facade,改以自身型別對同一參照純註記收窄(零 `as` 斷言,見 `docs/adr/0013`)。
_Avoid_: facade 各自複製一份查表、同名異義的表(同一個鍵在不同表裡代表不同語意卻共用一個名字)

**匯入掃描器 (Import Scan)**:
原始碼層 import 掃描的 test-support 模組;單一來源 `$lib/testing/import-scan.ts`(`walk`/
`importSpecifiers`/`makeReachPredicate` 三支,字串/註解/模板感知、六輪 codex 硬化),供接縫契約
測試掃 production 檔(見 `docs/adr/0014` §1 與 R5 C3 升格)。
_Avoid_: 契約測試檔內重新手焊 regex 掃描;production 檔 import `$lib/testing`(dogfood 契約會紅)

**可計費行 (ChargeableLine)**:
可進「結帳」金額計算與請款的購物車項目;唯一產地 `member/checkout.ts` 的 `chargeableLines()`
(濾除已訂閱方案後打上 brand),`checkoutMath` 與 `submitOrder` 兩終點只收此型別。
_Avoid_: 未過濾清單直餵 checkoutMath/submitOrder(編譯期擋);唯一產地之外自行 `as` 斷言打 brand
