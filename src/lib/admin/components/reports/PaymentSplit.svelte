<script lang="ts">
  /* 付款方式占比 — faithful port of reports.jsx `PaymentSplit`. A 120px
   * conic-gradient donut (cumulative stops, 72px hub showing 種管道 count) sitting
   * to the LEFT of the PAYMENT_SPLIT legend (row layout, gap 20). Fixed 380px. */
  import { Card } from '$lib/components/ui';
  import type { PctSlice } from '$lib/admin/data';
  import { donutStops } from './donut';

  export let rows: PctSlice[];

  $: stops = donutStops(rows);
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:14px;"
  >
    付款方式占比
  </div>
  <div style="display:flex; align-items:center; gap:20px;">
    <div class="ring" style="background:conic-gradient({stops});">
      <div class="hub">
        <div
          style="font-size:22px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;"
        >
          {rows.length}
        </div>
        <div style="font-size:10.5px; color:var(--df-text-light); margin-top:2px;">種管道</div>
      </div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column; gap:9px;">
      {#each rows as p}
        <div style="display:flex; align-items:center; gap:8px;">
          <span
            style="width:10px; height:10px; border-radius:5px; background:{p.color}; flex:none;"
          ></span>
          <span style="flex:1; font-size:12.5px; color:var(--df-text-dark);">{p.label}</span>
          <span style="font-size:12.5px; font-weight:700; color:var(--df-text-dark);">{p.pct}%</span>
        </div>
      {/each}
    </div>
  </div>
</Card>

<style>
  .ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hub {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
</style>
