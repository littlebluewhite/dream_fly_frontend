# 接上真實後端：Bearer Token、cents 邊界、購物車 v3、mock 現況清單

> Status: Accepted。源自 2026-07-04 前後端串接計畫（Task 11–19；`dream_fly_frontend` 的
> `feat/backend-integration` ↔ `dream_fly_backend` 的 `feat/frontend-integration`）。

前端從 mock-only 全面接上姊妹 repo `dream_fly_backend` 的真實 `/api/v1` API（Task 11 起）。本 ADR
記錄四項串接決定的現況快照：token 存放策略、cents↔NT$ 換算邊界、購物車 uuid 化（cart v3）、以及
`localStorage` 鍵值的最終清單；並記錄目前仍是 mock 的區域（`mobile-admin`、Google 登入等）現況，
作為未來接線時的起點紀錄（`mobile` 會員行動版已於 2026-07-07 更新脫離此列，見第 5 節）。

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
  主色 `var(--df-primary)`（2026-07-07 更新）。

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
| `dreamfly_refresh` | Refresh JWT（30 天） | 真相來源：`authStore.hydrate()` 靠它決定登入態 |
| `dreamfly_auth` | 會員個人資料快取 | 僅首屏快取，避免 hydrate 前閃爍；非真相來源 |
| `dreamfly_cart_v3` | 購物車品項 + 候補清單 | 唯一現行購物車鍵值；guest→login→checkout 全程持久化 |
| `dreamfly_cart_v2` | 舊版數字 id 購物車 | 遺留、不再讀取，無搬移 |
| `dreamfly_subscriptions` | （已移除）舊版訂閱快照 | Task 17 移除；訂閱真相改為隨需 `GET /subscriptions/me` |
| `df_staff_last_role` | staff 登入後的角色切換記憶 | 真實功能（疊加在真實登入之上），非 mock |
| `df_mobile_session` | `mobile` surface 的登入旗標 | **示範性登入守門**，與 `authStore`/真後端脫鉤，P2 |
| `df_madmin_session` / `df_madmin_role` | `mobile-admin` surface 的登入 + 角色旗標 | **示範性登入守門**，與 `authStore`/真後端脫鉤，P2 |

### 5. mobile-admin／staff demo flags 現況

2026-07-07 更新——先釐清本節範圍：member 點數兌換（`GET /rewards` + `POST /rewards/{id}/redeem`）、
member 成績單／證書（`GET /report-cards/me` + `GET /certificates/me`）、admin 報表分析
（`GET /reports/admin`）在本 ADR 定稿前即已接上真實 API，不屬於本節「demo/mock」之列；admin
dashboard 的 `TODAY`（今日課表）／`ACTIVITY`（最新動態）則相反，兩者仍是 live-mock——後端無對應
端點，原始碼已在 `admin/data.ts` 加註 P2 標記並指回本 ADR。優惠碼查表（`lookupCoupon`/`COUPONS`）
已搬到 `src/lib/mobile/coupons.ts`，現在只供 `mobile` 展示殼的 `CartSheet` 使用；`member` 結帳走
真實 `GET /coupons/{code}/validate`（`member/checkout.ts` 的 `validateCoupon`），`checkout-math.ts`
因此不再是 mock-only，而是被 member 真結帳與 public 購物車頁共同消費的純數學模組。

`mobile-admin` surface 目前完全沒有接上真實登入或第 2 節之後的任何真實 API——
`src/routes/mobile-admin/+layout.svelte` 的頭部註解仍自稱是「示範性的登入守門」，讀寫
`df_madmin_session` / `df_madmin_role`，跟 `authStore`、`dreamfly_refresh` 完全無關；
`mobile-admin` 的 `api.ts` 也整包呼叫 `reply()`，未呼叫 `lib/api/client.ts` 的 `api()`。
**`mobile`（會員行動版）已接上真實登入與全部 screens**（`2ddc933`，2026-07-07 更新）——
`src/routes/mobile/+layout.svelte` 改依 `authStore`/token 守門，示範性的 `df_mobile_session`
旗標已移除；`mobile/api.ts` 的 getter 改為薄層 import `member/api.ts` 既有的真實 seam。
`staff`（`/staff/login`）則自始不同——它在 Task 13 已經接上真實 `POST /auth/login` 並依角色導向
`admin`/`coach`；`df_staff_last_role` 只是登入後、疊加在真實登入之上的角色切換記憶，不是 demo
機制。剩下的區隔（`staff`/`mobile` 真、`mobile-admin` 假）是本次整合刻意留下的範圍缺口，見
frontend issue「mobile 雙 surface 接線」。

## 後果（刻意，非 bug）

- 換分頁/重整頁面時，`dreamfly_auth` 可能短暫顯示上一輪的個人資料快取（例如改名後另一頁還沒重新
  `hydrate()`），這是刻意的 UX 折衷（避免閃爍），不是資料不同步的 bug。
- 舊 `dreamfly_cart_v2`、（已移除的）`dreamfly_subscriptions` 鍵值可能仍留在長期使用者的瀏覽器
  `localStorage` 裡，不會自動清除；它們不再被任何程式碼讀取，純粹佔用少量 storage 配額，無功能
  影響。
- `mobile-admin` 目前是一座完全獨立於真實後端的「展示殼」——在這個 surface 裡登入、操作都不會
  反映到 `dream_fly_backend`，也不會受真實登入狀態影響（反之亦然）。任何人展示這個 surface 前
  應該知道這一點，避免誤以為看到的是真實資料。`mobile`（會員行動版）已於 2026-07-07 更新脫離
  這個描述——它現在是真實登入＋真實資料的 surface，與 `member` desktop 版共用同一套後端狀態。

## 已知後續

- `mobile-admin` 接上真實 API（含真實登入、真實課程/學員/訂單/訊息資料）是後續 P2 任務，非本次
  整合範圍——見 frontend issue「mobile 雙 surface 接線」。`mobile`（會員行動版）已完成此項
  （2026-07-07 更新），該 issue 剩餘範圍僅餘 `mobile-admin`。
- Google OAuth 登入（後端 `POST /auth/google` 已存在）尚未接上任何一個登入頁面（`member`/`staff`/
  `mobile`/`mobile-admin`）——見 frontend issue「Google OAuth 登入流程」。
- 若之後要為 `dreamfly_cart_v2`/`dreamfly_subscriptions` 做瀏覽器端清除（非搬移，只是清掉不用的舊
  key），可以在使用者下次寫入 `dreamfly_cart_v3`/登入成功時順手 `localStorage.removeItem()`；目前
  評估價值低（省下的 storage 微不足道），故未列入本次範圍。
