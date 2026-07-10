<script lang="ts">
  /* 星期別出席負載 — restored from the archived reports.jsx port (689769a^, there
   * bars=課堂數 with a mock per-day 出席率 atop), re-plumbed for real data
   * (Round 4 P4-F2). `rows` is now GET /reports/admin's weekday_load (契約 §3.24:
   * 近 30 天已物化場次的 present 出席人次按星期分桶,0=週日;固定 7 桶零填) — the
   * only real metric is 人次, so both the bar and the number atop show
   * presentCount (the mock 出席率 had no per-day data source). Weekday labels via
   * WEEKDAY_LABEL (索引即 weekday 值); the busiest day keeps the primary-dark
   * highlight. Bar heights go through normalizeBars(counts, 104) — all-zero weeks
   * render zero-height bars (and no highlight), never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminWeekdayLoadRow } from '$lib/admin/api';
  import { WEEKDAY_LABEL, weekdayVM } from '$lib/admin/report-math';

  let { rows }: { rows: AdminWeekdayLoadRow[] } = $props();

  const vm = $derived(weekdayVM(rows, 104));
  const heights = $derived(vm.heights);
  const max = $derived(vm.max);
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:4px;"
  >
    星期別出席負載
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    近 30 天出席人次 · 依星期分桶
  </div>
  <div style="display:flex; align-items:flex-end; gap:8px; height:158px;">
    {#each rows as d, i (d.weekday)}
      <div class="col">
        <span style="font-size:11px; font-weight:700; color:var(--df-primary);">{d.presentCount}</span>
        <div
          class="bar"
          style="height:{heights[i]}px; background:{max > 0 && d.presentCount === max
            ? 'var(--df-primary-dark)'
            : 'var(--df-primary)'};"
        ></div>
        <span style="font-size:11.5px; color:var(--df-text-light);">{WEEKDAY_LABEL[d.weekday]}</span>
      </div>
    {/each}
  </div>
</Card>

<style>
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
  }
  .bar {
    width: 100%;
    max-width: 30px;
    border-radius: 5px 5px 0 0;
  }
</style>
