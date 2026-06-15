<script lang="ts">
  /* 訂單與金流 — the orders table (admin.jsx OrdersView body). Status filter tabs
   * (全部/已付款/待付款/已退款) over a table: 訂單編號 / 學員 (avatar+name) / 項目 /
   * 優惠 / 金額 (right, mono) / 付款方式 / 經手人 / 狀態 (order StatusBadge) / 時間.
   * Filtering lives in the pure filterOrders() (orders-filter.ts); the topbar
   * `search` store feeds the query. A row click opens the read-only OrderDialog;
   * 標記已付款 updates the local working copy + toast, 發送催繳 toasts only. */
  import { Avatar, Card, Tabs } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import OrderDialog from './OrderDialog.svelte';
  import { ORDERS, type Order } from '$lib/admin/data';
  import { search, toasts } from '$lib/admin/stores';
  import { fmtNT } from '$lib/admin/format';
  import { filterOrders, countByStatus, type OrderStatusFilter } from './orders-filter';

  export let rows: Order[] = ORDERS;

  // Local working copy so 標記已付款 reflects immediately (mirrors the source useState).
  let orders: Order[] = rows;
  $: orders = rows;

  let tab: OrderStatusFilter = 'all';
  let active: Order | null = null;

  $: counts = countByStatus(orders);
  $: tabs = [
    { value: 'all', label: '全部', count: counts.all },
    { value: 'paid', label: '已付款', count: counts.paid },
    { value: 'pending', label: '待付款', count: counts.pending },
    { value: 'refunded', label: '已退款', count: counts.refunded }
  ];

  $: visible = filterOrders(orders, { query: $search, status: tab });

  function markPaid(o: Order) {
    orders = orders.map((x) => (x.id === o.id ? { ...x, status: 'paid' } : x));
    active = null;
    toasts.notify('success', '已標記收款', o.id + ' · ' + fmtNT(o.amount) + ' 已入帳。');
  }

  function remind(o: Order) {
    active = null;
    toasts.notify('info', '已發送催繳', o.member + ' 將收到繳費提醒。');
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
  onMarkPaid={markPaid}
  onRemind={remind}
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
