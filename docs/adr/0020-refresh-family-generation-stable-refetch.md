# refresh 族的世代穩定重抓:水合協定第四決策點 `fetchGenStable`

> Status: Accepted。源自 2026-08 架構深化工程 Round 10 A 案(commit `9060d95`,base `04fd86e`)。
> 關閉 `docs/adr/0016`「兩筆 known-latent」第 2 則(殘留 refresh race)——該筆自 R7 起被逐輪確認
> 仍然有效、R9 再度停放為 P1,本篇是它的結案紀錄。

水合協定自 `docs/adr/0016`(R5 C1)起有三個具名決策點——`guarded()`(進場 guard 短路)、
`mutationWins()`(落地前的 mutation 勝出重查)、`commit()`(翻旗)——住在
`src/lib/hydration-gate.ts` 的 `HydrationCore`,由 `createHydrationGate` 與 `load-gate.ts` 的
`hydrate` 選項共用。三個決策點都只服務 **hydrate** 路徑;**refresh 族**(顯式重新整理、
`ErrorState` 重試、突變後靜默重同步、mutator 的和解重抓)一路都是「一律真抓 + 無條件套用」,
在飛窗口內的本地 mutation 會被姍姍來遲的舊快照蓋掉。本篇記錄補上的第四決策點
`fetchGenStable`(世代穩定重抓)、它的判準句、三形否決紀錄、契約五條,以及刻意留在原地的兩筆殘餘。

## 背景:三處病灶,同一個根

改前的三處寫法各自看似合理,合起來就是 `docs/adr/0016` 那筆 known-latent:

1. **`hydration-gate.ts` 的 `refresh()`**:無世代快照、無條件 `apply` + `commit`——in-flight
   期間的 `markMutated()` 對它毫無影響,舊快照照樣落地。
2. **`load-gate.ts` 的 `applyRefreshed`**:不呼叫 `core.mutationWins()`,而且是**刻意**的
   (F5 註解明言:「無條件」指不做 mutation 旗標重查)。它與 `applyLoaded` 的不對稱是協定本體,
   不是漏寫。
3. **`session-gate.ts` 的 `queueReconcile`**:排出的和解重抓走的正是 `gate.refresh`,與上述兩者
   同族。R1 在飛期間若有第二支 mutation 完成而**不排** R2(它進場時旗標已 true、寫回時仍完整),
   R1 的舊快照會無條件套用、蓋掉那筆直寫。

三處的共同結構是:**refresh 族沒有任何「這份快照的出發點是否早於最後一次本地 mutation」的判準**。
使用者可見的樣子:MyCourseDetail 開詳情觸發的 `refreshLeaveRequests()` 飛行窗口內按取消,假單被
打回 pending;通知頁按重新整理的窗口內點已讀,已讀被打回未讀。

## 決定:第四決策點 `fetchGenStable`,單源住 `hydration-gate.ts`

```ts
export async function fetchGenStable<T>(
	fetch: () => Promise<T>,
	gen: () => number,
	iterate: () => boolean = () => true
): Promise<T | undefined>
```

(此為實作簽章;對外是兩個 overload——省略 `iterate` 時回 `Promise<T>`,見後文「overload 簽章」節。)

進場捕捉 `gen()` → `await fetch()` → 落地再讀一次 `gen()` 比對:相同代表這份快照的出發點不早於
最後一次本地 mutation,可以套用;不同代表 refresh **進場之後**有 mutation 落地,該份快照已是舊
事實,丟棄並**原地重抓**,直到世代穩定為止。`iterate` 是棄追判準(預設恆真＝抓到穩定為止),
回傳假即停並回 `undefined`,如何處置由呼叫端語意決定。

住所選在 `hydration-gate.ts`(協定詞彙的單一住所,`docs/adr/0016` 決定一),但**不進**
`HydrationCore`:這一點只讀 mutation 世代、不讀旗標,而且是 refresh 族專用(hydrate 三點路徑
刻意不套,見「契約五條」⑤)。`HydrationCore` 的註解已補一句指出第四點不在那顆 core 裡。

### 判準句(誤解即 P1)

**丟棄條件是「refresh 進場之後才發生的 mutation」,絕不可改讀旗標/世代的當下值。**
(本句與 `hydration-gate.ts` 內 `fetchGenStable` 的 doc 逐字同源(標點依本檔慣例正規化,非 byte-for-byte)——「判準只認『進場之後才發生的
mutation』,**絕不可**改讀旗標／世代的當下值」;兩處措辭必須同步,任一處被改寫都要回頭校對另一處。)

反例才是這條判準的重點:mobile-admin 的「寫入 → `markMutated` → `await refreshOps()`」是正常
序列——mutation 發生在 refresh **進場之前**,旗標當下就是 `true`、世代當下就是新的,但那份快照
必須**照常套用、且只能發一次 fetch**。若把判準寫成「旗標/世代當下是不是被動過」,這條每天都在
跑的正常序列會變成無窮重抓。守恆釘(`mobile-admin/stores.test.ts`)先斷言
`get(opsHydrated) === true` 再斷言快照照常套用且 `fetch` 恰一次——誤用旗標判準必炸;這條釘在
改動前的 HEAD 上就是綠的,全程沒有紅過。

### 三個整合點

- **`createHydrationGate.refresh()`**:`await fetchGenStable(opts.fetch, () => mutationGen)`,
  **不傳** `iterate`——store 層的 refresh 沒有「這一輪已無意義」的概念,抓到穩定為止。
  `apply` → `commit` 的次序不變。
- **`load-gate.ts` 的 gen 分支**:`LoadGateHydrateOptions<T>` 增可選 `gen?: () => number`;
  在場時 `run()` 與 `silentRefresh()` 以
  `fetchGenStable(fetcher, genReader, () => !destroyed && gen === generation)` 取代裸 fetch。
  棄追判準 =「已卸載 or 已被新一輪 run 取代」,兩者都單向不可逆,故回 `undefined` 時呼叫端既有的
  `destroyed`/`generation` 守衛必然也會攔下,語意不重疊。省略 `gen` 時整條路徑與舊碼逐字相同
  ——旗標自持、無世代帳的 plain-flag 消費端保舊語意。
- **`session-gate.ts` 的 `pageEntry()` 佈線**:一行 `gen: gate.mutationGen`。頁面的 load-gate 與
  store 閘門自此讀**同一本**世代帳,不是各記各的(`session-gate.test.ts` 有 `toBe` 同一函式的恆等
  釘)。`HydrationGate` 因此 additive 增一支唯讀的 `mutationGen(): number`;遞增仍只走
  `markMutated()`。

## 否決紀錄(三筆,供未來止步)

採用的是形 1——世代由**閘門**持有、經讀取器交出;以下是同輪評估過的另外兩形,以及一個更早被排除
的方向。

- **形 2:`mutationGen` 下沉 `HydrationCore`。** 否決。`load-gate.ts` 的 hydrate 選項是拿頁面傳進來
  的旗標**自建**一顆 core(`createHydrationCore(options.hydrate.flag)`),與 store 端 gate 內部那顆
  core 是**不同實例**——旗標是同一個 writable(共用),世代若住進 core 就變成兩本各自從 0 起算的帳:
  「兩顆 core 一面旗」的裂腦。頁面 refresh 讀到的世代永遠不會動,判準當場失效。世代必須是**閘門
  持有、經 `pageEntry` 交出讀取器**的單一本帳,不是 core 的成員。
- **形 3:自穩定的 `pageEntry` fetch(把重抓包進 `epochFetch` 那一層)。** 否決兩點:(a) 只有經
  `pageEntry()` 取得 fetch 的消費端受惠,頁面自帶 plain writable 的 direct-flag 消費端結構性留洞
  ——判準的覆蓋面取決於呼叫端有沒有走那條路,不是協定本身的性質;(b) 重抓被埋進 fetch 內部後,
  `docs/adr/0016` 三層界線的**第 1 層(load-gate 特有交織)無物可釘**——phase 是否單週期、棄追是否
  真的停手,這些正是第 1 層該負責的觀察面,卻在 load-gate 看不見的地方發生。
- **「丟棄不補抓」(把 hydrate 的 mutation-wins 直接套進 refresh)。** 否決。hydrate 的契約是
  mutation-wins **丟棄了事**(本地即真相,補抓的責任在後續的和解鏈);refresh 的契約是**顯式
  新鮮度**——使用者按了「重新整理」,丟棄之後**必須**補抓,否則什麼都沒發生。此不對稱是協定本體,
  不是遺漏。

## 契約五條

1. **rejection 原樣拋出,含第 N 次重抓的失敗。** 迴圈內 `await fetch()` 沒有 try/catch,rejection
   直接穿出函式;不吞、不回頭補套已被丟棄的舊快照。與 `hydration-gate.ts` 檔頭「fetch rejection
   原樣拋出」一致。
2. **load-gate 整合下 phase 單一週期。** `setPhase('loading')` 在 `run()` 內、迴圈**之外**執行一次,
   整個重抓迴圈活在那個單一 `await` 裡,沒有任何 phase 寫入點——重抓期間畫面不會閃回骨架。
3. **run-generation 不因重抓遞增。** `const gen = ++generation` 在迴圈外只執行一次,`fetchGenStable`
   完全不觸碰 `generation`,棄追判準只**讀**它。F1/F5 的重入語意因此原封,兩組重入釘一字未改且續綠。
4. **`queueReconcile` 零 diff。** 和解快照與後續 mutation 的殘窗經 `gate.refresh` 自帶的世代比對
   **免費**閉合——R1 進場捕捉的世代早於那筆 mutation,落地比對不符即丟棄並原地重抓,不必在
   `queueReconcile` 多排一支和解。閉合釘裡明確斷言和解仍只有一支(`gets === 1` 之後才變 2),
   證明閉合來源不是新排的 R2。該函式本體(FIFO 序列化、失敗翻旗可重試、幽靈 epoch 檢查)逐字未動。
5. **hydrate 不套 loop 的刻意不對稱。** `hydration-gate.hydrate()` 與 `load-gate.load()` 都不走這條
   迴圈,理由見上方「丟棄不補抓」。既有的 hydrate 競態兩釘(in-flight `markMutated`、旗標被翻回
   `false`)一字未改——誤把 loop 套進 hydrate,這兩釘會因為多出的第二次 fetch 而炸。

## 誠實界線:閉合了什麼、沒閉合什麼

閉合的不變量是「**不套用早於最後一次本地 mutation 出發點的快照**」,且**判定於落地當下**——
`fetchGenStable` 內最後一次比對與呼叫端 apply 之間仍隔一個 microtask,同輪 drain 內已排隊的寫回
延續理論上可交錯(與 load-gate 既有 generation re-check 同窗口級,非退化)。

**不是**「refresh 永遠顯示樂觀態」:樂觀 PATCH 與重抓 GET 在 server 端的先後(重抓可能仍讀到寫入
前的狀態,後續才收斂)屬新鮮度族,與 `docs/adr/0016` known-latent #1 同族,不在本案範圍。

重抓次數只有「mutation 停止即收斂」的保證,沒有硬上限——`iterate` 預設恆真是刻意的
(store 層沒有「這一輪已無意義」的概念)。無競態時零額外請求;有競態時 1–N 次,有限收斂。

## 兩筆殘餘(落字防未來誤判)

1. **`undefined` 棄追哨兵。** load-gate 的 gen 分支以 `stable === undefined` 判棄追。若未來出現
   `T` 合法含 `undefined` 的消費端(例如 `createLoadGate<void>`),一次**成功**但回傳 `undefined`
   的 fetch 會被靜默當成棄追吞掉(不 apply、不進 ready)。今日唯一的 gen 生產者是 `pageEntry()`
   ——`T` 是物件/陣列,這條路徑不可達。屆時的正解是改用 module-level 的 sentinel symbol,不是在
   呼叫端補旗標。
2. **gen 分支在 `run()` 與 `silentRefresh()` 刻意重複約 6 行。** 理由是兩個呼叫點同 closure、彼此
   相鄰,抽 helper 需要把該輪的 `gen`(run-generation)當參數穿進去,可讀性無增益。**不要**把這條
   重複記成「為了防 `undefined` 碰撞」——那個 hazard 的完備解是第 1 點的 sentinel symbol,不是重複
   程式碼;兩者是不同的問題,合併記帳會讓未來的人以為刪掉重複就會踩到型別洞。

## 附帶結構保證:跨帳號洩漏在結構上不可能

`fetchGenStable` **只在成功 fetch 之後**才可能重試——rejection 直接傳播、不重發。`session-gate`
的 `epochFetch` 在跨登出/換帳號時是 `throw`(不是回傳空值),因此世代穩定 loop 不可能在 session
epoch 已換的情況下憑一份 stale 回應再發一次 fetch:那份回應根本走不到比對那一行。跨帳號洩漏在
**結構上**不可能,不是靠某個額外守衛擋下的——這是本案與 `docs/adr/0017` P1′ 在飛作廢語意的交界,
往後若有人想「順手」讓 loop 吞掉 rejection 重試,這條保證會一起消失。

## 行為變更(逐條)

1. **MyCourseDetail 取消請假不再被舊快照蓋回**:`refreshLeaveRequests()` 飛行窗口內按取消,舊快照
   丟棄、原地重抓,假單維持 cancelled。
2. **兩通知頁重新整理在飛時已讀不回退**:member/mobile 通知頁的 load-gate 經 `pageEntry` 拿到
   `hydrate.gen`,重新整理(或 retry)窗口內點的已讀不再被打回未讀。
3. **mobile-admin 標記付款/標記已讀不閃回**:`refreshOps()`/`refreshMessages()` 在飛期間的
   `markOrderPaid`/`markMessageRead` 不再出現狀態閃回。
4. **waitlist/leave 和解快照不蓋後續 mutation**:`queueReconcile` 排出的 R1 若在飛期間有第二支
   mutation 完成而未排 R2,R1 的舊快照不再無條件落地。
5. **競態窗口內 refresh 多發 1–N 次 GET**:有限收斂(mutation 停止即穩定);無競態時零額外請求。
6. **守恆:「寫後 `await refreshOps()`」正常序列零變化**——快照照常套用、fetch 恰一次(判準句)。
7. **守恆:未接 `hydrate.gen` 的 plain-flag load-gate 消費端(生產上目前全部)語意逐字不變**
   ——只有 `pageEntry()` 吐出的進場包帶 `gen`。

## overload 簽章:省略 `iterate` ⇒ 永不棄追

`fetchGenStable` 宣告兩個 overload:省略 `iterate` 時回 `Promise<T>`,帶 `iterate` 時回
`Promise<T | undefined>`。動機是讓「不傳棄追判準就永遠抓到穩定為止」成為**型別事實**,
`createHydrationGate.refresh()` 因此不必寫一條不可能執行的 `undefined` 分支——R9「死出口收口」
慣例的延續(零消費者的出口不留在程式裡)。等價的單一簽章 + 呼叫端一行死出口在行為上完全相同,
本輪選前者。

## 測試落點:沿三層界線,不越層

機制本體的單元釘住在它自己的住所 `hydration-gate.test.ts`:三條世代穩定重抓釘(重抓一次、續抓到
穩定、第 N 次 rejection 原樣拋出)+ 一條 `mutationGen()` 唯讀單調薄釘。其餘依 `docs/adr/0016`
「協定測試三層界線」各補其位,不越層:

- **第 1 層(load-gate 特有交織,`load-gate.test.ts` 的 hydrate describe)**:phase 全程單一週期、
  重抓期間被新一輪 `load()` 取代即棄追、`silentRefresh()` 版全程不動 phase、第 N 次重抓 reject →
  `onError` + `error` 態且不翻旗,共四支。
- **第 2 層(session-gate 通用協定)**:R10 和解窗口閉合釘(含「和解仍只有一支」的斷言)+
  `hydrate.gen` 是 `gate.mutationGen` 同一函式的恆等釘。
- **第 3 層(各 adapter 薄採用釘)**:`leave-requests-api.test.ts` 的 MyCourseDetail 場景、
  `mobile-admin/stores.test.ts` 的判準守恆釘、`member/notifications.test.ts` 的 pageEntry 接線釘。

四條舊語意釘(`refresh() 無條件…`/`silentRefresh() 無條件…` 一類)只改標題、斷言一字未動——
標題原本宣稱的「無條件」在接上 `gen` 之後不再逐字為真,改題是為了讓釘的名字與它實際罩住的語意
一致,不是為了讓新功能變綠。

## 關聯 ADR

- **`docs/adr/0016`**:本篇關閉其「兩筆 known-latent」第 2 則;決定一(`HydrationCore` 三決策點
  單源)不受影響——第四點刻意不進那顆 core;「協定測試三層界線」原樣有效,本輪新釘各安其位
  (機制本體的單元釘住其自己的住所,三層各補其位,不越層)。
- **`docs/adr/0008`**:`hydrate` 選項與「`refresh()` 一律真抓」的對稱契約出自該篇。`applyRefreshed`
  的「無條件套用」在該篇與程式註解中**仍然逐字為真**——世代穩定發生在上游的 `run()`,那支函式
  本身確實不做旗標重查;該篇已補 dated 增補指回本篇。
- **`docs/adr/0017`**:`session-gate` 的 `mutate()`/和解鏈是本案第三處病灶的所在地,但本輪
  `queueReconcile` 零 diff——閉合是 `gate.refresh` 免費帶來的,不是在和解鏈上加新機制。P1′ 在飛
  作廢與本篇「附帶結構保證」互為前提。
- **`docs/adr/0019`**:`pageEntry()` 是本案唯一的佈線點(C3 落地);「死出口收口」慣例是 overload
  簽章決定的依據。

## 增補(2026-08-10,架構深化 R11 C1):GET/PATCH server-race 窗自 `docs/adr/0021` 關閉;第三參數 options 化

1. **「誠實界線」節劃在範圍外的那一條自本日關閉。** 原文明載——

   > **不是**「refresh 永遠顯示樂觀態」:樂觀 PATCH 與重抓 GET 在 server 端的先後(重抓可能仍讀到
   > 寫入前的狀態,後續才收斂)屬新鮮度族,與 `docs/adr/0016` known-latent #1 同族,不在本案範圍。

   ——自 `docs/adr/0021` 落地後以本節為準。關閉方式**不是**把樂觀態當成真相顯示(那是前端自造真相),
   而是補上協定的**第五決策點:mutation settle 訊號**(等待軸,同樣住 `hydration-gate.ts`、同樣
   刻意不進 `HydrationCore`):`markMutated(tail?)` 以 `tail.then(done, done)` 為在飛的樂觀 mutation
   記一本尾流帳,`refresh` 族每次出發 fetch 之前先問 `pendingSettle()`,有未 settle 的尾流就等到
   全數落地才捕捉世代、出發 GET——GET 不再搶在 PATCH 前面,server 回的就是含該筆寫入的真值。
   **本篇的判準句一字未動、覆蓋面亦未擴大**:等待軸是新增的正交軸,丟棄軸仍只認「refresh 進場之後
   才發生的 mutation」,`entered === gen()` 那行逐字保留。兩篇的判準句必須一起讀——想「合併簡化」
   兩軸的提案會同時打破兩篇的反例(把等待接上世代 → 本篇判準句反例的正常序列永久掛住;把丟棄接上
   尾流 → 本篇關掉的窗當場復發)。誠實界線、否決紀錄(含最像但最危險的「落地丟棄式」)與四則殘餘
   見該篇。

2. **`fetchGenStable` 第三參數 options 化,型別事實逐條保留。** 簽章由位置參數 `iterate` 改為
   options bag `{ iterate?, pendingSettle? }`(兩個正交決策不再擠同一個位置);上方「決定」節與
   「三個整合點」節寫的 `iterate` 位置參數形自此以本節為準。「overload 簽章」節建立的**型別事實
   不變**:第一支 overload 把 `iterate` 釘成 `?: undefined`,任何帶 `iterate` 的呼叫必然落到第二支,
   「無 `iterate` ⇒ `Promise<T>`」與「有 `iterate` ⇒ `Promise<T | undefined>`」兩句同時成立,
   `createHydrationGate.refresh()` 仍不必寫不可能執行的 `undefined` 分支。

3. **不受影響、仍然有效的四項**:①判準句與其反例(「寫入 → `markMutated` → `await refreshOps()`」
   照常套用、fetch 恰一次)原樣有效;②三形否決紀錄(形 2 世代下沉 core 的裂腦、形 3 自穩定
   `pageEntry` fetch、「丟棄不補抓」)原樣有效——R11 的「落地丟棄式」否決是它們的延伸,不是翻案;
   ③契約五條全部成立,其中第 2 條(load-gate 整合下 phase 單一週期)在 R11 之後仍然為真——等待
   發生在同一個 run-generation 之內、`setPhase('loading')` 仍在迴圈之外;④兩筆殘餘(`undefined`
   棄追哨兵、`run()`/`silentRefresh()` 刻意重複約 6 行)原樣有效——R11 只讓那兩處各多轉傳一個
   欄位,**未趁機抽 helper**,重複的理由未改變。

## 增補(2026-09-26,架構深化 R12):判準守恆釘改寫為 `markOrderPaid(order)` 新簽章

R12 Task 3(`docs/adr/0022` §1)把 `mobile-admin/stores.ts` 的 `markOrderPaid` 由同步的本地 demo
翻轉(`markOrderPaid(id)`)改為先寫後改的 async 動詞:

1. `await updateOrderStatus(order.orderId, 'paid')`。
2. `applyStatusChange()` 套回 `$orders`。
3. `opsGate.markMutated()`。

「判準句」節點名的守恆釘(`src/lib/mobile-admin/stores.test.ts`)依「ADR 點名的測試改寫不刪」
**改寫**:

- 舊序列:同步 `markOrderPaid(pending.id)` → `await refreshOps()`。
- 新序列:mock `updateOrderStatus` → `await markOrderPaid(pending)` → `await refreshOps()`。
- **斷言逐字不變**:重抓前 `get(opsHydrated) === true`、快照照常套用、`fetch` 恰一次。
- 同檔的「`hydrateOps()` 在飛時 `markOrderPaid` → mutation 勝出」競態釘同形改寫,斷言不變。

**判準句與其反例原樣有效**,反例的正常序列在 R12 反而更常見:

- mobile-admin 的學員/課程/教練寫入動詞(`addMember`/`saveCourse`/…)都在動詞內 `await refreshOps()`。
- 它們不呼叫 `markMutated()`,寫後重抓自己 `commit` 旗標。
- 所以「寫入 → 重抓」恰一次 fetch、快照照常套用,正是這條判準要守的形狀。

行為變更第 3 條(`markOrderPaid` 在 `refreshOps()` 在飛期間不再閃回)依然成立。

## 增補(2026-09-27,架構深化 R14):世代讀取器只經 `pageEntry()` 交出;`refreshMessages` 退役

完整背景見 `docs/adr/0024` §2、§3。本篇原文不改寫,以下各點以本節為準。

**1. 「三個整合點」第三點改寫。** 原文寫 `session-gate.ts` 的 `pageEntry()` 一行 `gen: gate.mutationGen`,
`HydrationGate` 因此 additive 增一支唯讀的 `mutationGen(): number`。R14 Task 2(候選 F1)起:

- `pageEntry()` 住 `HydrationGate` 本身,`hydrate.gen` 是閘門閉包內的 `() => mutationGen`。
- `mutationGen` **不再是閘門的公開成員**,世代讀取器只經 `pageEntry().hydrate.gen` 交出。這仍是形 1
  (世代由閘門持有、經讀取器交出),只是交出的出口收成一個。
- 遞增仍只走 `markMutated()`。plain 閘門(mobile-admin 的 `opsGate`)的頁面自此也讀同一本世代帳,
  不再只有 session 閘門的頁面。
- 「測試落點」的 `mutationGen()` 唯讀單調薄釘改經 `pageEntry().hydrate.gen` 讀,斷言不變;第 2 層的
  「`hydrate.gen` 是 `gate.mutationGen` 同一函式」恆等釘改寫為「`markMutated()` 之後 `hydrate.gen()`
  +1」的行為釘,住 `hydration-gate.test.ts`。

**2. hydrate 合併不是形 3。** R14 Task 3(候選 F2)讓 `hydrate()` 與 `pageEntry().fetch` 共用在飛 GET。
它只共用同一次 GET,沒有把世代迴圈包進 fetch;refresh 族(`refresh()`、`pageEntry().refresh`)一律
真抓、不合併,世代穩定重抓仍在 load-gate 的 `run()`/`silentRefresh()` 看得見的地方發生。形 3 的否決理由
原樣有效。

**3. 行為變更第 3 條的 `refreshMessages()`。** 該轉出已於 R14 Task 2 退役:訊息頁改寫成
`createLoadGate({ ...messagesPageEntry })`,重試走 load-gate 的 `refresh`,同樣經 `fetchGenStable` 讀
閘門的世代與尾流帳。「標記已讀不閃回」照舊成立。判準句、反例與兩支守恆/競態釘逐字不變。

## 增補(2026-09-28,架構深化 R15)

**形 1 的讀取器不再外流**。`docs/adr/0025` F-1 把 `pageEntry()` 交出的形狀從
`{ fetch, refresh, hydrate: { gen, pendingSettle, … } }` 換成 `{ source: LoadSource }`——
`mutationGen` 連經 `pageEntry().hydrate.gen` 這條路都不留了,`fetchGenStable` 完全收成
`hydration-gate.ts` 模組私有,只被同檔的 `refreshRun` 呼叫。load-gate 拿到的 `source.refresh
(isCurrent)` 只是一支黑箱 promise,連「有沒有世代」都看不見。

**為什麼這仍然不是形 3**。形 3 當年的兩點否決理由:(a) 只有經 `pageEntry()` 取得 fetch 的消費端
受惠,結構性留洞;(b) 重抓埋進 fetch 內部後,第 1 層(load-gate 特有交織)無物可釘。R15 之後 (a)
不再適用——`LoadGateOptions<T>` 是判別聯集(`{fetch,...}` 或 `{source,...}`,`source` 與
`fetch` 互斥),沒有 `source` 的 plain 頁面走 `plainSource()`,不存在「繞過協定直讀旗標」的第三條
路。(b) 依然成立且是刻意的:load-gate 仍然自己持有 phase 與 run-generation,`isCurrent()` 判準
仍在 load-gate 裡,`source.refresh` 呼叫前後 load-gate 照樣能斷言「phase 單一週期」「棄追後不寫」
——第 1 層要釘的觀察面(phase、卸載、被新一輪取代)沒有一項需要世代本身可見,`fetchGenStable`
移進 hydration-gate 之後,load-gate 那一層的釘一字未改、依舊全綠,證明第 1 層的可觀察性與世代讀取
器外不外流是兩件事。

**契約 1-5 的現況**:五條逐字有效,無一撤回或改寫。契約 3(「run-generation 不因重抓遞增」)、
契約 5(「hydrate 不套 loop」)描述的是 `hydration-gate.ts` 內部行為,與 `pageEntry()` 對外交出
什麼形狀無關;契約 2、4 描述的是 load-gate 整合面,`source.refresh(isCurrent)` 這條新介面下
`run()` 的單一 phase 週期、`queueReconcile` 零 diff 兩點也原樣成立(斷言路徑改經
`gate.pageEntry().source`,判準本身未變)。詳見 `docs/adr/0025` 候選 F-1。

## 增補(2026-10-03,架構深化 R17,FE-10)

本篇原文不改寫。R17(`docs/adr/0027` §5)把寫入入口收成 `write()`,**丟棄軸(`fetchGenStable`)的決定與判準原樣
成立**,以下敘述過時:

- **:24、:111-114、:200-201 的 `queueReconcile`「零 diff」住在 `session-gate.ts`**:函式搬進 `hydration-gate.ts`
  (檢查軸 `resetEpoch`),`mutate()`/和解鏈併入 `write()`。「閉合是 `gate.refresh` 的世代比對免費帶來的,不是在和解鏈上
  加新機制」這個論證不變。
- **:20、:59、:80、:231、:246、:259、:274 的 `markMutated`**:「寫入 → `markMutated` → `await refreshOps()`」
  這條判準反例現在是「`await write()` → `await refresh()`」,斷言(`get(flag) === true` 後快照仍套用、`fetch` 恰一次)
  不變;「遞增仍只走 `markMutated()`」現為「遞增只走 `write()` 內的 `bump()`」;`markOrderPaid` 的第 3 步是
  `opsGate.write()`。
- **:215 的 `markMutated(tail?)` 以 `tail.then(done, done)` 為在飛的樂觀 mutation 記帳**:同一個機制,入口是樂觀 `write()`。
