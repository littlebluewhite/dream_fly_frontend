# 營運 store 寫入動詞、通知 module 合一、點名備註本機化與 R12 其餘加深

> Status: Accepted。源自 2026-09-26 架構深化工程 Round 12(架構審查候選 01–07 + 同輪確認的 bug,
> 2026-09-26 落地)。base `073a895`;Task 1 `a005172`(+ 修波 `3b148b7`)、Task 2 `13e6ead`、
> Task 3 `14c8826`、Task 4 `a88440c`、Task 5 `6aa8401`、Task 6 `be392d1`、Task 7 `eeacdd9`。
> 使用者於同日定案兩項裁決:**D1**(點名備註改為誠實的本機備註)、**D2**(mobile seam 只刪死 export,
> 不改 `docs/adr/0014`)。

R12 沿 `docs/adr/0018`/`0019`「一輪多案、單篇記錄」的體例,不新開架構類別。共同目標是 locality:
「寫完要重抓」「已讀狀態」「請假規則」「點名草稿轉移」這類知識各自只住一處,並順手修掉審查確認的
bug(每個都附回歸測試)。本篇依序記錄六項決定、明確**不做**的事與理由、D2 留下的判準張力、可見的
行為變更,以及刻意遞延的已知項。被既有 ADR 點名的地方,各篇已補 2026-09-26 的 dated 增補指回本篇。

## 背景與決定

### 1. 候選 01 — mobile-admin 營運 store 擁有自己的寫入動詞(Task 3)

**病灶**:mobile-admin 的學員/課程/教練寫入散在四個呼叫端,各自「打 API → 記得 `refreshOps()`」。
儀表板的快速新增學員**忘了**重抓,而 `hydrateOps()` 已水合就被守衛短路,新學員在「學員管理」要
重新整理才看得到(已確認 bug)。

**決定**:`src/lib/mobile-admin/stores.ts` 新增逐 entity、新增/編輯分開的寫入動詞——
`addMember`/`saveMember`、`addCourse`/`saveCourse`、`addCoach`/`saveCoach`、`markOrderPaid`。

- **不做跨 entity 通用 CRUD**(`docs/adr/0018` C6),**不用 `isNew` 旗標**(`docs/adr/0012` 判準②)。
  表單的 `onSave(body, isNew)` 簽章不變,由頁面分派到兩支動詞。
- **語意**:寫入失敗 → 丟出(coach 兩支回 `coach-save.ts` 的 outcome 原樣),錯誤文案表照舊留頁面
  (`docs/adr/0011`)。寫入成功 → 動詞內 `await` 私有的 `refetchAfterWrite()`,呼叫端拿到 resolve 時
  列表已是新的。重抓失敗只 `console.error`、不丟出,因為寫入本身已成功。coach 兩支只在 `created`/
  `saved` 時重抓。
- **寫入動詞不呼叫 `markMutated()`**:寫後重抓會 `commit` 旗標,首次 `hydrateOps()` 若仍在飛,會被
  mutation-wins 丟棄,不會覆寫。「寫入 → 重抓」正是 `docs/adr/0020` 判準句反例裡的正常序列。
- **`markOrderPaid(order)` 由純本地 demo 改為先寫後改**:先 `updateOrderStatus(order.orderId, 'paid')`,
  再以桌面同一支 `applyStatusChange()` 把 server 回的 `status` 套回 `$orders`(以 `orderId` 比對,
  `paidAt` 取訂單日期),最後 `opsGate.markMutated()`。**仍不帶尾流**:mark 發生在 PATCH 已落定之後,
  沒有在飛尾流可入帳(`docs/adr/0021`)。**不重抓**:KPI 與待付款橫幅都由 `$orders` 衍生,局部套回
  即足夠。
- **分頁誠實**:`getOpsCollections()` 帶出 `pages`(members/classes/orders 各 `{ total, perPage }`),
  寫進新的唯讀 store `opsPages`。三頁 header 改顯示後端 total;`total > perPage` 時搜尋區顯示
  `searchCapHint()` 的「僅搜尋前 N 筆，完整清單請至桌面後台」。行動版不能換頁,所以不照抄桌面的
  「切換頁面」文案。
- **`/coaches` 少抓一次**:`getClasses()` 已回 `coaches`,`getOpsCollections` 不再另打
  `adminGetCoaches()`。

### 2. 候選 02 — 通知 module 合一(Task 5)

**病灶**:`src/lib/mobile/notifications.ts` 是 `src/lib/member/notifications.ts` 的近逐字雙生——同一個
`GET /notifications`、同一支 `mapNotification`、同樣的 `createSessionGate` 與 mark-before-await
mutator。伺服器端本來就是**同一份**已讀真值,前端卻維護兩份 store。

**決定**:`member/notifications.ts` 是唯一的通知 module。`mobile/notifications.ts` 與其測試刪除,
mobile 經自家 seam `mobile/stores.ts` 從已在白名單內的 `$lib/member/stores` 轉出六個符號:
`notifications`、`unreadCount`、`notificationsHydrated`、`notificationsPageEntry`、`markRead`、
`markAllRead`。mobile 消費端(`TabBar`、mobile 首頁、mobile 通知頁)隨之改名。

- **`docs/adr/0019` C3 的成環理由不再適用**:當年葉模組不得被 `stores.ts` re-export,是因為它需要
  `mobile/api.ts` 的 `getNotifications`,而 `mobile/api.ts` 又 import `stores.ts`。合一後來源是完全
  獨立的 `$lib/member/stores`,`member/*` 零 `$lib/mobile` import,不成環,C3 記載的取用路徑不對稱
  隨之消失。
- **兩個 `getNotifications()` 一併退役**:`mobile/api.ts` 的轉手與 `member/api.ts` 的本體(後者只剩
  那一個 production 呼叫端,`docs/adr/0010`「死值不留死出口」)。`mapNotification` 仍活在閘門的
  `fetch` 內,其型別表測試移到 `member/notifications.test.ts`、直接測函式。
- **兩條 mobile 獨有測試搬家**:「不登出直接換帳號」與 `markAllRead` 的 `allSettled` 尾流測試,
  移到 `member/notifications.test.ts`,並在刪除舊檔**之前**對 member 模組跑綠。mobile 通知頁測試
  改 `vi.mock('$lib/api/client')` + `fakeRouter`;實作者故意弄壞一次 fetch 路徑,12 支中 8 支轉紅,
  證明接線不是假綠(該破壞未提交)。
- 第五決策點的尾流呼叫端因此 **4 → 2**(`docs/adr/0021` 增補)。

### 3. 候選 04 — 請假動作規則住 domain 實體檔 `leave-requests.ts`(Task 6)

member 桌面 `routes/member/mine/+page.svelte` 與 mobile `MyCourseDetail.svelte` 兩處「我的請假」
列表各自手抄同一條規則。規則逐字相同,只有觸發元件不同。新增 `src/lib/domain/leave-requests.ts`,
匯出 `leaveAction(lr): 'cancel' | 'bookMakeup' | 'makeupBooked' | null`:

- `pending` → `cancel`
- `approved` 且無 `makeup_session_id` → `bookMakeup`
- `approved` 且有 → `makeupBooked`(僅顯示)
- 其餘 → `null`

兩處改 `{@const action = leaveAction(lr)}`。補課的開啟方式(Dialog vs sheet)與 toast 文案仍留呼叫端。

- **住實體檔、不住 `member-app.ts`**:`member-app.ts` 檔頭限定只放常數與查表;純函式住實體檔,
  前例是 `domain/sessions.ts` 的 `deriveSessionStatus`。
- **mobile 直取 `$lib/domain`、不經 seam**:這是純函式,依 `docs/adr/0014` §1 與其 R9 增補,
  `$lib/domain` 的純邏輯由消費端直取。

### 4. 候選 05 — overlay 註冊表搬出 host、連 props 定型(Task 4)

兩個 `OverlayHost.svelte` 的 `PUSH`/`SHEETS` 對照表共 28 項,原本型別是 `any`。這兩張表搬到
`src/lib/mobile/overlay-registry.ts` 與 `src/lib/mobile-admin/overlay-registry.ts`,以
`satisfies OverlayRegistry` 宣告。

- **泛型參數改為註冊表**:`createOverlay<PushReg, SheetReg>()`(`$lib/components/mobile/overlay`)。
  id 型別取註冊表的鍵;`push`/`sheet` 的 props 取元件 props 扣掉 host 注入的 `onBack`/`onClose`
  (`OverlayProps`)。props 全部可選時可省略引數。儲存端的 props 仍是 `Record<string, unknown>`,
  執行期行為逐字不變。
- **只准敘述層級的 type import**:`stores.ts` 只以 `import type { …Registry } from './overlay-registry'`
  引入註冊表。`verbatimModuleSyntax` 下整行在編譯後抹除;若寫成值 import,會在執行期把全部 overlay
  元件拉進 stores 的載入鏈,而元件反過來 import stores。實作前的 spike 以 `ts.transpileModule`
  驗過兩個 surface 的輸出都不含 `overlay-registry`。
- **host 端**以寬化指派 `const push: Record<Id, Component<any>> = PUSH` 取寬鬆視圖餵
  `<svelte:component>`。這是寬化指派,不是 `as` 斷言(`docs/adr/0012` §3)。
- **編譯器當場抓到的錯誤一併修掉**:
  - 儀表板快速新增的 `onSave` 參數過窄,改吃 `CreateMemberBody | UpdateMemberBody`,以 `'email' in body` 收窄。
  - `ClassSheet`/`MemberSheet` 的 `onEdit` 改必填。原本的 fallback 分支會悄悄丟掉 `onSave`,已刪除。
  - 三個行動表單的 `onSave` 型別照實寫成 `=> void | Promise<unknown>`。
- **型別斷言有閘門**:`src/lib/components/mobile/overlay.test.ts` 的 8 行 `@ts-expect-error` 覆蓋四種錯誤:
  錯命名空間的 id、錯或多的 props、缺必填 props、傳 host 注入的 prop。這些由 `npm run check` 強制:
  故意把 `OverlayProps` 退化成寬鬆型別時,其中 7 行轉為 unused-directive 錯誤。

### 5. 候選 03 — 點名草稿收進 controller;D1 備註本機化(Task 7)

**草稿內化**:`src/lib/coach/attendance-draft.ts` 刪除,其轉移函式成為 `attendance-controller.ts` 的
非匯出內部函式(`SaveBar` 型別同樣收為本地)。`attendance-draft.test.ts` 裡經 controller 介面觀察
得到的行為改寫進 `attendance-controller.test.ts`;觀察不到的(`undo` 恆等、輸入不被改寫)刪除
(「replace, don't layer」)。`attendance-tally.ts` **保留**:它是 coding-standards 點名的純函式範例,
兩頁都用。

**D1 — 誠實的本機備註**:後端 `PUT /sessions/{id}/attendance` 沒有備註欄位,備註從來不會送到後端
(審查確認)。本輪只改前端:

- `applyNote` 只寫 `notes`,**不再**把 `state` 打回 `dirty`、**不再** `dirtyCount + 1`。
- 儲存成功照舊保留 `notes`;`saveAttendance` 仍只收 marks。
- 兩頁的備註 Dialog/Sheet 加上「僅存本機，重新整理後會消失」。
- 後端備註欄位日後另開。

這反轉了 `docs/adr/0014` R10 增補的第④項(「備註編輯計入未存變更」)。

**順帶兩項**:
- `deps.now` 改為可選,預設為 controller 新匯出的 `nowHHMM`。兩頁各自的複本刪除;桌面頁仍 import
  `nowHHMM`,當 saved 卡 `savedAt` 缺值時的後備顯示。
- `AttClassFull` 新增必填欄位 `start`,由 `mapAttendanceClass` 以 `hhmm(s.start_time)` 填入。
  `sessionChipLabel` 改為 `` `${c.start} ${c.name}` ``,不再反解顯示用的 `time` 字串。輸出逐字不變。

### 6. 候選 06(縮小)— 新課程預設值與分類/狀態清單單源(Task 2)

- `src/lib/admin/components/course-request.ts` 新增 `blankClassRow(coaches)`,採桌面預設
  (`startDate: ''`、`checkinRate: 0`、`cat: CATS[0]`)。桌面 classes 頁與 mobile-admin `ClassForm`
  共用這一支。
- 分類/招生狀態清單以 `admin/data.ts` 的 `CATS`/`CLASS_STATUS` 為單一來源。mobile-admin
  `form-options.ts` 的 `F_CATS`/`F_CLASS_STATUS` 退役;mobile-admin classes 頁的分類 chips 改為
  `['全部', ...CATS]`。

### 7. 已確認 bug 與死碼(Task 1)

- **課程編輯框防連點**:`ClassEditDialog` 的 `save()` 改 `return onSave(...)`。`EditModal` 只在
  `onSave` 回傳 Promise 時才上 busy 鎖,原本鎖從未生效。五個 EditDialog 的 `onSave` 型別改為
  `=> void | Promise<void>`。
- **教練頁日期**:`/sessions/today` 已接真 API,「今日」卻是原型的固定日期 `2026-05-30`。
  `schedule-dates.ts` 新增 `todayLabel(d = new Date())`;`PROTO_TODAY` 與 `coach/data.ts` 的
  `TODAY_LABEL` 退役;排課頁的錨點與「今日」鈕改用 `new Date()`。
- **EditProfileSheet 繞過 pref-sync**:偏好從未 `PATCH /users/me`,且可能用本地預設值覆寫伺服器值。
  修法:
  - `pref-sync.ts` 匯出模組層單例 `prefSync`,由 SettingsScreen 與 EditProfileSheet 共用同一條
    `saveChain`。
  - sheet 先 `await prefSync.hydrate()`,再建立本地副本與初始值;存檔只送有變動的鍵。
  - hydrate 在飛期間,偏好 Switch 與存檔鈕一律 disabled(修波)。
  - 分類變更見 `docs/adr/0012` 增補。
- **seam 死 export**(`docs/adr/0010`):
  - `mobile/stores.ts` 與 `mobile-admin/stores.ts` 的 `createOverlay`/`OverlayEntry`/`OverlayState`
    轉出,以及 mobile 的 `AddResult` 轉出。
  - `mobile/auth.ts` 的 `consumeGoogleOauthState`。它唯一的消費者 `GoogleCallbackCard.svelte`
    直取 `$lib/member/google-oauth`。
  - `createOverlay` 兩份重複的直接測試併入新的 `components/mobile/overlay.test.ts`。

## 明確不做的事(供未來止步)

- **row 型別不合併**:`docs/adr/0007` 與 `docs/adr/0019` C4 批3 明定 row 型別(`ClassRow`/
  `MemberRow`/`OrderRow`)各 surface 各留。兩邊結構相同,所以共用純函式(`blankClassRow`、
  `buildCourseBody`、`applyStatusChange`)可直接吃兩種 row,本輪只統一**真正漂移**的預設值與清單。
- **寫入不回傳 row**(寫入動詞一律寫後重抓或局部套用,不以 API 回應組出新 row):
  - 訂單 `PATCH /orders/{id}/status` 的回應只有 `id`/`order_number`/`status`。
  - `mapAdminOrder(o, i)` 與 `mapCoach(c, i)` 需要列表 index。
  - `mapCourse(c, coachNameById)` 需要整張教練表。
  - 單筆回應組不出完整 row;硬組就得在動詞裡重建列表脈絡,反而比重抓更深。
- **候補取消與請假取消不合併**:`mine-controller.ts` 的 `cancelWaitlistEntry` 與 `cancel-leave.ts`
  只是寫法同形(busy 守衛 + 領域 outcome),不是逐字複製。領域不同(候補 vs 請假)、outcome 詞彙
  不同、端點不同,合併會逼出行為旗標(`docs/adr/0011` 否決的寬介面)。
- **mobile 結帳不刷新訂閱:不是 bug**。審查列為疑似 bug,核對後發現 mobile 購物車只放課程,可計費行
  不涉訂閱狀態,不動。
- **`PT_TYPE` 雖零消費者仍保留**:`docs/adr/0019` C4 批1 明列為保留側。
- **候選 07(mobile seam 純轉手退役)只做死 export**:見下節 D2。

## D2 與「`docs/adr/0014` 轉手規則 vs `docs/adr/0019` 純轉手判準」的張力(未解,留待日後)

審查候選 07 提議把 `mobile/stores.ts` 的純轉手 re-export 退役,讓 mobile 直取 `$lib/member` 的真正
產地。依據是審查當下的盤點:30 個值 export 中 23 個是純轉手,另外還有 19 條 `toBe` 身分釘與
foundation-contracts 源路徑白名單。候選 07 認為,每收斂一對雙生就得「re-export + 身分釘 + 白名單」
三檔同改,deletion test 顯示刪掉後複雜度消失,不會回到呼叫端。

兩份 ADR 對同一種匯出給出相反結論:

- **`docs/adr/0014` §1**:mobile 跨 surface 取用 store/動作/效應/型別,一律過自家 seam。seam 讓
  「mobile 向 member 借了哪些東西」集中可見;分叉風險由身分釘與白名單接手。
- **`docs/adr/0019` C4 判準句**:零型別事實、零值變形的同源轉手 = 假 seam,應退役。該句的適用範圍
  寫的是 `data.ts` facade 對 `$lib/domain`/`$lib/api/wire` 的轉手,但字面若延伸到 store/動作轉手,
  會判 `mobile/stores.ts` 的大多數轉出為假 seam。

**D2(使用者裁決,2026-09-26)**:本輪不改 `docs/adr/0014`,只依 `docs/adr/0010` 刪零消費者的死
export(§7)。`docs/adr/0014` 在此張力解決前仍然有效。本輪的通知合一因此照 0014 經 seam 轉出,
身分釘由 15 增為 21。日後重開時要回答的具體問題:0019 判準句的「型別事實」軸,是否也應適用於
0014 §1 以「效應/動作」軸決定的 store 轉手?兩條判準看的是不同的軸,目前沒有一條規則決定誰優先。
另外,0014 §1 的反方理由(mock 精確源路徑才是佈線證明)也意味著:測試本來就 `vi.mock` 源頭而非
seam,seam 的可見性收益只落在 production import 面。

## 可見的行為變更(逐條)

1. **mobile-admin 快速新增學員後,「學員管理」列表立刻看得到**(修 bug)。
2. **mobile-admin 學員/課程/教練新增與編輯的成功 toast 延後到重抓完成**,與更新後的列表同時出現。
   取捨是晚一次重抓的時間。寫入成功但重抓失敗時只記 log,成功 toast 照發。
3. **標記已付款**:
   - 收款時間顯示訂單日期,不再是「剛剛」。
   - 狀態取 server 回應,不再寫死 `'paid'`。
   - 真的送出 PATCH;失敗時丟出,store 不動。
4. **mobile-admin 三頁 header 改顯示後端 total**:
   - `{total} 位學員`
   - `{total} 個開課班級 · 本季招生中`
   - `共 {total} 筆報名繳費紀錄`

   超過一頁時,搜尋區會出現「僅搜尋前 N 筆」提示。
5. **mobile-admin 新課程預設與分類順序**:預設分類由「幼兒體操」改為「競技體操」(`CATS[0]`);
   預設開課日由 `2026/03/01` 改為空白,到課率由 90 改為 0;分類 chips 順序與桌面一致。
6. **通知已讀跨 surface 同步**:mobile 與 member 共用同一份 store,在 mobile 讀一則通知,member 的
   未讀角標同步減少。
7. **教練頁日期**:今日標籤、週/月曆的「今天」、排課頁錨點都改為真實日期。
8. **桌面課程編輯框快速連點只送出一次**。
9. **EditProfileSheet**:
   - 偏好改動真的寫回後端。
   - 從帳號頁開啟時,不再用本地預設值重置其他偏好。
   - hydrate 在飛期間,偏好開關與存檔鈕暫時 disabled。
10. **點名備註**:只改備註不再算未存變更。桌面的變更筆數不增加;行動頁的「點名已儲存」鈕維持原狀。
    備註框顯示「僅存本機，重新整理後會消失」。
11. **網路**:`getOpsCollections` 每次水合/重抓少一個 `GET /coaches`。

## 已知、刻意遞延

- **undo 可能復原成 `'saving'`(既有缺陷,D1 多開一條到達路徑)**:
  - `setMark`/`applyNote`/`markAllPresent` 都先取 undo 快照。儲存在飛時取到的快照帶
    `state: 'saving'`;該次儲存完成後按復原,會回到「儲存中」,但沒有任何請求在飛,頁面卡在儲存中,
    也無法切班。
  - `setMark` 在本輪之前就有這條路徑。D1 之後,儲存中編輯備註不再把 state 打回 dirty,儲存回應照常
    套用,於是 `applyNote` 的快照也能經成功路徑走到這裡。
  - 建議修法:`undo()` 在 `prev.state === 'saving' && state !== 'saving'` 時以 `'dirty'` 復原,
    外加一條測試;或先決定備註是否應可復原。本輪不動。
- **mobile-admin header total 與「全部」chip 計數不一致**:header 讀後端 total;學員頁「全部/啟用中/
  已停用」chips 與訂單頁「全部/已付款/待付款/已退款」chips 仍數已載入的第 1 頁。超過一頁時兩個數字不同。提示文字已說明
  搜尋只涵蓋前 N 筆,chip 計數的語意(「本頁」或「全部」)留待日後決定。
- **訂單頁 header 的措辭(開放問題)**:「共 N 筆報名繳費紀錄」的 N 是全部訂單,包含**方案**購買。
  依 `CONTEXT.md`,方案購買產生的是「訂閱」而非「報名」,所以這句把方案訂單也叫成報名。候選改寫是
  「共 N 筆繳費紀錄」;程式碼本輪不動,待確認用詞。
- **D1 的取捨**:只改備註並儲存後,saved 卡仍寫「已同步至雲端」。這句描述的是出勤,備註另有「僅存
  本機」標示。
- **其他**:`EditProfileSheet.save()` 沒有防連點鎖;`searchCapHint` 的 UI 文案住 `stores.ts`,提示
  markup 在三頁各一份。兩者都在審查中列為 minor,本輪不動。

## ADR 點名的測試:改寫,不刪(舊 → 新)

- **`docs/adr/0020` 判準守恆釘**(`src/lib/mobile-admin/stores.test.ts`):
  - 舊:同步 `markOrderPaid(pending.id)` → `await refreshOps()`。
  - 新:mock `updateOrderStatus` → `await markOrderPaid(pending)` → `await refreshOps()`。
  - 斷言不變:重抓前旗標已為 true、fetch 恰一次、快照照常套用。
  - 同檔的「`hydrateOps()` 在飛時 `markOrderPaid` → mutation 勝出」競態釘同形改寫,斷言不變。
- **`docs/adr/0021` 的 settle 測試與 P1″ 換帳號釘**:由 `src/lib/mobile/notifications.test.ts`(已刪)
  移到 `src/lib/member/notifications.test.ts`,分別是 describe「markAllRead 的 allSettled 尾流」與
  「跨帳號 session 重置」。
- **`docs/adr/0014` R10/R11 的點名釘**:`attendance-draft.test.ts` 的可觀察行為移入
  `src/lib/coach/attendance-controller.test.ts`。「空備註算 dirty」依 D1 反轉為「只改備註:state 仍
  saved、dirtyCount 不變」。

## 關聯 ADR

- **`docs/adr/0006`**:殘餘表的「mobile-admin 列表僅第 1 頁」與「帳戶設定」兩列有現況校正(增補)。
- **`docs/adr/0010`**:§1.5 的死 export 與兩個 `getNotifications()` 的退役,依其「死值不留死出口」。
- **`docs/adr/0011`**:寫入動詞不做通用 CRUD、候補/請假取消不合併,都沿用其「行為旗標寬介面不收」。
- **`docs/adr/0012`**:pref-sync 改列為 mobile 共用 module(名冊 9→8);K6 的 id 聯集改住註冊表;
  點名 controller 的 `now` 改為可選並有預設;c3 競態段裡 `applyNote` 的語意改變(增補)。
- **`docs/adr/0013`**:`TODAY_LABEL` 退役;§3 的 mobile `notifs` wrapper 住所校正(增補)。
- **`docs/adr/0014`**:seam 新增通知轉出、死 export 移除、`sessionChipLabel` 改讀 `start`、R10 第④項
  被 D1 反轉(增補);D2 張力見上節。
- **`docs/adr/0016`、`docs/adr/0017`**:mobile 通知葉模組退役,`createSessionGate` 消費者 4 → 3(增補)。
- **`docs/adr/0018`**:R11 增補「`markOrderPaid` 根本沒有網路呼叫」不再成立,C6 否決原樣有效(增補)。
- **`docs/adr/0019`**:C3 的葉模組與取用不對稱消失(增補)。
- **`docs/adr/0020`**:判準守恆釘改寫為新簽章,判準句與反例原樣有效(增補)。
- **`docs/adr/0021`**:尾流呼叫端 4 → 2;`markOrderPaid` 仍不入帳,但理由改變;settle 測試換路徑
  (增補)。

## 增補(2026-09-26,架構深化 R13):undo 已修、防連點關閉、`markOrderPaid` 改回傳 outcome,及三處現況

完整背景見 `docs/adr/0023`。本篇原文不改寫,以下各點以本節為準。

### 1. 「已知、刻意遞延」兩條已關閉

- **「undo 可能復原成 `'saving'`」**:已在 `157a70d`(R12 終審修波)修掉。`attendance-controller` 的
  `undo()` 還原到 `prev.state === 'saving'` 的快照、而此刻已不在儲存中時,落地為 `'dirty'`,並有 controller
  測試釘住。本篇該條的「建議修法」即實際修法。
- **「其他」條的「`EditProfileSheet.save()` 沒有防連點鎖」**:R13 Task 3 加上 busy 鎖(按鈕停用,
  `save()` 內再擋一次),存檔改為一次 `saveProfile`,失敗時不關。

### 2. `markOrderPaid` 改回傳 outcome,不再丟出

§1 與「可見的行為變更」第 3 條記「真的送出 PATCH;失敗時丟出,store 不動」。R13 Task 5 起它回傳
`changeOrderStatus` 的 outcome(`changed | illegalTransition | pointsShortfall | failed{error}`),
只有 `changed` 才套回並 `markMutated()`。「寫入失敗 → 丟出」的語意只剩學員/課程兩組動詞(教練兩支
本來就回 outcome)。測試對照見 `docs/adr/0023`。

### 3. 三處現況校正

- **課程動詞簽章**:`addCourse(course)`/`saveCourse(id, course)` 改收 `ValidCourse`(`course-request.ts`
  的 `checkCourseDraft` 產物),不再自己 `get(coaches)` 解 `coach_id`;body 由 `buildCreateCourseBody`/
  `buildUpdateCourseBody` 組出。「明確不做」節列的共用純函式 `buildCourseBody` 已退役,
  `applyStatusChange` 搬到 `order-status.ts`。
- **§6 的單一來源清單**:`CLASS_STATUS` 已退役(D2 讓招生狀態改唯讀,它失去最後消費者);分類清單仍以
  `admin/data.ts` 的 `CATS` 為單一來源。
- **§7 的 `prefSync` 單例**:隨 `pref-sync.ts` 退役,偏好寫入改走 `$lib/member/profile` 的 `setPref`,
  與 `saveProfile` 共用一條寫入鏈。「先水合再編輯」由該 module 結構保證。

## 增補(2026-09-27,架構深化 R14):D2 張力已解

完整背景見 `docs/adr/0024` §1。本篇原文不改寫,以下以本節為準。

「D2 與 `docs/adr/0014` 轉手規則 vs `docs/adr/0019` 純轉手判準的張力」一節留下的問題——0019 判準句的
「型別事實」軸是否也適用於 0014 §1 以「效應/動作」軸決定的 store 轉手——R14 Task 1(候選 F6)給出答案:

- **`docs/adr/0014` §1 管的是 import 方向**:mobile production 碼只經四個 seam 檔碰 `$lib/member`。
  這條保留,由 foundation-contracts 的 import 方向掃描釘住。
- **`docs/adr/0019` C4 判準句仍只適用於 `data.ts` facade**,不延伸到 `mobile/stores.ts` 的 store/動作
  轉手。兩條判準看的是不同的東西,不必排優先序。
- **真正退役的是身分釘和白名單**。該節末句已點出:測試本來就 `vi.mock` 源頭而非 seam,seam 的收益只
  落在 production import 面。R14 把最後三個按路徑 mock `$lib/member/stores` 的測試改走 fetch adapter,
  「mock 精確源路徑是佈線證明」失去對象,`mobile/stores.test.ts` 的 30 個 `toBe` 身分釘、
  `mobile/auth.test.ts` 的 2 個與 `ALLOWED` 白名單一併刪除。

seam 的轉出本身不退役。審查候選 07 當年要消除的「每收斂一對雙生就得 re-export + 身分釘 + 白名單三檔
同改」,自此只剩 re-export 一檔。

## 增補(2026-09-28,架構深化 R15)

### D2(:184-197)重開一半:`mobile/stores.ts` 的轉出退役,seam 本身不退役

`docs/adr/0025` F-4。R14 D2 裁決「本輪不改 `docs/adr/0014`」原樣有效——`mobile/stores.ts` 這個
seam **本身**沒有退役,mobile 消費端要借 member 的 store/動作/效應仍然可以經它借。本輪動的是
D2 記錄的另一件事:`mobile/stores.ts` 目前轉出的 27 個 `$lib/member/stores` 符號 + 3 個
`member/checkout` 符號裡,凡是**本輪之後零消費者**的死轉出(消費端全部改直取
`$lib/member/*`)予以刪除,連帶的 19 條(後增至 21 條,R14 增補)`toBe` 身分釘與白名單條目一併
清空。這不是 0019 C4 判準句延伸到 store 轉手的裁決——0014 §1 vs 0019 C4「型別事實軸 vs
效應/動作軸該由誰優先」這個具體問題本輪仍未回答,清的是「零消費者的 export」,不是「凡純轉手皆
退役」。0014 §1 因此在此張力解決前依然有效,只是 R15 把消費端幾乎全部搬離了它。

### 候選 04:`leaveAction` 改私有,由 `leaveRow()` 取代

`docs/adr/0025` 候選「請假列 VM」。本篇候選 04 定的 `leaveAction(lr)` 從 `domain/leave-requests.ts`
的公開匯出改為模組私有實作細節,呼叫端不再直接 `import { leaveAction }`。對外新增單一公開 API
`leaveRow(source): LeaveRow`(內含 `tone`/`label`/`when`/`makeupWhen`/`action`),兩處呼叫端的
`{@const action = leaveAction(lr)}` 改為 `{@const row = leaveRow(lr)}`。補課的開啟方式(Dialog vs
sheet)與 toast 文案仍留呼叫端,本篇候選 04 的這句話不變。
