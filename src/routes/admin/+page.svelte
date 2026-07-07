<script lang="ts">
  /* 營運總覽 — admin dashboard (admin.jsx AdminHome). PageHead (匯出報表 + 新增課程)
   * over a KPI StatCard row, then a 1.6fr/1fr split: the compact 學員名單 on
   * the left, and the 今日課表 + 最新動態 panels stacked on the right. The shell
   * layout already provides the sidebar + topbar; this renders page content only.
   *
   * Task 15: KPI 卡與學員名單預覽改吃真資料——KPI 讀 GET /reports/admin(admin/api.ts
   * 的 getReports())，學員名單讀 GET /users(getMembers())。原 4 張 KPI 卡中「本週
   * 課堂」「出席偏低」在 /reports/admin 沒有對應資料源(見契約 §3.24「mock 有但契約無」
   * 清單)，已移除(裁決 9，不留假數字)，僅保留有真實資料源的「在學學員」(members.
   * active)與「本月營收」(revenue.thisMonth，ntd() 後由 fmtNT() 顯示)。硬編日期
   * （原 sub="2026 年 6 月 10 日 · 全館即時概況"）一併移除。匯出報表 fires an info
   * toast (the React onClick); 新增課程 links to /admin/classes (the React
   * setView)。 */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import TodayPanel from '$lib/admin/components/TodayPanel.svelte';
  import ActivityPanel from '$lib/admin/components/ActivityPanel.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import { Button, Icon, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';
  import { getReports, getMembers, type ReportsData } from '$lib/admin/api';
  import type { MemberAccount } from '$lib/admin/data';
  import { fmtNT } from '$lib/admin/format';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let reports: ReportsData | null = null;
  let members: MemberAccount[] = [];

  function load() {
    phase = 'loading';
    Promise.all([getReports(), getMembers()])
      .then(([r, m]) => {
        reports = r;
        members = m.members;
        phase = 'ready';
      })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  function exportReport() {
    toasts.notify('info', '報表匯出中', '本月營運報表將於背景產生並寄送至您的信箱。');
  }
</script>

{#if phase === 'ready' && reports}
<div class="df-view" style="display:flex;flex-direction:column;gap:20px">
  <PageHead title="營運總覽" sub="全館即時概況">
    <svelte:fragment slot="actions">
      <Button variant="secondary" size="sm" on:click={exportReport}>
        <Icon name="download" size={15} />匯出報表
      </Button>
      <Button variant="primary" size="sm" href="/admin/classes">
        <Icon name="plus" size={15} />新增課程
      </Button>
    </svelte:fragment>
  </PageHead>

  <div class="kpis">
    <StatCard
      icon="users"
      label="在學學員"
      value={reports.members.active}
      tint="var(--df-primary-bg)"
      color="var(--df-primary)"
    />
    <StatCard
      icon="receipt"
      label="本月營收"
      value={fmtNT(reports.revenue.thisMonth)}
      tint="#FFF8DB"
      color="var(--df-accent-dark)"
    />
  </div>

  <div class="split">
    <MembersTable compact {members} />
    <div style="display:flex;flex-direction:column;gap:18px">
      <TodayPanel sub="全館 5 堂課" />
      <ActivityPanel />
    </div>
  </div>
</div>
{:else if phase === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={load} /></Card></div>
{:else}
  <div class="df-view" style="display:flex;flex-direction:column;gap:20px" data-testid="admin-home-skeleton">
    <SkelCard padding={30}><Skeleton w="40%" h={26} /></SkelCard>
    <div class="kpis">
      {#each [0, 1] as i (i)}<SkelCard><Skeleton w="100%" h={90} r={12} /></SkelCard>{/each}
    </div>
    <div class="split">
      <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
      <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
    </div>
  </div>
{/if}

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    max-width: 520px;
  }
  .split {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .kpis {
      grid-template-columns: 1fr;
      max-width: none;
    }
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
