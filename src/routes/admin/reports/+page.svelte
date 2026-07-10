<script lang="ts">
  /* 報表分析 — SvelteKit port of reports.jsx `ReportsView`, re-scoped in Task 15 to
   * real data and re-expanded in Round 4 P4-F2. The shell wraps /admin, so this
   * renders page content only: a PageHead (匯出報表), a 6-card KPI band (本月營收/
   * 新會員/新報名/訂單數/出席率/留存率 — 環比 delta 由 report-math 的 deltaPct()
   * 前端算,null → 卡上「—」), then the 13 chart panels restored from the archived
   * prototype (689769a^) re-plumbed onto GET /reports/admin 的真實彙總 sections
   * (P4-F1 擴充的 ReportsData;契約 §3.24), and finally the two honest tables
   * (courses/coaches). CampusRevenue(單一場館無分校維度)與 period picker 依裁決
   * 不還原;topCourses 由 topCoursesFrom(courses) 純函式推導,不是後端欄位。
   *
   * Data arrives async via getReports() — ONE call feeds the KPI band and every
   * panel — into a three-state gate (loading/error/ready). */
  import { onMount } from 'svelte';
  import { Button, Icon, Card, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import { toasts } from '$lib/admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getReports, type ReportsData } from '$lib/admin/api';
  import { fmtNT, fmtPct } from '$lib/admin/format';
  import { deltaPct, topCoursesFrom } from '$lib/admin/report-math';

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
  import PaymentSplit from '$lib/admin/components/reports/PaymentSplit.svelte';
  import ConversionFunnel from '$lib/admin/components/reports/ConversionFunnel.svelte';
  import WeekdayLoad from '$lib/admin/components/reports/WeekdayLoad.svelte';

  let data: ReportsData | null = null;

  const gate = createLoadGate({
    fetch: getReports,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });
</script>

<LoadGate {gate}>
  <div style="display:flex; flex-direction:column; gap:20px;" data-testid="reports-skeleton" slot="loading">
    <Skeleton w={220} h={32} r={8} />
    <div class="kpi-grid">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}
        <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={200} r={12} /></SkelCard>
  </div>

  <!-- 僅為 TS 縮小 data | null:onData 先於 ready,執行期必有值 -->
  {#if data}
    <div style="display:flex; flex-direction:column; gap:20px;">
      <PageHead title="報表分析" sub="檢視營運數據、營收趨勢與課程分析報表">
        <svelte:fragment slot="actions">
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
        <ReportKpi
          icon="dollar-sign"
          label="本月營收"
          value={fmtNT(data.revenue.thisMonth)}
          delta={deltaPct(data.revenue.thisMonth, data.revenue.lastMonth)}
          tint="#0066CC14"
          color="var(--df-primary)"
        />
        <ReportKpi
          icon="user-plus"
          label="本月新會員"
          value="{data.kpis.newMembers.thisMonth} 位"
          delta={deltaPct(data.kpis.newMembers.thisMonth, data.kpis.newMembers.lastMonth)}
          tint="#F59E0B14"
          color="#F59E0B"
        />
        <ReportKpi
          icon="book-open"
          label="本月新報名"
          value="{data.kpis.newEnrolments.thisMonth} 筆"
          delta={deltaPct(data.kpis.newEnrolments.thisMonth, data.kpis.newEnrolments.lastMonth)}
          tint="#10B98114"
          color="#10B981"
        />
        <ReportKpi
          icon="receipt"
          label="本月訂單數"
          value="{data.kpis.paidOrdersCount.thisMonth} 筆"
          delta={deltaPct(data.kpis.paidOrdersCount.thisMonth, data.kpis.paidOrdersCount.lastMonth)}
          tint="#8B5CF614"
          color="#8B5CF6"
        />
        <ReportKpi
          icon="calendar-check"
          label="本月出席率"
          value={fmtPct(data.kpis.attendanceRate.thisMonth)}
          delta={deltaPct(data.kpis.attendanceRate.thisMonth, data.kpis.attendanceRate.lastMonth)}
          tint="#10B98114"
          color="#10B981"
        />
        <ReportKpi
          icon="repeat"
          label="會員留存率"
          value={fmtPct(data.retention.at(-1)?.rate ?? null)}
          delta={null}
          tint="#0EA5E914"
          color="#0EA5E9"
        />
      </div>

      <RevenueBreakdown rows={data.revenueBreakdown} />

      <div class="panel-row">
        <RevenueTrend rows={data.revenue.trend} />
        <CategoryDonut rows={data.categorySplit} />
      </div>
      <div class="panel-row">
        <TopCourses rows={topCoursesFrom(data.courses)} />
        <IncomeSources rows={data.incomeSources12m} />
      </div>
      <div class="panel-row">
        <CoachPerf rows={data.coaches} />
        <VenueUsage rows={data.venueUsage} />
      </div>
      <div class="panel-row">
        <AttDist rows={data.attendanceDistribution} />
        <RetentionTrend rows={data.retention} />
      </div>
      <div class="panel-row">
        <AgeDist rows={data.ageDistribution} />
        <TierDist rows={data.tierDistribution} />
      </div>
      <div class="panel-row">
        <ConversionFunnel funnel={data.funnel} />
        <PaymentSplit rows={data.paymentSplit} />
      </div>
      <WeekdayLoad rows={data.weekdayLoad} />

      <Card padding={0} style="overflow:hidden">
        <div style="padding:18px 22px;border-bottom:1px solid var(--df-border)">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">課程報名狀況</h3>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--df-bg-light)">
              <th class="th">課程</th>
              <th class="th">已報名 / 名額</th>
              <th class="th">滿班率</th>
              <th class="th">候補人數</th>
            </tr>
          </thead>
          <tbody>
            {#each data.courses as c (c.id)}
              <tr class="row">
                <td class="td">{c.name}</td>
                <td class="td td-muted">{c.enrolled} / {c.maxStudents}</td>
                <td class="td">{fmtPct(c.fillRate)}</td>
                <td class="td td-muted">{c.waitlistCount}</td>
              </tr>
            {/each}
            {#if data.courses.length === 0}
              <tr><td colspan="4" class="empty">尚無課程資料</td></tr>
            {/if}
          </tbody>
        </table>
      </Card>

      <Card padding={0} style="overflow:hidden">
        <div style="padding:18px 22px;border-bottom:1px solid var(--df-border)">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">教練授課概況</h3>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--df-bg-light)">
              <th class="th">教練</th>
              <th class="th">授課班級數</th>
              <th class="th">學員人數</th>
            </tr>
          </thead>
          <tbody>
            {#each data.coaches as c (c.id)}
              <tr class="row">
                <td class="td">{c.name}</td>
                <td class="td td-muted">{c.courseCount}</td>
                <td class="td td-muted">{c.studentCount}</td>
              </tr>
            {/each}
            {#if data.coaches.length === 0}
              <tr><td colspan="3" class="empty">尚無教練資料</td></tr>
            {/if}
          </tbody>
        </table>
      </Card>
    </div>
  {/if}
</LoadGate>

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
  .th {
    text-align: left;
    padding: 11px 22px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--df-text-light);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .row {
    border-bottom: 1px solid var(--df-border);
  }
  .row:last-child {
    border-bottom: none;
  }
  .td {
    padding: 13px 22px;
    font-size: 13.5px;
    color: var(--df-text-dark);
  }
  .td-muted {
    color: var(--df-text-light);
  }
  .empty {
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
</style>
