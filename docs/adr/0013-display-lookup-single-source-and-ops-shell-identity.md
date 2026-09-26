# 顯示查表單一來源、營運桌面 shell 身分收斂與通知已讀落庫選型

> Status: Accepted。源自 2026-07 架構深化工程 Round 4 批次 1–3(W1 mobile 通知已讀落庫、W2 顯示查表
> 單源〔W2a 營運 ops-pair + W2b member-app 雙生〕、W3 mobile facade 直穿紀律收編、W4 coach/admin
> 桌面 shell 身分接 `authStore`、W5 coach 打卡組裝處補測,2026-07-14 落地)。

本批次同時收斂三件表面上不相關、但都源自「同一份資訊被兩個 facade 各自維護一份複本」這個既有模式的
現況:(a) admin↔mobile-admin ops-pair 與 member↔mobile 雙生 facade,各自複製一份「狀態/類型 →
tone/label」顯示查表,其中兩處已經靜默發散(`VENUE_STATUS` 的「可預約」vs「可使用」、`MEMBER_STATUS`
同名異義);(b) coach/admin 桌面 shell 的身分槽位仍讀寫死的 mock persona(`COACH`/admin 本地
`PROFILE.name`),與真實登入者脫鉤;(c) mobile 通知「已讀」只翻本地旗、不寫回後端,重新整理或開新
session 就回退成未讀。本 ADR 記錄三者的收斂決定、判準,以及批次 1 codex 審查留下的一筆殘留記帳。

## 背景與決定

### 1. 顯示查表單一來源:`$lib/domain` 各 entity 檔 + `member-app.ts`

**表 → 檔對照**(查表現在唯一居住的檔案,及消費它的 facade):

> **2026-08-03 增補**:下表「消費 facade」欄記的是 2026-07-14 落地當下的狀態。R9 C4 之後 admin 側
> 的活 re-export 全數退役(消費端直取)、`WEEK`/`TIME_ROWS`/`COACH_REPLIES`/`NOTIF_CATS` 一列
> member/mobile 兩側轉出亦全數退役——現況表與第一形絕跡的記帳見文末「增補(2026-08-03,架構深化
> R9 C4)」與 `docs/adr/0019`。查表的**單一來源歸屬**(左兩欄)不變。

| 查表 | 域檔 | 消費 facade |
| --- | --- | --- |
| `MEMBER_STATUS`(出席率三態) | `domain/members.ts` | admin(活 re-export) |
| `MEMBER_ACCOUNT_STATUS`(帳號啟用二態) | `domain/members.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `VENUE_STATUS` | `domain/venues.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `TICKET_TYPE` | `domain/tickets.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `STATUS_TONE`(課程招生狀態) | `domain/classes.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `LEVEL_TONE`(5 級課程分級) | `domain/course-level.ts` | admin(活 re-export),mobile-admin/member/mobile(皆純註記 re-assert,各自收窄回自身型別),`CourseCard.svelte`(公開行銷頁,直接展開) |
| `SESSION_STATUS`(今日場次狀態,R8 C4 增補) | `domain/sessions.ts` | admin(`api.ts` 直接 import,`mapTodaySession` 內部計算 tone/label,不 re-export)、coach(`data.ts` 直接 import,`CLASS_STATUS` 合成 label,tone/色彩自留)、mobile-admin(`api.ts` 直接 import,寬鍵 fallback) |
| `WEEK`/`TIME_ROWS`/`COACH_REPLIES`/`NOTIF_CATS` | `domain/member-app.ts` | member(活 re-export,`TIME_ROWS` 亦同)、mobile(`WEEK`/`COACH_REPLIES` 活 re-export、`NOTIF_CATS` 純註記收窄、`TIME_ROWS` 不轉出) |

**宣告形與不 `readonly` 理由**:五個 entity 查表檔(members/venues/tickets/classes/course-level)
一律用明確 `Record<K, V>` 型別註記(非 `as const`、非
`readonly`)。不用 `readonly` 是刻意的——`readonly` 陣列/tuple 無法賦值給可變陣列型別的位置,而
mobile/mobile-admin 自己的 `Tone` 是可變 tuple(`[string, string]`),若 domain 端把值宣告成
`readonly`,mobile 側純註記收窄回自己 `Record<string, Tone>` 的賦值就會直接編譯失敗。五個 entity
查表檔一律 `import type { Tone } from '$lib/api/wire'`(type-only,沿 `domain/orders.ts` 既有的
`OrderStatus` 先例)。`member-app.ts` 的成對常數不在此形之內——依其檔頭章程以寬鬆結構型別宣告
(`string[]`、`[string, string][]`),`Tone` 型別零 import(見下文「member-app 章程部分重開原文」)。

**facade 三形**——同一份 domain 查表,三種 facade 依自身型別限制選用其中一形,而非統一成一種:

1. **admin(活 re-export)**:`export { MEMBER_STATUS, MEMBER_ACCOUNT_STATUS } from '$lib/domain/members';`
   (連同對應型別的 `export type {...} from`)——admin 端本來就用 wire 的 `Tone` 型別,不需要另外收窄,
   直接轉手。
2. **mobile-admin(純註記 re-assert)**:`import { X as X_BASE } from '$lib/domain/Y'; export const X:
   <本檔可見型別> = X_BASE;`——核心不變量是 `X_BASE` 為 bare reference、賦值後仍是同一個參照,不是
   字面重建。可見型別的組合依表而異,不是一律同一種:`VENUE_STATUS`/`TICKET_TYPE` 是
   `Record<string, Tone>`(鬆散 `string` 鍵 + 本檔 tuple `Tone` 值),`MEMBER_ACCOUNT_STATUS` 鍵保留
   具名 union(`Record<MemberAccountStatus, Tone>`),`LEVEL_TONE`/`STATUS_TONE` 是
   `Record<string, string>`(plain-tone 表,值非 tuple)。mobile-admin 自己的 `Tone` 是本地 tuple
   型別、多數表的鍵偏好鬆散 `string`(供 `LevelBadge.svelte` 等消費端索引),不能直接
   `export {...} from` 域檔的窄型別。
3. **member/mobile(以自身較嚴格型別純註記收窄同參照)**:domain 存放結構寬鬆的型別,member/mobile
   匯入 `X_BASE` 後宣告 `export const X: Record<string, 自己的嚴格 Tone> = X_BASE;`——同一個參照,
   零 `as` 斷言,先例是 `NOTIFS_SEED` 的 `satisfies` 搭配(domain 宣告處用 `satisfies` 鎖住 tone 字面,
   facade 端才能純註記收窄而不需要斷言)。

**member-app 章程部分重開原文**:`domain/member-app.ts` 檔頭原本明文「domain 只收值,查表與型別留在
facade」這條界線,本輪隨這批查表/成對常數併入而修正。原文與改寫如下——

- 第 2 行,原文「僅收值相等的常數,查表與型別留在各 facade」→ 改寫為「僅收值相等的常數 —— 自
  ADR 0013 起含顯示查表/成對常數;`Tone` 等 facade 專屬型別仍留各 facade」。
- `Tone` 條款,原文「`Tone`(member 側是 union、mobile 側是 tuple,兩者不相容)一律不進這裡。」→
  改寫為「`Tone` 型別本身不進這裡;查表/成對常數以寬鬆結構型別在此宣告,窄側 facade 以自身型別對
  同一參照純註記收窄(`NOTIFS_SEED` 前例)。」

`member-app.ts` 因此從 Task 1(ADR 0010)當時「純值倉庫」的角色,擴大為「值 + 顯示查表/成對常數的
單一來源」;不變的是 `Tone` 型別本身(member 側 union、mobile 側 tuple,兩者結構不相容)依然不進來,
domain 只存放能被兩側各自純註記收窄的寬鬆結構型別。

**canonical=可預約,以及 mobile-admin 的畫面變更**:`VENUE_STATUS.available` 的中文標籤單源收斂為
「可預約」。桌面 `admin/data.ts` 原本就是這個字面(零變化),但 mobile-admin 原本是「可使用」——語意
相同、字面各自維護導致的靜默發散。單源後 mobile-admin 的 `VenuesScreen.svelte`(未改動、原樣消費新
查表)顯示文字實際跟著變成「可預約」——這是本輪查表收斂中唯一一處產生真實 UI 文案變化的項目;倉內
搜尋確認沒有任何既有測試斷言過舊字串「可使用」,故不影響任何測試綠燈。

**`MEMBER_STATUS` 消歧改名**:mobile-admin 原本也有一個叫 `MEMBER_STATUS` 的常數,但它存的其實是
`GET /users` 的 `is_active` 二元旗標語意(啟用中/已停用),跟 admin 側同名的「出席率三態」
(在學中/出席偏低/暫停中)完全不同——是跨 facade 的同名異義,不是同義複製。admin 端早已把這個
帳號啟用概念另外正確命名為 `MemberAccountStatus`;本輪 mobile-admin 端跟進改名為
`MEMBER_ACCOUNT_STATUS`,對齊 admin 既有命名,`StatusBadgeM.svelte` 隨之改 import 新名字。

**`CourseCard` 第 5 份收編**:`src/lib/components/CourseCard.svelte`(公開行銷頁的課程卡)原本自己
也維護一份 5 鍵 `canonicalLevelTones`(`satisfies Record<Level, BadgeTone>`),是 `LEVEL_TONE` 的
第 5 份複本(前 4 份是 admin/mobile-admin/member/mobile 各自 facade 的複本)。單源後改為直接展開
domain 的 `LEVEL_TONE`(`{ ...legacyLevelTones, ...LEVEL_TONE }`)——wire 的 `Tone`(7 值)與本地
`BadgeTone` 七值同集,結構相容,零額外斷言;對 `$lib/domain/course-level` 的 import 隨之從
`import type { Level }` 換成 `import { LEVEL_TONE }`——`canonicalLevelTones` 刪除後 `Level` 在本檔
已無任何使用者,原 type-only import 整行移除,新增的是另一個符號的 value import,不是同一個符號
的升級。

**`TIME_ROWS` 死出口**:mobile 側 `TIME_ROWS` 原本也曾比照 `WEEK` 轉出,但複核發現 mobile 沒有等價於
桌面 `member/schedule` 頁的「每週課表格線」畫面,是零消費者的死出口。單源到 `domain/member-app.ts`
時,mobile 側**整行不 re-export**——不是為了跟 `WEEK`/`COACH_REPLIES` 對稱而搬一個沒有消費者的值
過去,呼應 ADR 0010「死值不留死出口」的既有精神。

**不搬清單**(本輪複核過、判斷維持現狀的項目,供未來架構審查不必重提):

- **`PAY_STATUS`/`ATT_MARK` 單本**:兩表只存在於 `admin/data.ts`,mobile-admin 沒有對應複本——
  沒有東西可收斂,原地不動。
- **`ATT_STATE`/`PT_TYPE`/`NOTIF_TONE_BG`/`NOTIF_TONE_FG`**:四者常被籠統歸為「形狀不同」,但逐一
  核實後理由並不一致,值得分開記錄——
  - `ATT_STATE`:member 側鍵型別 `AttState`(`'present'|'leave'|'absent'`)只在 `member/data.ts`
    本地宣告,domain 的 `AttRecord.state` 欄位至今仍是同字面的 inline union、未被拉成可匯出的具名
    型別;mobile 側連 `AttState` 這個名字都沒有,鍵一律鬆散 `string`。要收斂 `ATT_STATE`,得先比照
    `MemberStatus`/`VenueStatus` 當初的做法,把 `AttRecord.state` 的 inline union 拉成 domain 具名
    型別——這一步本輪未做,`ATT_STATE` 因此連前置條件都不具備。
  - `PT_TYPE`:反而已經具備前置條件——它的鍵型別 `LedgerType` 早就是
    `domain/member-app.ts` 匯出的具名型別(`LedgerEntry.type` 的型別),member/mobile 兩側 facade
    也都已經在用這同一顆型別。`PT_TYPE`/`ATT_STATE`/`NOTIF_TONE_BG`/`NOTIF_TONE_FG` 這四個顯示查表
    本身單純不在 W2a/W2b 兩份任務 brief 明列的清單內,不是收斂不了——若未來要繼續這條路線,`PT_TYPE`
    會是四者中最現成的一個。
  - `NOTIF_TONE_BG`/`NOTIF_TONE_FG`:兩者在畫面上永遠成對消費(同一個通知圖示的底色+前景色)。
    `NOTIF_TONE_FG` 兩側字面其實逐位元組相等(合格候選),但配對的 `NOTIF_TONE_BG` 有一個鍵
    (`accent`)兩側字面不同(member `var(--df-accent-bg)`、mobile `#FFF8DB`)——跟下面 `ANNOUNCE`
    是同一類「一項發散、拖累整體」。本輪選擇把這一對當成不可拆的配對一起留在原地,而不是拆開
    「FG 搬、BG 不搬」——那樣會讓未來讀者疑惑兩個總是成對出現的常數為何分居兩處。
- **`ANNOUNCE` 刻意發散**:member/mobile 各自的公告陣列裡有一則公告的 `bg` 色不同(member
  `var(--df-accent-bg)` vs mobile `#FFF8DB`),整組陣列因此留在兩側原地——這是 Task 1 之前即有的
  既定裁決,本輪未變動,仍是 `member-app.ts` 檔頭章程明文的唯一值例外。
- **`F_MEMBER_STATUS`**:`mobile-admin/form-options.ts` 另有一個三鍵 tuple 陣列
  `[string, string][]`,標籤字面跟 `MEMBER_STATUS` 相同(在學中/出席偏低/暫停中),但形狀是給表單
  `<select>` 用的有序陣列,不是給 badge 顯示用的鍵值查表——用途不同,不是同一件事的複本。複核
  發現這個常數目前在整個 `src` 樹裡沒有任何 import 端(`MemberForm.svelte` 並未使用它)。是否要
  退役,屬於 ADR 0010「已知後續」記錄的 mobile-admin 死種子清理範疇,不在本輪顯示查表單源的範圍內。

### 2. 營運桌面 shell 身分立場窄化:coach/admin 讀 `$authStore.member`

coach(`Sidebar.svelte`/`Topbar.svelte`)與 admin(`Sidebar.svelte`)桌面 shell 的身分槽位,原本讀
寫死的 mock persona——`coach/data.ts` 的 `COACH`(李志偉)、admin `Sidebar.svelte` 本地的
`PROFILE.name`/`PROFILE.initial`(陳怡君)。本輪改讀真實登入者 `$authStore.member`,對齊 member
surface 早自 ADR 0006 起就已完成的同類收斂。三個檔案的身分槽位範圍不同:兩個 `Sidebar.svelte` 是
「大頭貼縮寫 + 顯示名 + 身分 popover」三件套;coach `Topbar.svelte` 唯一的身分元素是右上角的大頭貼
縮寫圓圈(`{$authStore.member?.initial ?? '?'}`),沒有姓名文字——它的 popover 是通知鈴鐺,與身分
無關。

**身分槽位讀同步 `authStore` 不算走 `api.ts`/load-gate 的語意釐清**:`docs/architecture.md` 既有的
「layout shell 在 seam 之外」這條界線,本輪並未被打破。`$: member = $authStore.member` 是**同步的
store 訂閱**,不是新開一條 async fetch、也沒有掛上 `load-gate.ts`/`hydration-gate.ts`;`authStore`
本身早在 ADR 0006 就已經是 `hydrate()` 對後端確認身分的地方,shell 這次只是把「讀哪個常數」從 mock
換成「讀這個別處已經水合好的既有 store」,沒有新增任何 I/O 或閘門邏輯到 shell 這一層。coach/admin
兩個 shell 因此依然「沒有 `data.ts`/`api.ts` import」這條既有事實成立(coach Topbar 唯一例外是
module-context 的 `NOTIFS`,下述)。

**推導沿 `mapCoach`**:coach `Sidebar.svelte` 衍生 `coachInitial` 用 `initialOf(member.name)`
(`$lib/api/wire`)——與 `coach/api.ts` 的 `mapCoach()` 推導教練姓名縮寫用的是同一顆函式,不是另開
一條算法。

**fallback 表**(未登入或 `member` 為 `null` 時的顯示):

| Shell | 身分槽位 | 顯示名 fallback | 縮寫 fallback |
| --- | --- | --- | --- |
| coach `Sidebar` | 縮寫 + 顯示名 + popover | 「教練」 | 「?」 |
| coach `Topbar` | 僅大頭貼縮寫圓圈 | —(無姓名槽位) | 「?」 |
| admin `Sidebar` | 縮寫 + 姓名 + popover | 「管理員」 | 「?」 |

**職稱 → 角色標籤**:coach `Sidebar.svelte` profile card 原本顯示 `COACH.role`(「資深體操教練」,
一個具體職稱)換成靜態字面「教練」——`authStore.member` 沒有 job-title 欄位,shell 不該假造一個
後端沒提供的職稱;換成的是「角色標籤」(這人是教練這個角色,不是某個特定頭銜),不是職稱。

**假員編刪行**:coach `Sidebar.svelte` popover 原本顯示 `COACH.id`(`DF-C2019-007`,一個無後端對應
欄位的假教練員編)整行刪除,不換成別的東西——真實 uuid 已經在教練設定頁可見,shell 不需要重複
(且是假的)一份。

**`COACH` 不退役**:`coach/data.ts` 的 `COACH` 常數本體與 `Coach` 型別都沒有退役。`Coach` 型別仍是
`coach/api.ts` 的 `mapCoach()` 回傳形狀;`COACH` 值雖然失去 Sidebar/Topbar 這兩個曾經的消費者,
但仍有兩個殘留消費者(見下方 §2 補充與後果節)。`coach/data.ts` 檔頭「COACH 是 Topbar/Sidebar 等
元件直接消費的活種子」這句消費者說明,已同步改寫:NOTIFS 仍是 Topbar 直接消費、`TODAY_LABEL`/
`CONVERSATIONS` 仍是 `coach/api.ts` 消費,`COACH` 改指向宣告旁新補的漂移註記。

> **2026-07-20(R5 C2)退役註記**:上句「`CONVERSATIONS` 仍是 `coach/api.ts` 消費」自本日起不再
> 成立——`getDashboard()` 已併入真 `getConversations()`(best-effort,失敗降級空陣列),
> `CONVERSATIONS` seed 依慣例於 `coach/data.ts` 原位退役;`Conversation` 型別與 `SlaTone` 仍為
> 活型別(真映射的型別消費者)。歷史裁決原文不改寫。

**§2 補充(批次 1 codex 審查記帳)**:`CoachAvatar.svelte` 的 `initial` prop 有一個預設值
`COACH.initial`(`export let initial: string = COACH.initial;`),原本是給「不需要承接特定教練資料」
的殼層呼叫端撐著(呼叫時不傳 `initial`)。W4 把 coach `Sidebar.svelte` 的兩個 `<CoachAvatar>` 呼叫
端都補上 `initial={coachInitial}` 後,連同既有已經會傳 `initial` 的另外兩個呼叫端
(`coach/components/settings/ProfileTab.svelte`、`routes/coach/settings/+page.svelte`),全倉四個
`<CoachAvatar>` 呼叫點目前無一遺漏地顯式傳入 `initial`——這個預設值因此已經沒有 production 觸達
路徑(`npm run check` 仍看得到它、型別合法,但執行期不會有任何呼叫走到這個 fallback)。本輪審查後
明文裁決:**元件本體與這個預設值不動,`COACH` 值也不退役,只在 `COACH` 宣告旁補一句漂移註記**——
註記內容是「值消費者僅剩 `CoachAvatar` 預設 `initial` 與 `routes/coach/page.test.ts` 的 fixture
兩處」。是否要拔掉這個目前打不到的預設值,留給以後專門的清理 pass 評估;現在拔並非 W4 這張卡的目標,
也**不與 ADR 0010「死種子退役」的精神牴觸,只是刻意的遞延**——ADR 0010 本身在「死活判定」一節就
明文「即使原始碼已經寫著……仍對每個候選符號重新 grep 一次全部消費者」,`COACH` 目前仍有兩個文字上
可 grep 到的消費者(即使其中一個已無執行期路徑),不是那種「重新 grep 後零消費者」的整段退役候選。

### 3. mobile 通知已讀落庫選型:案甲(維持既有結構 + 補 PATCH)vs 案乙(改用 `createHydrationGate`)

**問題**:mobile `notifs.markRead`/`markAllRead` 原本只翻本地 `notifsHydrated` 旗標,不打後端——
重新整理或開新 session 會讓已讀狀態回退成未讀(使用者可見的 bug)。desktop 對應的
`member/notifications.ts` 早就是「樂觀更新 + `PATCH /notifications/{id}/read` + 失敗不還原」的
真落庫寫法,而且它的 `notificationsHydrated` 是 `createHydrationGate`(`$lib/hydration-gate.ts`)
這個 factory 回傳的 `gate.hydrated`(見 `docs/adr/0008`「已知後續」段落)。

**案甲(本輪採用,結構極簡)**:`mobile/stores.ts` 的 `notifs` wrapper 保留既有結構——底層仍是
`notifsBase`(`createReadState` 建出的既有本地 read-state store)+ `notifsHydrated` 這顆獨立的
plain `writable(false)`;只在 `markRead`/`markAllRead` 內補上樂觀更新後的 `PATCH` 呼叫、失敗只
`console.error` 不還原、`markAllRead` 用 `Promise.allSettled` 統計後回傳 `'ok'|'partial'`。四個
行為點與 `member/notifications.ts` 逐一對齊(PATCH 端點、樂觀更新失敗不還原、`allSettled` 併發送出、
全部成功才回 `'ok'`),但**結構刻意保持不同**——member 走 `gate.markMutated()` +
`notifications.update()`,mobile 走既有的 `notifsBase` 方法 + 直接 `notifsHydrated.set(true)`。

**案乙(評估後不採用)**:把 mobile 的通知 hydration 也遷到 `createHydrationGate`,結構對齊
member(以及 mobile-admin 的 ops/messages)。

**deletion-test 論證(為何選案甲)**:mobile 通知頁本來就只有一個頁面同時身兼讀者與 mutator,不像
mobile-admin 的 ops/messages 有多個 mutator(`markOrderPaid`/`markMessageRead`)需要一個獨立於任何
單一頁面的 store 層 guard;`notifsHydrated` 早就是這頁 `createLoadGate` 的 `hydrate.flag` 選項在
使用的同一顆旗標(見 `docs/architecture.md`「載入閘門 vs 水合閘門決策樹」),`notifs` wrapper 本身
已經是「翻旗 + mutate」邏輯唯一齊聚的地方,沒有散落在多處呼叫端、需要靠一個 factory 才能收斂的重複。
若把這裡換成 `createHydrationGate`,拿掉「換 factory」這個動作後,W1 真正要修的 bug(已讀不落庫)
一樣要修——「換 factory」本身不會讓任何既有的重複消失,只是把同一段邏輯換一種包裝,是搬家不是收斂
(與 `docs/adr/0011`「明文不收清單」、`docs/adr/0012` K4 案 A 否決時用的是同一種判準:抽出的東西
若拿掉後複雜度原地重現、沒有真正收斂任何東西,就不該抽)。因此本輪只做行為對齊,不做結構遷就。

**對 ADR 0008 的關係**:本決定不修改、也不違反 ADR 0008 記錄的「四個變體」分類——mobile 通知頁仍是
「頁面自帶 `hydrate` 選項」的 page-owned 變體,`notifsHydrated` 仍是同一顆 plain writable,只是它的
mutator(`markRead`/`markAllRead`)現在除了翻旗還會真的打 `PATCH`。`member/notifications.ts` 是否
採用 `createHydrationGate`(它本輪之前已經是)完全是另一件獨立的事,本 ADR 不重新評估。

## 後果(刻意,非 bug)

- `VENUE_STATUS.available` 的中文標籤收斂為「可預約」後,mobile-admin 的 `VenuesScreen.svelte`
  顯示文字實際變更(見 §1)——沒有既有測試斷言舊字串,故不是需要處理的迴歸。
- `MEMBER_ACCOUNT_STATUS` 改名後,admin 與 mobile-admin 現在共用同一個名字指同一個語意(帳號啟用
  狀態);往後若有第三個 facade 需要同一張查表,不會再有命名跟「出席率三態」`MEMBER_STATUS` 撞名
  的風險。
- `CoachAvatar` 的 `initial` 預設值目前是型別上仍合法、執行期不可達的殘留(見 §2 補充)——下一次
  觸碰 `coach/data.ts` 或 `CoachAvatar.svelte` 的 pass,可以視情況一併評估是否拔除,不需要為此單開
  任務;`COACH` 常數本身也不因此被視為待退役。
- mobile 通知已讀落庫後,`notifs.markRead`/`markAllRead` 的簽章都改成回傳 `Promise`——既有
  fire-and-forget 呼叫點(頁面 click handler)與新增的 `await notifs.markAllRead()`(頁面依回傳值
  分流 toast 文案)並存,兩者都是合規用法,不代表其中一種呼叫方式待統一。
- coach/admin shell 身分改讀 `$authStore.member` 後,兩者的顯示內容(姓名/縮寫)會隨著登入者不同
  而不同——這是刻意的行為變更(從「固定顯示某個假教練/假管理員」變成「顯示真正登入的人」),不是
  bug;`docs/adr/0008` 記錄的「突變後三分法」與本次身分槽位變更無關,shell 讀取的是登入態而非某個
  列表資料的突變結果。

## 測試守衛

- `src/lib/domain/status-lookups.test.ts`(新檔)、`course-level.test.ts`(擴充):三層守衛比照既有
  `member-app.test.ts` 慣例——facade 同參照 `toBe`、域表字面 `toEqual` 快照 + 同名異義/canonical
  守衛(例如斷言 `MEMBER_STATUS.active[1]` 不等於 `MEMBER_ACCOUNT_STATUS.active[1]`、
  `VENUE_STATUS.available[1] === '可預約'`)、鍵數 canary。
- `src/lib/domain/member-app.test.ts`:`WEEK`/`TIME_ROWS`/`COACH_REPLIES`/`NOTIF_CATS` 四常數的
  wiring/字面/row-count 三層守衛;檔頭常數計數句同步改為 11。
- `src/lib/coach/components/Sidebar.test.ts`/`Topbar.test.ts`(新檔)、
  `src/lib/admin/components/Sidebar.test.ts`(擴充既有檔):已登入/未登入 fallback 兩種情境的渲染
  斷言,含 popover 假員編行不再出現的 `queryByText(...)` 為 `null` 斷言。
- `src/lib/mobile/stores.test.ts`/`src/routes/mobile/notifications/page.test.ts`:`PATCH` 落庫
  成功、失敗不還原、`markAllRead` 只對未讀發送且回傳 `'ok'|'partial'`,以及單一未讀 fixture 的
  「點已讀 → 重新整理 → 已讀不回退」回歸主測(釘住案甲的實際行為,而非只測到 mock 呼叫次數)。
- `src/routes/coach/page.test.ts`(W5 追加,零程式碼搬動):hero 後綴「(李教練)」不回歸的迴歸斷言;
  同批落地、但與本 ADR 三項決定無直接關係的 `clockTouched` 競態守衛與 `clockOut` 404 校正測試——
  這兩個是既有無測覆蓋的打卡組裝處補測,`docs/adr/0012` 判準④(controller 是否值得抽成獨立模組)
  在此不成立,故未抽 controller,呼應 `docs/adr/0011` 對「太薄、抽出不比呼叫點深」一類重構的既有
  否決紀律。

## 關聯 ADR

- **`docs/adr/0006`**:`authStore` 以 refresh token 為真相來源、`hydrate()` 才是實際跟後端確認身分
  的地方——shell 讀 `$authStore.member` 是這個既有真相來源的又一個訂閱端,不是新開一條身分來源。
- **`docs/adr/0007`**:`Tone`/`initialOf` 等 wire 知識單一來源——本輪新增的查表沿用同一顆 `Tone`
  型別,shell 身分推導沿用同一顆 `initialOf`。
- **`docs/adr/0010`**:死種子退役的方法論(重新 grep 全部消費者、值/型別分家、facade 各自現況可能
  不同、mobile-admin 死種子清理獨立遞延)——本輪 `TIME_ROWS` 死出口判斷、`CoachAvatar` 預設值的
  殘留記帳、`F_MEMBER_STATUS` 是否退役的遞延,皆沿用同一套判準與同一個既有的遞延決定。
- **`docs/adr/0012`**:§3 的型別慣例(`satisfies`/顯式型別註記/`as const`,禁整段字面 `as` 斷言)——
  本輪所有新查表宣告皆遵循,W2a 實測「寬 `Record` 承接窄 `Record`」未觸發 `TS2322`,計劃預告的
  單參照 `as` fallback 全程未動用;K7「保守版、更徹底的替代設計刻意遞延」的裁決風格,與本輪 §3
  選擇案甲、否決案乙的取捨同出一轍。

## 增補(2026-07-23,架構深化 R8 C4):domain/sessions.ts 是顯示查表第六個 entity 檔

`src/lib/domain/sessions.ts`(`SESSION_STATUS`/`TodayStatus`/`deriveSessionStatus`)收斂
admin/coach/mobile-admin 三處原本各自手抄的今日場次狀態查表,加入 §1 開頭表格所列
venues/tickets/members/classes/course-level 五個既有 entity 檔之列,成為第六個。canonical 標籤
裁決(`live` = 「上課中」,取 coach/mobile-admin 既有多數字面,admin 舊值「進行中」改字,手法
同上文 `VENUE_STATUS.available`「可預約」canonical 化先例)與三個消費端各自維持不同承接形
(coach 留活 re-export 且 `CLASS_STATUS` 保自己的 `{label,bg,fg}` 合成形、admin 直接 import、
mobile-admin 保留既有寬鍵 fallback)的完整裁決過程,記於 `docs/adr/0018`。

## 增補(2026-08-03,架構深化 R9 C4):第一形(admin 活 re-export)的實例在倉內絕跡;§1 現況表補登

`docs/adr/0019` 的 facade 純轉手退役以一條判準句掃過四個 surface 的 `data.ts`——「匯出行若不攜帶
本檔型別事實、不做值變形,且來源是 `$lib/domain` 或 `$lib/api/wire` 的**同源且結構恆等**符號
(含 facade 端改過名、退役後由 import-site alias 承接者)→ 退役」——而
§1 的**第一形(admin 活 re-export)恰好就是這條判準句要退役的形狀**:admin 端本來就用 wire 的
`Tone`,不需要收窄,那層轉手因此零型別事實可攜帶。批4 之後 admin 消費端(以
`components/StatusBadge.svelte` 為最大宗,一支元件 13 個符號)一律直取 `$lib/domain/members`/
`venues`/`tickets`/`classes`/`course-level` 與 `$lib/api/wire`。

**消失的是第一形的實例,不是這條分類本身**。三形的判準原樣有效——若日後某個新 facade 的 `Tone`
恰好與 wire 相容,0019 的判準句會直接判它「不必存在這層轉手」(而不是判它「該用第一形」);第二形
(mobile-admin 純註記 re-assert)與第三形(member/mobile 以自身較嚴格型別純註記收窄)因為真的攜帶
本檔型別事實,全數原樣保留、`toBe` 同參照守衛也全留。0019 同時把兩形的**鑑別法**落字:分水嶺是
**facade 宣告型別與 domain 宣告型別是否結構恆等**——結構恆等即零型別事實被附加,屬第一形;不恆等
(facade 以本檔可見型別重新宣告,無論收窄或放寬)才是真的攜帶型別事實的第二/三形。§1 五個 entity
查表(`VENUE_STATUS`/`MEMBER_ACCOUNT_STATUS`/`TICKET_TYPE`/`STATUS_TONE`/`LEVEL_TONE`)即為後者的
實例:domain 端一律是顯式 `Record<窄鍵, 值>` 標註(見上文「宣告形與不 `readonly` 理由」),facade
端改用本檔可見型別承接(組合依表而異,見上文第二形原文:鬆散 `string` 鍵配本檔 tuple `Tone`、保留
具名 union 鍵、或 plain-tone `Record<string, string>`),兩者不恆等,故本輪全數保留。
`member-app.ts` 那套以 `satisfies` 鎖字面、讓窄側 facade 零斷言收窄的手法(見上文「member-app 章程
部分重開原文」)是**該檔寬鬆結構型別章程下的線索**,不是通用判別式——§1 這五張 entity 查表沒有
一張用 `satisfies`,若照「`satisfies` vs 顯式標註」字面套會把它們全誤判成第一形,與上文 §1 Form 2
的記載直接相反。

**§1 表格現況補登**(表格原文記的是 2026-07-14 W2a/W2b 落地當下的狀態,以下是 R9 C4 之後的實況;
表格本身不改寫,以本節為準):

| 查表 | 域檔 | 消費 facade(2026-08-03 現況) |
| --- | --- | --- |
| `MEMBER_STATUS` | `domain/members.ts` | admin **改直取**(原活 re-export) |
| `MEMBER_ACCOUNT_STATUS` | `domain/members.ts` | admin **改直取**、mobile-admin(re-assert,不變) |
| `VENUE_STATUS` | `domain/venues.ts` | admin **改直取**、mobile-admin(re-assert,不變) |
| `TICKET_TYPE` | `domain/tickets.ts` | admin **改直取**、mobile-admin(re-assert,不變) |
| `STATUS_TONE` | `domain/classes.ts` | admin **改直取**、mobile-admin(re-assert,不變) |
| `LEVEL_TONE` | `domain/course-level.ts` | admin **改直取**;mobile-admin/member/mobile 純註記 re-assert(不變)、`CourseCard.svelte` 直接展開(不變) |
| `SESSION_STATUS` | `domain/sessions.ts` | 三消費端皆為直接 import,本輪不受影響 |
| `WEEK`/`TIME_ROWS`/`COACH_REPLIES`/`NOTIF_CATS` | `domain/member-app.ts` | **member 與 mobile 兩側的轉出全數退役**,四常數改由頁面/元件直取——`member/schedule` 頁(`WEEK`+`TIME_ROWS`)、`member/notifications` 頁與 mobile 通知頁(`NOTIF_CATS`)、`ContactDialog`/`ContactSheet`(`COACH_REPLIES`)、`ScheduleScreen` 與 mobile mine 頁(`WEEK`) |

最後一列是本次一併補登的**已失準列**:原文「member(活 re-export,`TIME_ROWS` 亦同)、mobile
(`WEEK`/`COACH_REPLIES` 活 re-export、`NOTIF_CATS` 純註記收窄、`TIME_ROWS` 不轉出)」自 C4 批1/批2
起兩側皆不成立。其中 mobile 的 `NOTIF_CATS` 原被記為「純註記收窄」,C4 重驗後判定為**假收窄**——
domain 端是顯式標註 `[string, string][]`,mobile 本地 `Tone = [string, string]` 與之結構恆等,
`export const NOTIF_CATS: Tone[] = NOTIF_CATS_BASE;` 沒有附加任何型別事實,屬第一形,故一併退役
(判定經 `npm run check` 對唯一消費檔改直取後零錯誤實測背書,非純推理)。`TIME_ROWS` 在 mobile 側
「不轉出」的死出口裁決不受影響——它從來就沒有 mobile 消費者。

## 增補(2026-08-03,架構深化 R10 E 案):報表呈現查表收進 `admin/report-math.ts`,並推翻該檔兩條舊紀錄

三類報表**呈現**素材自本日單源,住 `src/lib/admin/report-math.ts`:

1. **三序列色盤**——`COACH_PALETTE`/`VENUE_PALETTE`/`PAYMENT_PALETTE`(各 6 色的
   `readonly string[]`,消費端 `PALETTE[i % PALETTE.length]` 索引循環取色)。原本桌面
   `CoachPerf`/`VenueUsage`/`PaymentSplit` 三檔各一份本地 `PALETTE`,`ReportsScreen.svelte` 另有
   三份同名本地常數,共六份。
2. **兩張桶表升 `{label,color}` 複合形**——`AGE_BUCKET_LABEL`/`ATTENDANCE_BUCKET_LABEL` 由
   `Record<key, string>` 升為 `Record<key, {label, color}>`(值型別多行寫法比照同檔既有
   `REVENUE_SOURCE_LABEL`/`TIER_LABEL` 的複合形慣例),吸收桌面 `AgeDist`/`AttDist` 與
   `ReportsScreen` 各自逐字重抄的 `BUCKET_COLOR`。
3. **`REPORT_SCALES`**——5 面板 × `{desktop, mobile}` 的柱高/條寬像素值域(`as const`),取代
   10 個呼叫點各自硬編的同一組數字。

**住所為何是 `report-math.ts` 而不是 `$lib/domain`**:§1 的「顯示查表住 `$lib/domain` 各 entity 檔」
管的是**狀態/類型 → tone/label 的域語彙**——跨 surface、跨頁面、與後端 enum 對位。這三類不是域語彙,
是報表面板的呈現素材,消費者恰好只有桌面報表元件與 mobile-admin `ReportsScreen` 兩處,且與同檔的
逐面板 VM 算式屬同一個關切(色盤餵 donut/長條、尺度餵 `normalizeBars`)。`report-math.ts` 依
`docs/adr/0009` 本來就是跨 surface **直取**的純函式模組(不經任何 facade),把素材放在算式旁邊,
單源與取用路徑一次到位。

**判準:兩 surface 逐字同值即升格單源;單 surface 的呈現決策留呼叫端。** 留在呼叫端的兩例特別落字,
防未來審查誤判為漏收:`CategoryDonut` 的 `donutStops` **組裝**(色盤已單源,但把色餵成 conic 色標
是該面板的呈現決策)、`RevenueTrend` 的 peak 月強調色(`var(--df-primary-dark)` vs
`var(--df-primary)`——只有桌面有這個強調,行動版沒有,不是兩 surface 同值)。

**明文推翻 `report-math.ts` 內兩條舊檔內紀錄**(仿 `docs/adr/0014` §4 明文推翻本篇打卡「未抽
controller」紀錄的慣例,非靜默覆寫):

- 原「柱高/條寬的 maxScale 由呼叫端傳入……不在本檔硬編」——**參數是接口這件事不變**(桌面/行動
  用不同值域,本來就該由呼叫端決定傳哪一組,各 VM 的 `maxScale` 參數本身一字未動);被推翻的是
  「具體像素值各自硬編」這半句,值收進 `REPORT_SCALES`,呼叫端經其取值。
- 原「conic 色標(donutStops+色盤)屬呈現層,留在各 surface 呼叫端」——**組裝仍留呼叫端**;被推翻
  的是「色盤本身留呼叫端」,`PAYMENT_PALETTE` 已單源,呼叫端依索引循環取色餵給 `donutStops`。

**`revenueTrendVM` 改形**:回傳 `{total, max}` → `{total, heights}`,`max` 欄位退役,`heights`
內部改呼叫 `normalizeBars(rows.map(d => d.h), maxScale)`,與其餘四支面板 VM 同型。等價前提落字:
舊式是「`max` 保底 1 後 `(h/max)*160`」,`normalizeBars` 則是「`max <= 0` 才全 0」——兩者只在
`0 < max < 1` 這個區間分岔,而 rows 是**月營收(新台幣元)**,`0 < 月營收 < 1` 元在本域不可達;
全 0 兩式同為 0(不產生 NaN,有釘)。

像素與色值全程逐字保真:28 個色值 + 10 個 scale 值有逐鍵 `toEqual` pin,`charts.test.ts` 的四條
px 斷言與 `ReportsScreen.test.ts` 零改續綠。同批補上 `RevenueTrend.test.ts`——它是 14 個報表面板中
唯一沒有元件測試的一支(Task 15 復刻,不在 P4-F2 的 13 面板名單內),也是本輪唯一被改寫算式的面板。

## 增補(2026-08-10,架構深化 R11 C5+R1):`domain/class-detail.ts` 入列;`SlaTone` 退役註記校正

### 1. `src/lib/domain/class-detail.ts` — 課程詳情顯示派生單源(C5,commit `06bb6ff`)

新住戶,收的是課程詳情的兩件顯示知識:

- **`classDetailRows(k): [IconName, string, string][]`** —— 課程詳情的 **12 列** `[icon, 標籤, 值]`
  (星期時段、教練、教室、年齡、分類、期別、開課日、堂數、平均到課率、候補、補課、季費)。原本 admin 桌面
  `ClassDialog.svelte` 與 mobile-admin `ClassSheet.svelte` 各 inline 一份 byte-identical 雙生、兩份
  皆零測。
- **`classFill(enrolled, cap): { full, pct }`** —— 滿班判定 + 進度條百分比。原本四處各自重複
  (`ClassDialog`/`ClassSheet`/`ClassCard`/mobile-admin classes 頁)。

**唯一行為變更:`cap <= 0` 時 `pct` 由非有限值改為 0。** 舊式各呼叫點寫的是
`Math.round(enrolled / cap * 100)`,`cap === 0` 時得到 `Infinity`(或 `enrolled` 也為 0 時的 `NaN`)
並直接餵給 `ProgressBar`/`MiniBar` 的 `value`——既有缺陷,非本輪引入。`full` 一字未動(含
`cap === 0 → full === true` 這條「上限 0 視為已滿」的既有語意)。兩個對話框的 null 保真三元
(`k ? classFill(k.enrolled, k.cap) : { full: false, pct: 0 }`)是刻意的:未開態不可讓
`classFill(0, 0)` 的 `full === true` 洩進畫面。

**住所與歸類,落字防誤填**:本檔住 `$lib/domain`、消費端**直接 import 不經 facade**,沿的是
`docs/adr/0014` §1 把 `session-format.ts`(純顯示派生)搬進 `domain/` 的先例,不是 §1 開頭表格那個
「狀態/類型 → tone/label」家族的第七個 entity 檔——它不對位任何後端 enum、也不產出 `Tone`。下次
盤點顯示查表時請不要把它算進 venues/tickets/members/classes/course-level/sessions 那六張表的計數。
`ClassCard.svelte` 只遷 `classFill`,它自己那三列 meta rows 內容與詳情 12 列不同,**未收斂**。

### 2. §2「2026-07-20(R5 C2)退役註記」的末句已過時:`SlaTone` 自本日滅跡

§2 內那則引言註記寫著——

> `Conversation` 型別與 `SlaTone` 仍為活型別(真映射的型別消費者)。

——其中 **`SlaTone` 一詞自本日起不再成立**(R11 R1,commit `8a17ae5`)。SLA 是 mock 時代「緊急對話 /
回覆 SLA 倒數」的展示概念,後端從未提供對應欄位,`mapConversation()` 一直硬塞 `sla: ''` /
`slaTone: 'muted'`,UI 側因此渲染的是一顆恆空的 muted 時鐘 icon、一條恆為 falsy 的 banner 分支、
以及一個點了恆空清單的「緊急」tab。本輪把 `Conversation` 的 `urgent`/`sla`/`slaTone` 三欄與
`SlaTone` 型別本身連同全部 UI/filter/fixture 佐證一併移除,`SlaTone` 在倉內零殘留。

**`Conversation` 型別仍為活型別**(它是 `mapConversation()` 的回傳形狀),該註記的其餘部分——
`CONVERSATIONS` seed 已於 `coach/data.ts` 原位退役、歷史裁決原文不改寫——全部原樣有效。**本節只
校正「`SlaTone` 仍為活型別」這半句的現況,不改寫該註記原文。**

## 增補(2026-09-26,架構深化 R12):`TODAY_LABEL` 退役

§2 那句「`TODAY_LABEL`/`CONVERSATIONS` 仍是 `coach/api.ts` 消費」的 `CONVERSATIONS` 一半,已由 R5 C2
退役註記校正;另一半 `TODAY_LABEL` 自 R12 Task 1(`docs/adr/0022` §7)起同樣不再成立。

- 原型固定日期 `2026-05-30` 的 `TODAY_LABEL` 常數,已自 `coach/data.ts` 退役。
- `coach/api.ts` 的 `getDashboard`/`getToday` 改呼叫 `coach/schedule-dates.ts` 的 `todayLabel()`,
  以真實日期產生標籤。
- 同檔的 `PROTO_TODAY` 一併刪除;`weekDays`/`monthMatrix` 的 `todayRef` 預設改為 `new Date()`。

`coach/data.ts` 檔頭的消費者說明已同步改寫。`NOTIFS` 仍是 Topbar 直接消費的 mock seed,不受影響。

**同輪另一筆路徑校正**:本篇 §3「mobile 通知已讀落庫選型」描述的 `mobile/stores.ts` 的 `notifs` wrapper
(`notifsBase` + `notifsHydrated`)是 2026-07 當下的形狀。它先於 R9 C3 搬成葉模組
`src/lib/mobile/notifications.ts`(`docs/adr/0019`),再於 R12 併入 `src/lib/member/notifications.ts`
(`docs/adr/0022`)。

- 現況:mobile 經 `mobile/stores.ts` 轉出 member 的 `notifications`/`markRead`/`markAllRead`/
  `notificationsHydrated`。
- 所記的**行為**不變:已讀落庫、`markAllRead` 回傳 `Promise` 供頁面依結果選 toast。
- 該節歷史原文不改寫。

## 增補(2026-09-26,架構深化 R13):`MEMBER_STATUS` 退役;`SESSION_STATUS` 消費形校正;`toTodaySession` 與 `order-detail.ts` 入列

完整背景見 `docs/adr/0023`。本篇原文不改寫,以下各點以本節為準。

### 1. `MEMBER_STATUS`(出席率三態)退役

§1 現況表的 `MEMBER_STATUS` 一列,以及「測試守衛」節的同名異義守衛(斷言 `MEMBER_STATUS.active[1]`
不等於 `MEMBER_ACCOUNT_STATUS.active[1]`),自 R13 Task 1 起失去對象:

- 它唯一的 production 消費者是 `StatusBadge` 的 `'member'` case,而 `kind="member"` 全倉只有
  `MemberDialog` 的死分支傳入。三者同批退役(`docs/adr/0010` 增補)。
- `status-lookups.test.ts` 的三支 `MEMBER_STATUS` 測試(字面快照、同名異義守衛、鍵數 canary)一併刪除。
- `MEMBER_ACCOUNT_STATUS` 不受影響。`MemberStatus` 型別保留,仍替 mobile-admin 的 `MEMBERS_BASE`
  背書。同名異義的風險隨其中一方消失而消失。

### 2. `SESSION_STATUS` 三個消費端的承接形

R8 C4 增補與 `docs/adr/0018` §4 記的承接形,R13 Task 6 改了兩處:

- **admin**:`mapTodaySession` 改為 `toTodaySession(s, now)` 之後以 `SESSION_STATUS[t.state]` 取
  tone/label,不再直接呼叫 `deriveSessionStatus`。
- **mobile-admin**:`mapTodayClassToRow` 的輸入改收窄鍵 `TodayStatus`,直接索引 `SESSION_STATUS`;
  寬鍵 fallback `(… as Record<string, …>)[t.status] ?? ['neutral', '']` 退役,漏鍵變成編譯錯誤。
  `TodayRow` 另帶 `state`,首頁「上課中」橫幅改依 `state === 'live'` 判斷,不再比對 label 字面。
- **coach**:`data.ts` 的 `CLASS_STATUS` 合成 label 不變。`coach/api.ts` 對 `deriveSessionStatus`
  的活 re-export 失去消費者,退役;`mapTodayClass` 當時仍在本地呼叫它(R13 終審修波起改經
  `toTodaySession` 投影,見 `docs/adr/0023` 增補)。

### 3. `domain/sessions.ts` 新增 `toTodaySession`;`domain/order-detail.ts` 入列

- `toTodaySession(s: ApiTodaySession, now)` → `TodaySession`,是 `sessions.ts` 的第二支純函式,
  與 `deriveSessionStatus` 同居。它是投影,不是顯示查表,不影響「第六個 entity 檔」的計數。
- `src/lib/domain/order-detail.ts` 的 `orderDetailRows(o)` 是 `class-detail.ts`(R11 增補)的同類居民:
  桌面 `OrderDialog` 與 mobile-admin `OrderSheet` 原本各自內嵌的 13 列訂單明細(有退款原因時 14 列),
  以結構型別 `OrderDetailSource` 同時吃 `Order` 與 `OrderRow`。不對應後端 enum、不產出 `Tone`,
  不算第七個顯示查表。
