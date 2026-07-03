<script lang="ts">
  /* 課程分類占比 — faithful port of reports.jsx `CategoryDonut`. A 150px
   * conic-gradient ring (cumulative stops via donutStops) with a 93px white hub
   * showing 142 總課程數, over a colour-dot legend of the `rows` prop. Fixed 360px
   * width (flex:none) so it sits beside the flexible RevenueTrend. */
  import { Card } from '$lib/components/ui';
  import type { PctSlice } from '$lib/admin/data';
  import { donutStops } from './donut';

  export let rows: PctSlice[];

  $: stops = donutStops(rows);
</script>

<Card padding={18} style="width:360px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:10px;"
  >
    課程分類占比
  </div>
  <div style="display:flex; justify-content:center; margin-bottom:14px;">
    <div class="ring" style="background:conic-gradient({stops});">
      <div class="hub">
        <div
          style="font-size:28px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;"
        >
          142
        </div>
        <div style="font-size:11px; color:var(--df-text-light); margin-top:3px;">總課程數</div>
      </div>
    </div>
  </div>
  <div style="display:flex; flex-direction:column; gap:9px;">
    {#each rows as c}
      <div style="display:flex; align-items:center; gap:9px;">
        <span style="width:10px; height:10px; border-radius:5px; background:{c.color}; flex:none;"></span>
        <span style="flex:1; font-size:13px; color:var(--df-text-dark);">{c.label}</span>
        <span style="font-size:13px; font-weight:700; color:var(--df-text-dark);">{c.pct}%</span>
      </div>
    {/each}
  </div>
</Card>

<style>
  .ring {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .hub {
    width: 93px;
    height: 93px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
