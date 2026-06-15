<script lang="ts">
  /* 報表分析 — faithful SvelteKit port of reports.jsx `ReportsView`. The shell wraps
   * /admin, so this renders page content only: a PageHead (period picker + 匯出報表),
   * the REPORT_KPIS 3-col grid, the full-width RevenueBreakdown, then the prototype's
   * paired panel rows (flex, gap 18, wrap) — each pairs one flexible chart with one
   * fixed-width chart exactly as ReportsView lays them out. Every chart is pure CSS. */
  import { Button, Icon } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import { REPORT_KPIS } from '$lib/admin/data';

  import ReportKpi from '$lib/admin/components/reports/ReportKpi.svelte';
  import RevenueBreakdown from '$lib/admin/components/reports/RevenueBreakdown.svelte';
  import RevenueTrend from '$lib/admin/components/reports/RevenueTrend.svelte';
  import CategoryDonut from '$lib/admin/components/reports/CategoryDonut.svelte';
  import TopCourses from '$lib/admin/components/reports/TopCourses.svelte';
  import IncomeSources from '$lib/admin/components/reports/IncomeSources.svelte';
  import CoachPerf from '$lib/admin/components/reports/CoachPerf.svelte';
  import VenueUsage from '$lib/admin/components/reports/VenueUsage.svelte';
  import AttDist from '$lib/admin/components/reports/AttDist.svelte';
  import RetentionTrend from '$lib/admin/components/reports/RetentionTrend.svelte';
  import AgeDist from '$lib/admin/components/reports/AgeDist.svelte';
  import TierDist from '$lib/admin/components/reports/TierDist.svelte';
  import CampusRevenue from '$lib/admin/components/reports/CampusRevenue.svelte';
  import PaymentSplit from '$lib/admin/components/reports/PaymentSplit.svelte';
  import ConversionFunnel from '$lib/admin/components/reports/ConversionFunnel.svelte';
  import WeekdayLoad from '$lib/admin/components/reports/WeekdayLoad.svelte';
</script>

<div style="display:flex; flex-direction:column; gap:20px;">
  <PageHead title="報表分析" sub="檢視營運數據、營收趨勢與課程分析報表">
    <svelte:fragment slot="actions">
      <button type="button" class="period">
        <Icon name="calendar" size={16} color="var(--df-text-light)" />2026 上半年<Icon
          name="chevron-down"
          size={14}
          color="var(--df-text-light)"
        />
      </button>
      <Button variant="primary" size="sm">
        <span style="display:inline-flex; align-items:center; gap:8px;">
          <Icon name="download" size={15} />匯出報表
        </span>
      </Button>
    </svelte:fragment>
  </PageHead>

  <div class="kpi-grid">
    {#each REPORT_KPIS as k}
      <ReportKpi {k} />
    {/each}
  </div>

  <RevenueBreakdown />

  <div class="panel-row">
    <RevenueTrend />
    <CategoryDonut />
  </div>
  <div class="panel-row">
    <TopCourses />
    <IncomeSources />
  </div>
  <div class="panel-row">
    <CoachPerf />
    <VenueUsage />
  </div>
  <div class="panel-row">
    <AttDist />
    <RetentionTrend />
  </div>
  <div class="panel-row">
    <AgeDist />
    <TierDist />
  </div>
  <div class="panel-row">
    <CampusRevenue />
    <PaymentSplit />
  </div>
  <div class="panel-row">
    <ConversionFunnel />
    <WeekdayLoad />
  </div>
</div>

<style>
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .panel-row {
    display: flex;
    gap: 18px;
    align-items: stretch;
    flex-wrap: wrap;
  }
  .period {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid var(--df-border);
    background: #fff;
    color: var(--df-text-dark);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--df-font-body);
  }
</style>
