# 本人帳號資料單一 owner、誠實列型別、教練學員表單機、mobile-admin 外殼動作、session 身分 key 單源、mobile 課程類別表、請假 wire 單源、教練頁測試改走 HTTP seam、staff 登出

> Status: Accepted。源自 2026-09-30 架構深化工程 Round 16(架構審查的前端候選 01/02/04/07/08/10、
> 課程類別表、請假 wire 形狀,加上順手發現的 staff 登出 bug,2026-09-30 落地)。base `7863599`;
> Task 0 `e530f3a`(staff 登出)、Task 1a `5705e4f`+Task 1b `d770659`(本人帳號資料)、Task 2a
> `de3701f`+2b `80d02b7`+2c `b149a29`(誠實列型別,候選 02)、Task 3 `529ea55`(教練學員表單,
> 候選 04)、Task 4 `eabf559`(mobile-admin 外殼動作,候選 07)、Task 5 `533dda7`(session 身分 key,
> 候選 08)、Task 6 `1543cba`(mobile 課程類別表)、Task 7 `eb3fe2e`(請假 wire 形狀)、Task 8
> `ed3bf6d`(教練頁測試改走 HTTP seam,候選 10)、Task 9 `6dfdaa5`(過時註解)、Task 10(本篇與各
> ADR 增補)。使用者於同日裁決:**全部照審查建議做**;沒有資料的 KPI 格子直接拿掉(不顯示「尚無
> 資料」);教練生日接真資料但維持唯讀;教練設定的寫死統計拿掉。

R16 沿 `docs/adr/0018`/`0019`/`0022`/`0023`/`0024`/`0025`「一輪多案、單篇記錄」的體例,不新開架構
類別。共同目標仍是 locality:「登入者本人的帳號資料」「後端到底有哪些欄位」「教練學員表單的送出
規則」「mobile-admin 的角色從哪來」「session 身分 key 怎麼算」「mobile 課程類別表」「請假的 wire
形狀」「教練頁測試打在哪一層」這幾類知識各自只住一處。本輪修掉的真 bug 有三個:電話為空的教練改名
被後端 422 擋下、教練學員頁把每位學員都算成出席率偏低、桌面 admin/coach 的「登出」沒有真的登出。
本篇依序記錄九項決定、明確**不做**的事與理由、可見的行為變更、刻意遞延的已知項,以及 ADR 點名測試
的新舊對照。被既有 ADR 點名的地方,各篇已補 2026-09-30 的 dated 增補指回本篇。

## 背景與決定

### 1. Task 0 — 桌面 staff 登出真的登出(bug)

**病灶**:admin 與 coach 桌面 `Sidebar.svelte` 的「登出」只關選單、跳 toast,沒有呼叫
`authStore.logout()`,session 原封不動。

**決定**:照 member Sidebar 的做法——關選單 → toast(`已登出`/`結束目前工作階段。`)→
`await authStore.logout()` → `goto('/staff/login')`。`src/lib/testing/auth-mock.ts` 的
`makeAuthMockB` 補上 `logout`(重置為 `loggedIn: false`/`member: null`/`roles: []`)。

**紅釘**:兩個 Sidebar 測試檔各加一支登出測試(先因 mock 缺 `logout` 紅、再因元件沒呼叫紅,修後綠)。

### 2. Task 1 — 本人帳號資料(Self Account)只有一個 owner

**病灶**:會員端的 `src/lib/member/profile.ts` 與教練端 `coach/api.ts` 的私有身分閘門各自快取一份
`GET /users/me`。教練改名走自己的 `gate.mutate(PATCH /users/me)`,送出的是 `{ name, phone }` 全量——
電話為 `null` 的教練會送 `phone: ''`,撞上後端 8–20 字的規則被 422 擋下,畫面只顯示「連線發生問題」。
同一位登入者若也用會員 app,改名後 `$memberProfile` 仍是舊名(`docs/adr/0023`「快取各自為政」)。

**決定**:

- **1a(行為零變更)**:`git mv src/lib/member/profile.ts src/lib/self-account.ts`(測試檔同搬)。
  匯出改成角色中立的名字,**不留舊名 alias**:`selfAccount`、`SelfAccount`、`hydrateSelfAccount`、
  `saveSelfAccount`、`SelfAccountEdit`、`SelfAccountSaveOutcome`、`selfAccountEditError`;偏好相關
  的 `prefs`/`setPref`/`Prefs`/`PrefSetOutcome` 不變。`member/stores.ts` 的轉出刪除,所有消費端改直接
  `import from '$lib/self-account'`。
- **1b(fix)**:
  - `SelfAccount` 加 `id` 與 `lastLogin`(`YYYY-MM-DD HH:MM`,缺值為 `''`)。
  - `coach/api.ts` 的教練閘門改成 `createSessionGate<ApiCoach | null>`,fetch 是
    `Promise.all([hydrateSelfAccount(), listCoaches()])`,再以 `get(selfAccount).id` 找教練檔案。
    `CoachIdentity`、`fetchMe`、`identity` 刪除;`requireCoach()` 回 `{ account, coach }`;
    `mapCoach(account: SelfAccount, coach: ApiCoach)`。
  - `saveSettings(edit)` 簽章不變:`requireCoach()` → `saveSelfAccount(edit)` → `failed` 時丟出
    `outcome.error` → 以 `get(selfAccount)` 重新映射。`saveSelfAccount` 與目前值比對、只送改過的
    欄位,全部沒變就不發請求。教練閘門不再 `mutate`,它只快取 `ApiCoach`,沒有東西需要和解。
  - `selfAccountEditError` 改收 `Pick<…, 'name' | 'phone'>`,教練頁可以直接傳 `Coach`。桌面
    `ProfileTab.svelte` 與 mobile-admin `coach/csettings` 顯示 inline 驗證訊息(`role="alert"`),
    不合法時儲存鈕停用,`save()` 本身也擋。

**紅釘**:電話為 `null` 的教練只改姓名 → PATCH body 只有 `{ name }`;存檔後 `$selfAccount` 是新名字;
本人帳號資料已水合時教練閘門只補打 `GET /coaches`;兩個設定頁輸入 1 個字的姓名 → 顯示錯誤、按鈕停用、
不送出。`coach/api.test.ts` 的「教練身分:每個 session 只解析一次(C6)」四支測試原樣通過。

### 3. Task 2 — 誠實列型別:拿掉後端沒有的 P2 假欄位(候選 02)

**病灶**:三個 surface 的列型別保留了許多後端從未提供的欄位,mapper 寫死 `''`/`0` 填上。畫面因此出現
假篩選、假 KPI、落單的「 · 」,最嚴重的是教練學員頁:`att` 一律是 0,每位學員都被算成「出席率低於
75%」。

**決定**(規則 R1–R8):後端沒有的欄位從型別、mapper、`*Source` 介面、明細表、fixture 全部拿掉
(R1);只靠假欄位運作的篩選、分頁籤、圖例、徽章、進度條、色表一起拿掉(R2);只顯示假值的 KPI 格子
直接拿掉(R3);組合文字丟掉空段(R4);不存在功能的提示拿掉(R5);能打字但不會存的輸入框,值是真的
改唯讀、值是假的拿掉(R6);誠實的固定標籤改成元件字面值(R7);保留 `CLAUDE.md` 明列的 P2 mock、
裝飾用的 `color`、`OrderBase.method`、`Coach.id`(R8)。

- **2a 教練端**:`Student.level/skill/pct/att`(連同 `StudentLevel`、`LEVEL_TINT`)、
  `TodayClass.level/cat`、`SchedCourse` 只留 `{ day, start, end }`(`SchedCat`/`SchedVenue`/
  `CAT_COLOR` 一起退役)、`Conversation.kind`、`Coach.en/gender/emergency`。`Coach.birth` 改讀
  `account.birth`(真資料)。學員頁 KPI 只留「學員總數」,列表 key 由 `s.name` 改 `s.user_id`;排課頁
  拿掉分類/場館篩選與圖例,區塊標籤是字面值「可授課時段」;訊息中心拿掉「家長」分頁;設定頁標題
  只剩 `{role}`、寫死的 STATS 拿掉;ProfileTab 的性別、緊急聯絡人、簡介輸入框拿掉,email 與生日
  改 disabled;csettings 的「家長訊息通知」改「學員訊息通知」(偏好 key `parentMsg` 不變)。
  `mobile-admin/data.ts` 只轉手 `type Student`。
- **2b admin 端**:`ClassBase.room/term/sessions`、`ClassRow.startDate/checkinRate/makeup`、
  `OrderBase.invoice/handler`、`Order.campus/taxId`。`classDetailRows` 12 → 6 列、`orderDetailRows`
  13 → 9 列(有退款原因時 10 列),OrdersTable 拿掉「經手人」欄,ClassCard 第三列只顯示年齡。
- **2c 會員端**:`EnrolledCourse.cat/coach/room/next/term/remain`、`DashboardData.track`。
  member/mine KPI 只留「出席率」;聯絡教練的標題改「聯絡教練」;mobile 首頁的「下一堂課」卡刪除,
  `MobileHomeData.myCourses` 隨之退役,`getHome()` 不再打 `getMine()`。

對照 integration-contract 核過:`MyEnrolmentResponse`、`MyStudentResponse`、`CoachScheduleResponse`、
`TodaySessionResponse`、`AdminOrderSummary` 都沒有被刪的欄位,沒有「其實是真的」需要保留。

### 4. Task 3 — 教練學員表單收成 `coach/student-forms.ts`(候選 04)

**病灶**:桌面 `CertificateDialog`/`ReportCardDialog` 與 mobile-admin `StudentActionSheet` 逐字複製
同一套編排:必填檢核、防雙送、trim、空選填欄省略、submitting 生命週期、本地日期預設。

**決定**:照 `member/leave-form.ts` 做單檔雙工廠,**不用 mode 旗標**(`docs/adr/0012` K1):
`createCertificateForm(deps)`(`reset()`、`submit(student)` 回 `certificateIssued | failed | null`)與
`createReportCardForm(deps)`(`reset(student)` 預填單堂課、`submit()` 回 `reportCardCreated | failed |
null`),外加 `RATING_OPTIONS` 與私有 `localIsoDate()`。模組只 import 型別,建構零副作用。toast 文案
(`apiErrorMessage` 映射)與重置時機(`lastOpen` 守衛,`docs/adr/0015`)留在元件。這是
`docs/adr/0014` §2 雙生核可類的新例(桌面兩個 dialog ↔ mobile 一個 sheet,deps 相同、零行為旗標)。

**測試**:新增 `student-forms.test.ts`;兩個 dialog 測試裡已被模組覆蓋的案例刪除(沒有任何
ADR 點名它們),保留開啟、toast、403/409/網路錯誤、取消、開啟重置;sheet 的 5 支不動。

### 5. Task 4 — mobile-admin 外殼動作收進 `nav`/`stores`(候選 07)

**決定**:

- `mobile-admin/nav.ts` 匯出 `roleHome(role)`,取代手抄的 `adminPath(r, r === 'admin' ? 'home' :
  'today')`;guard 與登入頁改用它。
- `RoleSheet` 拿掉 `setRole` prop,選了就 `goto(roleHome(id))`。`role` store、`switchRole` 與 layout 的
  `role.set` 刪除——角色只從 URL 推導,四個頁面以固定值 `overlay.sheet('role', { role: 'admin' |
  'coach' })` 開啟。
- 新增 `openCoachNotif()`,與 `openAdminNotif` 共用一個私有 helper;四個教練頁的鈴鐺改用它。

### 6. Task 5 — session 身分 key 單一來源 `sessionIdentity()`(候選 08)

**病灶**:`loggedIn ? (member?.id ?? '') : null` 這條身分 key 公式在 `session-gate.ts`、mobile-admin
`MessageThread` 與 member/mobile/mobile-admin 三個 layout 的暖機 key 各抄一份。

**決定**:`session-gate.ts` 匯出純函式 `sessionIdentity(a: Pick<AuthState, 'loggedIn' | 'member'>):
string | null`,`createSessionCore` 與上述四處改呼叫它。**不做 derived store**:它會讓所有 session
閘門的重置時機往後延一拍,而且 15 個 mock authStore 的測試檔都得跟著改。

### 7. Task 6 — mobile 課程類別表 `domain/course-category.ts`

**決定**:新增 `COURSE_CATEGORIES`(`key`/`chip`/`trialLabel`/`icon`/`age`,6 筆)與
`courseCategoryIcon(cat)`(未知類別回 `graduation-cap`),照 `domain/course-level.ts` 的形狀,值照抄
mobile 現有資料。`mobile/api.ts`、mobile 首頁、mobile 課程頁、`TrialScreen` 改讀它。`admin/data.ts` 的
`CATS`(`docs/adr/0022` 指定的 admin 單一來源)與行銷站 `homeContent.ts` 不動。

### 8. Task 7 — 請假 wire 形狀單一來源,教練端修正

**決定**:

- `src/lib/api/wire.ts` 新增 `LeaveStatus` 與 `ApiLeaveRequest`(§3.20 `LeaveRequestResponse`)。
- `member/leave.ts` 的 `LeaveRequest = Omit<ApiLeaveRequest, 'decided_at'>`,本地 wire 宣告刪除;
  `domain/leave-requests.ts` 改從 wire import `LeaveStatus`,不再自己匯出。
- 教練端 `ApiCoachLeaveRequest = ApiLeaveRequest & { user_id, user_name }`。`decideLeaveRequest` 改回
  `Promise<void>`:後端 PATCH 回的是會員形狀(沒有 `user_name`),舊版把它映成帶
  `user_name: undefined` 的列,而且沒有人讀。
- 教練請假頁的時段改用 `formatSessionDateTime`,多顯示星期。

### 9. Task 8 — 教練頁測試改走 HTTP seam(候選 10)

**病灶**:8 個 `routes/coach/*/page.test.ts` 把 `$lib/coach/api` 整支換成假模組。這讓
`load-error-copy.ts` 必須用 `e.name === 'CoachNotFoundError'` 判別(假模組裡 class 是 `undefined`),
也讓測試無法驗證 mapper 與 wire。

**決定**:

- 新增 `src/lib/testing/coach-routes.ts`(照 `ops-routes.ts`):`COACH_USER`、`COACH_FIXTURE`、
  `COACH_ROUTES`(只放身分解析會打的 `GET /users/me`、`GET /coaches`)。fixture 值刻意和種子
  `COACH` 全部不同。
- 8 個頁面測試改 `vi.mock('$lib/api/client')` + `loginAs(COACH_USER)` + `fakeRouter(overrides,
  COACH_ROUTES)`;案例數全部不變,呼叫斷言改成 HTTP 路徑與 body。
- `coachLoadErrorCopy` 改用 `e instanceof CoachNotFoundError`(import 自 `./api`,不成環)。
- `import-scan.test.ts` 加可執行契約「測試 seam 契約:零 vi.mock 整支 $lib/coach/api」(掃所有
  `*.test.ts`,檔數下限 >100 防空集合假綠)。

Task 9 只修過時註解(mobile-admin 約 20 個「經 `$lib/mobile-admin/api` re-export」檔頭、
`store-warm.ts`、`session-gate.ts` 的 JSDoc 位置等),不改行為,本篇不另立一節。

## 明確不做的事(供未來止步)

- **後端背景工作 owner**:屬後端線,三個迴圈形狀已不同,等出現第三個週期性工作再開。
- **訂單 artifacts module**:會很淺——補償本來就是一張平鋪的 owner 呼叫清單(`docs/adr/0007`)。
- **點數兌換雙生**:桌面多一步確認,接近 `docs/adr/0018` R11 C6 已否決的案例。
- **NotifSheet 改讀即時 store**:這是 UX 變更,不是加深。
- **統一 admin `CATS`**:`docs/adr/0022` 已指定它是 admin 端的單一來源;Task 6 的 mobile 類別表是
  另一份關注點(chip/試上標籤/icon/年齡),不併。
- **HTTP seam 遷移擴到非 coach 的 surface**:member/mobile/admin/public 沒有 workaround 等著退役,
  這輪不遷。
- **會員端 ContactDialog/ContactSheet 是假聊天**:只記下來,不在這輪。
- **教練生日改成可寫**:`saveSelfAccount` 支援 `birth`,但那是新功能;本輪只接真值、維持唯讀。
- **沒資料的 KPI 不接報表 endpoint**:不接 `/reports/coach` 的 `attendance_rate_30d`,也不顯示
  「尚無資料」。之後想要再接真 endpoint。
- **`sessionIdentity` 不做 derived store**(見第 6 節)。

## 可見的行為變更(逐條)

1. **桌面 admin/coach 按「登出」真的登出**,並回到 `/staff/login`(Task 0)。
2. **教練改名只送改過的欄位**:電話為空的教練改名不再被 422 擋下;沒有任何變動時不發請求,仍顯示
   成功 toast(Task 1b)。
3. **教練設定頁的 inline 驗證**:姓名/電話不合法時顯示紅字、儲存鈕停用,不再送出後才顯示連線錯誤
   (桌面 ProfileTab 與 mobile-admin csettings,Task 1b)。
4. **身兼會員的教練改名後,會員 app 的名字同步更新**(同一份 `$selfAccount`,Task 1b)。
5. **假 KPI 格子移除**:教練學員頁只剩「學員總數」、member/mine 只剩「出席率」(Task 2)。
6. **教練學員頁不再把每位學員標成出席率偏低**;學員卡沒有程度徽章、技能條與出席率(Task 2a)。
7. **教練生日顯示真值(唯讀)**;設定頁寫死的 312 hr/36 人/6 年統計與 `· {id}` 拿掉(Task 2a)。
8. **排課頁沒有分類/場館篩選與圖例;訊息中心沒有「家長」分頁**(Task 2a)。
9. **admin 課程明細 12 → 6 列、訂單明細 13 → 9 列,訂單表沒有「經手人」欄**(Task 2b)。
10. **mobile 首頁的「下一堂課」卡拿掉,首頁少打一次 `getMine()`(`GET /enrolments/me`)**(Task 2c)。
11. **mobile-admin 切換角色直接導向該角色首頁**;選目前角色只關閉 sheet、不導覽(Task 4)。
12. **教練請假頁的時段顯示星期**,例如 `2026-07-10 (五) 19:00`(Task 7)。

其餘改動 wire 等價。

## 已知、刻意遞延

- **只剩一格的 KPI 網格**:教練學員頁與 member/mine 的網格仍是 `repeat(3,1fr)`,一格只佔 1/3 寬。
- **R5 可能還有漏網的示範提示**:TodayClassCard 的「查看名單」toast 與 ClassCard 的名冊 toast 與
  假欄位無關,本輪沒動。
- **桌面 NotifTab 仍寫「家長訊息」**(mobile-admin csettings 已改「學員訊息」)。
- **教練身分快取到登出為止**:`docs/adr/0023` 記的這條不變——閘門現在只快取 `ApiCoach`,管理員改了
  教練檔案,本人仍要重新登入才看得到。
- **教練儀表板測試仍 `vi.mock('$lib/coach/clock')`**:打卡模組不是 `coach/api`,不在 grep 契約範圍。
- **settings 頁的 loading 案例讓 `GET /coaches` 永遠卡住**:目前是檔內最後一支,之後在它後面加測試
  要留意在飛的 hydrate 會不會合併。
- **mobile 類別表與行銷站年齡不一致**:幼兒 3–6 vs 3–5、啦啦隊 8+ vs 10–16,待使用者確認哪個對。
- **HTTP seam 遷移**:member/mobile/admin/public 的頁面測試仍 mock 各自的 api 模組(見「明確不做」)。

## ADR 點名的測試:改寫,不刪(舊 → 新)

| ADR | 位置 | 舊 | 新 |
| --- | --- | --- | --- |
| `docs/adr/0014` §3 name-based 判別 | `src/lib/coach/load-error-copy.test.ts` | name-only 假物(一般 Error 改 `name`)會命中「未綁定教練檔案」 | 「name-only 假物…→ 不命中,GENERIC_LOAD_ERROR(name 比對 workaround 已退役)」;案例數 5 → 5 |
| `docs/adr/0014` §3 桌面理由(頁面測試整支 mock `coach/api`) | 8 個 `routes/coach/*/page.test.ts` | `vi.mock('$lib/coach/api')` + 斷言 getter 呼叫 | `vi.mock('$lib/api/client')` + `fakeRouter(…, COACH_ROUTES)`,斷言 HTTP 路徑與 body;案例數逐檔不變 |
| `docs/adr/0015` reset 釘 ×2 | `src/lib/admin/components/ClassEditDialog.test.ts` | fixture 帶 `room`/`term`/`sessions`/`startDate`/`checkinRate`/`makeup` | fixture 拿掉這些欄位(型別已無),兩支斷言逐字不變 |
| `docs/adr/0022` §4 overlay 型別斷言 | `src/lib/components/mobile/overlay.test.ts` | `@ts-expect-error 缺必填 setRole` | `@ts-expect-error setRole 已移除(RoleSheet 改以 URL 導覽)`,改釘「多傳 setRole 被拒」;`o.sheet('role')` 缺必填 props 那行保留,directive 行數不變 |
| `docs/adr/0023` R11 pref-sync 單元(移植) | `src/lib/member/profile.test.ts` → `src/lib/self-account.test.ts` | 「setPref 三種 outcome」「交錯競態」(移植自 pref-sync.test.ts) | 隨檔 `git mv`,describe 名與斷言不變;檔內識別字改新名 |
| `docs/adr/0023` C6 教練身分 | `src/lib/coach/api.test.ts` | 「教練身分:每個 session 只解析一次(C6)」四支 | 逐字不變、原樣通過;另加 describe「教練身分經本人帳號資料解析(R16 Task 1b)」 |

對象已退役、隨之刪除的釘(不是改寫):

- **`docs/adr/0010` §3 描述的 `LEVEL_TINT` 涵蓋率測試**(`coach/data.test.ts`「every StudentLevel value
  resolves in LEVEL_TINT」)與同檔的 `CAT_COLOR` 涵蓋率測試——查表隨 `Student.level`/`SchedCourse.cat`
  退役。ADR 只以文字描述它、沒有引用測試名;剩下的 `CLASS_STATUS` 涵蓋率測試仍是該節論點的實例。
- **`mobile-admin/stores.test.ts` 的 `switchRole`**——`role` store 與 `switchRole` 退役(Task 4)。
- 其餘刪除(教練學員頁的平均出席率 KPI 與程度篩選、排課頁的分類篩選、`conversations-filter` 的
  「家長」分支、mobile 首頁的三支「下一堂課」測試、兩個學員表單 dialog 被模組覆蓋的案例)都沒有被任何
  ADR 點名。

## 關聯 ADR

- **`docs/adr/0006`**:整合殘餘的誠實化延伸——後端沒有的列欄位拿掉、教練生日接真值、staff 登出(增補)。
- **`docs/adr/0007`**:`LeaveStatus`/`ApiLeaveRequest` 收進 wire;`coach/api.ts` 不再宣告或 import
  `ApiUser`(增補)。
- **`docs/adr/0010`**:§3 的 `LEVEL_TINT` 例子失去對象;本輪退役清單(增補)。
- **`docs/adr/0012`**:pref-sync 語意的住所改名 `self-account.ts`;`student-forms.ts` 走雙生核可、
  不入單頁名冊(增補)。
- **`docs/adr/0013`**:`course-category.ts` 入列;明細列數變更;色差紀錄複核無誤(增補)。
- **`docs/adr/0014`**:§1 邊界 seam 只剩 `Student`;§2 雙生核可類新例 `student-forms.ts`;§3 改回
  `instanceof`,桌面那側的理由也消失(增補)。
- **`docs/adr/0015`**:學員表單機的重置時機留元件,決定一照舊(增補)。
- **`docs/adr/0017`**:身分 key 收成 `sessionIdentity()`;教練閘門改快取 `ApiCoach | null`(增補)。
- **`docs/adr/0019`**:C4 批3 保留的 `LEVEL_TINT`/`Student` 邊界 seam 只剩 `Student`(增補)。
- **`docs/adr/0022`**:`blankClassRow` 欄位減少;`CATS` 不動;`RoleSheet` props 型別變更(增補)。
- **`docs/adr/0023`**:兩條遞延項關閉(快取各自為政、場地/期別/堂數的顯示清理);會員資料 module
  改名搬家;教練閘門形狀改變(增補)。
- **`docs/adr/0025`**:`LeaveStatus` 的住所改為 `api/wire.ts`(增補)。
