<script lang="ts">
  /* 年齡層分布 — faithful port of reports.jsx `AgeDist`. One block per age band:
   * dot + label · pct%, over a width-% bar (pct, in the band colour). Flexible
   * card beside the fixed TierDist. */
  import { Card } from '$lib/components/ui';
  import type { PctSlice } from '$lib/admin/data';

  export let rows: PctSlice[];
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:16px;"
  >
    年齡層分布
  </div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each rows as a}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="width:9px; height:9px; border-radius:5px; background:{a.color};"></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{a.label}</span>
          </span>
          <span style="font-size:13px; font-weight:700; color:var(--df-text-dark);">{a.pct}%</span>
        </div>
        <div class="track">
          <div style="height:100%; width:{a.pct}%; border-radius:4px; background:{a.color};"></div>
        </div>
      </div>
    {/each}
  </div>
</Card>

<style>
  .track {
    height: 8px;
    border-radius: 4px;
    background: #eef2f6;
    overflow: hidden;
  }
</style>
