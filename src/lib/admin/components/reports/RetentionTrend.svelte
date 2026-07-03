<script lang="ts">
  /* 新生 vs 續報 — faithful port of reports.jsx `RetentionTrend`. STACKED bars: each
   * month's column is (nu+re)/maxR * 116px tall, split into an accent (新生) top
   * segment sized nu/(nu+re) and a primary (續報) fill below. A two-item legend
   * follows. Fixed 380px beside the flexible AttDist. */
  import { Card } from '$lib/components/ui';
  import type { RetentionBar } from '$lib/admin/data';

  export let rows: RetentionBar[];

  $: maxR = Math.max(...rows.map((d) => d.nu + d.re));
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
    <div>
      <div
        style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
      >
        新生 vs 續報
      </div>
      <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">近 6 個月 · 報名人數</div>
    </div>
    <span style="font-size:13px; font-weight:700; color:#0EA5E9;">留存 88.4%</span>
  </div>
  <div style="display:flex; align-items:flex-end; gap:12px; height:150px;">
    {#each rows as d}
      <div class="col">
        <div class="stack" style="height:{((d.nu + d.re) / maxR) * 116}px;">
          <div style="height:{(d.nu / (d.nu + d.re)) * 100}%; background:var(--df-accent);"></div>
          <div style="flex:1; background:var(--df-primary);"></div>
        </div>
        <span style="font-size:11px; color:var(--df-text-light);">{d.m}</span>
      </div>
    {/each}
  </div>
  <div style="display:flex; gap:18px; margin-top:14px; font-size:12px; color:var(--df-text-light);">
    <span style="display:flex; align-items:center; gap:6px;">
      <span style="width:10px; height:10px; border-radius:3px; background:var(--df-accent);"></span>新生學員
    </span>
    <span style="display:flex; align-items:center; gap:6px;">
      <span style="width:10px; height:10px; border-radius:3px; background:var(--df-primary);"></span>續報學員
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
