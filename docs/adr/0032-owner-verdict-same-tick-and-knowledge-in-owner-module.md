# 擁有者判定同一拍、知識只住 owner module

> Status: Accepted(§1–§2)。源自 2026-10-18 架構深化工程 Round 23(前端部分,parent issue #49)。

R23 的兩個決定:§1 是 code 的一條規則,§2 是文件的分工。方向相同——一條規則只住一個地方,而且有測試擋著它不被悄悄弄壞。
本篇只記決定和理由;規則本身寫在 owner module 的檔頭,這裡不重述。

## 背景與決定

### 1. 擁有者判定同一拍

**病灶**:擁有者判定(「還是同一個擁有者、同一個身分嗎」)只在算出它的那一拍為真,被它保護的動作卻常常晚一拍才做。async
helper 算出判定,呼叫端要等 `await` 恢復才動手,中間至少隔一個 microtask,換登可能剛好落在這個空檔。這條規則原本沒有一個家,
靠手放在水合閘門、session 閘門、登入狀態核心與 api client 四個 module 裡。R21、R22 連續兩輪的收斂 refactor,都把一次身分
比對從呼叫端搬進 async callee,也都在幾小時內補回呼叫端那一次比對——同一個機制,出在兩個不同的接縫。消費端另有一處:教練
在 `PATCH /users/me` 飛行中換帳號,伺服器已經存好,畫面卻顯示「儲存失敗」,因為存檔之後讀的是已經重置的共享 store。

**決定**:

- **判定只在算出它的那一拍有效。** 被它保護的動作要嘛同一拍做完,要嘛延後的動作帶著出發時的擁有者、在真正動手那一拍自己比;
  呼叫端不拿 callee 前一拍給的判定動手。規則只寫在 `src/lib/hydration-gate.ts` 檔頭「擁有者判定同一拍」,其他 module 引用它。
- **測試一字未改不是行為沒變的證據;新增 await 點時要有換擁有者的掃描。** 會給出擁有者判定的 async 步驟,測試在它落地之後的
  每一拍各換一次擁有者(擁有者換人掃描,`$lib/testing/owner-switch-sweep`)。refactor 的停止條件不再寫「某測試檔一字未改」。
- 依這條規則:水合閘門的和解重抓帶著 `write()` 出發時的擁有者;本人帳號資料的存檔結果帶回這次存的是誰,教練設定用它組畫面
  資料,不在 `await` 之後讀共享 store。換帳號時教練存檔照樣成功收尾。

**理由**:

- 規則散在約 20 處,而每一輪收斂 refactor 都會把 code 搬過 `await`——正是會悄悄弄壞它的那種改動。延後的動作自己帶著擁有者,
  下一次抽 helper、加 `await` 時,呼叫端不用記得補一次比對。
- 住所選水合閘門的檔頭:session 閘門建在它上面,延後動手的和解重抓也在它裡面。
- `docs/adr/0031` §5 拿「水合閘門測試一字未改」當行為等價的證據,但沒有任何既有測試會在新的 await 點換擁有者,所以「沒改」
  證明不了什麼;那一輪的回歸正落在這個盲點。掃描逐拍換人,新增的 await 點自動被打到,不靠作者知道它在哪。
- 選「延後的動作帶著擁有者」而不是「helper 改成同步」:和解自己比之後,多一拍不影響正確性,`recoverWrite` 與 `HydrationGate`
  的 interface 都不用變。

### 2. 知識只住 owner module,GLOSSARY 只放定義

**病灶**:GLOSSARY 與 `docs/architecture.md` 變成第二份實作說明。GLOSSARY 約三分之二是前端技術用語的 protocol 與 interface
說明;architecture.md 大部分在重寫各 module 的內部,真正是地圖的內容只佔一小段。改一條規則要改 code、檔頭、GLOSSARY、
architecture.md,常常還要補 ADR 增補。文件已經在漂移(architecture.md 說幾個 store 沒有自己的測試檔,其實都有),每個 agent
開工前卻被要求讀完這兩份。

**決定**:每種知識只住一個地方。

| 問題 | 去哪裡 | 放什麼 |
|---|---|---|
| 這個詞是什麼 | `GLOSSARY.md` | 每條一兩句定義與 `_Avoid_`;技術用語再點名 owner module |
| 規則是什麼 | owner module 的檔頭 | 不變量、protocol 步驟、選用條件、interface 說明 |
| 為什麼這樣決定 | `docs/adr/` | 決定與理由 |
| 東西在哪裡 | `docs/architecture.md` | 有哪些 surface、`src/lib` 怎麼分、要讀哪個 module |

- 改一條規則,只改 code 與那個 module 的檔頭。GLOSSARY 只在新增或改名一個詞時動,而且只改定義與 `_Avoid_`。
- ADR 只記決定和理由:不列 commit hash、不列測試數。現況以檔頭為準,舊 ADR 的措辭變舊也不補增補指回新篇;歷史留在 git log。
- 文件掃描測試(`$lib/testing/glossary-scan.test.ts`)守 GLOSSARY 的形狀:原始碼路徑或副檔名、行號、commit hash、輪次編號、
  定義過長、code span 過多、缺 `_Avoid_` 都會紅;ADR 編號可以引用。沒有豁免清單:寫不下就拆詞,或把內容搬回檔頭。

**理由**:

- 一條規則一個住所,改規則就是改一處;第二份說明一定漂移,而且漂移的那份沒有測試擋。
- 檔頭緊貼 code,改 code 的人一定看得到;GLOSSARY 與 architecture.md 離 code 遠,只能靠記憶同步。
- GLOSSARY 要短到幾分鐘讀完,才真的能拿來統一用詞;規則從條目點名的 owner module 直接找到。
- ADR 的 commit 清單、測試數與「指回本篇」的增補是第二份變更紀錄,git log 已經有一份。

## 明確不做的事(供未來止步)

- **把 401 重送規則整個收進登入狀態核心**:`docs/adr/0031` 照舊。api client 同步再比一次身分、同一拍送出,已經符合 §1。
- **合併 session 閘門的 `sessionEpoch` 與內層水合閘門的 `resetEpoch`**:兩者同步移動、各比各的。
- **讓 `recoverWrite` 在 keep/rollback 時同步回傳**:和解帶著擁有者之後,多一拍不影響正確性。
- **`requireCoach` 在 `await` 之後讀 module 狀態**:換身分時多拋一次 `CoachNotFoundError`,頁面會重掛,無害;留在觀察名單。
- **結帳在換登時的在飛視窗**:`docs/adr/0023`、`0024` 已遞延。
- **改寫舊 ADR 的原文或增補**:舊 ADR 維持原樣,包括 `docs/adr/0031` §5 的停止條件。
- **替 architecture.md 加掃描測試**:它是地圖,本來就會寫路徑。
- **清理沒改到的檔頭**:只在改到的檔順手改成只寫現況。
- **測試夾具的四種登入形狀、`coach-session` 沒人用的 `authRoutes`**。
- **後端變更與 wire 型別變更**:後端另開 issue,不改 DTO 形狀。
- **改使用者層級的 skill**:domain-modeling 的規則已經跟 §2 一致。
