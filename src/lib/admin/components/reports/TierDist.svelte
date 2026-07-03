<script lang="ts">
  /* 會員分級分布 — faithful port of reports.jsx `TierDist`. Vertical bars (count atop,
   * height = count/maxC * 100px) in a 158px track, each its own colour. Fixed 380px
   * beside the flexible AgeDist. */
  import { Card } from '$lib/components/ui';
  import type { CountBar } from '$lib/admin/data';

  export let rows: CountBar[];

  $: maxC = Math.max(...rows.map((d) => d.count));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:4px;"
  >
    會員分級分布
  </div>
  <div style="font-size:12px; color:var(--df-text-light); margin-bottom:16px;">
    依累積點數分級 · 學員人數
  </div>
  <div style="display:flex; align-items:flex-end; gap:16px; height:158px;">
    {#each rows as d}
      <div class="col">
        <span
          style="font-size:16px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
        >
          {d.count}
        </span>
        <div class="bar" style="height:{(d.count / maxC) * 100}px; background:{d.color};"></div>
        <span style="font-size:12px; color:var(--df-text-light);">{d.label}</span>
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
    max-width: 48px;
    border-radius: 6px 6px 0 0;
  }
</style>
