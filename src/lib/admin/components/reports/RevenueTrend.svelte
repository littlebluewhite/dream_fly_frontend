<script lang="ts">
  /* 月營收趨勢 — faithful port of reports.jsx `RevenueTrend`. Flexbox column bars
   * (height = h/max * 160px) inside a 190px-tall track; the peak month renders in
   * primary-dark. Flexible card (flex:1) beside the fixed CategoryDonut. */
  import { Card } from '$lib/components/ui';
  import { REVENUE_TREND } from '$lib/admin/data';

  $: max = Math.max(...REVENUE_TREND.map((d) => d.h));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;">
    <div>
      <div
        style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
      >
        月營收趨勢
      </div>
      <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">單位:新台幣(仟元)</div>
    </div>
    <span style="font-size:13px; font-weight:700; color:var(--df-primary);">總計 NT$ 4.51M</span>
  </div>
  <div style="display:flex; align-items:flex-end; gap:8px; height:190px;">
    {#each REVENUE_TREND as d}
      <div class="col">
        <div
          class="bar"
          title={d.m}
          style="height:{(d.h / max) * 160}px; background:{d.peak
            ? 'var(--df-primary-dark)'
            : 'var(--df-primary)'};"
        ></div>
        <span style="font-size:11px; color:var(--df-text-light);">{d.m}</span>
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
    gap: 8px;
    justify-content: flex-end;
    height: 100%;
  }
  .bar {
    width: 100%;
    max-width: 26px;
    border-radius: 5px 5px 0 0;
    transition: height 0.4s ease;
  }
</style>
