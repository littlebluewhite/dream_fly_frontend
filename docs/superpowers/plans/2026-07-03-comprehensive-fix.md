# 全面修復(接縫推廣 + domain 二階段 + 文件收斂)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 member pilot 驗證過的 mock API 接縫推廣到 admin/coach/mobile/mobile-admin 四個 surface(28 頁),抽取 member↔mobile 重複 seed 到 domain 單一來源,並把 `docs/architecture.md` 與 `README.md` 收斂到現況。

**Architecture:** 每 surface 一個 `src/lib/<surface>/api.ts` async 接縫(`reply<T>()` 唯一旋鈕),頁面走 legacy `onMount` 三態閘門(`loading|error|ready`);三態元件 hoist 到共用貨架 `$lib/components/ui`;seed 值依 `$lib/domain` 既有 facade 模式單一來源化。設計依據:`docs/superpowers/specs/2026-06-21-mock-api-seam-design.md`(§3 接縫形狀、§5 頁面模式與測試)。

**Tech Stack:** SvelteKit 2 + Svelte 5(頁面維持 legacy mode)+ TypeScript strict + Vitest 4 + Testing Library。

## Global Constraints

逐條照抄自 spec 與 repo 既有裁決;**每個任務隱含包含本節**:

- **繁體中文**(臺灣用語)— 所有 UI 文案、註解、commit 訊息;禁止簡體。domain 詞彙照 `CONTEXT.md`(報名/方案/訂閱/購物車/結帳/洽詢/候補),不用 Avoid 清單裡的同義詞。
- **頁面一律 legacy Svelte(不用 runes)**:全 repo 路由頁皆 legacy mode(`let` + `$:` + `on:click`);加任何 rune 會把元件切到 runes mode → `on:click` 跳 `event_directive_deprecated` 污染 `npm run check`。消費接縫用 `onMount` + 純 `let` 三態(spec §5)。
- **`reply<T>()` 是唯一的延遲/失敗注入旋鈕**:每個 `api.ts` 頂部 `const reply = <T>(value: T): Promise<T> => Promise.resolve(value);`,所有 getter 經過它。
- **實體集合與資料型硬編字串走接縫;色調/標籤查表與 helper 留直接 import**(member 前例:`CATALOG` 進接縫、`LEVEL_TONE` 留下)。資料型硬編字串 = 日期、數字、人名、課名等未來後端會回的顯示值(如 member 的 `nextClass`);純 UI 文案(按鈕、標題)不動。
- **keyed each 一律用 index key**,不用顯示文字(同名項目會擲 `each_key_duplicate`;spec §5)。
- **三個 fetch-readiness 守衛**(member pilot 修過的 3 類 bug,逐頁自查):
  1. **空集合守衛**:選取預設項用 `d.items[0]?.id ?? null`,空集合走 `ready` + EmptyState,不是丟進 `.catch`(commit 1332e4a)。
  2. **stale 回應守衛**:凡 fetch 結果會寫進「共享 store」的頁面,加 `alive` 旗標(`onDestroy` 清除),`load()`/`refresh()` 寫入前檢查(commit a3181df)。純本地 `let` 的頁面不需要。
  3. **retry 不被 hydration 守衛短路**:hydration 守衛存在時,ErrorState 的 `onRetry` 必須走 always-refetch 的 `refresh()`,不能走會被守衛短路的 `load()`(commit e0f7678)。
- **單一來源 = no behaviour change**:facade 公開 API(匯出名與型別)逐字不變;**只抽取 member↔mobile 深度相等(JSON deep-equal)的常數**;`domain/members.ts` 的王承恩 `points: 420` 與 member/mobile `ME.points: 1250` 的矛盾**不碰**(產品決策,僅在 PR 描述記錄)。
- **新 facade 依 `src/lib/admin/facade-type-exports.test.ts` 前例補 type-export 回歸守衛**(型別契約只有 `npm run check` 會抓,vitest 不會)。
- **vitest 4 陷阱**:`beforeEach` 一律 block body(箭頭隱式回傳 mock 會被 v4 當 cleanup 呼叫);帶 `transition:`/`fly`/`fade` 的元件測試要補 `element.animate` stub(參考 `src/lib/stores/ToastPublic.test.ts`);清單測試 fixture 不依賴顯示文字唯一性。
- **`npm run check` 才權威**:新建檔的 LSP diagnostics 常陳舊(svelte-kit sync 前掃的假錯),以 check 輸出裁決。
- **驗證關卡(每任務收尾)**:`npm run check && npm run test`;動到路由/樣式/建置面再加 `npm run build`。全計畫完成後三項全跑(三綠)。
- **commit 訊息**照 repo 慣例(`feat(scope): …` / `refactor(scope): …`),結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- **staff surface 明確排除**:無 `staff/data.ts`,`staff/login` 是登入表單 + 角色門戶(pre-auth UI,不該 await authed API),其 `COACH` 跨 surface import 不動(有 `staff/login/page.test.ts` 鎖 `李教練`)。
- **公開行銷頁明確排除**(spec §4:未來走 `+page.ts` load,本案範圍外)。

---

### Task 1: domain member-app seed 抽取(member↔mobile 單一來源)

**Files:**
- Create: `src/lib/domain/member-app.ts`
- Create: `src/lib/domain/member-app.test.ts`
- Modify: `src/lib/member/data.ts`(改為消費 domain,公開 API 不變)
- Modify: `src/lib/mobile/data.ts`(同上)
- Create: `src/lib/mobile/data.test.ts`(mobile 目前零 data 層測試;補 facade 等值守衛)

**Interfaces:**
- Consumes: 現有 `src/lib/member/data.ts` 與 `src/lib/mobile/data.ts` 的字面常數;`src/lib/admin/data.ts:28-70` 的消費前例(pass-through re-export + base import + 本地衍生)。
- Produces: `$lib/domain/member-app` 匯出共用 seed 常數(名稱沿用 member 側,如 `ME`、`CATALOG`…);`$lib/member/data` 與 `$lib/mobile/data` 的**匯出面逐字不變**(後續 Task 3–6 依賴此穩定性)。

**背景(給實作者):** member 與 mobile 是同一個「會員 app」的桌面/手機雙生,`data.ts` 近乎重複(同 persona 王承恩 GY2024001)。候選常數:`ME, STATS, SKILLS, UPCOMING, MY_COURSES, ATT_HISTORY, CATALOG, SCHEDULE, ANNOUNCE, ORDERS, MAKEUP_SLOTS, CONTACT_THREAD, NOTIFS_SEED, POINTS_LEDGER, REWARDS, REPORTS, CERTS`。member 獨有(`COACH_REPLIES`、`SUBS_SEED`、checkout helpers、`LEVEL_TONE` 等查表)與 mobile 獨有(`fmtNT`、`WEEK`、`NOTIF_*` 查表、tuple `Tone`)留在原 facade。**兩側 `Tone` 型別不相容(union vs tuple),查表/型別一律不入 domain。**

- [ ] **Step 1: 逐常數比對 member vs mobile 的深度相等性**

寫一個臨時 Node 腳本(不進版控)或直接在 vitest 裡比對:對候選清單逐一 `JSON.stringify(memberX) === JSON.stringify(mobileX)`。輸出兩份清單:**相等(抽取)** 與 **有差異(留在原地、記入報告)**。若某常數僅型別註記不同、值相等,仍可抽取(domain 存值,facade 以自己的型別 re-export/斷言)。

- [ ] **Step 2: 先寫 domain/member-app.test.ts(紅)**

比照 `src/lib/domain` 既有 `data.test.ts` 風格:斷言 `member-app` 匯出的每個常數與 member 側現值 deep-equal(用字面快照或直接 import member/data 比對均可,擇既有慣例)。

- [ ] **Step 3: 建 `src/lib/domain/member-app.ts`(綠)**

檔頭註解:「會員 app(member 桌面 / mobile 手機雙生)共用 seed 單一來源。值逐位元組沿用 member 側;僅收值相等的常數,查表與型別留在各 facade。」把 Step 1 判定相等的常數**原封搬入**(含既有行內註解),並匯出對應 interface(`Member`、`CatalogCourse` 等基礎型別若兩側同形,一併上移;若不同形,domain 用結構型別、facade 各自斷言)。

- [ ] **Step 4: member/data.ts 改消費(公開 API 不變)**

照 `admin/data.ts` 模式:值相等者 `export { X, type TX } from '$lib/domain/member-app';`,原字面刪除;留下的獨有常數不動。檔頭補 tombstone 註解說明單一來源位置。

- [ ] **Step 5: mobile/data.ts 改消費(公開 API 不變)**

同 Step 4。mobile 的型別若與 domain 同形不同名(如 `MyCourse`),維持 `export type MyCourse = …` 別名不變。

- [ ] **Step 6: 補 `src/lib/mobile/data.test.ts`**

斷言 mobile facade 匯出與 `$lib/domain/member-app` 同源常數 `toBe`(同 reference)或 `toEqual`(依 facade 是否轉制),並比照 `admin/facade-type-exports.test.ts` 前例添加 type-export 守衛(`import type` 可指派性檢查)。

- [ ] **Step 7: 驗證關卡**

Run: `npm run check && npm run test`
Expected: check 0 errors;既有 member/mobile 頁面測試全綠(值未變,故必綠;若有紅 = 抽取了不相等的常數,回 Step 1 修正)。

- [ ] **Step 8: Commit**

```bash
git add src/lib/domain/member-app.ts src/lib/domain/member-app.test.ts src/lib/member/data.ts src/lib/mobile/data.ts src/lib/mobile/data.test.ts
git commit -m "feat(domain): single-source member-app seed (member↔mobile 雙生去重)"
```

---

### Task 2: hoist 三態元件到共用貨架 + df-shimmer 全域化

**Files:**
- Create: `src/lib/components/ui/ErrorState.svelte`、`Skeleton.svelte`、`SkelCard.svelte`、`EmptyState.svelte`(自 `src/lib/member/components/` 平移)
- Modify: `src/lib/components/ui/index.ts`(barrel 加 4 個匯出)
- Modify: `src/lib/styles/global.css`(加 `@keyframes df-shimmer`)
- Modify: `src/lib/member/member.css:23`(刪本地 `@keyframes df-shimmer`)
- Modify: `src/lib/styles/mobile-frame.css:152`(刪本地 `@keyframes df-shimmer`)
- Delete: `src/lib/member/components/ErrorState.svelte`、`Skeleton.svelte`、`SkelCard.svelte`、`EmptyState.svelte`
- Modify: member 頁面中所有 `$lib/member/components/{ErrorState,Skeleton,SkelCard,EmptyState}` import(grep 全量改到 `$lib/components/ui`)

**Interfaces:**
- Consumes: 現有 4 個元件原始碼(全 `--df-*` token、僅依賴 `$lib/components/ui` 的 Icon/Button — 已確認 surface 中立)。
- Produces: `import { ErrorState, Skeleton, SkelCard, EmptyState } from '$lib/components/ui'` — Task 3–6 所有頁面轉換依賴這個匯入面;`ErrorState` props 契約:`title='載入失敗'`、`body='連線發生問題，無法取得最新資料，請稍後再試。'`、`onRetry: (() => void) | null`。

- [ ] **Step 1: 平移 4 個元件檔(內容原封不動)到 `src/lib/components/ui/`,並在 barrel `index.ts` 末尾加:**

```ts
// ── 非同步三態(loading / error / empty)狀態元件 — 自 member pilot hoist ──
export { default as ErrorState } from './ErrorState.svelte';
export { default as Skeleton } from './Skeleton.svelte';
export { default as SkelCard } from './SkelCard.svelte';
export { default as EmptyState } from './EmptyState.svelte';
```

(ErrorState 內部的 `$lib/components/ui/Icon.svelte` 相對層級 import 改為 `./Icon.svelte`。)

- [ ] **Step 2: keyframes 全域化**

`global.css` 末尾加(逐字自 member.css 搬):

```css
/* 骨架 shimmer — Skeleton.svelte(共用貨架)依賴;單一定義,勿在 surface css 重複 */
@keyframes df-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
```

> 注意:先讀 `member.css:23` 與 `mobile-frame.css:152` 確認兩份定義一致再搬;若不一致以 member 側為準並在報告註明。搬完刪除兩處本地定義。

- [ ] **Step 3: 改 member 呼叫端 import**

`grep -rln "member/components/ErrorState\|member/components/Skeleton\|member/components/SkelCard\|member/components/EmptyState" src/` 逐檔把單檔 import 改為 barrel:`import { ErrorState, Skeleton, SkelCard, EmptyState } from '$lib/components/ui';`(僅該頁有用到的名字)。刪 `src/lib/member/components/` 的 4 個原檔。

- [ ] **Step 4: 驗證關卡**

Run: `npm run check && npm run test && npm run build`
Expected: 三綠;member 各頁測試不變綠(元件行為零變更)。手動 sanity:`grep -rn 'df-shimmer' src` 應只剩 global.css 定義 + Skeleton 使用處。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ui): hoist 三態元件(ErrorState/Skeleton/SkelCard/EmptyState)到共用貨架 + df-shimmer 全域化"
```

---

### Task 3: admin surface 接縫(api.ts + 6 頁)

**Files:**
- Create: `src/lib/admin/api.ts`、`src/lib/admin/api.test.ts`
- Modify: `src/routes/admin/{tickets,classes,coaches,venues,orders,reports}/+page.svelte`
- Modify(既有): `src/routes/admin/{tickets,venues,orders,reports}/page.test.ts`(happy path 補 mock)
- Create: `src/routes/admin/{classes,coaches}/page.test.ts`(原本沒有;至少涵蓋三態)

**Interfaces:**
- Consumes: `$lib/admin/data` 既有匯出(`TICKETS, CLASSES, COACHES, VENUES, ORDERS, REPORT_KPIS` + 型別);Task 2 的 `$lib/components/ui` 三態元件。
- Produces: `src/lib/admin/api.ts` 匯出如下(Task 内自足,後續任務不依賴):

```ts
/* 管理後台 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { TICKETS, CLASSES, COACHES, VENUES, ORDERS, REPORT_KPIS } from './data';
import type { Ticket, ClassRow, Coach, Venue, Order } from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 教練清單單一內部存取點;未來 fetch 只改此處。 */
const coaches = (): Coach[] => COACHES;

export interface TicketsData { tickets: Ticket[] }
export const getTickets = (): Promise<TicketsData> => reply({ tickets: TICKETS });

export interface ClassesData { classes: ClassRow[]; coaches: Coach[] }
export const getClasses = (): Promise<ClassesData> => reply({ classes: CLASSES, coaches: coaches() });

export interface CoachesData { coaches: Coach[] }
export const getCoaches = (): Promise<CoachesData> => reply({ coaches: coaches() });

export interface VenuesData { venues: Venue[] }
export const getVenues = (): Promise<VenuesData> => reply({ venues: VENUES });

export interface OrdersData { orders: Order[] }
export const getOrders = (): Promise<OrdersData> => reply({ orders: ORDERS });

export interface ReportsData { kpis: typeof REPORT_KPIS }
export const getReports = (): Promise<ReportsData> => reply({ kpis: REPORT_KPIS });
```

(`kpis` 若 `data.ts` 有具名型別就用具名型別,不用 `typeof`。**實作時逐頁檢查元件樹**:若 admin/reports 的圖表元件、classes 的對話框元件等有「自己直接 import data.ts 實體集合」的,把該集合納入該頁 getter 並以 props 下傳,在報告列出;查表/tone 不算。)

**頁面轉換模式(每頁相同;以 venues 為例,其餘 5 頁照表套用):**

- [ ] **Step 1(每頁): page.test.ts 先行(紅)**

新測試檔照這個模板(既有測試檔則:頂部加 `vi.mock`,`beforeEach` block body 裡 `mockReset` + `mockResolvedValue(seed 聚合)`,既有案例的同步 `getByText` 改 `await findByText` 等 ready 後斷言):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { VENUES } from '$lib/admin/data';
import { getVenues } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getVenues: vi.fn() }));

beforeEach(() => {
  vi.mocked(getVenues).mockReset();
  vi.mocked(getVenues).mockResolvedValue({ venues: VENUES });
});

describe('場館管理 — 三態', () => {
  it('happy:ready 後渲染第一筆場館', async () => {
    const { findByText } = render(Page);
    await findByText(VENUES[0].name);
  });
  it('error:顯示「載入失敗」', async () => {
    vi.mocked(getVenues).mockReset();
    vi.mocked(getVenues).mockRejectedValue(new Error('network'));
    const { findByText } = render(Page);
    await findByText('載入失敗');
  });
  it('loading:顯示骨架', () => {
    vi.mocked(getVenues).mockReset();
    vi.mocked(getVenues).mockReturnValue(new Promise(() => {}));
    const { getByTestId } = render(Page);
    expect(getByTestId('venues-skeleton')).toBeTruthy();
  });
});
```

- [ ] **Step 2(每頁): api.test.ts 加該 getter 案例(紅→綠)**

照 `src/lib/member/api.test.ts` 風格:`await getVenues()` `toEqual({ venues: VENUES })` 且回傳 `toBeInstanceOf(Promise)`。

- [ ] **Step 3(每頁): 轉換頁面(綠)**

script 區:

```ts
import { onMount } from 'svelte';
import { getVenues, type VenuesData } from '$lib/admin/api';
// 三態元件自共用貨架
import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';

let phase: 'loading' | 'error' | 'ready' = 'loading';
let data: VenuesData | null = null;

function load() {
  phase = 'loading';
  getVenues()
    .then((d) => { data = d; phase = 'ready'; })
    .catch(() => { phase = 'error'; });
}
onMount(load);
```

- 原 `let venues: Venue[] = VENUES` 這類「複製到本地 let 供編輯」的頁(venues 有新增/編輯),改成 ready 時初始化:`.then((d) => { venues = d.venues; phase = 'ready'; })` — 本地可變 `let` 維持頁內編輯行為。
- 既有 `$:` 衍生(filter/search)改為以 `data`(或本地 let)為源,`data ? … : []` 守空。
- 模板包三態:`{#if phase === 'ready' && data}` 原內容 `{:else if phase === 'error'}` `<Card padding={0}><ErrorState onRetry={load} /></Card>` `{:else}` 骨架(`SkelCard` + 數個 `Skeleton`,外層 `data-testid="venues-skeleton"`;骨架用**字面陣列**迭代)。
- keyed each 檢查:該頁清單 key 若用顯示文字,改 index。
- 資料型硬編字串檢查:頁內日期/數字/人名字面(如 KPI 數字)→ 進該頁 getter payload;UI 文案不動。
- 空集合守衛:若頁面有 `xs[0].y` 或預設選取,改 `xs[0]?.y ?? fallback` + `EmptyState`。
- admin 頁皆為「本地 let / $: 」消費(無共享 store 寫入)→ 不需 alive 旗標;`onRetry={load}` 即可(無 hydration 守衛)。

- [ ] **Step 4(每頁): 驗證 + commit**

Run: `npx vitest run src/routes/admin/venues/page.test.ts src/lib/admin/api.test.ts && npm run check`
Expected: PASS / 0 errors。

```bash
git add src/lib/admin/api.ts src/lib/admin/api.test.ts src/routes/admin/venues/
git commit -m "feat(admin): route venues page through getVenues seam"
```

**六頁套用表:**

| 頁 | getter | payload | 特別注意 |
|---|---|---|---|
| venues | `getVenues` | `{ venues }` | 本地 let 可變(新增/編輯);既有 page.test.ts 補 mock |
| tickets | `getTickets` | `{ tickets }` | `TICKET_TYPES` 查表留直接 import;既有 page.test.ts 補 mock |
| orders | `getOrders` | `{ orders }` | 既有 page.test.ts 補 mock |
| reports | `getReports` | `{ kpis }` | **檢查圖表元件樹**是否直接 import 報表資料集(`CATEGORY_SPLIT` 等)— 有則納入 payload 下傳 |
| classes | `getClasses` | `{ classes, coaches }` | `CATS` 查表留直接;`let classes = CLASSES` 改 ready 初始化;新建 page.test.ts |
| coaches | `getCoaches` | `{ coaches }` | 新建 page.test.ts |

- [ ] **Step 5(任務收尾): 全量驗證**

Run: `npm run check && npm run test`
Expected: 全綠(六頁 + api 測試全部通過,無其他 surface 回歸)。

---

### Task 4: coach surface 接縫(api.ts + 7 頁)

**Files:**
- Create: `src/lib/coach/api.ts`、`src/lib/coach/api.test.ts`
- Modify: `src/routes/coach/{+page.svelte,today,attendance,schedule,messages,students,settings}`(7 個 `+page.svelte`)
- Modify(既有): `src/routes/coach/{attendance,messages}/page.test.ts`
- Create: `src/routes/coach/{index 用 page.test.ts,today,schedule,students,settings}` 缺的 page.test.ts(至少三態;index 的檔名為 `src/routes/coach/page.test.ts`)

**Interfaces:**
- Consumes: `$lib/coach/data` 匯出;Task 2 三態元件。
- Produces: `src/lib/coach/api.ts`:

```ts
/* 教練工作台 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { COACH, TODAY_LABEL, TODAY_CLASSES, CONVERSATIONS, ATT_TODAY_CLASSES, SCHED_COURSES, STUDENTS, MSG_DIRECTORY, THREAD, SHARED_FILES } from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 「登入教練本人」與「今日課表」單一內部存取點;index 與 today 兩頁共用。 */
const me = () => COACH;
const todayClasses = () => TODAY_CLASSES;

export interface CoachDashboardData { coach: typeof COACH; todayLabel: string; todayClasses: typeof TODAY_CLASSES; conversations: typeof CONVERSATIONS }
export const getDashboard = (): Promise<CoachDashboardData> =>
  reply({ coach: me(), todayLabel: TODAY_LABEL, todayClasses: todayClasses(), conversations: CONVERSATIONS });

export interface TodayData { todayLabel: string; todayClasses: typeof TODAY_CLASSES }
export const getToday = (): Promise<TodayData> => reply({ todayLabel: TODAY_LABEL, todayClasses: todayClasses() });

export interface AttendanceData { classes: typeof ATT_TODAY_CLASSES }
export const getAttendance = (): Promise<AttendanceData> => reply({ classes: ATT_TODAY_CLASSES });

export interface CoachScheduleData { courses: typeof SCHED_COURSES }
export const getSchedule = (): Promise<CoachScheduleData> => reply({ courses: SCHED_COURSES });

export interface MessagesData { conversations: typeof CONVERSATIONS; directory: typeof MSG_DIRECTORY; thread: typeof THREAD; sharedFiles: typeof SHARED_FILES }
export const getMessages = (): Promise<MessagesData> =>
  reply({ conversations: CONVERSATIONS, directory: MSG_DIRECTORY, thread: THREAD, sharedFiles: SHARED_FILES });

export interface StudentsData { students: typeof STUDENTS }
export const getStudents = (): Promise<StudentsData> => reply({ students: STUDENTS });

export interface CoachSettingsData { coach: typeof COACH }
export const getSettings = (): Promise<CoachSettingsData> => reply({ coach: me() });
```

(`typeof X` 佔位:data.ts 有具名型別(`AttRow`、`Conversation` 等)一律用具名型別。)

**七頁套用表(轉換模式與 Task 3 Step 1–4 完全相同,測試模板同):**

| 頁 | getter | 特別注意 |
|---|---|---|
| `+page.svelte`(index) | `getDashboard` | `TODAY_LABEL` 是資料型字串(日期標籤)→ 已進 payload;KPI 數字若硬編也進 payload |
| today | `getToday` | `CLASS_STATUS` 查表留直接;頁內 `reminders` 字面陣列是 UI 提示文案,留在頁內 |
| attendance | `getAttendance` | 既有 page.test.ts 補 mock;`attendance-tally.ts` util 不動;檢查元件樹是否直接 import `ATT_CLASS`/`ATT_ROSTER`(有則納入 payload) |
| schedule | `getSchedule` | `CAT_COLOR` 查表留直接;`schedule-grid/dates` util 不動 |
| messages | `getMessages` | 既有 page.test.ts 補 mock;thread 選取用 `conversations[0]?.id ?? null` 空守衛 |
| students | `getStudents` | `LEVEL_TINT` 查表留直接 |
| settings | `getSettings` | 表單初值自 `data.coach` 帶入(ready 後初始化本地 let) |

- coach 頁皆無共享 store 寫入 → 不需 alive 旗標;`onRetry={load}`。
- staff/login 的 `import { COACH } from '$lib/coach/data'` **不動**(Global Constraints)。

- [ ] **每頁:test 先行(紅)→ api getter(綠)→ 轉頁(綠)→ `npx vitest run <該頁與 api 測試> && npm run check` → commit(`feat(coach): route <page> page through <getter> seam`)**
- [ ] **任務收尾:`npm run check && npm run test` 全綠**

---

### Task 5: mobile surface 接縫(api.ts + 5 頁,含 notifs store 化)

**Files:**
- Create: `src/lib/mobile/api.ts`、`src/lib/mobile/api.test.ts`
- Modify: `src/lib/mobile/stores.ts`(notifs store 改 api 水合,見下)+ `src/lib/mobile/stores.test.ts`
- Modify: `src/routes/mobile/{+page.svelte,courses,mine,account,notifications}`(5 個 `+page.svelte`)
- Modify(既有): `src/routes/mobile/courses/page.test.ts`
- Create: 其餘 4 頁的 page.test.ts(index 為 `src/routes/mobile/page.test.ts`)

**Interfaces:**
- Consumes: `$lib/mobile/data`(Task 1 之後部分 re-export 自 domain — 匯出面不變,照常 import);member notifications 模板:`src/routes/member/notifications/+page.svelte` + `src/lib/member/stores.ts` 的 notifications 水合(**先讀這兩檔再動 notifs**)。
- Produces: `src/lib/mobile/api.ts`:

```ts
/* 會員 app(手機)mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { CATALOG, ANNOUNCE, MY_COURSES, SCHEDULE, ORDERS, NOTIFS_SEED } from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

const myCourses = () => MY_COURSES;

export interface MobileHomeData { catalog: typeof CATALOG; announce: typeof ANNOUNCE; myCourses: typeof MY_COURSES }
export const getHome = (): Promise<MobileHomeData> => reply({ catalog: CATALOG, announce: ANNOUNCE, myCourses: myCourses() });

export interface MobileCoursesData { catalog: typeof CATALOG }
export const getCourses = (): Promise<MobileCoursesData> => reply({ catalog: CATALOG });

export interface MineData { courses: typeof MY_COURSES; schedule: typeof SCHEDULE }
export const getMine = (): Promise<MineData> => reply({ courses: myCourses(), schedule: SCHEDULE });

export interface MobileAccountData { orders: typeof ORDERS }
export const getAccount = (): Promise<MobileAccountData> => reply({ orders: ORDERS });

/** 通知 feed(store-getter,非包物件)。與 stores.ts 同源、同樣 clone。 */
export const getNotifications = () => reply(NOTIFS_SEED.map((n) => ({ ...n })));
```

**notifs store 化(本任務核心風險點 — 三守衛全用上):**

- `src/lib/mobile/stores.ts` 現況:`notifs` writable 以 `NOTIFS_SEED` 同步 seed,`unread` 衍生,`markRead/markAllRead` mutation。改法照 member notifications 前例:store 起始空陣列 + `hydrated` 守衛;`notifications/+page.svelte` 在 `onMount` 走 `load()`(守衛短路用)與 `refresh()`(always refetch,`onRetry` 用它);寫回 store 前檢查 `alive`(`onDestroy` 清除);`markRead` 等 mutation 不動。**badge(`unread`)在其他頁面/TabBar 也讀** — 水合前 unread 顯示 0 是可接受的初始態(member 前例相同)。
- `stores.test.ts` 對應更新;`notifications/page.test.ts` 補三態 + 兩個回歸:(1) unmount 後 resolve 不覆寫 store(照 `src/routes/member/notifications/page.test.ts` 既有案例形狀);(2) refresh 失敗後 retry 會真的 refetch。

**五頁套用表(其餘同 Task 3 模式):**

| 頁 | getter | 特別注意 |
|---|---|---|
| `+page.svelte`(index) | `getHome` | 首頁 KPI/banner 資料型硬編字串進 payload;`cart`/`overlay` store 互動不動 |
| courses | `getCourses` | 既有 page.test.ts 補 mock(有 cart/overlay 互動案例 — 改 `await find*` 等 ready) |
| mine | `getMine` | `WEEK` 查表留直接;`type MyCourse` 照舊自 data import |
| account | `getAccount` | 個資區塊若硬編(姓名/電話)→ 進 payload(比照 member `getAccount` 的 `profile`) |
| notifications | `getNotifications`(store-getter) | 三守衛;`NOTIF_CATS/NOTIF_TONE_*` 查表留直接 |

- mobile 頁面在 phone-frame 樣式內,骨架直接用共用 `Skeleton`(`df-shimmer` 已全域化);EmptyState/MEmpty:通知空清單沿用既有 `MEmpty`,不新造。
- [ ] **每頁:test 先行 → getter → 轉頁 → 驗證 → commit(`feat(mobile): route <page> page through <getter> seam`);notifs store 化獨立 commit(`feat(mobile): hydrate notifs store through getNotifications seam`)**
- [ ] **任務收尾:`npm run check && npm run test` 全綠**

---

### Task 6: mobile-admin surface 接縫(api.ts + 10 頁,store-seeded 模式)

**Files:**
- Create: `src/lib/mobile-admin/api.ts`、`src/lib/mobile-admin/api.test.ts`
- Modify: `src/lib/mobile-admin/stores.ts`(集合 store 改 api 水合)+ `src/lib/mobile-admin/stores.test.ts`
- Modify: `src/routes/mobile-admin/admin/{+page.svelte,classes,members,more,orders}` 與 `src/routes/mobile-admin/coach/{+page.svelte,attendance,csettings,messages,students}`(10 個 `+page.svelte`)
- Create/Modify: 各頁 page.test.ts(現況多數沒有;每頁至少三態)

**Interfaces:**
- Consumes: `$lib/mobile-admin/data`;`src/lib/mobile-admin/stores.ts:13` 現有「data → writable store」seeding;member notifications 水合模板。
- Produces: `src/lib/mobile-admin/api.ts`(getter 對頁,store 集合走水合 getter):

```ts
/* 行動管理端 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { PROFILES, MEMBERS, TODAY, ACTIVITY, COACHES, VENUES, TICKETS, COACH_TODAY, ROSTER, SKILLS, CLASSES, ORDERS } from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

export interface MAdminHomeData { profiles: typeof PROFILES; members: typeof MEMBERS; today: typeof TODAY; activity: typeof ACTIVITY }
export const getAdminHome = (): Promise<MAdminHomeData> => reply({ profiles: PROFILES, members: MEMBERS, today: TODAY, activity: ACTIVITY });

export interface MoreData { profiles: typeof PROFILES; coaches: typeof COACHES; venues: typeof VENUES; tickets: typeof TICKETS }
export const getMore = (): Promise<MoreData> => reply({ profiles: PROFILES, coaches: COACHES, venues: VENUES, tickets: TICKETS });

export interface MCoachHomeData { coachToday: typeof COACH_TODAY; profiles: typeof PROFILES }
export const getCoachHome = (): Promise<MCoachHomeData> => reply({ coachToday: COACH_TODAY, profiles: PROFILES });

export interface RosterData { roster: typeof ROSTER }
export const getRoster = (): Promise<RosterData> => reply({ roster: ROSTER });

export interface MStudentsData { members: typeof MEMBERS; skills: typeof SKILLS }
export const getStudents = (): Promise<MStudentsData> => reply({ members: MEMBERS, skills: SKILLS });

export interface CsettingsData { profiles: typeof PROFILES; coaches: typeof COACHES }
export const getCsettings = (): Promise<CsettingsData> => reply({ profiles: PROFILES, coaches: COACHES });

/** 集合 store 水合(clone,防共享參照被 mutation 污染)。 */
export interface OpsCollections { members: typeof MEMBERS; classes: typeof CLASSES; coaches: typeof COACHES; orders: typeof ORDERS }
export const getOpsCollections = (): Promise<OpsCollections> =>
  reply({
    members: MEMBERS.map((m) => ({ ...m })),
    classes: CLASSES.map((c) => ({ ...c })),
    coaches: COACHES.map((c) => ({ ...c })),
    orders: ORDERS.map((o) => ({ ...o }))
  });
```

(getter 名/payload 以**實作時逐頁核對的實際用量**為準 — 上面是以 import 清單推定的起點;差異記入報告。)

**store 水合改造:** `stores.ts` 的集合 writable(`orders`、`members`、`classes`、`coaches` 等)改為空起始 + `hydrateOps()`(內部呼叫 `getOpsCollections()`,`hydrated` 守衛防重複,供 `refresh` 用的 always-refetch 版本)。消費 store 的頁(classes/members/orders)在 `onMount` 觸發水合並以三態呈現;**overlay 的新增/編輯 mutation 行為不變**(水合守衛保證使用者改動不被第二次進頁覆寫)。alive 旗標:凡頁面把 fetch 結果寫入共享 store 的路徑都要。

**十頁套用表(模式同前;測試模板同 Task 3):**

| 頁 | 資料來源 | getter |
|---|---|---|
| admin/(index) | 直接 import | `getAdminHome` |
| admin/classes | `$classes` store | `hydrateOps` + 三態(`STATUS_TONE` 留直接) |
| admin/members | `$members` store | `hydrateOps` + 三態(`PAY_STATUS` 留直接) |
| admin/orders | `$orders` store | `hydrateOps` + 三態(`ORDER_STATUS`/`fmtNT` 留直接) |
| admin/more | 直接 import | `getMore` |
| coach/(index) | 直接 import | `getCoachHome` |
| coach/attendance | 直接 import | `getRoster` |
| coach/messages | store(`coachNotifs`?) | 實作時核對:type-only import 的頁,資料源若是 store → 併入水合;若字面在頁內 → 進 getter |
| coach/students | 直接 import | `getStudents` |
| coach/csettings | 直接 import | `getCsettings` |

- [ ] **每頁:test 先行 → getter/水合 → 轉頁 → 驗證 → commit;stores 水合改造獨立 commit(`feat(mobile-admin): hydrate ops collection stores through getOpsCollections seam`)**
- [ ] **任務收尾:`npm run check && npm run test` 全綠**

---

### Task 7: 更新 docs/architecture.md

**Files:**
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: 現況程式碼(Task 1–6 完成後);`docs/adr/0005-toast-consolidation.md`;`git log --oneline -60` 的重構脈絡。
- Produces: 權威架構文件與現況一致(CLAUDE.md 宣告它 authoritative)。

- [ ] **Step 1: 修過期敘述**

`docs/architecture.md:31` 現況寫 `toastStore`/`notificationsStore` 屬 public surface — 已過期(toast 整併於 ADR 0005:canonical deep store `src/lib/stores/toast*` + desktop/mobile/public 三 adapter;legacy `toastStore` 已刪)。逐段核對 `lib/stores/` 貨架描述與現況檔案。

- [ ] **Step 2: 補缺漏章節(各 2–6 句,維持該文件現有密度與語氣)**

1. `src/lib/domain/` 單一來源層:ops seed(venues/tickets/coaches/activity/reports + `*_BASE`)+ Task 1 的 `member-app.ts`;facade 消費模式(pass-through re-export / base 衍生);`facade-type-exports` 型別守衛慣例。
2. `src/lib/components/mobile/` 共用行動元件貨架(Sheet/TabBar/ScreenHeader 等 hoist 後現況)與 `src/lib/components/ui` 的三態元件(Task 2)。
3. mock API 接縫:每 surface `api.ts`、`reply<T>()` 旋鈕、三態閘門慣例、涵蓋範圍(member + admin + coach + mobile + mobile-admin;public/staff 排除及理由)— 引用 spec 路徑。

- [ ] **Step 3: 驗證**

文件內每個提到的路徑/符號逐一 `ls`/grep 存在性(禁止寫入不存在的檔名);`npm run check` 照跑(文件不影響,但確保 repo 乾淨)。

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(architecture): 收斂到現況 — domain 層/共用貨架/toast 整併/api 接縫覆蓋"
```

---

### Task 8: 重寫 README.md

**Files:**
- Modify: `README.md`(整檔重寫)

**Interfaces:**
- Consumes: `CLAUDE.md`(專案定位)、`CONTEXT.md`(domain 詞彙)、`docs/architecture.md`(Task 7 之後)、`package.json` scripts。
- Produces: 與現況一致的 README(取代 init 時的羽球行銷 scaffold)。

- [ ] **Step 1: 重寫內容,章節:**

1. 標題:Dream Fly(夢飛)— 體操與競技啦啦學苑前端。
2. 一段話定位:SvelteKit 2 + Svelte 5 + TS strict;**無真後端**(seed + localStorage,結帳為模擬)。
3. 快速開始:`npm install`(每次 fresh checkout 必跑;lockfile 不進版控)→ `npm run dev`。
4. 指令表:dev / build / preview / check / test(+ 單檔、-t 用法)。
5. 架構一覽(3–5 句):七大 surface、`src/lib` 佈局、mock API 接縫、domain 單一來源 — 連到 `docs/architecture.md`、`CONTEXT.md`、`docs/adr/`。
6. 驗證關卡:`npm run check && npm run test`(+ build 時機)。

全文臺灣繁體;不虛構不存在的功能(禁寫 CI、部署、授權條款等 repo 沒有的東西)。

- [ ] **Step 2: 驗證**

README 裡每個指令實際跑過一次(`npm run check` 等);每個提及路徑存在。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): 重寫 — 取代過期羽球 scaffold,對齊現況"
```

---

## 明確排除(不做,附理由)

- **staff surface 接縫**:無 data.ts;login 是 pre-auth UI。
- **公開行銷頁接縫**:spec §4 判定未來走 `+page.ts` load(SSR + SEO),本案範圍外。
- **coach/data.ts 入 domain**:persona 與名冊和 domain 無映射(李志偉/12 學生/陳怡君均不在 domain),強行合併 = 行為變更。
- **王承恩 points 420 vs 1250 矛盾**:admin 檢視與會員 app 檢視數字不一致是預存產品資料問題,不在「no behaviour change」修復內;記入 PR 描述。
- **fmtNT/format.ts 散置**(admin/member/mobile/mobile-admin 各一份):候選後續清理,本案不動(避免與接縫改動疊加)。
- **adapter 選定、後端 REST/憑證確認、知識圖譜 /understand --full**:非程式碼修復;PR 描述列為後續。
