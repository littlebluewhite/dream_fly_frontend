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

| 查表 | 域檔 | 消費 facade |
| --- | --- | --- |
| `MEMBER_STATUS`(出席率三態) | `domain/members.ts` | admin(活 re-export) |
| `MEMBER_ACCOUNT_STATUS`(帳號啟用二態) | `domain/members.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `VENUE_STATUS` | `domain/venues.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `TICKET_TYPE` | `domain/tickets.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `STATUS_TONE`(課程招生狀態) | `domain/classes.ts` | admin(活 re-export)、mobile-admin(re-assert) |
| `LEVEL_TONE`(5 級課程分級) | `domain/course-level.ts` | admin(活 re-export),mobile-admin/member/mobile(皆純註記 re-assert,各自收窄回自身型別),`CourseCard.svelte`(公開行銷頁,直接展開) |
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
