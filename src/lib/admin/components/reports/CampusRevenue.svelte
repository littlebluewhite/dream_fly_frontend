<script lang="ts">
  /* 分校別營收 — faithful port of reports.jsx `CampusRevenue`. One block per campus:
   * dot + name + students caption · mono amount, over a width-% bar (pct, in the
   * campus colour). Flexible card beside the fixed PaymentSplit. */
  import { Card } from '$lib/components/ui';
  import type { CampusRevenue } from '$lib/admin/data';

  export let rows: CampusRevenue[];
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      分校別營收
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">本月 · 含在學人數</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:15px;">
    {#each rows as c}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="width:9px; height:9px; border-radius:5px; background:{c.color};"></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{c.name}</span>
            <span style="font-size:11.5px; color:var(--df-text-muted);">{c.students} 位學員</span>
          </span>
          <span
            style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
          >
            {c.amount}
          </span>
        </div>
        <div class="track">
          <div style="height:100%; width:{c.pct}%; border-radius:4px; background:{c.color};"></div>
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
