# Toast 整併:一個深 store + 三個薄 layout adapter

六個面原各自維護的 toast 通知(5 份 `createToasts` factory + 6 份 `ToastStack.svelte`),統併為一個**深 store**(`src/lib/stores/toasts.ts`)與三個**薄 layout adapter**(`src/lib/components/toast/` 下 desktop / mobile / public)。新增內容判重(dedup)、全域上限(cap=4)等統一行為,並修正 coach 計時器 drift。

## 背景與決定

Toast 通知散落六個面,各自建立 `createToasts` factory 與 `ToastStack` 元件:

- 後台、教練、會員三個 desktop surface:各自一份,計時 4000ms / 4200ms / 4000ms(計時不統一)。
- 行動版、行動管理:各自一份,計時 2800ms;無 dedup 或上限。
- Public 面:`toastStore.ts` + `Toast.svelte`,計時 3000ms。

各 factory 與各棧都相似但略異:無跨 surface 復用、無統一介面(member 的 `notify()` 無回傳 id)、無內容判重、無全域上限。

架構審查候選 #4 指出散落與重複;進一步探索後發現:

1. **`toastStore.ts` 原被誤判為孤兒**:初審時認為無人用,實為 public 面的活 store(已遷移至新深 store `src/lib/stores/toasts.ts` 的公開單例 `marketingToasts`)。
2. **五份散落的 factory 有充分復用潛力**:介面可統一(都只需 `notify(tone, title, body=''): number`);行為可統一(dedup 特徵、全域 cap、計時);layout 可細分為三層(desktop 淺色右下、mobile 深色置於底部 tab-bar 上方、public 浮動右上)。

選擇一個深 store + 三個薄 adapter:

- **深 store**(`src/lib/stores/toasts.ts`):
  - `createToasts(duration)` 回傳 `{ subscribe, notify, dismiss }`,內部閉包無 `this`。
  - `notify(tone, title, body='')`: 檢查 `(tone, title, body)` 是否已存在→若存在則重置計時器＋回傳舊 id(內容判重 dedup);若不存在則新增,超過上限 4 時 FIFO 踢最舊,回傳新 id。
  - 行為:自動過期(計時器),全域上限 4,內容判重。
  - 兩個公開單例:
    - `src/lib/stores/toasts.ts` 匯出 `createToasts`,後台／教練／會員各自呼叫 `createToasts(4000)`。
    - `src/lib/stores/marketingToasts.ts` = `createToasts(3000)`,供 public 面用。

- **薄 layout adapter** 三層:
  - `src/lib/components/toast/ToastStack.svelte`:桌面版(後台、教練、會員),淡色背景,右下角,4 個棧位。
  - `src/lib/components/toast/ToastStackMobile.svelte`:行動版(mobile、mobile-admin),深色背景,置於底部 tab-bar 上方,2800ms。
  - `src/lib/components/toast/ToastPublic.svelte`:公開面,頂右,飛進+進度條,3000ms。
  - 各 adapter 只選取並渲染 store 的當前棧,無業務邏輯。

介面統一:

- `notify(tone, title, body='')` → `number` (toast id),供頁面呼叫;member 原無 id 回傳改補。
- `ToastTone` 統一為 5-key superset:`success | info | warning | error | accent`(原各面有子集)。

計時器保留每面設定:後台 / 教練 / 會員 4000ms、行動版 / 行動管理 2800ms、public 3000ms;不硬編進 store,而由各面 `createToasts(duration)` 的引數決定。

## 後果(刻意,非 bug)

- **新增內容判重(dedup)**:同一 `(tone, title, body)` 組合若在棧中已存在,後續再 `notify()` 同組合時會重置計時器＋回傳舊 id,而非新增重複條目。這避免了「重複操作導致棧中重複通知」的冗餘。
- **全域上限 cap=4**:任一面的棧不會超過 4 條;超過時 FIFO 踢最舊。這是刻意的上限設計,避免棧爆炸。
- **Coach 計時器 4200ms → 4000ms**:原 `coach/stores.ts` 自承其 4200ms 計時源自「source-faithful」想法,與實際設計目標不符。整併時統一為 4000ms,與後台、會員一致。
- **Member notify 補回傳 id**:原 member 的 `notify()` 無 id 回傳;新介面統一回傳,用於後續 dismiss 或追蹤(已有若干程式碼預期此 id)。
- **公開 `toastStore.ts` 與 `Toast.svelte` 刪除**:原 public 面的孤兒式 store 已遷移至 `marketingToasts` 單例,`Toast.svelte` 元件改由 `ToastPublic.svelte` 統一 layout。
- **Duration 逐面保留,無硬編**:後台 / 教練 / 會員 4000ms、mobile / mobile-admin 2800ms、public 3000ms,各面各自 `createToasts(duration)` 決定,日後若需微調不必改 store。

## 已知後續

- **候選 #7 遺物:孤兒 store 清掃**:原計畫「清除所有孤兒 store」(候選 #7);整併後發現 `notificationsStore.ts` 非孤兒(用於 `Header.svelte` + `NotificationsDropdown.svelte`),不可刪。真正可刪的孤兒只剩 `cartStore.ts` 一份,列為日後任務。
- **SSR hydration 與持久化 store 初始化**:新 store 為無狀態(無持久化),不涉及 hydration 問題;但若未來需擴展為持久化(如「近期通知歷史」)時,應參考 ADR-0001 已知後續關於 load-at-init 的 SSR 風險。
- **Layout 細節(mobile-admin 2800ms)**:mobile-admin 面用 `ToastStackMobile`,計時 2800ms(與 mobile 同);若日後產品需求要求 mobile-admin 與後台 toast 同速(4000ms),可另案調整。
