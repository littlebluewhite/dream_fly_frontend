# mutation settle 訊號:水合協定第五決策點與 refresh 族的等待軸

> Status: Accepted。源自 2026-08 架構深化工程 Round 11 C1(主體 commit `c53b0af`、修波 commit
> `875e6d9`,base `afe091c`)。關閉 `docs/adr/0020`「誠實界線」節記載的 **GET/PATCH server-race 窗**
> ——該篇當時把它劃在世代穩定重抓的範圍**之外**、歸為新鮮度族「不在本案範圍」,本篇是它的結案紀錄。

`docs/adr/0020` 補上的第四決策點 `fetchGenStable`(世代穩定重抓)解決的是「舊快照蓋掉**本地**
mutation」:refresh 進場後若有本地 mutation 落地,那份快照作廢、原地重抓。但它的判準只讀
mutation **世代**,而世代在 `markMutated()` 當下就已遞增——樂觀 mutation 是 **mark-before-await**
(先寫 store + `markMutated()`,才 `await` PATCH),所以「PATCH 還在飛」這件事對世代軸是**不可見**的。
GET 若在這個窗口內出發,server 回的是寫入**前**的真值,而世代此刻**已經穩定**,那份 server 舊真值
會照常套用、把樂觀已讀打回未讀。本篇記錄補上的第五決策點 **mutation settle 訊號**(等待軸)、
它的判準句、介面與硬契約、三形否決紀錄、刻意不入帳名單,以及四則誠實界線。

## 背景:世代軸為何補不到這一格

R10 之後的通知頁動線,一步一步看:

1. 使用者點「已讀」:`markRead()` 先樂觀改寫 store,再 `gate.markMutated()`(世代 +1),**然後**
   才 `await api(PATCH /notifications/{id}/read)`。
2. 使用者(或 `ErrorState` 的重試、或 mutator 尾隨的和解重抓)在 PATCH 仍在飛時觸發 `refresh()`。
3. `fetchGenStable` 進場捕捉世代 —— 捕捉到的已經是 **+1 之後**的值。
4. GET 出發、抵達後端;後端此刻尚未收到那筆 PATCH,回的是 `read: false`。
5. 落地比對:世代沒變(這段期間沒有第二筆 mutation)→ **判定穩定 → 套用** → 畫面把剛剛的已讀打回未讀。

第 3 步就是關鍵:世代軸問的是「refresh **進場之後**有沒有新的 mutation」,而這筆 mutation 發生在
進場**之前**——它在世代軸眼裡是一筆早已了結的舊帳,不是競爭者。真正還在飛的是那條 **PATCH 尾流**,
而閘門原本沒有任何地方記著它。`docs/adr/0020` 誠實界線節寫的正是這一格:

> **不是**「refresh 永遠顯示樂觀態」:樂觀 PATCH 與重抓 GET 在 server 端的先後(重抓可能仍讀到寫入
> 前的狀態,後續才收斂)屬新鮮度族……不在本案範圍。

本篇把它收進範圍:不是靠「顯示樂觀態」(那會變成前端自造真相),而是**不讓 GET 搶在 PATCH 前面
出發**——出發時機一旦排在尾流之後,server 回的就是含這筆寫入的真值,新鮮度契約與樂觀顯示不再對立。

## 決定:第五決策點 = mutation settle 訊號,住 `hydration-gate.ts`,與世代帳分離

閘門新增**第二本帳**:未 settle 的 mutation 尾流計數(`pendingTails`)+ 等待者佇列
(`settleWaiters`)。世代帳管**丟棄**,尾流帳管**等待**,兩本帳在程式碼裡是兩段互不讀取對方狀態的
獨立邏輯。

### 判準句(誤解即 P1)

**等待判準只認未 settle 的 mutation 尾流;丟棄判準維持進出場世代比對;兩軸不得互換。**

(本句與 `hydration-gate.ts` 中 `fetchGenStable` 的 `opts.pendingSettle` 段落同源——該處作
「**等待軸與丟棄軸正交**:等待不看世代,丟棄仍只看進出場世代比對,兩者不得互換」;兩處措辭不同、
判準逐點對應,任一處被改寫都要回頭校對另一處。)

兩個方向的誤用各自會炸掉一半協定:

- **把等待軸接上世代**(例如「世代動過就等」)——`docs/adr/0020` 判準句反例裡那條每天都在跑的正常
  序列(mobile-admin 的「寫入 → `markMutated` → `await refreshOps()`」)會**永久掛住**:那筆
  mutation 沒有尾流、世代卻已經動過,等待條件恆真而無人 settle。
- **把丟棄軸接上尾流**(例如「尾流全 settle 就直接套用」)——refresh 進場後才發生的本地 mutation
  會重新被舊快照蓋回,`docs/adr/0020` 關掉的窗當場復發。

因此 `fetchGenStable` 內兩段程式碼刻意保持互不引用:等待前導只呼叫 `opts.pendingSettle?.()`、
從不讀 `gen()`;`entered === gen()` 那行一字未動、從不讀尾流帳。

### 介面(additive,既有呼叫端零變動)

```ts
/** tail 在場 = 這筆 mutation 有網路尾流;閘門以 tail.then(done, done) 記帳,reject 也算 settle。
 *  省略 tail = 無尾流(如 demo mutation),行為與 R11 前逐字相同。 */
markMutated(tail?: Promise<unknown>): void;

/** 有未 settle 的尾流 → 回一個「全數 settle 時 resolve」的 promise;靜止 → 同步回 undefined。 */
pendingSettle(): Promise<void> | undefined;
```

三條語意各自是刻意的:

1. **`then(done, done)` —— reject 也 settle,是結構保證。** 失敗路徑出帳不靠呼叫端記得寫 `catch`:
   一筆失敗的 PATCH 同樣「不再在飛」,再等下去就是永久飢餓。這條把「呼叫端自律」換成「閘門結構」,
   同 `docs/adr/0019` C1 以型別結構保證 anti-enumeration 的手法。
2. **`pendingSettle()` 靜止時**同步**回 `undefined` —— 硬契約。** 不是風格偏好:多回一個 resolved
   promise 就多一個 microtask,`fetchGenStable` 的世代捕捉會因此**晚於**呼叫端「refresh 之後同步
   `markMutated`」的那一行,`docs/adr/0020` 的三條世代穩定釘(它們正是靠這個同步性判定在飛)會集體
   翻紅。靜止是絕大多數時候的常態,這條同時也讓零競態路徑的額外成本嚴格為零。
3. **`pendingSettle()` 回的 promise「resolve 時保證靜止」。** 內部是 `while (pendingTails > 0)`
   重查迴圈:等待者被喚醒到真正恢復執行之間若又有尾流入帳(下一筆 mark-before-await),不 resolve、
   續等。這是該支 promise 的**公開契約**,其他消費端可以直接呼叫 `gate.pendingSettle()` 而不必自建
   重查。

`settleWaiters` 在歸零時**先換陣列再喚醒**,避免醒來者立刻重排卻被同一輪重複喚醒;佇列不會無界成長
(每次歸零整批清空)。

### 等待落點:`fetchGenStable` 迴圈前導的 **for 重查形**(修波紀錄)

```ts
for (let wait = opts?.pendingSettle?.(); wait; wait = opts?.pendingSettle?.()) {
	await wait;
	if (!iterate()) return undefined; // 棄追:等待期間這一輪已無意義
}
const entered = gen();
const data = await fetch();
```

主體 commit(`c53b0af`)原本是**單次 await 形**(`const wait = …; if (wait) { await wait; … }`),
審查揪出一格殘窗、修波 commit(`875e6d9`)改為上面的 `for` 形。殘窗的精確形狀值得落字,因為它不直覺:

`pendingSettle` **內部**的 `while` 重查只覆蓋「等待者被喚醒 → IIFE 恢復」那一段;它補不到下一段
——**IIFE 已經 resolve 外層 promise、但 `fetchGenStable` 還沒恢復執行**。落在這段 microtask 裡的
`markMutated(tail)` 會整個漏過等待:GET 帶著在飛尾流出發,而且 `entered` 是在那筆 mutation
**之後**才捕捉的,丟棄軸(進出場世代比對)同樣接不住。改成 `for` 之後,從最後一次重問到 `gen()`/
`fetch()` 之間**全程同步**,沒有第三方插隊的餘地。

**硬契約在 `for` 形下原封**:靜止時第一次求值即 `undefined` → 迴圈條件首次為偽 → **迴圈體一次都不
跑、零額外 microtask**。

**`pendingSettle` 內部的 `while` 保留,不因消費端多一層防護而退化**:兩層重查互為 defence-in-depth,
而「resolve 時保證靜止」是介面註解寫死的公開契約(本篇測試的探針就直接消費它)。

### 三形否決紀錄(供未來止步)

- **形 (a):純計數旗標(`inFlightMutations > 0` 就等),不攜尾流語意。** 否決。計數只回答「有幾筆在
  飛」,回答不了「等到哪一刻」——沒有 promise 可 await,消費端只能輪詢或靠事件匯流排另建一層;而
  `then(done, done)` 記帳把「何時算完」直接綁在該筆 mutation 自己的 promise 上,不需要第二套時序
  來源。
- **形 (c):`makeKey` 級注入(把等待判準做成 per-request key,由呼叫端傳進 `fetchGenStable`)。**
  否決。等待軸的正確性取決於「每個 mutator 有沒有記得傳對 key」,與 `docs/adr/0020` 否決形 3 的
  理由同構(覆蓋面取決於呼叫端有沒有走那條路,不是協定本身的性質);且 key 的粒度會誘使未來有人做
  「只等同一筆通知的尾流」這種細分,而 refresh 抓的是**整份清單**,細分在語意上就是錯的。
- **落地丟棄式(GET 照發,settle 後才判斷要不要丟)。** 否決,而且是三形中最像但最危險的一形:
  in-flight 尾流數歸零、世代又穩定時,那份**已經抓回來的舊態照樣套用**——缺陷原封不動,只是延後
  發生;若改成「settle 後強制再抓一次」,則在連續 mutation 流下**空轉無上限**(每輪都被下一筆
  mutation 作廢),而等待形只要停手就收斂。等待成本(一次 promise)嚴格小於丟棄成本(一次白打的
  GET + 一次補抓)。

### 刻意不入帳名單(兩支,程式碼零 diff)

- **`mobile-admin/stores.ts` 的 `markOrderPaid`** —— demo 動作,沒有網路尾流可入帳(它翻的是本地
  ops 快照);傳 `undefined` 走 `if (!tail) return`,行為與 R11 前逐字相同。
- **`mobile-admin/stores.ts` 的 `markMessageRead`** —— 它的 fire-and-forget 是**既有裁決**,不是
  遺漏:入帳會讓 `refreshMessages()` 開始等已讀回條,那是**行為變更**而非缺陷修復。想改的人請先
  回看 `docs/adr/0018` C7(通知已讀 mutator 雙生收斂遞延)——這兩支與 member 側的 mutate 語意是否
  真的同構,本身就是那張卡遞延的原因。

## 佈線事實(三層,恰四個呼叫端)

| 層 | 檔案 | 本輪動了什麼 |
| --- | --- | --- |
| 機制 | `src/lib/hydration-gate.ts` | `FetchGenStableOptions`、`fetchGenStable` 迴圈前導 + 第三參數 options 化、`pendingTails`/`settleWaiters`、`markMutated(tail?)`、`pendingSettle()` |
| 第 1 層 | `src/lib/load-gate.ts` | `LoadGateHydrateOptions.pendingSettle`(additive 可選欄)+ `run()`/`silentRefresh()` **兩處**轉傳 |
| 第 2 層 | `src/lib/session-gate.ts` | `pageEntry()` 的 hydrate 包**一行** `pendingSettle: gate.pendingSettle` |
| 呼叫端 | `member/notifications.ts`、`mobile/notifications.ts` | `markRead`/`markAllRead` 各兩支,共 **4 點**,`markMutated(patch)`/`markMutated(settled)` |

三筆結構事實:

- **load-gate 的「刻意重複兩處」維持不動。** `docs/adr/0020` 兩筆殘餘第 2 點記載 `run()` 與
  `silentRefresh()` 的 gen 分支刻意重複約 6 行;本輪只是讓那兩處各多轉傳一個欄位,**不趁機抽
  helper**——重複的理由(同 closure、抽出需把該輪的 run-generation 穿進去)沒有改變。
- **`session-gate.ts` 的 `mutate()` 本體零 diff。** 它是 await-then-write 形(`await request()` →
  `writeBack` → `markMutated()`),不存在「寫回時尾流仍在飛」的窗口;需要尾流帳的是
  **mark-before-await** 的樂觀 mutator,而那四支刻意不走 `mutate()`(見 `session-gate.ts` 檔頭)。
- **`load()` 不等。** 等待軸與世代軸同屬 refresh 族;hydrate 契約(mutation-wins 直接丟棄)不變,
  這一點與 `docs/adr/0020` 契約五條第 ⑤ 條同一條界線。等待也發生在同一個 run-generation 之內,故
  等待期間 phase **不多跳一次 loading**。
- **`markAllRead` 整批當一條尾流。** 傳的是 `Promise.allSettled(...)`——含失敗也 settle,不會因為
  其中一筆 PATCH reject 就卡死 refresh。

## 誠實界線(四則,程式碼刻意不處理)

1. **尾流掛死 → refresh 跟著等。** 無逾時、無取消,與「fetch 掛死」同級的既有失效模式。呼叫端的
   `destroyed`/`generation` 棄追只在**醒來後**才生效,掛死的尾流不會喚醒任何人。
2. **連續 mutation 流 → refresh 飢餓。** 使用者持續點已讀時 refresh 會一直等;**停手即收斂**
   (尾流帳歸零)。這與 `docs/adr/0020` 重抓次數「mutation 停止即收斂、無硬上限」是同一種有限性
   保證的兩個面向。
3. **PATCH 失敗後 refresh 顯示 server 真相(未讀)是顯式新鮮度契約,不是回歸。** 樂觀更新「失敗不
   還原」的不閃爍原則本來就只保證「不當場閃回」;使用者主動重新整理時顯示後端事實正是 refresh 族
   的契約。`mobile/notifications.test.ts` 有一條斷言把它釘成文件(PATCH 失敗 → refresh 後
   `read === false`),避免未來有人把它當缺陷「修掉」。
4. **跨身分尾流:尾流帳不隨 session identity 重置。** `createSessionGate` 的 `onChange` 只做
   `reset()` + `hydrated.set(false)` + 和解鏈重置,**不清 `pendingTails`**——A 帳號在飛的 PATCH
   會讓 B 帳號的第一次 refresh 多等一會兒。這是**必然自癒**的:尾流一 settle 帳就歸零,而且等待
   本身不搬運任何資料(跨帳號的**資料**洩漏由 `docs/adr/0017` 的 P1′ epoch 核對結構性擋住,見
   `docs/adr/0020`「附帶結構保證」)。刻意不加重置的理由是:清帳等於讓等待者永遠等不到喚醒
   (waiter 佇列同時要一併處置),為一個會自癒的延遲引入一種掛死模式,不划算。

## 型別事實:`fetchGenStable` 第三參數 options 化

第三參數由位置參數 `iterate` 改為 options bag `{ iterate?, pendingSettle? }`——兩個正交決策不再擠
同一個位置。**`docs/adr/0020`「overload 簽章」節建立的型別事實逐條保留**:

```ts
export function fetchGenStable<T>(fetch, gen, opts?: { iterate?: undefined; pendingSettle?: … }): Promise<T>;
export function fetchGenStable<T>(fetch, gen, opts: FetchGenStableOptions): Promise<T | undefined>;
```

第一支 overload 把 `iterate` 釘成 `?: undefined`,任何**帶** `iterate` 的呼叫必然落到第二支
——「無 `iterate` ⇒ `Promise<T>`」與「有 `iterate` ⇒ `Promise<T | undefined>`」兩句同時成立,
`createHydrationGate.refresh()` 因此仍不必寫一條不可能執行的 `undefined` 分支(`docs/adr/0019`
「死出口收口」慣例)。**這條型別事實有活證明**:`refresh()` 內 `opts.apply(await fetchGenStable(…, { pendingSettle }))`
——`apply: (data: T) => void` 在 `strict: true` 下若收到 `T | undefined` 必然編譯失敗,故
`npm run check` 0 error 本身就是它的持續性守恆閘,不需另立探針檔。

## 行為變更(逐條)

1. **兩個通知頁在飛 PATCH 期間按「重新整理」,已讀不再被 server 舊真值打回未讀。** 這是本案唯一
   的使用者可見修復,補完 `docs/adr/0020` 行為變更第 2 條(該條關的是**本地** mutation 被舊快照
   蓋回,本條關的是 **server** 舊真值搶跑)。
2. **在飛尾流窗口內的 refresh 多等一段(= PATCH 的往返時間),GET 出發時機延後。** 靜止時零成本
   (`pendingSettle()` 同步回 `undefined`,一個 microtask 都不多花)。
3. **守恆:無尾流的 `markMutated()` 路徑逐字不變。** mobile-admin 的 ops/messages、
   `session-gate.mutate()` 內的那支、以及任何未傳 `tail` 的呼叫,行為與 R11 前完全相同。
4. **守恆:`load()`/`hydrate()` 不等。** hydrate 三決策點路徑零變動。

## 測試落點:沿 `docs/adr/0016` 三層界線,不越層

機制本體的單元釘住在它自己的住所 `hydration-gate.test.ts`(6 條:尾流未 settle 不出發/settle 後
恰一次、reject 也算 settle、等待期間第二筆尾流入帳續等、**醒來與 GET 出發「之間」入帳的尾流**
(修波輪新增,精確打在單次 await 形的殘窗上)、refresh 在飛時入帳的補抓輪同樣等、`pendingSettle()`
靜止同步回 `undefined`);其餘各安其位:

- **第 1 層(load-gate 特有交織)**:`refresh` 版與 `silentRefresh` 版各一條(前者斷言 phase 全程
  單一週期、後者斷言全程不動 phase),外加一條棄追釘(等待期間被新一輪 `load()` 取代 → 醒來即棄追,
  舊輪的 GET 永不出發)。
- **第 2 層(session-gate 通用協定)**:`hydrate.pendingSettle` 是 `gate.pendingSettle` **同一函式**
  的恆等釘。此釘初版寫成 `toBe(gate.pendingSettle)` 是**假綠**(實作前兩側都是 `undefined`,
  `undefined === undefined` 直接過),已補一行 `expect(typeof gate.pendingSettle).toBe('function')`
  前導——這類「同一參照」釘只要兩側可能同時不存在,就必須先釘存在性,落字防重演。
- **第 3 層(各 adapter 薄採用釘)**:member 側一條(在飛 PATCH 時頁面 refresh 的 GET 不出發、
  settle 後才出發且已讀不回退)、mobile 側一條(`markAllRead` 的 PATCH 群含失敗,`allSettled`
  settle 後照出發)。

**釘的目標是 refresh 族,不是 `hydrate`**:`refreshNotifications` **就是** `gate.hydrate`
(`member/notifications.ts`),而 hydrate 對這個缺陷**結構上免疫**——`markRead` 的 `markMutated`
先於 PATCH 發生並翻旗,之後任何 `hydrate()` 都被 `core.guarded()` 短路、根本不發 GET;已在飛的
hydrate 則被 post-await 的 mutation-wins 丟棄。故第 3 層兩條釘打的是頁面 load-gate 的
`refresh()`(使用者在飛 PATCH 時按「重新整理」),與同 describe 內既有的 `pageEntry` 接線釘同形。

## 關聯 ADR

- **`docs/adr/0020`**:本篇是其第四決策點的**正交補位**,關閉其「誠實界線」節劃在範圍外的 GET/PATCH
  server-race 窗;`fetchGenStable` 的丟棄判準、overload 型別事實、`run()`/`silentRefresh()` 兩處刻意
  重複、`undefined` 棄追哨兵一筆殘餘全數原樣有效(該篇已補 dated 增補指回本篇)。**兩篇的判準句必須
  一起讀**:0020 管丟棄、本篇管等待,任何想「合併簡化」這兩軸的提案都會同時打破兩篇的反例。
- **`docs/adr/0016`**:第五決策點與第四點同樣**刻意不進** `HydrationCore`——它只讀尾流帳、不讀旗標,
  而且是 refresh 族專用;決定一(三決策點單源)不受影響。協定測試三層界線原樣有效,本輪新釘各安其位。
- **`docs/adr/0017`**:`pageEntry()` 是唯一佈線點(一行);`mutate()` 本體零 diff,因為它是
  await-then-write 形、無需尾流帳。跨帳號**資料**洩漏由該篇的 P1′ epoch 核對結構性擋住,本篇誠實
  界線 ④ 只承認跨身分的**延遲**,不承認洩漏。
- **`docs/adr/0018`**:C7(通知已讀 mutator 雙生收斂)遞延理由在本輪依然成立——本篇正是把
  member/mobile 兩側的 mark-before-await 與 mobile-admin 的 fire-and-forget **正式分開記帳**
  (前者入帳、後者刻意不入),兩者的 mutate 語意確實不同構,那張卡的「先確認是否真同構」前提在此
  得到答案。
- **`docs/adr/0019`**:`markMutated(tail?)` 的 `then(done, done)` 以**結構**(而非呼叫端自律)保證
  失敗路徑出帳,沿其 C1 `ForgotSubmitIO` 刻意不給 `setError` 的同一種手法;`pendingSettle()` 的
  overload 保留亦沿其「死出口收口」慣例。
