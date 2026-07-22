# 既有慣例延伸五例、CRUD 提交同構否決與通知已讀雙生遞延

> Status: Accepted。源自 2026-07 架構深化工程 Round 8(C1–C7 七張卡,2026-07-23 落地)。
> C1/C2/C3+C4/C5 五張為程式碼寫入卡(commits 66a7adf、193a846、60c89bd、f34619d,base
> 670fd77);C6 為唯讀 spike(不落地任何程式碼變更);C7 為遞延記錄(不落地)。

Round 8 不新開任何架構類別——它把 `docs/adr/0011`/`0012`/`0013`/`0014` 已經立案的五個既有慣例
(單頁 controller、desktop↔mobile 雙生表單機、顯示查表單源、mobile-admin re-export 家族、
admin `api.ts` barrel 化)各自套一個新的具體案例,逐一用既有判準核對是否成立;同時一次唯讀
spike 明確否決了第六個候選慣例(admin 桌面三頁 CRUD 提交骨架同構),並把第七個候選(通知已讀
mutator 雙生)記錄在案、刻意遞延。本 ADR 依序記錄 C1–C7 七項決定,以及過程中審查揪出並修復的
兩個 Important 缺陷。

## 背景與決定

### 1. C1 — `messages-controller`:coach/messages 頁編排收進單頁 controller(單頁 controller 清單 5→6)

commit `193a846`。`src/lib/coach/messages-controller.ts` 的 `createMessagesController` 把
`coach/messages/+page.svelte` 的對話串編排收進單一 `MessagesViewState` 快照 store,`getThread`/
`markRead`/`sendMessage`/`getStudents`/`createConversation` 五支 API 呼叫注入為 deps。依
`docs/adr/0012` 四判準核對,全數成立:①呼叫端恆為該頁一頁;②deps 皆純 I/O 效應、零行為旗標;
③outcome 詞彙(`threadLoaded`/`sendFailed`/`conversationCreated`/`alreadyCreating` 等)是訊息中心
領域生命週期,非通用 `ok`/`error`;④零 `load-gate`/toast import,六則 toast 文案逐字留頁。

收斂範圍:

- **`selectThread`**:同步函式,回傳 `{ threadReady, badgeCleared }` 兩條各自獨立、互不等待的
  promise(`SelectThreadHandles`)——`threadReady`(`getThread`)仿 attendance-controller 的
  遞增 token 機制擋過期回應(`token !== seq` 即回傳 `{ kind: 'stale' }`,不寫 `thread`);
  `badgeCleared`(`markRead`)不受此 guard 限制(逐字複刻頁面現行行為:已讀標記與目前是否還
  停留在該對話無關)。兩條 promise 刻意不用 `Promise.all` 合併(R1 修復,commit `10d90e6`)——
  初版曾合併成單一 outcome,導致 `markRead` 卡住/永不落定時連帶拖住 `threadReady`,使失敗
  toast 或已載入狀態遲遲無法呈現;修法後任一方卡住都不影響另一方落定。
- **`send`**:過期回應防護不是 token 機制,而是送出當下捕捉的 `conversationId` 快照比對
  (`sel === conversationId` 才附加回應到 `thread`)——與 `selectThread` 分屬兩套不同的過期防護,
  刻意不合流。失敗時 `sendFailed` 攜原始 `text`,供頁面決定是否還原輸入框。
- **compose 三態**(`openCompose`/`pickRecipient`/`confirmCompose`):`confirmCompose` 的
  `creating` 守衛靜默回傳 `alreadyCreating`,同 `checkout-controller` 的 `alreadyPaying` 先例。

**`closeCompose()`——實作中發現的必要衍生**:不在原始任務規格內,是接線時發現的真缺陷——
`composeOpen` 併入 controller 狀態後,頁面若沿用舊有「直接賦值 `composeOpen = false`」的
`Dialog onClose`/取消按鈕慣例,賦值只會改到頁面 `$: ({...} = $ctrl)` 解構出的鏡射變數,controller
內部狀態不受影響,下一次 `publish()`(例如使用者切換對話觸發的訊息載入)就會把頁面鏡射變數蓋回
`true`,使用者會看到「自己關掉的對話框又彈回來」。修法:controller 新增 `closeCompose()`
(`composeOpen = false; publish();`,不動 `composePick`,逐字複刻原行為),頁面三處綁定
(`onClose`、遮罩點擊、取消按鈕)全部改呼叫 `ctrl.closeCompose`。

**留頁(判準④)**:對話清單 `convos` 與其 `getConversations` gate、tab×搜尋過濾與選取回退
(`conversations-filter.ts`,K3/0012 既有純函式模組,不被本次收斂取代)、toast 文案(頁面依
`outcome.kind` 翻譯)。badge 清零與傳送後 `convos` 的預覽/時間更新都作用在 `convos`(頁面狀態,
非本 controller 收編範圍)——故由頁面訂閱 `selectThread()` 回傳的 `badgeCleared` promise、或
自行以呼叫當下捕捉的 id 交還頁面套用,不由 controller 直接改寫 `convos`。

`page.test.ts` 原本靠 render 之舞覆蓋的 21 個案例改由 `messages-controller.test.ts` 的無渲染單測
接手,頁測試只留 outcome→toast 映射與零星整合斷言。單頁 controller 清單自此
**5→6**:attendance-controller / conversations-filter / coach-save / clock-controller /
checkout-controller / messages-controller(`docs/adr/0012` 增補、`docs/architecture.md` 同步)。

### 2. C2 — `settings-form`:admin↔mobile-admin 雙生表單機收斂(`docs/adr/0014` §2 雙生核可類新例)

commit `60c89bd`。`src/lib/admin/settings-form.ts` 的 `createSettingsForm({ putSettings })` 收斂
桌面 `admin/settings/+page.svelte` 與 `mobile-admin/overlays/AdminSettingsScreen.svelte` 兩畫面
逐字重複的 10 欄草稿狀態機、`onData` 攤平、`maxClassSize` label↔數值換算、`SettingsWriteBody`
組裝。依 0014 §2 三條件核對:deps 相同(僅 `putSettings`)、零行為旗標、編排逐字重複——三條件
皆成立,雙生收斂核可。

**裁決:單工廠不拆 `createFormCore`/`guardedSubmit`**。仿的骨架是 `member/leave-form.ts`,但
`leave-form.ts` 內部拆出一個不匯出的 `createFormCore` 供 `createLeaveRequestForm`/
`createMakeupBookingForm` 兩支工廠共用,是因為它要服務**兩個不同的 outcome 領域**(請假 vs
補課)。`settings-form` 只有一個消費領域(系統設定儲存),沒有第二個變體工廠會共用這個
core——硬拆 `createFormCore`/`guardedSubmit` 屬過早抽象(沒有第二個呼叫端證明這條切割線的
必要性),故本模組維持單一工廠、守衛內聯在 `save()` 內。這是與 leave-form「一檔兩工廠」對照組
互為表裡的裁決:多消費領域才值得拆 core,單一領域不值得。

**其他形狀差異**(皆記錄於模組檔頭):

- `draft` 是單一 `Writable<SettingsDraft>` 物件,非拆成 10 個獨立 `Writable`——因為設定表單
  沒有「必填欄位未選」這種 valid 守衛(10 欄皆有預設值,恆為 valid,不像 leave-form 的
  session 選取守衛),markup 直接 `bind:value={$draft.name}` 對物件欄位雙向綁定即可。
- `save()` 回傳三態 outcome(`saved`/`failed`/`alreadySaving`)而非 leave-form 的「守衛擋下時
  回傳 `null`」——沒有 valid 守衛可跟 in-flight 守衛共用一個「回 null」出口,in-flight 守衛因此
  值得有自己明確的 kind,讓呼叫端不必用 `if (!outcome) return` 猜測「回 null 代表什麼」。
- **`saved` outcome 攜 `release()` 手柄(R1 修復,commit `10d90e6`)**:save() 成功後 `saving`
  鎖**不會自動釋放**——呼叫端必須在自己的 post-save 同步(如 `gate.silentRefresh()`)完成後
  親自呼叫 `outcome.release()`,鎖才真正復位;在此之前 `saving` 持續擋下後續 `save()` 呼叫。
  這是回歸修復:初版把解鎖放在 `save()` 的 `finally`,PUT 一 resolve 就解鎖,此時呼叫端的
  `silentRefresh()` 還在飛,「儲存變更」按鈕提早恢復可點,使用者若這時再按一次,第二次
  `save()` 不會被 in-flight 守衛擋下,可能兩個 PUT 交錯、第一次的 `silentRefresh` 覆寫第二次
  剛送出的 draft;修法把鎖的持有期間拉回涵蓋 post-save 同步窗口(重構前的原始語意)。
  **新增消費端必須呼叫 `release()`,否則鎖死**——`failed`/`alreadySaving` 兩態不受影響
  (失敗立即解鎖,不需要 `release`)。

403 文案映射(桌面 `settingsErrorMessage` / 行動 `SETTINGS_ERROR_TEXT` 表)、成功 toast、
`gate.silentRefresh()` 呼叫時機依判準④逐字留在各畫面(兩畫面皆已在 `await gate.silentRefresh()`
落定後才呼叫 `outcome.release()`);桌面「登入裝置」P2 區塊零觸碰。行動端經 `mobile-admin/api.ts`
零映射 re-export 取用 `createSettingsForm`/`SettingsDraft`。`settings-form.test.ts` 現 9 例
(含後續審修增補),兩畫面既有 render 測試斷言面不變。

### 3. C3 — mobile-admin `CoachesScreen` 接既有 `coach-save` seam(消費端擴張,非新增模組)

commit `66a7adf`。`mobile-admin/overlays/CoachesScreen.svelte` 的新增/編輯教練流程,改呼叫桌面
`admin/coaches/+page.svelte` 已在用的同一套 `saveNewCoach`/`saveCoachEdit`
(`admin/components/coach-save.ts`,K4/`docs/adr/0012` 既有兩階段 async 編排器),取代本地
inline 兩步序列與本地 `coachBody`。這不是重新評估 0012 判準①(呼叫端恆為一頁)——`coach-save.ts`
本身是無狀態純函式模組,`mobile-admin/api.ts` 新增一行 `export { saveNewCoach, saveCoachEdit, ... }
from '$lib/admin/components/coach-save';` 零映射 re-export,結構上與 `docs/adr/0014` §3
既有的 `coachLoadErrorCopy` 經同一 barrel 供 mobile-admin 兩頁取用是同一手法(re-export 家族
新增一員),不是「單頁 controller 多了第二個呼叫端」。

**裁決:`coachBindFailed.pendingUserId` 在本消費端刻意丟棄**。桌面版第二步(教練綁定)失敗時,
對話框留在畫面上、把 outcome 的 `pendingUserId` 存回頁面哨兵,供使用者在同一個對話框工作階段內
按「儲存」重試(跳過已成功的 `createMember`,直接重打 `createCoach`)。mobile-admin 沿用既有的
「儲存即關閉 sheet、成功/失敗 toast 非同步顯示」慣例(同 `MemberForm` 對照的 `members/+page.svelte`
handleSave),sheet 已經關閉,沒有「同一個工作階段內重試」的機制可用——故 `pendingUserId`
原樣拿到後不做任何事,錯誤 toast 改為建議使用者至「學員管理」頁確認該帳號、或重新執行一次新增
教練(換一個 email)。同桌面一樣不做自動回滾(後端沒有複合建立端點,也沒有刪除使用者的端點可
呼叫)。這是行為裁決,不是遺漏:`outcome` 型別本身不知道呼叫端是否會用這個欄位,兩種消費端各自
依自己的 UX 慣例決定要不要接住它。新增 `CoachesScreen.test.ts` 七例,含「綁定失敗不打第二步
重試」一例釘住此裁決。

### 4. C4 — `domain/sessions.ts`:顯示查表第六個 entity(今日場次狀態單源,canonical 正字「上課中」)

commit `66a7adf`。新立 `src/lib/domain/sessions.ts`:`TodayStatus`(`'wait'|'live'|'done'|'soon'`)
+ `SESSION_STATUS: Record<TodayStatus, [Tone, string]>` + 純函式 `deriveSessionStatus`(牆鐘時間
推導,`§3.18` 裁決 2:前端本地時間直接字典序比較,不做時區換算;連同其私有 `wallClockTime`
自 `coach/api.ts` 整段搬入,語意零改)。收斂 admin/coach/mobile-admin 三處原本各自手抄的「今日
場次狀態 → tone/中文標籤」查表(coach `data.ts` 的 `CLASS_STATUS` label、admin 的
`TODAY_TONE_LABEL`、mobile-admin 的 `TODAY_STATUS_LABEL`),加入 `docs/adr/0013` §1 表格既有的
venues/tickets/members/classes/course-level 五個 entity 檔之列,成為第六個。

**裁決:canonical 標籤 `live` = 「上課中」**。coach/mobile-admin 原字面即「上課中」,admin
原字面是「進行中」——語意相同、字面各自維護導致的靜默發散,單源後 admin 這邊改字(同
`docs/adr/0013` `VENUE_STATUS.available`「可預約」canonical 化的先例:取多數字面、少數改字)。

三個消費端各自維持不同承接形,不強求統一:

- **`coach/api.ts`**:`deriveSessionStatus` 留活 re-export(「檔頭 import + 原位置裸 export」
  兩段式,非純 `export {X} from 'mod'` 語法——因為同檔 `mapTodayClass()` 仍要在本地呼叫它,純
  re-export 不建立本地綁定會編譯錯誤;仿同檔既有 `CoachNotFoundError` 前例),下游呼叫端與測試
  mock 路徑不動。
- **`coach/data.ts`**:`CLASS_STATUS` 保留自己較豐富的 `{ label, bg, fg }` 形(未收斂成 admin/
  mobile-admin 那樣的裸 re-export)——因為 markup 也需要 `bg`/`fg`,只有 `label` 欄位改由
  `SESSION_STATUS[k][1]` 合成,不再各自維護一份文案字面。
- **`admin/api.ts`**:直接 `import { deriveSessionStatus, SESSION_STATUS } from '$lib/domain/
  sessions'`,`SESSION_STATUS[state]` 用 `deriveSessionStatus` 回傳的窄鍵 `TodayStatus` 直接索引,
  不需窄化 cast——消除原本 admin 透過 `coach/api.ts` 借用實作的跨 surface 依賴方向。
- **`mobile-admin/api.ts`**:保留既有的寬鍵 fallback
  `(SESSION_STATUS as Record<string, [Tone, string] | undefined>)[t.status] ?? ['neutral', '']`——
  因為這裡的 `t.status` 是後端給的鬆散 `string`(非 `TodayStatus` 窄型別),沿用既有「cast 查表
  本身」慣例(同 `wire.ts` 的 `orderStatusBadge()` 既有寫法),不窄化來源字串。

**刻意留 surface 的部分:tone/色彩,C4 只單源 label 與推導邏輯**。`coach/data.ts` 的
`CLASS_STATUS` 除 `label` 欄位外,`bg`/`fg` 兩欄維持自己原有的 CSS 自訂屬性值未動——例如
`wait` 用 `var(--df-primary-bg)`/`var(--df-primary-dark)`(主色調藍),而 `SESSION_STATUS.wait`
本身攜帶的 `Tone` 是 `'neutral'`(admin/mobile-admin 兩處消費端直接採用這個 `Tone` 值作畫面
色調,兩者與 coach 因此在 `wait` 這一態呈現不同顏色)。coach 這欄色彩自 C4 之前就是獨立於
`Tone` 系統的一組 CSS 值,C4 沒有把它也拉進單源——這是計畫裁決:C4 的收斂範圍明確劃在「狀態 →
文字標籤」與「狀態推導邏輯(`deriveSessionStatus`)」兩件事,色彩呈現是各 surface 自己的畫面
決定,不是「今日場次狀態」這個領域概念本身的一部分,並非遺漏或不徹底。

`docs/adr/0013` 增補、`docs/architecture.md`、`CONTEXT.md` 同步更新查表清單。

### 5. C5 — `admin/api.ts` 拆殼:Reports 群整段遷 `reports-api.ts`

commit `f34619d`。`admin/api.ts`(1099 → 788 行)的 Reports 群(`GET /reports/admin`,5 個
`export type`、15 個 `export interface`、`getReports`、7 支私有 mapper、18 個私有 `Api*` wire
interface,共 336 行)機械式整段搬到新檔 `admin/reports-api.ts`,interface 完全不變;`admin/api.ts`
原地留逐名 re-export barrel 段(值符號一段 `export { getReports } from './reports-api';`、型別符號
一段 `export type { ... } from './reports-api';`,對齊 `member/stores.ts` 既有的 barrel 慣例)。
42 個 `$lib/admin/api` 消費端(含 `mobile-admin/api.ts` 對 `getReports`/`ReportsData` 的既有
re-export、再轉出供 `ReportsScreen.svelte` 消費的三層鏈)零改動。對應測試段(原 `getReports`
describe block)同步整段遷 `reports-api.test.ts`(285 行),改從 `./reports-api`(新模組本身)
直接匯入受測對象,而非繞經 `./api` barrel——co-locate 慣例、也避免測試依賴方向反著走;barrel
鏈(`reports-api.ts` → `admin/api.ts` → `mobile-admin/api.ts`)本身的正確性(re-export 路徑是否
真的接到 `reports-api.ts` 的匯出符號)由 svelte-check 靜態編譯保證(路徑或名稱寫錯即為編譯錯誤),
外加 C5 落地時對 42 個消費端逐名核對——不是由任何執行期測試覆蓋:`mobile-admin/api.test.ts` 對
整支 `$lib/admin/api` 下 `vi.mock`(含 `getReports`),其 `getAdminHome` 相關測試驗的是
mobile-admin 自身映射/委派層是否正確呼叫、傳遞回傳值,不觸及 barrel 鏈本身的執行期串接。

**裁決:Settings/Courses 群本輪不拆,按需跟進**。本次只動 Reports 群,不是順手把整個
`admin/api.ts` 拆成多檔——YAGNI,其餘群落目前沒有痛點(檔案大小本身不是痛點;沒有第二個消費者
需要獨立 import Settings/Courses 群的型別)驅動。`member/api.ts` 同名符號(`ReportsData`/
`getReports`,語意是會員視角「我的課程統計」,與 admin 端報表分析完全無關)獨立未動,避免混淆。

### 6. C6 — admin 桌面三頁(coupons/tickets/venues)CRUD 提交同構:不成立(唯讀 spike,記錄在案)

唯讀 spike,零 production 寫入,承 `docs/adr/0011`「否決:list-page controller factory」與
`docs/adr/0012` 四判準的既有審查傳統。範圍:以 `save()` 提交為軸,逐字核對 admin 桌面六個列表頁——
coupons(`+page.svelte:72-91`)/tickets(`:106-126`)/venues(`:100-120`)三頁在「`try` 起至
`gate.silentRefresh()` 止」的骨架逐字同構(含 `catch` 的 `return`、`wasNew` 存底、成功 toast 的
「`wasNew ? 建立 : 更新`」措辭模式);classes/coaches/members 三頁另行核對後結構性不同(classes 是
樂觀本地陣列合併、無 `silentRefresh()`;coaches 是無 page-level try/catch 的兩步 outcome switch
(即 K4);members 是 `create`+`saveEdit` 兩支獨立函式對映兩個獨立對話框),不落入同構範圍。

| 頁 | 控制流形狀 | body 準備 |
| --- | --- | --- |
| coupons | `save(updated)` 單函式雙分支,`wasNew` 存底 | **兩支**非對稱 builder(`code` 僅 create 有、`is_active` 僅 update 有),body 型別不同 |
| tickets | 逐字同構於 coupons | **一支**共用 builder,`try` 前預先算好 `const body` |
| venues | 逐字同構於 coupons | **一支**共用 builder,同 tickets |

**依 `docs/adr/0012` 四判準核對**:①呼叫端恆為 1 頁——**不成立**,抽出後恆有 3 個不同實體的
呼叫端,不落入 `docs/adr/0014` §2 雙生核可類(該類前提是 desktop↔mobile 雙生,本案是同一
surface 上三個不同實體);②deps 零行為旗標——**邊界不成立**,三頁的 body 準備形狀不一致
(tickets/venues 一支共用 builder,coupons 兩支非對稱 builder),要讓三個呼叫端共用同一介面必須
新增選項參數,重演 `docs/adr/0011`「寬介面、淺框架」的否決理由;③outcome 詞彙是領域意圖——形式上
因為三頁 `save()` 內沒有 outcome 判別聯集、只有 inline toast 而「無剩餘語彙可違反」通過,但這正
反映抽出的東西沒有領域意圖,只是控制流轉移;④gate/toast/error-mapper 留頁——成立,但剝離後剩餘
核心僅剩 `if (wasNew) { await create(...); } else { await update(id, ...); }` 單一分支 5 行。

**deletion test 結論**:即使用最有利於抽出方(tickets/venues 對稱 body 版本)估算,抽出一支
`submitEntity({ wasNew, create, update, id, body })` 通用函式,呼叫端三處合計省下的行數
(≈3×4 行)小於新模組定義(型別簽名+函式本體+檔頭註解)與其測試(至少 4 案例)所需行數;
coupons 的非對稱 body 迫使呼叫端仍要寫等價的三元判斷(邏輯分散到兩個檔案,比現狀單一 if/else
更分散)。介面複雜度(5 個具名欄位+泛型)逼近被取代的實作複雜度(1 個 if/else)——比
`docs/adr/0012` K4 已否決的一行布林反相案例更薄(K4 案好歹省一個布林變數宣告,本案殘餘連變數
宣告都沒有,純粹是 if/else 換函式呼叫的語法搬家)。與 `member/leave-form.ts` 成立案的關鍵差異:
leave-form 吃下的是一台真正的**狀態機**(三態載入、`submitting` 防雙送、reason trim、valid
衍生),四個呼叫端原本各自逐字複製;coupons/tickets/venues 的 `save()` **沒有機制**可吃,
三頁唯一共享的是「呼叫哪支 API」的一行分派,其餘全是已經正確留頁的顯示知識。

**known-gap 修正(brief 原預查需要修正,以此為準)**:brief 原預查「三頁 `save()` 全無 busy/saving
守衛」不準確——三頁的**編輯對話框**(`CouponCreateDialog`/`TicketEditDialog`/`VenueEditDialog`)
皆透過共用殼層 `admin/components/EditModal.svelte` 掛載,該殼層自 Round 3(commit `1b6a6eb`,
「EditModal 防重複送出」)起已內建防連點守衛(`handleSave()` 鎖住 `busy` 直到 `onSave()` 落定、
主按鈕 `disabled={busy}`),覆蓋全部六個 admin 桌面頁的 create/update 路徑,非 coupons/tickets/
venues 特有缺口。真正、範圍更窄的缺口是 coupons 頁另有兩個不經 `EditModal` 的次要 mutation
(`toggleActive()`、`confirmDelete()`)理論上可被連續點擊觸發重複 PATCH/DELETE——與本節「`save()`
同構」提問無關,列入記錄、不主張補。mobile-admin 側同樣需要修正:mobile-admin **不存在**
CouponsScreen(優惠碼管理是桌面專屬功能);`TicketsScreen`/`VenuesScreen` 的寫入側維持示範
(兩檔檔頭註解明文「寫入側維持 demo」,僅一行 `toasts.notify(...)`,不建 request body),非本節
討論的「CRUD 提交」,不構成任何同型重複候選(既有 P2 缺口,`CLAUDE.md` 已記錄,非本輪新發現);
mobile-admin 唯一真實 CRUD overlay 是 `CoachesScreen`(見 C3),屬 coaches 的「兩步 outcome
switch」家族,不屬本節討論的 `wasNew` 骨架家族。

**裁決:不成立,未翻案**。三頁 `save()` 的同構真實存在,但同構的部分恰好落在
`docs/adr/0011`/`0012` 已劃定「留頁」那一圈之外只剩的、比既有兩個否決先例(0011 的 5 行
body-builder、0012 K4 的一行布林反相)更薄的殘渣。不落地,不主張任何替代抽取。

### 7. C7 — 通知已讀 mutator 雙生(member/mobile-admin)收斂:遞延

`member/notifications.ts` 的 `markRead`/`markAllRead`(經 `docs/adr/0017` 改走 `session-gate`
的 `gate.markMutated()`)與 `mobile-admin/stores.ts` 的 `markOrderPaid`/`markMessageRead`
(走 `hydration-gate` 的 `markMutated()`)在「樂觀更新 + mutate 後標記」這個形狀上表面相似,本輪
評估後**遞延,不在本輪處理**。理由:`docs/adr/0017`(session-gate 三工廠)一週內剛重佈同一區塊
(2026-07-22 落地),此時再動同一段程式碼屬短時間內二次重構同一區,缺乏冷卻期;且兩者服務的
identity 來源不同(member 側是 `authStore`,mobile-admin 側目前無 session-identity 感知需求,見
`docs/adr/0017`「刻意不把 session 維度深化進 `hydration-gate.ts` 本身」的既有邊界),是否值得收斂
需要先確認兩者的 mutate 語意是否真的逐字同構,而非只是表面形狀相似——這個確認本身超出遞延評估的
邊界。待下次自然需要觸碰此區時,順勢重新評估。

## 過程紀錄:本輪審查揪出並修復的兩個 Important

1. **`admin/api.ts` 孤兒 `TodayStatus` import(C4 刪表殘留)**:C4 刪除 admin 本地
   `TODAY_TONE_LABEL` 查表後,`import type { TodayStatus } from '$lib/coach/data';` 已無任何
   本地消費者(全檔僅剩兩處純文字註解提及該名稱,非程式碼引用)——已移除,前後兩行 import
   (`deriveSessionStatus, SESSION_STATUS` 與 `MEMBER_COLORS, mapMemberAccount`)未動。
2. **`coach/messages/page.test.ts` 的 outcome→toast 映射斷言在搬遷中被連根刪除**:C1 把 render
   之舞測試改由 controller 21 例接手時,原「送出失敗時還原輸入框內容並提示錯誤 toast」測試整段
   刪除,連帶把其中「`sendMessage` 失敗 → `toasts.notify('error', '傳送失敗', ...)`」這條頁層
   映射斷言(`docs/adr/0012` 判準④要求留頁測試的部分)也一併刪掉、未留替代——已在同一 describe
   區塊補回一則輕量測試(僅斷言 outcome→toast 映射,不含已搬進 `messages-controller.test.ts`
   的 stale-guard/輸入框還原)。

兩者皆已修復,反映在本 ADR 引用的 commits 中;記錄於此供未來類似「刪表/搬測試」重構時參考同類
遺漏模式(孤兒 import 檢查需要對每個改動符號複查、不能只查「剛好改到的那一個」;搬遷測試時要
逐條核對原測試斷言的是哪一層,被搬走的斷言與該留頁的斷言可能夾在同一個 `it()` 裡)。

## 後果(刻意,非 bug;記錄性殘留)

- admin 即時課表狀態文字從「進行中」變成「上課中」(C4)——刻意的 UI 文案變更,非迴歸。
- **真迴歸(審查揪出,已修復)**:`routes/mobile-admin/admin/+page.svelte` 的
  `liveNow`(「進行中課堂」橫幅是否顯示)原本硬編 `today.find((t) => t.label === '進行中')`——
  C4 canonical 化後,真資料經 admin `getTodaySessions()`/`SESSION_STATUS` 產出的 live 標籤已是
  「上課中」,此比對從此恆為 false,橫幅在真資料下永不觸發,是 C4 label 改字的下游副作用。
  此洞未被既有測試攔下,因為 `routes/mobile-admin/admin/page.test.ts` 對整支
  `$lib/mobile-admin/api` 下 `vi.mock`,餵入的 fixture 同樣沿用舊字面「進行中」——測試與生產
  路徑巧合地共用同一個過時字面,測試因此對真實資料永遠不會發生的輸入形狀保持綠燈,沒有驗到
  C4 真正改變的那條路徑。修法:頁面改 `import { SESSION_STATUS } from '$lib/domain/sessions'`,
  比對改為 `t.label === SESSION_STATUS.live[1]`;`page.test.ts` 的 fixture 同步改用 canonical
  值「上課中」,並補一句規則性註解說明此陷阱(見該檔頭),避免日後又悄悄改回硬編字面而測試測不出來。
- `src/lib/domain/sessions.ts` 落地後,倉內仍有殘留測試 fixture 字面寫著舊值「進行中」,經
  grep 核實現況為三個檔案、四處(皆為直接餵入 prop/mock 回應的展示字面,不經過真正的
  `SESSION_STATUS`/`mapTodaySession` 映射路徑,元件或消費端本身不對其做任何條件判斷,純渲染或
  純傳遞):`admin/components/TodayPanel.test.ts`(1 處)、`routes/admin/page.test.ts`(1 處,
  desktop admin 首頁沒有 `liveNow` 一類橫幅邏輯,純 prop 展示,已核實)、`mobile-admin/api.test.ts`
  的 `getAdminHome` 描述區塊(2 處,驗證的是 mobile-admin 對桌面 `getTodaySessions()` 回應的
  逐欄位透傳保真,不是重新驗證 `SESSION_STATUS` 本身的計算)。四處皆確認不影響測試綠燈、純屬
  觀感字面漂移,非本輪寫入集,留待未來若有人動到這些測試檔時順手更新,不需要為此單開任務。
- `CoachAvatar` 的 `initial` 預設值等既有 `docs/adr/0013` §2 記錄的漂移殘留不受本輪影響。

## 測試守衛

- `src/lib/coach/messages-controller.test.ts`(新檔,24 例,含後續審修增補):`selectThread` 的
  stale-guard、`threadReady`/`badgeCleared` 互不阻塞的可證偽回歸測試(R1)、`markRead`
  best-effort 與 `thread`/`sel` 無關、`send` 的 conversationId 快照防護與 `sendFailed` 攜
  `text`、compose 三態與 `creating` 守衛、`closeCompose` 專屬案例。`routes/coach/messages/
  page.test.ts` 保留 outcome→toast 映射與整合斷言。
- `src/lib/mobile-admin/overlays/CoachesScreen.test.ts`(新檔,7 例):`createAndRefresh`/
  `updateAndRefresh` 依 `outcome.kind` 分派 toast,含「綁定失敗不打第二步重試」釘住
  `pendingUserId` 丟棄裁決。
- `src/lib/admin/settings-form.test.ts`(新檔,9 例,含後續審修增補):`applyData` 攤平、
  `maxClassSize` label↔數值換算、`save()` 三態 outcome、`alreadySaving` in-flight 守衛、
  `release()` 手柄需顯式呼叫才復位的回歸測試(R1,含 refresh 未落定期間 `alreadySaving`
  擋二次 PUT)。兩畫面既有 render 測試斷言面不變。
- `src/lib/domain/sessions.test.ts`(新檔,8 例)+ `src/lib/domain/status-lookups.test.ts`
  (擴充):`SESSION_STATUS` 四鍵字面快照、canonical 守衛(`SESSION_STATUS.live[1]` 為
  「上課中」而非 admin 舊值「進行中」)、`deriveSessionStatus` 的 wait/live/done 三段邊界。
- `src/lib/admin/reports-api.test.ts`(新檔,285 行,原 `admin/api.test.ts` describe block
  逐字搬遷)+ `src/lib/admin/api.test.ts`(barrel 段零邏輯、既有斷言不變)。三層 re-export 鏈
  (`reports-api.ts` → `admin/api.ts` → `mobile-admin/api.ts`)本身不經任何執行期測試覆蓋,由
  svelte-check 靜態編譯保證路徑/名稱正確,外加 C5 落地時逐名核對 42 消費端;
  `mobile-admin/api.test.ts` 對整支 `$lib/admin/api` 下 `vi.mock`,只覆蓋 mobile-admin 自身
  映射層是否正確呼叫、傳遞回傳值。

## 關聯 ADR

- **`docs/adr/0011`**:C6 spike 的判準②(deps 零行為選項邊界不成立)與 deletion test 論證皆直接
  引用其「否決:list-page controller factory」與「明文不收清單」的既有理由(5 行 body-builder、
  寬介面淺框架);C3 兩個消費端的 error mapper 留頁慣例不變,且維持 0011「後果」節既有的兩種
  合規接線形——桌面沿用具名包裝函式 `coachErrorMessage`(丙形),mobile-admin 沿用元件層
  `COACH_ERROR_TEXT` 常數表直接餵 `apiErrorText`(乙形)。
- **`docs/adr/0012`**:C1 messages-controller 是其四判準第六個適用例(單頁 controller 清單
  5→6);C3 的 `saveNewCoach`/`saveCoachEdit` 是既有 K4 模組的第二個消費端,非重新開判準①;
  C6 spike 的判準①③④逐條核對、K4「一行布林反相」否決先例是 C6 deletion test 的比較基準。
- **`docs/adr/0013`**:C4 `domain/sessions.ts` 是其顯示查表家族第六個 entity 檔,canonical 標籤
  裁決手法(取多數字面、少數改字)沿用 `VENUE_STATUS.available`「可預約」先例。
- **`docs/adr/0014`**:C2 settings-form 是其 §2 雙生核可類新例,「單工廠不拆 core」裁決與
  leave-form 的「一檔兩工廠」形成對照;C3 的 coach-save re-export 是其 §3 mobile-admin
  re-export 家族新增一員(同 `coachLoadErrorCopy` 手法)。
- **`docs/adr/0017`**:C7 遞延理由——session-gate 三工廠一週內剛重佈同一鄰近區塊,此輪不二次
  觸碰,冷卻後待下次自然需要時再評估通知已讀 mutator 雙生是否值得收斂。
