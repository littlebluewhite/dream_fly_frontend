<script lang="ts">
  /* 報表分析 — faithful SvelteKit port of reports.jsx `ReportsView`. The shell wraps
   * /admin, so this renders page content only: a PageHead (period picker + 匯出報表),
   * the KPI 3-col grid, the full-width RevenueBreakdown, then the prototype's
   * paired panel rows (flex, gap 18, wrap) — each pairs one flexible chart with one
   * fixed-width chart exactly as ReportsView lays them out. Every chart is pure CSS.
   *
   * Data arrives async via getReports() (mock-API seam): onMount loads the KPI band
   * AND every chart dataset into a three-state gate (loading/error/ready). The 15
   * charts take their datasets as REQUIRED props from this payload — no chart reads
   * seed data itself, so swapping the mock for a real backend touches api.ts only. */
  import { onMount } from 'svelte';
  import { Button, Icon, Select, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import { toasts } from '$lib/admin/stores';
  import { REPORT_PERIODS, DEFAULT_PERIOD, kpisForPeriod } from '$lib/admin/components/reports-period';
  import { getReports, type ReportsData } from '$lib/admin/api';

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

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: ReportsData | null = null;

  function load() {
    phase = 'loading';
    getReports()
      .then((d) => { data = d; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  // The period picker re-scales ONLY the KPI band (kpisForPeriod); the 15 charts
  // render their payload datasets as-is (the prototype's period control never
  // touched the charts either).
  let period = DEFAULT_PERIOD;
  $: kpis = data ? kpisForPeriod(data.kpis, period) : [];
</script>

{#if phase === 'ready' && data}
  <div style="display:flex; flex-direction:column; gap:20px;">
    <PageHead title="報表分析" sub="檢視營運數據、營收趨勢與課程分析報表">
      <svelte:fragment slot="actions">
        <div class="period-select">
          <Select bind:value={period} options={REPORT_PERIODS} />
        </div>
        <Button
          variant="primary"
          size="sm"
          on:click={() => toasts.notify('info', '匯出報表', '報表將以 PDF 寄送至您的信箱。')}
        >
          <span style="display:inline-flex; align-items:center; gap:8px;">
            <Icon name="download" size={15} />匯出報表
          </span>
        </Button>
      </svelte:fragment>
    </PageHead>

    <div class="kpi-grid">
      {#each kpis as k, i (i)}
        <ReportKpi {k} />
      {/each}
    </div>

    <RevenueBreakdown rows={data.revenueBreakdown} total={data.revenueTotal} />

    <div class="panel-row">
      <RevenueTrend rows={data.revenueTrend} />
      <CategoryDonut rows={data.categorySplit} />
    </div>
    <div class="panel-row">
      <TopCourses rows={data.topCourses} />
      <IncomeSources rows={data.incomeSources} />
    </div>
    <div class="panel-row">
      <CoachPerf rows={data.coachPerf} />
      <VenueUsage rows={data.venueUsage} />
    </div>
    <div class="panel-row">
      <AttDist rows={data.attDist} />
      <RetentionTrend rows={data.retention} />
    </div>
    <div class="panel-row">
      <AgeDist rows={data.ageDist} />
      <TierDist rows={data.tierDist} />
    </div>
    <div class="panel-row">
      <CampusRevenue rows={data.campusRevenue} />
      <PaymentSplit rows={data.paymentSplit} />
    </div>
    <div class="panel-row">
      <ConversionFunnel rows={data.funnel} />
      <WeekdayLoad rows={data.weekdayLoad} />
    </div>
  </div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div style="display:flex; flex-direction:column; gap:20px;" data-testid="reports-skeleton">
    <Skeleton w={220} h={32} r={8} />
    <div class="kpi-grid">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={200} r={12} /></SkelCard>
  </div>
{/if}

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
  /* keep the period Select compact inside the PageHead actions row */
  .period-select {
    min-width: 150px;
  }
  .period-select :global(.control) {
    height: 38px;
  }
</style>
