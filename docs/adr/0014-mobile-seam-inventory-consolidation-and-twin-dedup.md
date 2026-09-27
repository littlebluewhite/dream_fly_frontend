# mobile 表面接縫收編邊界與雙生收斂

> Status: Accepted。源自 2026-07-16 架構深化工程 8 卡批次(W1 coach 載入文案單源＋打卡
> controller＋public 月曆選取抽純、W2 formatter 單源＋請假/補課表單機、W3 編輯對話框 reset 補測＋
> 取消請假收斂＋mobile 接縫存量收編,2026-07-16 落地;實作計畫本身先經 codex 兩輪審查——一般驗證輪
> 與對抗終審輪——修正 24 條發現後才執行)。

本批次的共同病灶有四:(a) mobile surface 的 production 程式碼仍有存量繞過自家 seam 直取
`$lib/member` 符號,「哪些關注點必須過 seam、哪些依 `docs/adr/0009` 維持直取」從未落字;(b)
desktop↔mobile 雙生元件把同一套編排逐字複製兩份(請假/補課表單機、取消請假),而
`docs/adr/0012` 判準①「呼叫端恆為一頁」字面上擋住了收斂;(c) coach 六頁的載入錯誤文案逐字同文卻
各自維護,`docs/adr/0011`「文案留呼叫端」字面上也擋住了收斂;(d) coach 首頁打卡編排的狀態機
(hydrate ABA、409/404 校正、in-flight 去重)只能用 render 之舞測,而 `docs/adr/0013` 留有一筆
「不抽 controller」的紀錄。本 ADR 記錄四者的收斂決定與判準——其中 (b)(c) 是對 0012/0011 的**明文
劃界**、(d) 是對 0013 一筆紀錄的**明文推翻**,均非靜默覆寫。

## 背景與決定

### 1. mobile 接縫收編邊界:動作/效應/顯示查表/型別過自家 seam,純函式維持直取

**裁決**(2026-07-16 使用者定案):mobile surface 的 production 程式碼裡,凡屬 **store/動作/效應/
顯示查表/型別**的跨 surface 取用,一律經自家四個 seam 檔——`mobile/api.ts`(資料 getter 委派,
Round 3 既有)、`mobile/stores.ts`(store 與動作 re-export)、`mobile/data.ts`(顯示查表 facade)、
`mobile/auth.ts`(新增,Google OAuth 效應三件組 `isGoogleLoginEnabled`/`startGoogleLogin`/
`consumeGoogleOauthState` 的 re-export——效應性模組不在 `docs/adr/0009` 的純邏輯豁免內);**純函式**
(report-math、filters、donut、formatter 綁定等)依 0009 維持跨 surface 直取,不收。

落地形:`mobile/stores.ts` 的存量 re-export 塊自 `'$lib/member/stores'` 收編 14 個符號
(points/pointsLedger/refreshPoints/redeemReward/redeemRewardErrorMessage/joinWaitlist/
joinWaitlistErrorMessage/leaveRequests/refreshLeaveRequests/createLeaveRequest/cancelLeaveRequest/
bookMakeup/leaveRequestErrorMessage/getCourseSessions)+ type-only 的 `LeaveRequest`/`CourseSession`,
並自 `'$lib/member/checkout'` 收編 `validateCoupon`/`orderErrorMessage`;計畫原枚舉的
`WaitlistEntry` 因 production 零消費者依「用不到的不加」剔除。11 個 production 消費者(PointsScreen、
CartSheet、CourseDetailSheet、LeaveSheet、MakeupSheet、MyCourseDetail、mobile 首頁/courses/account
路由、login 兩頁)全數換路徑。

**不變量與守衛**:「mobile production source(`.test.ts`/`.fixture.svelte` 除外)中,上述四檔之外
無任何 `$lib/member` import」——由 `mobile/foundation-contracts.test.ts` 的 source-scan 契約釘住
(沿用該檔既有 walker 的排除慣例;掃描涵蓋靜態/side-effect/動態 import 與相對路徑逃逸四種形;
落地時做過可證偽驗證:暫塞違規行會被精確點名)。**測試檔明文豁免**:sheet/overlay 與 seam 自身的
測試檔仍直取或 `vi.mock('$lib/member/stores')`——mock 精確源路徑正是「元件真的接在 member 實作上」
的佈線證明手段,收編進 seam 反而會讓 mock 靜默失效變假綠。分叉風險(re-export 與源頭漂移)由
identity pins(`toBe` 同參照;`mobile/stores.test.ts` 16 個 + `mobile/auth.test.ts` 3 個)接手;
identity pin 驗不出「繞道 barrel 之下深模組」的路徑漂移(參照仍同、但 vi.mock 不再攔截),由
foundation-contracts 的源路徑白名單契約(stores/checkout/leave-form/cancel-leave 四模組)補上。

**顯示查表隨批升遷**:`LEAVE_STATUS` 自 `member/data.ts` 升遷 `domain/member-app.ts`(常數計數
11→12,計數句在 `domain/member-app.test.ts`),member/mobile 兩側 facade 以 0013 Form-3 純註記收窄
re-assert 消費。宣告形有一個此批驗出的陷阱要記:**satisfies 目標必須明列 tone 字面聯集**
(`satisfies Record<string, ['warning' | 'success' | 'error' | 'neutral', string]>`)——寫成
`[string, string]` 會把 tuple 元素契約擴寬成 `string`,下游 facade 的 `Record<string, [Tone, string]>`
純註記收窄在 strict 下直接紅燈(同檔 NOTIFS_SEED 先例)。`session-format.ts`(純顯示派生)同批
`git mv` 進 `domain/`,六個 member/mobile 消費者直接 import——純顯示模組無需 facade 中繼。
mobile-admin 側同型:`LEVEL_TINT` + `type Student` **留在** `coach/data.ts`(單複本無分歧,搬進
domain 只是搬家),經 `mobile-admin/data.ts` 活 re-export 供兩個消費者取用;`StudentLevel` 零
mobile-admin 消費者故不轉出——零消費者的型別轉出在轉譯期擦除,是 vitest/check 皆護不住的死出口。

**mine 單一接縫**:`member/api.ts` 的 `getMine()` 成為 `hydrateSessionStores(caller, tasks)` 的
第三個採用者(候補清單 + 我的請假),但採**並行形**——主 fetch 與水合以 `Promise.all` 併發,而非
`getDashboard()`/`getAccount()` 的尾端 await 序列形。這是行為等價優先:mine 頁改接前本來就是三支
請求並行、主 fetch fail-hard、旁路 best-effort,收斂進 getter 不應順手改變時序;差異已記在模組註解。

### 2. `docs/adr/0012` 判準①的「雙生收斂」核可類

0012 判準①要求單頁 controller「呼叫端恆為一頁」,本批為其增設一個**明文核可類**:當多個呼叫端是
desktop↔mobile **雙生**、且同時滿足「deps 完全相同、零行為旗標參數、編排逐字重複」三條件時,允許
雙(多)呼叫端共用同一 deps 注入模組;判準②(deps 僅 I/O 效應)③(領域詞彙)④(零 gate/toast
import、文案留呼叫端)照舊,一條不鬆。本批兩例:

- **`member/leave-form.ts`**:請假/補課表單機雙工廠(`createLeaveRequestForm`/
  `createMakeupBookingForm`),四個呼叫端(LeaveDialog/MakeupDialog/LeaveSheet/MakeupSheet)。
  三態載入、valid 守衛、防雙送、reason trim 進模組;outcome 用領域 kind
  (`leaveRequested`/`makeupBooked`/`failed` 攜原始拋出物),`leaveRequestErrorMessage` 映射、
  toast 文案(含 makeup body 的兩面分歧)、409/404/422 的 render 佈線測試全留元件端。
- **`member/cancel-leave.ts`**:取消請假 busy 守衛 + outcome(`leaveCancelled` 攜 course_name/
  `failed`),兩個呼叫端(member/mine 頁、mobile `MyCourseDetail`)。收斂前兩處 `doCancelLeave`
  除 busy 變數名外含 toast 文案逐字全同。

**明確不收**的部分同樣落字:兩頁的 attendance gate 佈線生命週期本來就不同(mine 可切換 active id、
MyCourseDetail 固定 id + onMount),gate 佈線不是逐字重複,留在各元件——這正是判準④的用途。通用
`ok`/`success` 一類 outcome 詞彙違反判準③,本批一律用領域 kind。

### 3. `docs/adr/0011` 劃界:載入(gate onError)文案單源 vs 動作錯誤表留呼叫端

0011「文案留呼叫端」的理由是 per-entity 知識屬於頁面;其收斂紀律本身是「byte-identical 才收」。
coach 六頁(desktop 四頁 + mobile-admin coach 兩頁)的**載入**錯誤 title/body 對(泛用連線失敗 +
「未綁定教練檔案」兩對)逐字同文、零 per-page 實體知識,故收斂進
`src/lib/coach/load-error-copy.ts`(`GENERIC_LOAD_ERROR` 常數兼各頁初始值單源 +
`coachLoadErrorCopy(e)`)——判別採 **name-based**(`e.name === 'CoachNotFoundError'`)而非
instanceof,因 desktop 頁測試把 `$lib/coach/api` 整支換假模組(class undefined);mobile-admin 兩頁
經 `mobile-admin/api.ts` 活 re-export 取用。**劃界**:此單源僅涵蓋載入(gate `onError`)文案;
動作錯誤的 per-entity 1-4 行文案表依 0011 照舊留在各呼叫端,兩者此後各行其道。

### 4. `docs/adr/0013` 打卡「未抽 controller」紀錄之推翻

0013 末段(W5 補測)記錄:打卡組裝處只補 render 測試、不抽 controller,理由是 0012 判準④當時
判定不成立(「太薄」)。本批以 0012 四判準**重新逐條裁決,全數成立**:①呼叫端恆為
`coach/+page.svelte` 一頁;②deps 僅 `clockIn`/`clockOut`/`isClockedIn` 三支 I/O 效應、零行為旗標;
③outcome 詞彙(`clockedIn`/`alreadyClockedIn`/`notClockedIn`/`stale`)是打卡領域生命週期;
④零 `$lib/load-gate`/toast import,六組 toast 文案逐字留頁。**前提差異**:0013 那輪只補了 render
測試;而 hydrate ABA(`clockTouched`,mutation wins)+ 409/404 校正 + in-flight 去重是一台狀態機,
用 render 之舞測(page.test 舊 183-201 段)正是 0012 controller 要消滅的測試形狀。故抽出
`src/lib/coach/clock-controller.ts`(仿 attendance-controller 的 deps 注入工廠;**未加** busy
早退守衛——現況防雙擊只靠 `disabled={clocking}`,加了是行為變更),ABA render 之舞刪除、12 個
無渲染單元 its 接手,其餘頁測試(409/404 精確標題斷言等)全留兼作 outcome→toast 映射覆蓋。
0013 該筆紀錄自此由本節**取代**;其餘 0013 內容(顯示查表三形、shell 身分、通知落庫)不受影響。

### 5. known-latent 記錄(記錄性,不隨批修復)

- `getMine()` 順手水合使 mobile 的 `getHome`/`getMine` 委派也帶上候補/請假 best-effort hydrate,
  既有的「`joinWaitlist` prepend 可能被更早發出的 in-flight `refreshWaitlist` 回應覆寫」race 面
  隨之擴大(mine 上本已存在)。請假側同款(codex R2 補名):in-flight `refreshLeaveRequests`
  回應若晚於 `cancelLeaveRequest` 的原地 status 改寫抵達,會把已取消列蓋回 `pending`,含「首次
  水合蓋掉水合前 mutation」變體——與候補 race 同機制、同擴散路徑(desktop mine 本已存在,經
  mobile 委派而擴大)。水合 guard(`createHydrationGate` 採用)屬另案裁決,不靜默出貨。
- `MyCourseDetail` onMount 的 `refreshLeaveRequests` 是「開詳情刷新最新」的刻意語意,保留;
  mine 進頁 + 開 overlay 的兩次抓取為已知重複,同屬上述另案。

## 關聯 ADR

- **`docs/adr/0008`**:ScheduleCalendar 的 bespoke 三態模板豁免不動——本批僅把其**選取轉移**抽為
  `public/calendar-selection.ts` 純函式(`gate.refresh()` 副作用留元件),gate 佈線零改動。
- **`docs/adr/0009`**:mobile-admin 純函式直取的批准是本 ADR §1「純函式不收」邊界的直接依據;
  formatter 收斂(lib-root `format.ts`)後 ReportsScreen 的 `fmtPct` 直取亦依 0009 保留。
- **`docs/adr/0011`**:§3 為其劃界(載入文案 vs 動作文案),錯誤映射器單源紀律照舊。
- **`docs/adr/0012`**:§2 為判準①增設雙生核可類;§4 的 clock-controller 是其四判準的新適用例
  (單頁 controller 清單 3→4)。
- **`docs/adr/0013`**:§4 取代其打卡「未抽」紀錄;其顯示查表三形由 §1 的 `LEAVE_STATUS` 延伸
  (member-app 常數 11→12),`readonly`/satisfies 宣告紀律照舊並補記 tone 字面聯集陷阱。

## 增補(2026-07-23,架構深化 R8 C2+C3)

- **§2 雙生核可類新例**:`src/lib/admin/settings-form.ts`(`createSettingsForm`)收斂桌面
  `admin/settings/+page.svelte` 與 `mobile-admin/overlays/AdminSettingsScreen.svelte` 逐字
  重複的草稿狀態機/save() 組裝,三條件核對與「單工廠不拆 createFormCore/guardedSubmit」的
  裁決見 `docs/adr/0018`。
- **§3 re-export 家族新增一員**:`admin/components/coach-save.ts` 的 `saveNewCoach`/
  `saveCoachEdit`(K4/`docs/adr/0012`)現由 `mobile-admin/api.ts` 同款零映射 re-export 供
  `CoachesScreen.svelte` 消費——與本節既有的 `coachLoadErrorCopy` 經同一 barrel 供 mobile-admin
  兩頁取用同一手法;`pendingUserId` 哨兵在此消費端刻意丟棄的行為裁決見 `docs/adr/0018`。

## 增補(2026-08-03,架構深化 R9 C2+C4)

- **§1 的 `LEVEL_TINT`/`Student` 邊界 seam 本輪重驗、原判維持**:`docs/adr/0019` C4 批3 以判準句
  掃過 `mobile-admin/data.ts` 的每一行匯出,`export { LEVEL_TINT, type Student } from
  '$lib/coach/data';` 落在保留側的第三款(「ADR 記名的邊界 seam」)——本節明載的理由(單複本無分歧、
  搬進 domain 只是搬家、canonical 出處刻意留在 `coach/data.ts`)未因本輪而改變,該行連同其上方六行
  解說註解**逐位元組未動**。同批的其他六個匯出(`COACHES`/`Coach`/`Venue`/`Ticket`/`ActivityRow`
  與 `MemberAccountStatus`/`OrderStatus`)則因零附加型別事實而退役。兩者並置正是本節邊界的用意:
  **經 facade 借道需要一個記名的理由,直取才是預設**;下次審查若看到 `LEVEL_TINT` 還在轉手,請先
  回看本節與 0019 的判準句保留側,勿當成漏網的純轉手。`StudentLevel` 零 mobile-admin 消費者故不
  轉出的死出口裁決同樣不變。
- **§1 的 mobile 接縫不變量不受 C2/C4 影響**:C4 讓 mobile 的 overlay/頁面改直取
  `$lib/domain/member-app`、C2 讓 mobile 的購物車改建於 lib-root 的 `$lib/cart` 之上——兩者都不是
  `$lib/member` 直取,`foundation-contracts.test.ts` 的 reach 謂詞(只咬 `$lib/member`)因此不被
  觸發,`MOBILE_SEAM_FILES` 四檔白名單與 `mobile/stores.ts` 的源路徑白名單皆**零改動**。
  C3 新增的葉模組 `src/lib/mobile/notifications.ts` 同理:它 import 的是 `$lib/api/client`/
  `$lib/stores/read-state`/`$lib/session-gate`/`$lib/domain/member-app` 與自家 `./api`,零
  `$lib/member`,不需要進白名單(該檔為何是葉模組、為何 `stores.ts` 不得 re-export 它,見
  `docs/adr/0019` C3 的成環證據)。
- **§1「顯示查表過自家 seam」的邊界因此需要一句現況校正**:該裁決的原意是「跨 surface 取用
  member 的東西要過 seam」,不是「所有顯示查表都必須經 `mobile/data.ts` 借道」。C4 之後,凡來源是
  `$lib/domain` 的**純轉手**顯示常數(`WEEK`/`COACH_REPLIES`/`NOTIF_CATS` 等)一律由消費端直取
  canonical 源;`mobile/data.ts` 留下的是真的攜帶本檔型別事實的收窄查表(`LEAVE_STATUS`/
  `LEVEL_TONE`,0013 Form 3)與本地字面資料(`ATT_STATE`/`ANNOUNCE`/`NOTIF_TONE_BG`/`FG`/`PT_TYPE`)。

## 增補(2026-08-03,架構深化 R10 B 案):§2 雙生核可類新例——行動點名頁接回 attendance-controller

- **§2 雙生核可類新例:`src/lib/coach/attendance-controller.ts`。** 該 controller 原是
  `docs/adr/0012` 判準①(呼叫端恆為一頁)的首例,呼叫端只有桌面 `coach/attendance/+page.svelte`;
  行動版 `mobile-admin/coach/attendance/+page.svelte` 則自 Task 20 起手抄一份薄化的點名編排
  (五個鏡射變數 + 自己的 saved/saving 旗標)。本輪核對本節三條件——deps 完全相同
  (`saveAttendance`/`now`,行動頁自帶同一支 `nowHHMM()`)、零行為旗標參數、編排逐字重複
  ——全數成立,故行動頁改為 controller 的**第二個呼叫端**,自身退成薄 adapter(`$ctrl` 解構五條
  鏡射變數 + `labelOf()` 顯示衍生 + outcome→toast 佈線)。判準②③④照舊一條不鬆:toast 文案與其
  組裝仍逐字留頁面。
- **映射層退役,改零映射 re-export。** `mobile-admin/api.ts` 原本為行動點名頁維護一層映射
  (`mapAttRow()` 與 `MAttendanceClass`/`MAttendanceData` 兩個本地形狀),把桌面 seam 的
  `AttRow`/`AttClassFull` 改鍵名再賣一次;`mobile-admin/data.ts` 另有配套的 `RosterEntry` 型別 +
  `ROSTER` 11 筆種子。收斂後三者一併退役,改為
  `export { getAttendance, saveAttendance } from '$lib/coach/api';` + `export type { AttRow,
  AttDefault, AttClassFull };`——沿本節(§3)`coachLoadErrorCopy`/`coach-save` 與 `CoachProfile`
  已有的零映射 re-export 慣例(`CoachProfile` 因與本檔另一個 `Coach` 撞名而需 alias,此處三個型別
  無撞名,故用不帶 alias 的同款手法);`ROSTER` 種子依 `docs/adr/0010` 於原位留退役註記。
- **行動頁白拿桌面語意(五項行為變更)。** 前四項是真正的改善:①切班不再丟未存草稿(controller 的
  `byClass` 暫存);②儲存中切班被擋並發 info toast(行動版原本會直接丟棄 in-flight 儲存狀態);
  ③儲存中再編輯後,遲到的回應被 token guard 丟棄(`stale` 分支不做事);④備註編輯計入未存變更
  (原本 `saveNote` 完全不碰 saved 旗標,加註記後儲存鈕仍顯示「點名已儲存」,是既有失真行為)。
  第五項是連帶**繼承**的桌面既有限制:行動 chips 仍以 session id 為 key(`classOpts` 的
  `key: c.id`),點擊時頁面先把 id 轉回課名才交給 controller 的 `selectClass(name)`,controller
  內部以課名 `find()` 只找得到陣列中排序在前的第一筆同名場次——同日兩場同課名時,不論怎麼點,
  另一場的 chip 都無法把畫面切過去,`FilterChips` 的 `value === key` 判斷下那顆 chip 也永遠顯示
  不出選取中,**第二場實際無法點名**。舊版行動頁 `selectClass` 直接以 id 賦值,能正確區分兩場;
  這是 B 案接回桌面 `attendance-controller` 才帶進來的行動面 regression——桌面 `CoachDropdown`
  本來就吃這個以課名比對的限制,不是本輪新引入的缺陷,但確實讓行動版從「能分辨」退化為
  「不能分辨」。根修需把 `selectClass` 介面由課名改成 session id,是桌面 `CoachDropdown` 與行動
  chips 需同步跟進的介面設計變更,超出本輪「不動桌面」的既定範圍,列未來輪次候選。
- **教訓(落字防重演):退役一層映射,必然讓它的 seam 測試斷言變成孤兒。** `mobile-admin/api.test.ts`
  原本兩個 describe 斷言的是**映射後**形狀(`label`/`RosterEntry` 的 `id`/`default`);零映射
  re-export 之後回傳值變成桌面 seam 的原樣物件,那組深比對必紅——這不是回歸,是斷言本身失去對象。
  本輪同批改成該檔既有的「delegates … verbatim」形(mock 回傳具名 `payload`,斷言呼叫端回傳值
  `toBe(payload)` 參照相等,`saveAttendance` 另留 `toHaveBeenCalledWith` 驗參數原樣傳遞)。
  日後再有映射層退役,請把它的 seam 測試列進同一批寫入集:漏列的話,不是留下一組必紅的斷言,
  就是留下一組不再驗證任何東西的假綠。

## 增補(2026-08-04):同日同課名限制撤銷——`selectClass` name→id 落地

上節「根修需把 `selectClass` 介面由課名改成 session id……列未來輪次候選」已於同分支後續
commit 兌現。動因:R10 合併前的全分支終掃(codex)把此條由 P2 升為 P1 並判 not merge-ready
(「ADR 落字承認≠移除 regression」),使用者裁決先修再合。三層改動:

- **controller**:`selectClass(id)` 以 `find((c) => c.id === id)` 查找——內部狀態
  (`curClassId`/`byClass` 鍵)本就以 session id 為 identity,只是查找入口對齊之,一行+簽名。
- **`CoachDropdown` options keyed 化**:`options: string[]` → `{ key, label }[]`,`value` 與
  `onChange` 走 key、label 只管顯示。這不只是佈線需要:舊形以顯示字串當 `{#each}` key,同名
  兩場會直接觸發 Svelte `each_key_duplicate` runtime error——桌面在「選不到第二場」之前就先
  崩掉整顆 dropdown,keyed 化把兩個病灶一次結構性消除。字串篩選類使用點(我的學員 ×2、
  排課管理 ×2)以 `key = label` 機械遷移,顯示與語意零變化。
- **行動頁 shim 退役**:id→name 一行轉換刪除,chips 的 session id 直傳 controller。

上文行為變更清單的**第五項(同日兩場同課名取第一場)自此撤銷**——桌面與行動皆可分辨並點名
同名兩場。釘:controller 同名 fixture(以 id 切到第二場、名冊隨切)、行動頁同名 chip it
(labelOf 時間前綴區分顯示、id 分流選取);桌面既有切班互動 it 兼任 keyed 佈線證明(onChange
若誤傳 label,controller 以 id 查無 → 名冊不換即紅)。殘餘記帳:同名兩場在**桌面** dropdown
的顯示字串相同(識別已由 key 保證,僅視覺無從分辨哪場是哪場);補時間前綴屬顯示層決策——
行動 chips 的 `labelOf` 本就帶時間前綴天然消歧——留待實際排課出現同名兩場時再議。

## 增補(2026-08-10,架構深化 R11):四筆現況校正

### 1. 上節末句的「殘餘記帳」已了結——`sessionChipLabel` 提共用,桌面 dropdown 帶時間前綴

上節結尾記著「補時間前綴屬顯示層決策……留待實際排課出現同名兩場時再議」;R11 R3(commit
`610e7bd`)不等排課出現就把它做掉了,理由是雙生本身:同一條顯示公式(去「今日 」前綴、取
en-dash 前的起始時間、接課名)當時只住在行動頁的本地 `labelOf()`,桌面 dropdown 則裸顯課名。
本輪把公式提進 `src/lib/coach/attendance-controller.ts` 的具名匯出
`sessionChipLabel(c: AttClassFull): string`,行動頁刪本地 `labelOf`、三個呼叫點
(chips 標籤、儲存成功 toast 的班別標籤、roster 摘要列的 Panel sub)改吃共用函式,桌面
`coach/attendance/+page.svelte` 的 dropdown `options` 由 `label: c.name` 改為
`label: sessionChipLabel(c)`。

- **這是蓄意的行為變更,不是等值重構**:桌面 dropdown 的顯示字串自此帶時間前綴,同名兩場在**視覺上**
  也能分辨(先前只有 key 保證識別正確,人眼分辨不出哪一列是哪一場)。上節的殘餘記帳**自此銷帳**。
- **識別軸不受影響**:`selectClass` 仍吃 session id、`CoachDropdown` 的 `{#each}` 仍以 `o.key` 為鍵
  ——上節「keyed 化」的兩個病灶(選不到第二場、`each_key_duplicate`)由 key 一路保證,與 label 顯示
  什麼無關。行動頁的 `page.test.ts` **零編輯**且既有硬編字串(如 `'19:00 測試班甲'`)原樣通過,是
  「公式搬家、輸出逐字相同」的直接證據。
- **一則測試側信道自然弱化,落字防誤判**:桌面同名兩場的 it 原本附帶一種偶然的偵測力——舊公式下兩筆
  fixture 的顯示字串**必然相同**,故「`{#each}` 誤退化成以 label 為鍵」這種假設性回歸會確定性地撞上
  Svelte 的 `each_key_duplicate` 而讓測試崩掉。改用 `sessionChipLabel` 後兩筆顯示字串因時間不同而
  唯一,這條側信道不再觸發。**這是本功能的自然結果、不是覆蓋率缺口**:真正該守的「以 id 路由」主軸
  仍由該 it 的名冊切換斷言鎖住,本輪並另補一條「兩選項顯示字串相異」的正面斷言。

### 2. §5 known-latent 的候補 prepend race:自 `docs/adr/0017` 起已被 store 層吸收

§5 第一則記載「`joinWaitlist` prepend 可能被更早發出的 in-flight `refreshWaitlist` 回應覆寫」與其
請假側鏡射,末句寫「水合 guard(`createHydrationGate` 採用)屬另案裁決,不靜默出貨」。該另案是
`docs/adr/0016`(R5 C1),其機制隨後又於 `docs/adr/0017`(R7 C1)整段收進 `createSessionGate`
的 `mutate()`——**現況以本節為準**:`src/lib/member/waitlist.ts` 的 `joinWaitlist`/`cancelWaitlist`
都是 `gate.mutate(request, writeBack)` 的薄呼叫,進場快照(`wasHydrated`/`epoch`)、跨登出寫回作廢、
寫回時重查完整度、`markMutated()`、以及條件式序列化和解重抓全部發生在工廠內,**呼叫端一行都不焊**。
這一則因此不再是開放的 known-latent,而是「機制已存在、住在 store 層」。

**同批已核對、確認不需要改動的判斷**:R11 C6(把五個呼叫端的「`cart.add()` → 收到 `'waitlisted'`
→ `joinWaitlist()`」序列收成單一模組)以「順手把 race 也一起收掉」為部分動機提案,經核對後
**否決**——race 早已被上述 store 層機制吸收,呼叫端那三行裡根本沒有任何 race 機制可收,收益主張
不成立。完整的 deletion-test 論證見 `docs/adr/0018` 的 R11 增補。

### 3. §1 的源路徑白名單:四模組 → **五模組**

§1 末段寫「由 foundation-contracts 的源路徑白名單契約(stores/checkout/leave-form/cancel-leave
四模組)補上」——R11 C2 之後為**五模組**,新增 `$lib/member/checkout-controller`
(`src/lib/mobile/foundation-contracts.test.ts` 的 `ALLOWED` 陣列與該 it 的描述同批更新)。擴充的
性質與既有的 `leave-form`/`cancel-leave` 兩員完全同款:都是 desktop↔mobile **雙生收斂**後,
mobile 經自家 `stores.ts` seam 零映射 re-export 一個住在 `$lib/member` 的共用模組——是白名單設計
內的正當居民,不是繞道。§1 的不變量(「mobile production source 中,四個 seam 檔之外無任何
`$lib/member` import」)本身**一字未改**,`MOBILE_SEAM_FILES` 四檔白名單亦零改動。

### 4. §2 雙生核可類新例:`member/checkout-controller.ts`(結帳付款機)

`src/lib/member/checkout-controller.ts` 的 `createCheckoutController` 原是 `docs/adr/0012` 判準①
(呼叫端恆為一頁)的第五例,呼叫端只有桌面 `CheckoutDialog.svelte`;行動版 `CartSheet.svelte` 則
自己手焊一台同構的付款機(本地 `step`/`paying`/`paid` 三變數 + 自己 `crypto.randomUUID()` 產的
`idempotencyKey`)。本輪(commit `20f93a8`)核對本節三條件——deps 完全相同(僅 `placeOrder`)、零
行為旗標參數、編排逐字重複——全數成立,故 `CartSheet` 改為 controller 的**第二個呼叫端**,自身退成
薄 adapter(`$: ({ step, paying, paid } = $checkout)` 三條鏡射 + outcome→toast 佈線)。判準②③④
照舊一條不鬆:六句 toast 文案與其組裝逐字留元件。

- **兩個消費者的生命週期不同層,機器本身不分岔**:桌面 `CheckoutDialog` 整個結帳期間都不卸載,靠
  `setOpen` 的閉→開邊沿換發 key / 偵測 `resumedInFlight`;行動 `CartSheet` 是 **mount 級**
  (`OverlayHost` 的 `{#if}` 每次開啟即重掛),每開一次就 new 一顆 controller,**刻意不呼叫
  `setOpen`**——建構期產生的那把 key 即本次結帳流程的 key,失敗重試沿用同一把由 `confirmPay` 的
  catch 分支既有語意提供。這兩條由 `checkout-controller.test.ts` 新增的「mount 級生命週期」
  describe 保存釘住(既有 12 條單測全部針對經 `setOpen` 換發過的 key,對建構期 key 有盲區——以
  兩次臨時突變實測過該盲區存在)。
- **`docs/adr/0016` 附記(同輪 C5)的「非 twin」裁決由本節取代**:該篇當年記「**非 twin**:mobile
  CartSheet 付款流結構不同(`mobile/stores.ts` placeOrder 佈線),不做跨 surface 抽象」;本輪逐字
  比對後認定分歧只在**佈線層**(誰提供 `placeOrder`、生命週期由誰驅動),付款機本體確實是逐字雙生。
  歷史裁決原文不改寫,該篇已補 dated 增補指回本節。
- **同批附帶一筆雙生文案收斂**:優惠碼套用的「trim 空守衛 + `validateCoupon` + 404/網路錯誤同一句
  文案」兩側逐字重複,收成 `member/checkout.ts` 的 `applyCouponCode()`,兩個呼叫端各縮為 3 行。
  `validateCoupon` **保留 export**(唯一跨模組消費者退場,但它的三條單測是「404 與其他錯誤分類」
  這條契約的唯一釘子,`applyCouponCode` 把兩者併成同一句文案後就驗不到了);mobile seam 端的
  `validateCoupon` re-export 則依死出口紀律移除,identity pin 一併改釘 `applyCouponCode`。

## 增補(2026-09-26,架構深化 R12):seam 轉出增減、`sessionChipLabel` 改讀 `start`、R10 第④項由 D1 反轉

完整背景見 `docs/adr/0022`。本篇原文不改寫,以下各點以本節為準。

### 1. §1 seam:通知段改經 `mobile/stores.ts` 轉出(+6),死 export 移除

- **新增轉出**:`mobile/stores.ts` 自 `$lib/member/stores`(白名單內既有源路徑)轉出六個通知符號
  `notifications`/`unreadCount`/`notificationsHydrated`/`notificationsPageEntry`/`markRead`/
  `markAllRead`。原因是 R12 Task 5 把 mobile 專屬的 `src/lib/mobile/notifications.ts` 併入 member 的
  唯一通知 module。
  - R9 增補第二點說的「C3 新增的葉模組 `src/lib/mobile/notifications.ts` 不需要進白名單」隨該檔刪除
    而失去對象。
  - 通知自此走本節的標準 seam 路徑。
  - 源路徑白名單(五模組)與 `MOBILE_SEAM_FILES` 四檔白名單都**零改動**。
- **身分釘計數**:
  - 原文記「`mobile/stores.test.ts` 16 個 + `mobile/auth.test.ts` 3 個」。
  - 現況是 `mobile/stores.test.ts` 對 `$lib/member/stores` 的 **21 個**(R12 前 15 + 通知 6),
    `mobile/auth.test.ts` **2 個**。
- **死 export 移除**(`docs/adr/0010`「死值不留死出口」,R12 Task 1):
  - `mobile/auth.ts` 不再轉出 `consumeGoogleOauthState`。§1 原文列的 Google OAuth「三件組」現為
    兩件(`isGoogleLoginEnabled`/`startGoogleLogin`)。唯一的 callback 消費者
    `GoogleCallbackCard.svelte` 本來就直取 `$lib/member/google-oauth`。
  - `mobile/stores.ts` 移除 `createOverlay` 值轉出、`OverlayEntry`/`OverlayState`/`AddResult`
    型別轉出。
  - `mobile-admin/stores.ts` 同批移除同款 overlay 轉出。
- **§1 的不變量本身一字未改**。本輪也**沒有**退役任何有消費者的純轉手。
  - 審查候選 07 提議依 `docs/adr/0019` C4 的純轉手判準退役它們，但使用者裁決 D2 只刪死 export、
    不改本篇。
  - 兩篇判準之間的張力記在 `docs/adr/0022`「D2」節，留待日後。
- **mobile 直取 `$lib/domain/leave-requests`**(R12 Task 6 的 `leaveAction`)是純函式，依本節「純函式
  維持直取」與 R9 增補第三點，不經 seam。

### 2. R11 增補 §1 的 `sessionChipLabel` 公式:改讀 `start` 欄位

R11 增補記的公式是「去『今日 』前綴、取 en-dash 前的起始時間、接課名」。R12 Task 7 起:

- `AttClassFull` 新增必填欄位 `start`,由 `coach/api.ts` 的 `mapAttendanceClass` 以
  `hhmm(s.start_time)` 填入。
- `sessionChipLabel(c)` 改為 `` `${c.start} ${c.name}` ``,不再反解顯示用的 `time` 字串。
- **輸出逐字不變**,同名兩場以時間區分的效果與識別軸(session id)都不受影響。

### 3. R10 增補的兩處校正:`nowHHMM` 住所,與第④項由 D1 反轉

- **「行動頁自帶同一支 `nowHHMM()`」不再成立**:`AttendanceControllerDeps.now` 改為可選，預設為
  controller 匯出的 `nowHHMM`,兩頁的本地複本刪除。
  - 桌面頁仍 import `nowHHMM`,當 saved 卡 `savedAt` 缺值時的後備顯示。
  - 三條件中的「deps 完全相同」照舊成立:兩頁都只注入 `saveAttendance`。
- **行為變更清單第④項「備註編輯計入未存變更」自 R12 起反轉**:
  - 使用者裁決 D1。後端 `PUT /sessions/{id}/attendance` 沒有備註欄位，備註從來不會送到後端。
    把它算成「待同步」變更，等於暗示儲存會把它送出去。
  - 現況:`applyNote` 只寫 `notes`、不動 `state`/`dirtyCount`;儲存成功保留 `notes`。
  - 兩頁的備註 Dialog/Sheet 標示「僅存本機，重新整理後會消失」。
  - 第④項當年指出「加註記後儲存鈕仍顯示『點名已儲存』是失真」。D1 之後同一個畫面**是**誠實的:
    儲存鈕描述出勤，備註另有本機標示。
  - 前三項(切班保留草稿、儲存中切班被擋、遲到回應丟棄)不受影響。

## 增補(2026-09-26,架構深化 R13):seam 轉出 +6、身分釘 21 → 27、結帳由工廠轉出改為模組級實例

完整背景見 `docs/adr/0023`。本篇原文不改寫,以下各點以本節為準。

### 1. §1 seam:會員資料段經 `mobile/stores.ts` 轉出,mobile 本地 profile/prefs 退役

- **新增轉出**:`mobile/stores.ts` 自 `$lib/member/stores`(白名單內既有源路徑)轉出會員資料 module 的
  6 個值 `memberProfile`/`prefs`/`hydrateProfile`/`setPref`/`saveProfile`/`profileEditError`,以及
  5 個型別 `MemberProfile`/`Prefs`/`ProfileEdit`/`PrefSetOutcome`/`ProfileSaveOutcome`。
- **退役**:mobile 本地的 `Prefs`/`PREFS_DEFAULT`/`prefs`/`profile` store、`ME` import,以及
  `$lib/mobile/pref-sync`(整檔)。mobile 與 member 自此讀寫**同一顆**會員資料單例。
- **身分釘計數**:`mobile/stores.test.ts` 對 `$lib/member/stores` 的同參照釘由 **21 → 27**(+6)。
- 源路徑白名單(`ALLOWED`)與 `MOBILE_SEAM_FILES` **零改動**:新符號走 `$lib/member/stores` barrel。
- **成環前提消失**:`mobile/api.ts` 不再 import `mobile/stores.ts`(`getPreferences`/`savePreferences`
  隨 pref-sync 退役)。見 `docs/adr/0019` 增補。

### 2. 結帳:工廠純轉出退役,改為模組級實例 `checkout`

- 舊:`mobile/stores.ts` 純轉出 `createCheckoutController`,`CartSheet` 每次掛載自己 `new` 一個;
  `mobile/stores.test.ts` 以 `toBe` 釘它與 member 同參照。
- 新:`mobile/stores.ts` 在 `cart` 旁建 `export const checkout = createCheckoutController({ placeOrder })`
  (與購物車同生命週期,付款在飛時關掉 sheet 再開不會換 key)。工廠轉出失去唯一消費者,退役。
- 這不是純轉手:它是以本檔的 `placeOrder` 接線建構的實例。同參照釘因此換成**接線釘**——以
  `vi.doMock('$lib/member/checkout-controller')` 重新載入本檔,斷言工廠以 `{ placeOrder }` 被呼叫。
- `stores.ts` 仍 import `$lib/member/checkout-controller`(白名單內),只是不再轉出工廠本身。

### 3. 雙生核可類的 `checkout-controller`:兩端改為同一種生命週期

R11 增補把 `checkout-controller` 列入 §2 雙生核可類時,記下兩個消費端落在不同生命週期層、機器內無
分支。R13 起兩端都用 `setOpen` 邊沿:mobile `CartSheet` 掛載時 `setOpen(true)`、卸載時 `setOpen(false)`,
只在 `freshCheckout` 時 `refreshPoints()`,同桌面。差異仍只在接線,機器零 diff。

§1 的不變量一字未改。`docs/adr/0022` 記的 D2 張力(本篇 §1 vs `docs/adr/0019` C4 判準)本輪沒有重提。

## 增補(2026-09-27,架構深化 R14):§1 身分釘與白名單退役、seam 轉出增減;§2 新增行動訊息雙生

完整背景見 `docs/adr/0024` §1、§5、§6。本篇原文不改寫,以下各點以本節為準。

### 1. §1:import 方向規則保留,身分釘與白名單退役

R14 Task 1(候選 F6)。§1「不變量與守衛」寫的兩層守衛——`toBe` 同參照的 identity pins 與
foundation-contracts 的源路徑白名單——都是為「測試 `vi.mock` 精確源路徑才是佈線證明」而存在。

- **三個按路徑 mock `$lib/member/stores` 的測試**(`LeaveSheet`/`MakeupSheet`/`MyCourseDetail`)改用
  `$lib/api/client` + `fakeRouter`,斷言打了哪個端點、帶什麼 body。佈線證明改由真端點給。
- **退役**:`mobile/stores.test.ts` 的身分釘整段(R13 增補記的 27 個 `$lib/member/stores` 符號,加上
  3 個 `member/checkout` 符號,共 30 個 `toBe`,以及 R13 §2 的結帳接線釘);整個 `mobile/auth.test.ts`
  (2 個);`foundation-contracts.test.ts` 的 `ALLOWED` 白名單 it。
- **保留**:四個 seam 檔,以及 import 方向掃描(mobile production 碼在四檔之外零 `$lib/member` import)。
  §1 的不變量本身一字未改。
- 「測試檔明文豁免」仍成立,但理由改寫:掃描的 walker 本來就排除測試檔,與測試 mock 什麼無關,
  不再倚賴「mock 精確源路徑是佈線證明」這句話。
- **`docs/adr/0022` 的 D2 張力就此解開**:§1 管的是 import 方向,保留;`docs/adr/0019` C4 判準句仍只
  適用於 `data.ts` facade;真正退役的是身分釘與白名單。seam 的轉出本身不退役。見 `docs/adr/0024` §1。

### 2. §1 seam 轉出增減

- **新增**:`mobile/stores.ts` 自 `$lib/member/stores` 轉出 `hydrateNotifications`(R14 Task 4;原
  `refreshNotifications` 更名,供 mobile layout 的暖機清單)。
- **退役**(`docs/adr/0010`,死值不留死出口):`applyCouponCode`/`chargeableLines`/`subscriptions` 三個
  轉出(R14 Task 5)。`CartSheet` 的優惠碼套用與可計費預覽收進 `checkout` 單例,單例的 deps 在
  `stores.ts` 內部直接 import 這些來源。`orderErrorMessage` 轉出保留。
- **`checkout` 單例的 deps 補齊**:`createCheckoutController({ placeOrder, applyCouponCode, lines:
  derived([cart, subscriptions], … chargeableLines), points })`。
- §1 原文「mine 單一接縫」提到的 `hydrateSessionStores`,自 R14 起是 `$lib/store-warm` 的
  `warmStores`,並行形不變(`docs/adr/0012` 增補)。

### 3. §2 雙生核可類新例:mobile-admin `MessageThread` 接回 `messages-controller`

R14 Task 6(候選 F5),照 R10 B 案(`718844b`)的前例。三條件逐條核對:

- **deps 完全相同**:`mobile-admin/api.ts` 補轉出 `createConversation`(並刪掉「刻意不轉出」的註解),
  `MessageThread` 以 `{ getThread, sendMessage, markRead, getStudents, createConversation }` 建
  controller,與桌面 `coach/messages/+page.svelte` 逐字相同。
- **零行為旗標參數**:`messages-controller.ts` 與其測試零 diff。
- **編排逐字重複**:原本的本地 getThread/sendMessage 狀態機退役。

接線差異只在 adapter:`badgeCleared` 為 true 才呼叫 `markMessageRead(m.id)`(使用者裁決:等後端確認
已讀才清角標);`sending` 防連點與失敗 toast 留在 `MessageThread`。判準②③④照舊一條不鬆。
