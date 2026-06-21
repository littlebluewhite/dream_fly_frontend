# Mock API 接縫(seam)— 設計 spec

- 日期:2026-06-21
- 狀態:設計已定案(brainstorming 多輪確認)→ 待 member pilot 實作
- 相關:`docs/architecture.md`、`docs/adr/0001`、`CONTEXT.md`

## 1. 背景與問題

後端尚未完成,但前端想「先假裝有後端」。目前狀態(見 `docs/architecture.md`):

- 沒有任何 SvelteKit `load` 函式(零個 `+page.ts` / `+page.server.ts`)。
- 資料是**同步的 module 常數**(`export const ME = {...}`、`STATS`、`CATALOG`…),元件**直接 `import`**。
- 有狀態的部分(cart / auth / 訂閱)由 `src/lib/member/stores.ts` + `localStorage` 包住。
- 型別定義(`Member`、`EnrolledCourse`、`CartItem`…)已完整 — 等於未來 API 的 schema 已寫好。

**隱形成本**:資料永遠「立刻就有」,所以 UI 幾乎沒有 loading / error 路徑。一旦接真後端(非同步),這些狀態逃不掉。

## 2. 目標(已選定)

**降低未來接真後端的成本**:在「元件 ↔ seed 資料」之間插一層 async 接縫,讓 `seed → fetch` 的切換**只動一層**,而非每個元件。

### 非目標(v1 明確不做)

- 網路層 mock(MSW)。
- 延遲 / 錯誤注入(但接縫旋鈕 `reply<T>()` 預留)。
- SvelteKit `load` / `+server.ts`(維持現有 SSR-free 模型,不碰 ADR 0001 的 hydration caveat)。
- member 以外的 surface(pilot 證明後才推廣)。

## 3. 做法:每個 surface 一個 `api.ts` 接縫

`src/lib/<surface>/api.ts` 匯出 async getter。**今天**回傳 `Promise.resolve(seed)`;**未來**回傳 `fetch(...)`。呼叫端 `await getX()` 永遠不變。

```ts
// src/lib/member/api.ts — 接縫本身
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE } from './data';
import type { Member, Stat, Skill, UpcomingClass, Announcement } from './data';

// 唯一一處未來可調「延遲 / 失敗注入」的旋鈕
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

export interface DashboardData {
  me: Member; stats: Stat[]; skills: Skill[]; upcoming: UpcomingClass[]; announce: Announcement[];
  nextClass: string; // banner「下一堂課」— 原 markup 硬編,移進接縫
  track: string;     // 技巧卡 track badge — 原 markup 硬編,移進接縫
}

export const getDashboard = (): Promise<DashboardData> =>
  reply({
    me: ME, stats: STATS, skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
    nextClass: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館', track: '競技啦啦隊'
  });
```

未來接真後端,**只改函式內容**,呼叫端不動:

```ts
export const getDashboard = (): Promise<DashboardData> =>
  fetch('/api/member/dashboard', { credentials: 'include' }).then((r) => r.json());
```

### 消費端兩條既有路徑(不新增 `load`)

- **已被 store 包住的資料**(cart / auth / 訂閱)→ 在 store 的 `init()` 裡 `await api`,元件幾乎不動。
- **目前直接 import 常數的資料**(`STATS`、`CATALOG`…)→ 元件在 `onMount` 裡 `await`,存進純 `let`(不用 runes;見 §5)。

## 4. 資料載入策略(逐 surface)— 判準:「伺服器那趟拿得到嗎?」

SSR 開啟時程式分兩趟:**伺服器趟**(Node,無 `window` / `localStorage` / 使用者身分)、**瀏覽器趟**(有)。判斷一份資料該用 `load` 還是 client 抓,只問一句:**伺服器那趟拿得到這份資料嗎?**

| Surface | 資料來源 | 伺服器趟拿得到? | 策略 |
| --- | --- | --- | --- |
| 公開行銷(`/courses`、`/coaches`、`/venues`) | 公開常數 | 是 | 未來可選 SvelteKit `+page.ts` load(SSR + SEO)— **本案範圍外** |
| 登入型 app(member / admin / coach) | localStorage / authed | 否 | client-side `api.ts` + `onMount` |

Pilot 在 **member(登入型)**→ client-side。理由:auth 與資料活在 localStorage(client-only),伺服器 `load` 看不到,給不了好處;而這恰好對齊「真後端 + auth」的最終樣子。

## 5. Pilot:會員儀表板

- **目標檔**:`src/routes/member/+page.svelte` — 純唯讀裸常數消費者(`ME, STATS, SKILLS, UPCOMING, ANNOUNCE`),無 store、無持久化、無 mutation = 教科書級 GET 案例。
- **新增**:`src/lib/member/api.ts`(`getDashboard()` 聚合)。
- **改頁面**:**legacy `onMount` + 純 `let`(不用 runes)**,三態閘門 `phase: 'loading' | 'error' | 'ready'`(同步 `onMount` + `.then/.catch`)。loading 顯示骨架(沿用 `Skeleton` / `SkelCard`,以**字面陣列**迭代確保 SSR 與首次 client 樹一致)、error 顯示 `ErrorState`(props `onRetry`)、ready 顯示真資料。對比現有 `LoadingGate.svelte` 的固定 650ms 假計時器,這裡由 promise 驅動。**`LoadingGate.svelte` 本身不動**。
  - **不用 runes 的理由**:本檔混用 legacy `on:click`;加任何 rune 會把元件切到 runes mode → `on:click` 跳 `event_directive_deprecated` → 污染 `npm run check`。已驗證房規模板 `src/routes/member/notifications/+page.svelte`。
  - banner「下一堂課」與技巧卡 track badge 也走 `data.nextClass` / `data.track`(進接縫,守住「換後端只改一檔」)。
  - **清單 keyed-each 一律用 index key**,不用顯示文字:真後端可能回同名項目(例:兩筆同名技巧),用名稱當 key 會擲 `each_key_duplicate`,且 `[name, value]` 無法在 `api.ts` 內修而不動呼叫端。(codex 對抗式 round 3 揪出。)

```ts
import { onMount } from 'svelte';
import { getDashboard, type DashboardData } from '$lib/member/api';

let phase: 'loading' | 'error' | 'ready' = 'loading';
let data: DashboardData | null = null;
function load() {
  phase = 'loading';
  getDashboard()
    .then((d) => { data = d; phase = 'ready'; })
    .catch(() => { phase = 'error'; });
}
onMount(load);
```

```svelte
{#if phase === 'ready' && data}
  <!-- data.me / data.stats / … / data.nextClass / data.track;清單以 index 當 key -->
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <!-- skeleton:Skeleton / SkelCard,字面陣列 -->
{/if}
```

### 測試

- `src/lib/member/api.test.ts`:`getDashboard()` resolves 回 seed、形狀符合型別(含 `nextClass` / `track`)。
- `src/routes/member/page.test.ts`(mock `$lib/member/api` 與 `$app/navigation`):
  - happy:初始 `queryByText` 為 null(microtask 未解析)→ `await findByText` 後出現真內容。
  - error:`mockRejectedValue` → `findByText('載入失敗')`(ErrorState 預設標題)。
  - 迴歸:同名技巧不崩潰(驗證清單用 index key,非顯示文字)。

### 驗證關卡(三綠)

```
npm run check && npm run test && npm run build
```

## 6. 未來遷移(真後端落地時)

兩條獨立的線 — **資料**與**憑證**分開看:

- **應用資料**:單一真實來源(source of truth)搬到**伺服器 DB**。`localStorage` 不消失,**降級**為:快取、UI 狀態(主題/語言)、未登入的訪客購物車(登入後合併到伺服器)。**不再當資料庫用**,而非「不能用」。
- **登入憑證**:多半從 `localStorage`(`dreamfly_auth`)改成 **`HttpOnly` cookie**。這同時是 **SSR / server-load 能認得使用者的前提**(cookie 隨請求自動上伺服器)。「Bearer 標頭(放 localStorage/記憶體)」vs「`HttpOnly` cookie」是**後端團隊的決定**,取捨在 XSS(localStorage 可被偷)vs CSRF(cookie 自動送,需 `SameSite` / CSRF token)。
- **接縫對這個決定無感**:cookie → `fetch(url, { credentials: 'include' })`;Bearer → 由 `api.ts` 附 `Authorization` 標頭。頁面 `await getDashboard()` 兩種都不用改。
- **逐 surface 重訪**:屆時公開行銷頁可採 `+page.ts` load(SSR + SEO);若團隊要 server-side authed SSR,可考慮把 SvelteKit 當 BFF 代理層。

## 7. 推廣(pilot 證明後)

逐 surface 重複:新增 `api.ts`,把 store-init / `$effect` 消費端接過去。`reply<T>()` 維持為唯一的延遲/錯誤旋鈕。

## 8. 待與後端團隊確認(未來)

- REST 形狀 / 端點命名 / 聚合 vs granular 粒度。
- 憑證機制(`HttpOnly` cookie vs Bearer 標頭)。
