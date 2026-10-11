# 教練對話列表單一 owner(推翻 0018 §1／0024 F5)、行銷公告走水合閘門、總查表原語

> Status: Accepted(§1–§3)。源自 2026-10-11 架構深化工程 Round 20(前端部分)。base `5e54f16`;
> 對話列表 `50b0f6f`(新 module)、`7730ff5`(mobile-admin 改讀)、`6d23187`(退役 messages store)、
> `8faefc5`(桌面訊息中心改讀)、`8cfa1d0`(工作台改衍生、`getDashboard` 不再抓對話)、
> 桌面角標與 coach layout 暖機(本篇前一個 commit);行銷公告 `aeb0566`+`ba6cdf7`;總查表 `d2196c2`..`ba6b261`。

R20 沿 `docs/adr/0018`/`0024`/`0028`「一輪多案、單篇記錄」的體例。三項前端決定中,只有 §1 推翻既有 ADR 的明文
裁決(0018 §1 留頁條款、0024 F5),所以單獨寫足證據;§2、§3 與既有 ADR 方向一致,只摘要。

測試總數收尾為 245 檔、2638 passed | 2 skipped。

## 背景與決定

### 1. 教練對話列表只有一個 owner:`src/lib/coach/conversations.ts`

**病灶**:教練的對話摘要(`GET /conversations/me`)散在三處——桌面訊息中心頁面自持 `convos` 並手寫已讀／送出／
新對話三種列表變更;mobile-admin 的 `messages` store 只管已讀;桌面工作台由 `getDashboard()` 再抓一次。

**推翻的裁決**:

- `docs/adr/0018` §1 留頁(判準④):「對話清單 `convos` 與其 gate……badge 清零與傳送後 `convos` 的預覽／時間更新都作用在
  `convos`(頁面狀態)」。
- `docs/adr/0024` 明確不做 F5(與已知遞延「桌面 `convos`」「mock 角標」):「桌面 `convos` 不併進 store。桌面外殼沒有
  讀未讀數的地方(`coach/nav.ts` 的角標是 mock),`Conversation` 與 `MessageRow` 的形狀也不同」。

**新證據**(裁決當時沒有,或當時的前提不成立):

1. **手機版預覽過期**:教練在對話串回覆成功後,mobile-admin 訊息列表的預覽與時間仍停在舊值——桌面雙生會更新、手機
   不會。這個不對稱沒有任何 commit 或 ADR 記錄,是 R20 審查讀程式碼時發現的。
2. **重複 GET**:mobile-admin 教練首頁的 `getCoachHome()` 呼叫 `getDashboard()`,後者抓 `/conversations/me` 再丟棄
   (註解自承「每次多付一次隨即丟棄的 GET」);layout 暖機又抓一次。每次載入兩支相同的 GET。
3. **F5 的「沒有讀者」是循環論證**:桌面外殼唯一的讀者(`nav.ts` 角標)是 mock,正是**因為**沒有 store;「沒有後端餵
   這個角標」的標籤也不實——`ConversationSummaryResponse.unread_count` 早已餵 mobile-admin 的真角標。至於
   `Conversation` 與 `MessageRow` 形狀不同,只是兩個投影,不是不能共用同一份資料(`MessageRow` 隨本輪退役)。

**決定**:

- **一個 module 持有列表**:`conversations`(唯讀)、`unreadConversationCount`(badge > 0 的對話個數,不是未讀則數加總)、
  `hydrateConversations`、`conversationsPageEntry`、`refreshConversationsIfHydrated`,建在 `createSessionGate` 上
  (同 `member/notifications`、`member/leave`)。換帳號即重置回 `[]`,在飛舊回應由 epoch 核對作廢(`docs/adr/0023` C6
  的 per-coach 重置照舊)。映射沿用 `coach/api.ts` 的 `getConversations()`。
- **mutator 由呼叫端把 controller 的 promise 交進來**(跟既有的 `badgeCleared` 交法一樣):
  `markConversationRead(id, badgeCleared)`、`recordSent(id, ctrl.send(text))`、`recordCreated(ctrl.confirmCompose())`。
  好處有二:
  - `write()` 在**呼叫當下**記住身分,promise 落地前換了帳號即 stale,不會寫進新身分的列表——呼叫端不必手寫身分核對。
  - `messages-controller` 完全不用知道列表,仍只是對話串狀態機(`docs/adr/0018` §1 的 controller 邊界不動)。
  三者都走非樂觀 `write()`(`docs/adr/0021`、`0027` §5):成功才 `commit`;失敗(ack 為 false、`sendFailed`、
  `createFailed`／`alreadyCreating`)在 `send` 內拋出,列表不動。toast 與頁面的 tab／搜尋／選取留頁面。
- **讀者**:桌面訊息中心(`createLoadGate({ ...conversationsPageEntry })`,取代頁面自持的 `convos`)、桌面工作台
  (前 3 筆由列表衍生,`getDashboard` 不再抓對話)、桌面側欄角標(`unreadConversationCount`,為 0 不顯示;`nav.ts`
  的 `badge: 3` 與 `CoachNav.badge` 欄位刪除)、mobile-admin 訊息頁／對話串／TabBar(教練首頁不讀列表,其 `pendingReplies` 來自 `/reports/coach`;它只是少了重複的 GET)。
- **暖機**:coach layout 與 mobile-admin layout 都以身分為 key 暖 `hydrateConversations`(`docs/adr/0024` §4 的暖機清單)。
- **新鮮度維持現狀**:桌面訊息中心與工作台再次進頁時,畫面先顯示已有的列表,背景再真抓一次
  (`refreshConversationsIfHydrated`,失敗靜默、舊列表照舊;多支在飛時以最後出發的為準,先出發的較晚落地不蓋回);**第一次進頁只抓 1 次**——layout 暖機、頁面 load 與
  工作台 `onMount` 的 `hydrateConversations` 共用同一顆閘門與同一支在飛 GET(`docs/adr/0020` 的在飛合併),已水合即
  短路。`routes/coach/layout.test.ts` 釘住:教練 1 次、重新 render 仍 1 次、與頁面同時 hydrate 仍 1 次、登出 0 次、
  A 換 B 共 2 次。手機版維持每個帳號抓一次。
- **留著的**:`conversations-filter.ts`(tab × 搜尋過濾與選取回退,K3／`docs/adr/0012` 既有純函式模組)仍是列表上的純函式;
  原 `applyCreatedConversation` 的 exists-or-prepend 規則併進 `recordCreated`。

### 2. 行銷公告改走水合閘門,由根 layout 暖機(`aeb0566`、`ba6cdf7`)

`notificationsStore` 原本在 factory 內、import 當下就打 `GET /posts?per_page=100`——每個 surface 開機(含 `/admin`、
`/coach`)都多一支公開 GET,且失敗被吞成永遠為空的清單、不重試。改建在 plain 水合閘門(公開端點、與身分無關,不用
session 閘門)上:import 零請求,`hydrateAnnouncements` 才抓,失敗拋出且閘門維持未水合,下次暖機重試。根 layout 的行銷
外殼暖機清單(`docs/adr/0028` §3,`!isAppSurface`)多一項。`unreadCount` 改名 `unreadAnnouncements`,與 member／
read-state 的同名匯出區分。符合 `docs/adr/0024` §4 暖機清單的方向,不是新類別。

### 3. `lookupOr` 總查表原語與課程層級後備

`lookupOr(table, key, fallback)`(`api/wire.ts`)是總查表的唯一寫法,只認自有鍵,不把 `Object.prototype` 上的繼承
成員當成查到的值;既有手寫 `Object.hasOwn`／`??` 的查表改用它,課程等級與招生狀態查表自帶後備,消費端改呼叫函式。
細節與可見變化(未知等級 tone 變 `neutral`)已寫在 `docs/adr/0013` 的 R20 增補,此處不重複。

## 明確不做的事(供未來止步)

- **把對話串（thread）併進列表 module**:`messages-controller` 仍是對話串狀態機,不持有也不認識列表;列表由呼叫端交
  promise 餵入。
- **樂觀更新**:三個 mutator 都等後端確認才寫回,與 `docs/adr/0021`／`0027` §5 的 ack-gated 已讀一致。
- **mobile-admin 與桌面各留一份列表**:同一個教練本人的資料,一份就夠;mobile-admin 只保留它自己的 UI 狀態。
- **為了 `Conversation`／`MessageRow` 形狀不同而保留兩份**:`MessageRow` 已退役,mobile-admin 直接讀 `Conversation`。
- **admin 分區的通知角標**:仍是沒有後端的 mock,不在暖機清單內(見遞延)。

## 可見的行為變更(逐條)

1. **mobile-admin 回覆後,訊息列表的預覽與時間跟著更新**(此前停在舊值)。
2. **桌面側欄「訊息中心」角標是真的未讀對話數**,為 0 不顯示;不再永遠顯示 3。
3. **`GET /conversations/me` 次數**:mobile-admin 教練首頁 2→1(不再由 `getDashboard()` 夾帶);桌面工作台次數不變(GET 由 `getDashboard` 移入列表);其餘桌面教練頁每個帳號多 1 支(側欄角標,由 coach layout 暖機)。
4. 桌面再次進頁（訊息中心、工作台）先顯示已有的列表再背景重抓,第一次進頁仍只抓 1 次——與先前一致。
5. 行銷公告只在行銷外殼打 `GET /posts`,app 介面零次;失敗可在下次暖機重試(§2)。
6. 其餘改動 wire 等價。

## 已知、刻意遞延

- **沒有後端的外殼角標仍寫死**:coach Topbar 的 `NOTIFS`、admin Topbar 的「目前有 3 則新通知」、mobile-admin 的
  `ADMIN_NOTIFS`／`COACH_NOTIFS`。`docs/adr/0024` 已知遞延那一條只剩這幾項,`coach/nav.ts` 的 `badge: 3` 已不在其中。
- **工作台對話列表的背景重抓失敗靜默**:舊列表照舊,不提示使用者(與訊息中心頁一致);不另設重試。
- **`refreshConversationsIfHydrated` 會拋出**:呼叫端各自 `.catch`;沒有把「靜默」收進 module,因為訊息中心與工作台
  吞法相同但未來可能想顯示。
- **`notificationsStore` 的 `clearNotification`／`addNotification` 沒有呼叫端**(`aeb0566` 記錄,非本輪造成,未刪)。

## 關聯 ADR

- **`docs/adr/0018`** §1:「`convos` 留頁」被推翻(§1);`messages-controller` 的邊界不動(增補指回本篇)。
- **`docs/adr/0024`** F5:「桌面 `convos` 不併進 store」與「`badge: 3` 是 mock」被推翻;§4 暖機清單多教練對話(增補)。
- **`docs/adr/0006`**、**`0013`**:`getDashboard()` 夾帶 best-effort `getConversations()` 的敘述被取代(各補一行退役註記)。
- **`docs/adr/0012`**:`conversations-filter.ts` 單頁 controller 清單不變。
- **`docs/adr/0017`**、**`0023`** C6、**`0020`**:session 閘門的換人作廢與在飛合併是本模組的基礎。
- **`docs/adr/0021`**、**`0027`** §5:`write()` 為唯一寫入動詞,已讀維持 ack-gated。
- **`docs/adr/0028`** §3:行銷外殼暖機清單(§2 延伸)。
- **`docs/adr/0013`** R20 增補:總查表原語(§3)。
