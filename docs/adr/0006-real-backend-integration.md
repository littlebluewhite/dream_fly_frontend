# 接上真實後端：Bearer Token、cents 邊界、購物車 v3、mock 現況清單

> Status: Accepted。源自 2026-07-04 前後端串接計畫（Task 11–19；`dream_fly_frontend` 的
> `feat/backend-integration` ↔ `dream_fly_backend` 的 `feat/frontend-integration`）。經 Round 2
> （2026-07-05，整合類 P2 收斂）與 Round 3（2026-07-06 起，course sessions/attendance/leave-makeup/
> messages/certificates+report-cards/rewards/reports 七個後端子系統 + admin 使用者端點 + 5 級課程
> 分級，含兩個 mobile surface 接真）持續更新，反映目前狀態（本次更新：2026-07-10，Round 4
> F1–F11 + P4-F1~F4：試上預約、逐堂出勤、會員儀表板統計、admin 今日課表/最新動態、教練/場館/票券/
> 優惠碼/系統設定寫入、mobile Google OAuth 陸續接真，§5 殘餘表逐項覆核改寫；報表面板還原另見新增的
> `docs/adr/0009`）。

前端從 mock-only 全面接上姊妹 repo `dream_fly_backend` 的真實 `/api/v1` API（Task 11 起）。本 ADR
記錄四項串接決定的現況快照：token 存放策略、cents↔NT$ 換算邊界、購物車 uuid 化（cart v3）、以及
`localStorage` 鍵值的最終清單；並記錄目前仍是 mock 的殘餘區域現況——Round 3 把兩個 mobile surface
也接上真實 API 後，殘餘只剩少數逐項列出、皆有明確理由的角落（見第 5 節與「已知後續」），作為後續
清理的起點紀錄。

## 背景與決定

### 1. Bearer Token：access 記憶體、refresh localStorage，輪替 + single-flight

後端（`dream_fly_backend` ADR-0001）核發兩顆 JWT：access token（15 分鐘）與 refresh token（30 天，
輪替、重用即撤銷整個裝置家族）。前端對應決定（Task 11）：

- **Access token 只存記憶體**（`src/lib/api/tokens.ts` 的模組層 `let accessToken`）——分頁重整即遺失，
  必須靠 refresh 換回；不落地，降低 XSS 情境下被讀取後長期有效的風險。
- **Refresh token 存 `localStorage`**（鍵值 `dreamfly_refresh`）——換取「重整頁面不用重新登入」。
- `src/lib/api/client.ts` 的請求攔截器自動加上 `Authorization: Bearer <access>`；收到 401 時觸發
  **single-flight** refresh：並發的 401 請求共用同一個進行中的 `/auth/refresh`，成功後全部重放，
  失敗則清 token 並導回登入頁——避免多個並發請求各自觸發 refresh、互相用掉對方的輪替額度。
- **`authStore`（`src/lib/stores/authStore.ts`）的真相來源是 refresh token 是否仍有效**
  （`hydrate()` 先檢查 `getRefresh()`），不是 `localStorage` 裡的個人資料快取。`dreamfly_auth` 這個
  鍵值仍然存在，但角色降級為「首屏個人資料快取」——只用來讓已登入使用者重整頁面時不要先閃一下
  「未登入」畫面，`hydrate()` 才是真正對後端確認身分的地方。
- **member surface 的畫面身分已改讀 `$authStore.member`**：`Topbar.svelte`/`Sidebar.svelte` 的大頭貼
  縮寫／姓名／顏色不再讀 mock 的 `ME` 常數（已刪），改讀 `toMember()` 的
  `{ id, name, initial, since, points, color, age }` 投影；後端未提供 per-member 頭像色時一律填品牌
  主色 `var(--df-primary)`（2026-07-07 更新）。**coach/admin 兩個桌面 shell 的身分槽位自 2026-07-14
  起比照辦理**：coach 的 `Sidebar.svelte`/`Topbar.svelte` 與 admin 的 `Sidebar.svelte` 同樣改讀
  `$authStore.member`，不再讀 mock 的 `COACH` 常數／admin 本地 `PROFILE.name`/`PROFILE.initial`
  （見 `docs/adr/0013`）；**coach 桌面 Topbar 的通知鈴鐺仍讀本地 seed（`NOTIFS`）不變**——教練工作流的
  通知目前後端無對應 feed，是既有 P2，本次身分收斂未觸及。

### 2. cents → NT$ 邊界：後端一律 `*_cents`，前端唯一換算點 `ntd()`

後端所有金額欄位一律以「分」為單位存放與傳輸（`price_cents`、`total_cents`、`discount_cents`、
`unit_price_cents`……），前端顯示需要的是「元」。換算集中在**單一函式**：

```ts
// src/lib/public/adapters.ts
export const ntd = (cents: number): number => Math.round(cents / 100);
```

`admin/api.ts`、`member/api.ts`、`member/stores.ts`、`member/checkout.ts`、
`member/components/CheckoutDialog.svelte` 皆從 `$lib/public/adapters`
import 這顆 `ntd()`，沒有任何檔案自行重寫 `/100` 或 `Math.round` 的換算邏輯——新增一個要顯示金額的
欄位時，一律透過這個函式，不要在呼叫端另開一條換算路徑。（`coach` surface 目前沒有金額欄位需要
顯示，未使用 `ntd()`。）

### 3. 購物車 UUID 化（cart v3）

`src/lib/member/stores.ts` 的持久化鍵值是 `dreamfly_cart_v3`（Task 15）：

- **String uuid item id** 取代 mock 時代的數字命名空間 id（後端 `product_id`/`course_id` 本來就是
  uuid，前端不再需要自造數字 id 去分辨「這是商品還是課程」）。
- **`(type, id)` 去重**：`addItem()` 依 `(type, id)` 找相同品項；重複 add 只回報 `'bumped'`、不遞增
  qty（新加入的品項一律從 qty 1 開始）。`updateQty()` 仍允許之後對單一品項調整數量。
- 後端另外在 DB 層用 `cart_items_course_qty` CHECK constraint 保證「課程」品項的 qty 恆為 1
  （`dream_fly_backend` ADR-0002）——商品類才有「數量」概念，課程沒有「買 3 份同一門課」的語意。
  這是後端獨立的保證，跟前端 `addItem()` 的 dedupe 邏輯是兩層各自的防線，不是同一個機制。
- **無 v2→v3 資料搬移**：舊的 `dreamfly_cart_v2`（數字 id）資料保留在使用者瀏覽器內，但前端不再
  讀取——舊 id 對真後端沒有意義，遷移一顆本來就要丟棄的 mock id 沒有價值。

### 4. `localStorage` 鍵值最終清單

| 鍵值 | 內容 | 現況 |
| --- | --- | --- |
| `dreamfly_refresh` | Refresh JWT（30 天） | 真相來源：`authStore.hydrate()` 靠它決定登入態——`mobile`/`mobile-admin`（Round 3 Task 19/20 起）共用同一顆 token，跟 desktop member/staff 是同一個登入態，不是各自獨立一份 |
| `dreamfly_auth` | 會員個人資料快取 | 僅首屏快取，避免 hydrate 前閃爍；非真相來源 |
| `dreamfly_cart_v3` | 購物車品項 | 唯一現行購物車鍵值；guest→login→checkout 全程持久化。**不再含候補清單**——候補（waitlist）真相已於 Round 2 Task 3 移到伺服器端（`GET/POST/DELETE /waitlist*`），`PersistedCart` 型別已不帶 `waitlist` 欄位；長期使用者瀏覽器裡若還殘留舊 payload 的 `waitlist` 陣列，載入時單純略過、不回寫（見 `member/stores.ts` 的 `loadCart()`） |
| `dreamfly_cart_v2` | 舊版數字 id 購物車 | 遺留、不再讀取，無搬移 |
| `dreamfly_subscriptions` | （已移除）舊版訂閱快照 | Task 17 移除；訂閱真相改為隨需 `GET /subscriptions/me` |
| `df_staff_last_role` | staff 登入後的角色切換記憶 | 真實功能（疊加在真實登入之上），非 mock |
| `df_mobile_session` | （已移除）`mobile` surface 舊版示範性登入旗標 | Round 3 Task 19 移除；`mobile` 現與 desktop member 共用同一個 `authStore`/`dreamfly_refresh` 真實登入態，守門邏輯見 `src/routes/mobile/guard.ts` |
| `df_madmin_session` / `df_madmin_role` | （已移除）`mobile-admin` surface 舊版示範性登入 + 角色旗標 | Round 3 Task 20 移除；`mobile-admin` 現與 desktop staff 共用同一套角色判斷（`$lib/staff/roles` 的 `staffPortals()`），守門邏輯見 `src/routes/mobile-admin/guard.ts` |

### 5. mobile / mobile-admin：已接線（Round 3 Task 19/20），殘餘 mock 逐項列出

2026-07-07 更新——先釐清本節範圍：member 點數兌換（`GET /rewards` + `POST /rewards/{id}/redeem`）、
member 成績單／證書（`GET /report-cards/me` + `GET /certificates/me`）、admin 報表分析
（`GET /reports/admin`）在本 ADR 定稿前即已接上真實 API，不屬於本節「demo/mock」之列。報表面板
（admin 報表頁 13 個圖表元件 + mobile-admin ReportsScreen）在 Round 4 從封存原型還原、重新接上真資料
的完整決策記錄另見新增的 `docs/adr/0009`，本節不重複。

`mobile`、`mobile-admin` 兩個 surface 在 Round 3（Task 19/20）已接上真實登入，與各自對應的 desktop
surface（member/staff）共用同一套 API：

- **真實登入**：兩者都移除了各自的示範性 localStorage 旗標（見第 4 節），改用跟 desktop 完全相同的
  `authStore`/`dreamfly_refresh` 真相來源。`mobile` 的守門邏輯（`src/routes/mobile/guard.ts`）鏡射
  `member/guard.ts`；`mobile-admin` 的守門邏輯（`src/routes/mobile-admin/guard.ts`）鏡射
  `$lib/staff/roles` 的 `staffPortals()` 角色判斷，並比照 desktop staff 做 admin/coach 分區（coach
  角色進不了 `/mobile-admin/admin`）。
- **API 接縫改為薄層**：`src/lib/mobile/api.ts`、`src/lib/mobile-admin/api.ts` 不再整包呼叫
  `reply()`；改為復用 desktop `$lib/member/api.ts`（mobile）與 `$lib/admin` + `$lib/coach`
  （mobile-admin）既有的真實 API 函式，型別對齊 desktop（例如 `mobile-admin/data.ts` 的
  `ClassRow`/`MemberRow`/`OrderRow` 現在直接沿用 desktop 形狀），不是平行重寫一份新邏輯。
- **假寫入面 sweep**：兩個 mobile surface 原本各自有一批「看起來能操作、實際只改本地 state」的假
  寫入介面，Round 3 期間逐一盤點並接真——mobile 的結帳（`CartSheet` 現在真的呼叫 `POST /orders`，
  復用 desktop 的 `syncCartToServer`/`validateCoupon`/`refreshPoints` 等 seam）；mobile-admin 的點名、
  會員新增/編輯、班級新增/編輯、訂單狀態變更、教練↔學員即時訊息、成績單/證書發放，共 7 處全部接真
  後端（Round 3 Task 20）。
- **優惠碼查表徹底退役**：`lookupCoupon()`/`COUPONS` 本地查表一度短暫搬到
  `src/lib/mobile/coupons.ts`（Task 11 P2 過渡狀態），隨上面「假寫入面 sweep」再收斂一步——
  `CartSheet` 現改走跟 `member` 結帳同一顆真實 `validateCoupon()`（`member/checkout.ts` 的
  `GET /coupons/{code}/validate`），本地查表已無任何呼叫端、完全退役（非搬移到另一份 mock）；
  `checkout-math.ts` 是 member 真結帳與 public 購物車頁共同消費的純數學模組，並非 mock-only。
- **admin 必填 prop 收斂**：`ClassEditDialog`（`coaches`）與 `OrdersTable`（`rows`）也已移除 mock
  時代的預設值、改為必填 prop，由頁面（`classes`/`orders`）傳入真實資料，避免元件在無資料時靜默
  顯示空殼（2026-07-07 更新）。

**Round 4（F1–F11 + P4-F1~F4，2026-07-10 定稿）把 Round 3 結束時列出的九項殘餘接掉六項、
再精修一項**，逐項覆核如下（實際 grep 結果，非憑 commit 訊息推定）：

- **`mobile` 試上預約**（Task F8）：`TrialScreen.svelte` 送出改打真 `POST /contact`
  （`inquiry_type='trial'` + 自由 `metadata`，integration-contract.md §3.17）——復用既有「洽詢」
  端點與資料表，不是另開一張 booking，也不佔用課程名額。已不是殘餘。
- **`mobile` 課程詳情出勤紀錄**（Task F7）：`MyCourseDetail.svelte` 與 desktop `member/mine` 頁
  皆已改真 `GET /enrolments/{id}/attendance`；`ATT_HISTORY` mock 已整個移除（非改名或搬移，
  `git grep ATT_HISTORY` 只剩「已退役」的註解）。原本「鏡射 desktop 同一缺口」的說法已不成立——
  兩側同時解決。
- **`mobile`/desktop 會員儀表板統計**：`mobile/api.ts` 的 `getMine()`、`member/api.ts` 的
  `getDashboard()` 皆改接新增的共用 seam `getReportStats()`（`GET /reports/me`）；`streak`/
  `skillsMastered`（後端無此概念）換成後端真有的 `upcomingSessions7d`/`attendedTotal`，不是同名
  硬套假資料。
- **admin dashboard 今日／動態**（Task F11）：`admin/data.ts` 的 `TODAY`/`ACTIVITY` 兩個 live-mock
  常數已整個退役（唯一消費者 `TodayPanel`/`ActivityPanel` 改吃 `getTodaySessions()`/
  `getRecentActivity()` 傳入的 props；`admin/+page.svelte` 已無任何 mock 常數 import）。
- **`mobile-admin`/admin 教練寫入**（Task F5）：兩側 `createCoach`/`updateCoach`
  （`POST /coaches`、`PATCH /coaches/{id}`）皆已接真，「先 `POST /users` 拿 user_id 再建教練欄位」
  兩步流程兩 surface 一致（`CoachEditDialog.svelte`／`CoachForm.svelte` 皆不再有本地假寫入
  fallback）。
- **admin 場館編輯**（Task F4）／**admin 票券寫入**（Task F1）：`createVenue`/`updateVenue`、
  `createProduct`/`updateProduct` 均已接真——這兩項只解決了 desktop 側，mobile-admin 側現況見下表。
- **admin/mobile-admin 系統設定**（Task F9）：`GET/PUT /settings` 兩側皆已接真；設定頁其中一個子
  區塊（登入裝置清單）仍是刻意排除在契約範圍外的本地 mock，現況見下表。
- **admin 優惠碼編輯/停用/刪除**（Task F6）：`updateCoupon`/`deleteCoupon` 已接真，優惠碼頁現有
  建立/列表/編輯/停用/刪除完整 CRUD（先前僅建立/列表）。
- **mobile Google OAuth**（Round 4 F2）：見下方「已知後續」。

**Round 4 之後仍保留的殘餘**（逐項核實於 2026-07-10，皆為後端無對應端點、契約明文排除、或純裝飾
性質，非本輪遺漏）：

| 區域 | 檔案 | 現況 |
| --- | --- | --- |
| `mobile-admin` 身分小卡 | `src/lib/mobile-admin/data.ts`（`PROFILES`） | 僅 admin 首頁 hero 仍顯示硬編姓名（陳怡君）；coach 首頁已於 Round 3 改接真實身分，不再共用這份 mock |
| `mobile-admin` 列表僅第 1 頁 | `src/lib/mobile-admin/api.ts`（`getOpsCollections()`） | 學員/班級/訂單皆只抓分頁第 1 頁，因行動版無 `PaginationBar`；誠實不完整，非假資料 |
| `mobile-admin` 場館／票券管理 | `src/lib/mobile-admin/overlays/VenuesScreen.svelte`／`TicketsScreen.svelte` | desktop 側已接真寫入（見上）；mobile-admin 側維持唯讀展示（場館——Task F4 決定不擴大範圍去加行動版寫入 UI）；票券沿用靜態 `TICKETS` seed，「編輯」仍顯示「（示範）」toast，「新增」則誠實導引使用者去桌面版操作，不是假裝成功 |
| `mobile` 帳戶設定「儲存變更」／桌面會員帳戶頁個人資料 | `src/lib/mobile/overlays/SettingsScreen.svelte`／`src/routes/member/account/+page.svelte` | 姓名/電話/家長聯絡人等欄位兩側都仍是本地端編輯、無可寫後端欄位；桌面生日已真 `PATCH /users/me { birth_date }`（Task P4-F4），mobile 尚未跟進生日欄位；mobile 的通知偏好/深色模式四個開關已真（Task F10，不在此列） |
| admin 登入裝置清單 | `src/routes/admin/settings/+page.svelte`（`LOGINS`） | 契約 §3.25 開頭明文排除（需 session 管理，另案處理），維持純本地 mock，非本輪遺漏 |

以上殘餘跟既有殘餘同一等級（例如 admin 學員表仍只顯示後端有提供的 7 個真欄位，其餘約 13 個概念欄位
因無後端來源而隱藏，非造假）——都是「後端尚無端點」「契約明文排除」或「純裝飾」的誠實缺口。逐項核對
後，Round 3 結束時列出的九項殘餘僅剩上表五項，其中兩項（場館／票券、系統設定）是原本殘餘的窄化描述
而非新發現的缺口。

### 6. Round 3 接線範圍：7 個新後端子系統 + admin 使用者 + 5 級課程分級

Round 3（後端 Task 1–8 + 前端 Task 9–20，2026-07-06 起）新增並接線了 7 個先前完全沒有後端支援、
純靠前端 mock 撐著的子系統，加上既有 courses 模組的分級擴充：

| 子系統 | 後端模組／端點 | 前端消費者 |
| --- | --- | --- |
| 課程場次／週課表 | `sessions`：`GET /courses/{id}/sessions`、`GET /sessions/today`、`GET /schedule/me` | 會員週課表（desktop `member/schedule` + `mobile` ScheduleScreen）、教練今日場次卡 |
| 出勤點名 | `attendance`：`GET /sessions/{id}/roster`、`PUT /sessions/{id}/attendance`、`GET /coaches/me/students` | 教練點名頁、教練學員名冊、mobile-admin 點名 |
| 請假／補課 | `leave`：`POST/GET/PATCH/DELETE /leave-requests`、`POST /leave-requests/{id}/makeup` | 會員請假/補課（desktop + mobile LeaveSheet/MakeupSheet） |
| 訊息中心 | `messages`：`POST /conversations`、`GET /conversations/me`、對話訊息 CRUD | 教練↔會員一對一訊息（desktop + mobile-admin 真聊天） |
| 成績單／證書 | `certificates`：`POST/GET /report-cards[/me]`、`POST/GET /certificates[/me]` | 教練寫評語、成績單/證書查詢與發放（desktop + mobile-admin） |
| 點數兌換 | `rewards`：`GET /rewards`、`POST /rewards/{id}/redeem`、`GET /rewards/redemptions/me`、admin CRUD | 會員點數兌換頁（desktop + mobile） |
| 彙總報表 | `reports`：`GET /reports/admin`、`GET /reports/coach`、`GET /reports/me` | admin/coach/member 三個報表頁 + admin dashboard |
| admin 使用者管理 | `users`：`GET /users`、`GET /users/{id}`、`POST /users`、`PATCH /users/{id}` | admin 學員新增/編輯（7 個真欄位） |
| 課程 5 級分級 | `courses`：`course_level` 擴充為 `foundation/beginner/intermediate/advanced/elite` | admin/coach/member/mobile/mobile-admin 五個 surface 收斂到共用常數 `$lib/domain/course-level`（`COURSE_LEVEL_LABEL`），取代原本三 surface 各自分歧、只涵蓋舊 3 值的對照表 |

這些子系統在 desktop 與兩個 mobile surface 全部落地後，第 5 節的殘餘表格就是目前僅剩、且逐項有明確
理由的部分。

## 後果（刻意，非 bug）

- 換分頁/重整頁面時，`dreamfly_auth` 可能短暫顯示上一輪的個人資料快取（例如改名後另一頁還沒重新
  `hydrate()`），這是刻意的 UX 折衷（避免閃爍），不是資料不同步的 bug。
- 舊 `dreamfly_cart_v2`、（已移除的）`dreamfly_subscriptions` 鍵值可能仍留在長期使用者的瀏覽器
  `localStorage` 裡，不會自動清除；它們不再被任何程式碼讀取，純粹佔用少量 storage 配額，無功能
  影響。
- `mobile`/`mobile-admin` 現在是 desktop member/staff 的真實客戶端（Round 3 起）——登入、購物車/
  訂單/課表/點名/訊息等操作都會反映到 `dream_fly_backend`，也受同一套真實登入狀態影響。第 5 節的
  殘餘表格是目前僅剩的例外，不是整個 surface 的性質。

## 已知後續

- `mobile`、`mobile-admin` 接上真實 API 已於 Round 3（Task 19/20）完成——見第 5 節殘餘表格，剩下的
  都是後端無對應端點或純裝飾性質的個別缺口，不是整個 surface 層級的落差。
- Google OAuth 登入（後端 `POST /auth/google` 已存在）現接線於 `member`（Round 2 Task 9）與
  `mobile`（Round 4 F2——復用 member 同一套 authorization-code redirect，`callbackPath` 參數化為
  `/mobile/login/google`，見 `src/lib/member/google-oauth.ts`；CSRF `state` 兩者共用同一把
  `sessionStorage` key，與呼叫端是哪個 surface 無關）。`staff`、`mobile-admin` 兩個登入頁仍沒有
  Google 選項——這不是遺漏：`dream_fly_backend` 的 `google_auth()` 不論是全新使用者、還是透過 email
  比對 link 到既有密碼帳號，流程尾端一律 `assign_role_tx(user.id, "member")`
  （`modules/auth/service.rs`），沒有一條路徑會核發或保留 `staff`/`coach`/`admin` 角色。若在 staff
  登入頁開放這顆按鈕，新使用者會落地成一個只有 member 角色的帳號、既有 staff 帳號用它登入則會被
  動掛上一個多餘的 member 角色——皆非預期行為。staff 帳號的建立與角色指派本就是走 admin 後台
  （`POST /users` + 角色指派），不是自助式登入頁的職責；是否要另開一條 staff 專用的 Google
  登入/角色選擇流程屬產品決策，非本輪範圍。
- 若之後要為 `dreamfly_cart_v2`/`dreamfly_subscriptions` 做瀏覽器端清除（非搬移，只是清掉不用的舊
  key），可以在使用者下次寫入 `dreamfly_cart_v3`/登入成功時順手 `localStorage.removeItem()`；目前
  評估價值低（省下的 storage 微不足道），故未列入本次範圍。
