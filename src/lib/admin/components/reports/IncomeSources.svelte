<script lang="ts">
  /* 收入來源分析 — faithful port of reports.jsx `IncomeSources`. One block per
   * source: dot + label · mono amount, a width-% bar (pct, filled in the source
   * colour), then a "{pct}% 占比" caption. Fixed 380px beside flexible TopCourses. */
  import { Card } from '$lib/components/ui';
  import { INCOME_SOURCES } from '$lib/admin/data';
</script>

<Card padding={18} style="width:380px; flex:none;">
  <div
    style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); margin-bottom:16px;"
  >
    收入來源分析
  </div>
  <div style="display:flex; flex-direction:column; gap:14px;">
    {#each INCOME_SOURCES as s}
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="display:flex; align-items:center; gap:8px;">
            <span style="width:9px; height:9px; border-radius:5px; background:{s.color};"></span>
            <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">{s.label}</span>
          </span>
          <span
            style="font-size:13px; font-weight:700; color:var(--df-text-dark); font-family:var(--df-font-mono);"
          >
            {s.amount}
          </span>
        </div>
        <div class="track">
          <div style="height:100%; width:{s.pct}%; border-radius:4px; background:{s.color};"></div>
        </div>
        <div style="font-size:11px; color:var(--df-text-light); margin-top:4px;">{s.pct}% 占比</div>
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
