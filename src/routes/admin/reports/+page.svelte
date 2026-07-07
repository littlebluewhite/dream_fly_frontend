<script lang="ts">
  /* 報表分析 — SvelteKit port of reports.jsx `ReportsView`, re-scoped in Task 15 to
   * real data. The shell wraps /admin, so this renders page content only: a
   * PageHead (匯出報表), a real-data KPI band (revenue this/last month + member
   * counts), the 12-month RevenueTrend chart, and two honest tables (courses/
   * coaches). The prototype's period-picker + 15 mock chart panels (kpis/
   * revenueBreakdown/categorySplit/topCourses/incomeSources/coachPerf/venueUsage/
   * attDist/retention/ageDist/tierDist/campusRevenue/paymentSplit/funnel/
   * weekdayLoad) had no GET /reports/admin data source (integration-contract.md
   * §3.24「mock 有但契約無」清單) and were removed along with their chart
   * components/period picker (裁決 9：不留假數字) — see admin/api.ts's ReportsData
   * for the surviving real shape (revenue/members/courses/coaches).
   *
   * Data arrives async via getReports(): onMount loads it into a three-state gate
   * (loading/error/ready). */
  import { onMount } from 'svelte';
  import { Button, Icon, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import { toasts } from '$lib/admin/stores';
  import { getReports, type ReportsData } from '$lib/admin/api';
  import { fmtNT, fmtPct } from '$lib/admin/format';
  import RevenueTrend from '$lib/admin/components/reports/RevenueTrend.svelte';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: ReportsData | null = null;

  function load() {
    phase = 'loading';
    getReports()
      .then((d) => { data = d; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);
</script>

{#if phase === 'ready' && data}
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
      <StatCard icon="dollar-sign" label="本月營收" value={fmtNT(data.revenue.thisMonth)} tint="var(--df-primary-bg)" color="var(--df-primary)" />
      <StatCard icon="circle-dollar-sign" label="上月營收" value={fmtNT(data.revenue.lastMonth)} tint="var(--df-bg-light)" color="var(--df-text-light)" />
      <StatCard icon="users" label="會員總數" value={data.members.total} tint="var(--df-success-bg)" color="var(--df-success)" />
      <StatCard icon="user-plus" label="本月新增會員" value={data.members.newThisMonth} tint="#F59E0B14" color="#F59E0B" />
      <StatCard icon="user-check" label="在學會員" value={data.members.active} tint="#8B5CF614" color="#8B5CF6" />
    </div>

    <RevenueTrend rows={data.revenue.trend} />

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
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div style="display:flex; flex-direction:column; gap:20px;" data-testid="reports-skeleton">
    <Skeleton w={220} h={32} r={8} />
    <div class="kpi-grid">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={200} r={12} /></SkelCard>
  </div>
{/if}

<style>
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 16px;
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
