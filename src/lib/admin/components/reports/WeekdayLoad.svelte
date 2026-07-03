<script lang="ts">
  /* 星期別課堂負載 — faithful port of reports.jsx `WeekdayLoad`. Vertical bars (rate%
   * label atop, height = classes/maxC * 104px) in a 158px track; the busiest day
   * (classes === maxC) renders in primary-dark. Fixed 380px beside ConversionFunnel. */
  import { Card } from '$lib/components/ui';
  import type { WeekdayLoad } from '$lib/admin/data';

  export let rows: WeekdayLoad[];

  $: maxC = Math.max(...rows.map((d) => d.classes));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:4px;"
  >
    星期別課堂負載
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    長條為課堂數 · 數字為平均出席率
  </div>
  <div style="display:flex; align-items:flex-end; gap:8px; height:158px;">
    {#each rows as d}
      <div class="col">
        <span style="font-size:11px; font-weight:700; color:var(--df-primary);">{d.rate}%</span>
        <div
          class="bar"
          style="height:{(d.classes / maxC) * 104}px; background:{d.classes === maxC
            ? 'var(--df-primary-dark)'
            : 'var(--df-primary)'};"
        ></div>
        <span style="font-size:11.5px; color:var(--df-text-light);">{d.d}</span>
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
