<script lang="ts">
  /* 訂單與金流 — the orders table (admin.jsx OrdersView body). Status filter tabs
   * (全部 + 待付款/已付款/處理中/已完成/已取消/已退款 — 中文標籤沿用 admin/data.ts 的
   * ORDER_STATUS 查表，不另建第二份對照) over a table: 訂單編號 / 學員 (avatar+name) /
   * 項目 / 優惠 / 金額 (right, mono) / 付款方式 / 經手人 / 狀態 (order StatusBadge) / 時間.
   * Filtering lives in the pure filterOrders() (orders-filter.ts); the topbar
   * `search` store feeds the query. A row click opens the OrderDialog; 變更狀態
   * (Task 8 piece 2: legalNextStatuses-driven, real PATCH /orders/{id}/status via
   * the page) and 發送催繳 (toast only) are both forwarded up unchanged. */
  import { Avatar, Card, Tabs } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import OrderDialog from './OrderDialog.svelte';
  import { ORDERS, ORDER_STATUS, type Order, type OrderStatus } from '$lib/admin/data';
  import { search } from '$lib/admin/stores';
  import { fmtNT } from '$lib/admin/format';
  import { filterOrders, countByStatus, type OrderStatusFilter } from './orders-filter';

  // The orders page owns the mutable order state (so the summary KPIs and this
  // table stay in sync); we render straight from `rows` and report actions up.
  export let rows: Order[] = ORDERS;
  export let onChangeStatus: (o: Order, next: OrderStatus) => void = () => {};
  export let onRemind: (o: Order) => void = () => {};

  let tab: OrderStatusFilter = 'all';
  let active: Order | null = null;

  // Canonical lifecycle order — matches ORDER_STATUS (admin/data.ts) and the
  // 6-value order status backend contract (§3.10).
  const STATUS_TABS: OrderStatus[] = [
    'pending',
    'paid',
    'processing',
    'completed',
    'cancelled',
    'refunded'
  ];

  $: counts = countByStatus(rows);
  $: tabs = [
    { value: 'all', label: '全部', count: counts.all },
    ...STATUS_TABS.map((s) => ({ value: s, label: ORDER_STATUS[s][1], count: counts[s] }))
  ];

  $: visible = filterOrders(rows, { query: $search, status: tab });

  function handleChangeStatus(o: Order, next: OrderStatus) {
    active = null;
    onChangeStatus(o, next);
  }

  function handleRemind(o: Order) {
    active = null;
    onRemind(o);
  }
</script>

<Card padding={0} style="overflow:hidden">
  <div style="padding:12px 22px 0">
    <Tabs {tabs} bind:value={tab} />
  </div>

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:var(--df-bg-light)">
        <th class="th">訂單編號</th>
        <th class="th">學員</th>
        <th class="th">項目</th>
        <th class="th">優惠</th>
        <th class="th th-right">金額</th>
        <th class="th">付款方式</th>
        <th class="th">經手人</th>
        <th class="th">狀態</th>
        <th class="th">時間</th>
      </tr>
    </thead>
    <tbody>
      {#each visible as o (o.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <tr class="df-rowhover row" on:click={() => (active = o)}>
          <td class="td td-id">{o.id}</td>
          <td class="td">
            <div style="display:flex;align-items:center;gap:9px">
              <Avatar name={o.initial} size="xs" color={o.color} />
              <span style="font-size:13.5px;font-weight:600;color:var(--df-text-dark)">{o.member}</span
              >
            </div>
          </td>
          <td class="td td-muted">{o.item}</td>
          <td class="td" class:td-dash={o.discount === '—'} class:td-muted={o.discount !== '—'}
            >{o.discount}</td
          >
          <td class="td td-amount">{fmtNT(o.amount)}</td>
          <td class="td td-muted">{o.method}</td>
          <td class="td td-muted">{o.handler}</td>
          <td class="td"><StatusBadge kind="order" value={o.status} /></td>
          <td class="td td-time">{o.date}</td>
        </tr>
      {/each}
      {#if visible.length === 0}
        <tr>
          <td colspan="9" class="empty">找不到符合的訂單</td>
        </tr>
      {/if}
    </tbody>
  </table>
</Card>

<OrderDialog
  order={active}
  onClose={() => (active = null)}
  onChangeStatus={handleChangeStatus}
  onRemind={handleRemind}
/>

<style>
  .th {
    text-align: left;
    padding: 11px 22px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--df-text-light);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .th-right {
    text-align: right;
  }
  .row {
    border-bottom: 1px solid var(--df-border);
    cursor: pointer;
  }
  .row:last-child {
    border-bottom: none;
  }
  .td {
    padding: 13px 22px;
  }
  .td-id {
    font-family: var(--df-font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--df-primary);
  }
  .td-muted {
    font-size: 13px;
    color: var(--df-text-light);
  }
  .td-dash {
    font-size: 13px;
    color: var(--df-text-muted);
  }
  .td-amount {
    text-align: right;
    font-family: var(--df-font-mono);
    font-size: 13.5px;
    font-weight: 700;
    color: var(--df-text-dark);
  }
  .td-time {
    font-size: 12.5px;
    color: var(--df-text-muted);
    font-family: var(--df-font-mono);
  }
  .empty {
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
</style>
