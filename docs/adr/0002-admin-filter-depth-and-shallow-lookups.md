# admin-filter-depth-and-shallow-lookups 管理端過濾器深度與淺層查找模組

架構審查候選 #5(「filter modules false-confidence gap」)經對抗式 grilling 後,否決了兩項提案變更。本 ADR 記錄這兩個決定,避免未來的 `/improve-codebase-architecture` 再次提出相同候選。

## 背景與決定

**1. `filterMembers` / `filterClasses` / `filterOrders` 維持 2-arg interface。**
compact 預覽列數上限(`COMPACT_PREVIEW_LIMIT`,定義於 `MembersTable.svelte` 第 29 行)是*展示*邏輯:它在 `.svelte` 內兩處使用——compact 的 `out.slice(0, COMPACT_PREVIEW_LIMIT)` 與 `PanelHead` 標籤 `最近活躍 ${COMPACT_PREVIEW_LIMIT} 位`;此次變更即把這兩處原本重複的字面 `6` DRY 成單一 const。曾考慮將其作為第三個 `limit?` 參數推入 filter,但被拒絕:這會將展示關切洩漏進 domain filter interface,並打破三個同級 module(`members-filter.ts`、`classes-filter.ts`、`orders-filter.ts`)一致的 2-arg 對稱性。上限屬於 `.svelte`、不屬於 filter、不屬於 store、也不屬於 page prop。

**2. `coach-status.ts` 與 `mobile-admin/components/tone.ts` 刻意維持 shallow,不做 inline。**
兩者各是一個小型查找 module。但每個都有對應的 regression test:前者由 `coach-status.test.ts` 覆蓋(4 個 case,逐一驗 `coachStatus('online'|'busy'|'offline')` 的標籤與 CSS token),後者由 `MiniBar.test.ts` 覆蓋(pinning `toneColor('primary') → var(--df-primary)`,修復了 codex P2 bug:bare `primary` 被當作無效 CSS 背景值而渲染成透明)。Inline 這兩個 module 會刪除對一個已知 bug 的覆蓋。Shallow-but-tested 優於 inlined-and-untested;這與「把 one-liner inline 掉」的直覺判斷相反。

## 後果(刻意,非 bug)

- **覆蓋現況須精確說明。** `members-filter.test.ts` 對純函數 `filterMembers` 做了扎實覆蓋(status / query / sort,以及各 advanced field — course / pay / attMin / attMax 與代表性組合;非窮舉所有組合)。`MembersTable.test.ts` characterize 了 `...(compact ? {} : $memberFilter)` spread(兩個分支)與 compact 欄/列渲染,並在此次變更中新增了 compact 列數上限(`slice(0, COMPACT_PREVIEW_LIMIT)`)及標籤(`最近活躍 6 位`)的 pin test。**尚未被 characterize 的**是 `MembersTable.svelte` 的 `$: visible` 區塊(第 55–63 行)中的 call-site wiring:測試從未驅動 `search` store、未點擊非 `all` 的狀態 tab、也未點擊排序表頭——`$search`、`status: tab`、`sort` 的 UI plumbing 仍未在 component 層級被 characterize。
- `coach-status.ts` 與 `tone.ts` 維持 shallow module 形式;呼叫端若日後需要組合,直接 import 即可,無需任何包裝。

## 已知後續

`MembersTable.svelte` 的 `$search` / `status: tab` / `sort` call-site wiring 目前僅間接受 `members-filter.test.ts` 的純函數測試保護——它驗證了 `filterMembers` 能處理這些 input,但 `.svelte` 中把 store 值餵進去的薄層 plumbing 是 low-risk pass-through,此處刻意不 characterize。關閉此缺口需要 component-interaction 測試(對抗式 grilling 的「option 2」),顯式延後處理——且這**不是**加深 filter module 的理由:加深 filter 無論如何都無法 characterize UI plumbing。
