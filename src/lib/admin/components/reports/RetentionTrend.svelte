<script lang="ts">
  /* 新生 vs 回訪 — restored from the archived reports.jsx port (689769a^, there
   * titled 新生 vs 續報 over mock 報名人數), re-plumbed for real data (Round 4
   * P4-F2). `rows` is now GET /reports/admin's retention (契約 §3.24: 近 6 studio
   * 月出席 cohort — 該月 ≥1 present 即活躍;new=首次活躍月、returning=此後再活躍;
   * rate=|上月∩本月|/|上月|,上月空 → null) — the copy says 出席活躍, not 報名/
   * 續報, to match that 口徑. The header rate is the LAST bucket's rate via fmtPct
   * (null → 「—」; the archived 88.4% was hardcoded). Stack heights go through
   * normalizeBars(totals, 116) and the inner split guards total=0 — all-zero
   * months render zero-height stacks, never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminRetentionRow } from '$lib/admin/api';
  import { fmtPct } from '$lib/admin/format';
  import { retentionVM } from '$lib/admin/report-math';

  let { rows }: { rows: AdminRetentionRow[] } = $props();

  const vm = $derived(retentionVM(rows, 116));
  const heights = $derived(vm.heights);
  const lastRate = $derived(vm.lastRate);
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
    <div>
      <div
        style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
      >
        新生 vs 回訪
      </div>
      <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">
        近 6 個月 · 出席活躍會員數
      </div>
    </div>
    <span style="font-size:13px; font-weight:700; color:#0EA5E9;">留存 {fmtPct(lastRate)}</span>
  </div>
  <div style="display:flex; align-items:flex-end; gap:12px; height:150px;">
    {#each rows as d, i (d.month)}
      {@const total = d.newCount + d.returningCount}
      <div class="col">
        <div class="stack" style="height:{heights[i]}px;">
          <div
            style="height:{total > 0 ? (d.newCount / total) * 100 : 0}%; background:var(--df-accent);"
          ></div>
          <div style="flex:1; background:var(--df-primary);"></div>
        </div>
        <span style="font-size:10px; color:var(--df-text-light);">{d.month}</span>
      </div>
    {/each}
  </div>
  <div style="display:flex; gap:18px; margin-top:14px; font-size:12px; color:var(--df-text-light);">
    <span style="display:flex; align-items:center; gap:6px;">
      <span style="width:10px; height:10px; border-radius:3px; background:var(--df-accent);"></span>新生(首次活躍)
    </span>
    <span style="display:flex; align-items:center; gap:6px;">
      <span style="width:10px; height:10px; border-radius:3px; background:var(--df-primary);"></span>回訪學員
    </span>
  </div>
</Card>

<style>
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
  }
  .stack {
    width: 100%;
    max-width: 30px;
    border-radius: 5px 5px 0 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
