<script lang="ts">
  /* 出席率分布 — faithful port of reports.jsx `AttDist`. Vertical bars (count atop,
   * height = count/maxC * 110px) inside a 168px track; each bar carries its own
   * colour. Flexible card beside the fixed RetentionTrend. */
  import { Card } from '$lib/components/ui';
  import { ATT_DIST } from '$lib/admin/data';

  $: maxC = Math.max(...ATT_DIST.map((d) => d.count));
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:6px;"
  >
    出席率分布
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">全館學員人數分布</div>
  <div style="display:flex; align-items:flex-end; gap:16px; height:168px;">
    {#each ATT_DIST as d}
      <div class="col">
        <span
          style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          {d.count}
        </span>
        <div class="bar" style="height:{(d.count / maxC) * 110}px; background:{d.color};"></div>
        <span style="font-size:11.5px; color:var(--df-text-light); text-align:center;">{d.label}</span>
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
  }
  .bar {
    width: 100%;
    max-width: 54px;
    border-radius: 6px 6px 0 0;
  }
</style>
