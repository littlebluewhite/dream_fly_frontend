<script lang="ts">
  /* 體驗 → 報名 轉換漏斗 — faithful port of reports.jsx `ConversionFunnel`. One row per
   * stage: label · mono count 人 · pct%, plus a per-step 轉化 % (this pct ÷ the
   * previous stage's pct) for every stage after the first. Below each is a 24px
   * track with a width-% fill in the stage colour. Flexible card beside WeekdayLoad. */
  import { Card } from '$lib/components/ui';
  import type { FunnelStage } from '$lib/admin/data';

  export let rows: FunnelStage[];
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      體驗 → 報名 轉換漏斗
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">本季</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:11px;">
    {#each rows as f, i}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{f.label}</span>
          <span style="font-size:12.5px; color:var(--df-text-light);">
            <b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{f.count}</b> 人 · {f.pct}%{#if i > 0}<span
                style="color:var(--df-text-muted);"
              >
                · 轉化 {Math.round((f.pct / rows[i - 1].pct) * 100)}%</span
              >{/if}
          </span>
        </div>
        <div class="track">
          <div style="height:100%; width:{f.pct}%; border-radius:7px; background:{f.color};"></div>
        </div>
      </div>
    {/each}
  </div>
</Card>

<style>
  .track {
    height: 24px;
    border-radius: 7px;
    background: #eef2f6;
    overflow: hidden;
  }
</style>
