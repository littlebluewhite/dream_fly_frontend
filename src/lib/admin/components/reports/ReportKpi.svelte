<script lang="ts">
  /* 報表分析 KPI card — faithful port of reports.jsx `ReportKpi` (tighter than the
   * dashboard StatCard: 44px icon chip, value 27px, delta pill is a rounded
   * success-tint chip with a trending-up arrow). Renders the whole REPORT_KPIS
   * grid is the page's job; this is one card driven by a single ReportKpi. */
  import { Card, Icon } from '$lib/components/ui';
  import type { ReportKpi } from '$lib/admin/data';

  export let k: ReportKpi;
</script>

<Card padding={0} style="overflow:hidden">
  <div style="padding:16px 18px; display:flex; flex-direction:column; gap:10px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div
        style="width:44px; height:44px; border-radius:10px; background:{k.tint}; display:flex; align-items:center; justify-content:center;"
      >
        <Icon name={k.icon} size={22} color={k.color} />
      </div>
      <span class="delta">
        <Icon name="trending-up" size={13} />{k.delta}
      </span>
    </div>
    <div
      style="font-family:var(--df-font-heading); font-size:27px; font-weight:800; color:var(--df-ink); letter-spacing:-0.5px;"
    >
      {k.value}
    </div>
    <div style="font-size:13px; color:var(--df-text-light); margin-top:-4px;">{k.label}</div>
  </div>
</Card>

<style>
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #10b9811a;
    color: var(--df-success-strong);
    font-size: 12px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
  }
</style>
