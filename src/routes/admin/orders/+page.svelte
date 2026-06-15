<script lang="ts">
  /* 訂單與金流 — 報名繳費紀錄. Faithful port of admin.jsx OrdersView: a PageHead
   * with an 匯出對帳單 action, four summary StatCards (本月已收 / 待付款 / 本月訂單 /
   * 退款), then the orders table. Filtering + the detail dialog live in
   * OrdersTable; the summary numbers derive from the same ORDERS fixture. */
  import { Button, Icon } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import OrdersTable from '$lib/admin/components/OrdersTable.svelte';
  import { ORDERS } from '$lib/admin/data';
  import { toasts } from '$lib/admin/stores';
  import { fmtNT } from '$lib/admin/format';
  import { countByStatus, paidRevenue } from '$lib/admin/components/orders-filter';

  const counts = countByStatus(ORDERS);
  const revenue = paidRevenue(ORDERS);
</script>

<PageHead title="訂單與金流" sub="報名繳費紀錄">
  <Button
    slot="actions"
    size="sm"
    variant="secondary"
    on:click={() => toasts.notify('info', '匯出對帳單', '本月對帳單將寄送至財務信箱。')}
  >
    <Icon name="download" size={15} />匯出對帳單
  </Button>
</PageHead>

<div class="stats">
  <StatCard
    icon="circle-dollar-sign"
    label="本月已收"
    value={fmtNT(revenue)}
    tint="var(--df-success-bg)"
    color="var(--df-success)"
  />
  <StatCard
    icon="clock"
    label="待付款"
    value={counts.pending + ' 筆'}
    tint="var(--df-warning-bg)"
    color="var(--df-warning)"
  />
  <StatCard
    icon="receipt"
    label="本月訂單"
    value={counts.all + ' 筆'}
    tint="var(--df-primary-bg)"
    color="var(--df-primary)"
  />
  <StatCard
    icon="rotate-ccw"
    label="退款"
    value={counts.refunded + ' 筆'}
    tint="var(--df-bg-light)"
    color="var(--df-text-light)"
  />
</div>

<OrdersTable />

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }
  @media (max-width: 900px) {
    .stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
