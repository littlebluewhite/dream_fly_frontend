<script lang="ts">
  /* 營運總覽 — admin dashboard (admin.jsx AdminHome). PageHead (匯出報表 + 新增課程)
   * over a 4-up KPI StatCard grid, then a 1.6fr/1fr split: the compact 學員名單 on
   * the left, and the 今日課表 + 最新動態 panels stacked on the right. The shell
   * layout already provides the sidebar + topbar; this renders page content only.
   *
   * KPI values are the prototype's static literals. 匯出報表 fires an info toast
   * (the React onClick); 新增課程 links to /admin/classes (the React setView). */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import TodayPanel from '$lib/admin/components/TodayPanel.svelte';
  import ActivityPanel from '$lib/admin/components/ActivityPanel.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import { Button, Icon } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';

  function exportReport() {
    toasts.notify('info', '報表匯出中', '本月營運報表將於背景產生並寄送至您的信箱。');
  }
</script>

<div class="df-view" style="display:flex;flex-direction:column;gap:20px">
  <PageHead title="營運總覽" sub="2026 年 6 月 10 日 · 全館即時概況">
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
      value="248"
      delta="+12"
      up
      tint="var(--df-primary-bg)"
      color="var(--df-primary)"
    />
    <StatCard
      icon="calendar-check"
      label="本週課堂"
      value="64"
      delta="+4"
      up
      tint="var(--df-success-bg)"
      color="var(--df-success)"
    />
    <StatCard
      icon="receipt"
      label="本月營收"
      value="NT$182K"
      delta="+8%"
      up
      tint="#FFF8DB"
      color="var(--df-accent-dark)"
    />
    <StatCard
      icon="user-x"
      label="出席偏低"
      value="6"
      delta="-2"
      up
      tint="var(--df-warning-bg)"
      color="var(--df-warning)"
    />
  </div>

  <div class="split">
    <MembersTable compact />
    <div style="display:flex;flex-direction:column;gap:18px">
      <TodayPanel sub="全館 5 堂課" />
      <ActivityPanel />
    </div>
  </div>
</div>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .split {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 1100px) {
    .kpis {
      grid-template-columns: repeat(2, 1fr);
    }
    .split {
      grid-template-columns: 1fr;
    }
  }
</style>
