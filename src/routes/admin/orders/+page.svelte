<script lang="ts">
  /* 訂單與金流 — 報名繳費紀錄. Faithful port of admin.jsx OrdersView: a PageHead
   * with an 匯出對帳單 action, four summary StatCards (本頁已收 / 待付款 / 本頁訂單 /
   * 退款), then the orders table. Filtering + the detail dialog live in
   * OrdersTable; the summary numbers derive from the same orders working copy.
   *
   * Data arrives async via getOrders() (admin seam): onMount loads it into a
   * three-state gate (loading/error/ready); `orders` is the local mutable
   * working copy.
   *
   * R13 Task 5(C4)：變更狀態改共用 order-status.ts 的 changeOrderStatus——PATCH
   * /orders/{id}/status 的呼叫 + ApiError 狀態碼判別收進該模組（原與 mobile-admin
   * markOrderPaid 共用；W-6 修正 1 移除後本頁是唯一呼叫端）。已對過後端
   * update_order_status：非法轉換/並發衝突一律 400（illegalTransition，
   * OrderDialog 只提供合法選項，理論上不會踩到，這裡是防禦性 fallback）；
   * 409（pointsShortfall）是退款/取消補償撞點數不足時才會發生；其餘（含 403）
   * 走 failed，用 apiErrorText 查表。成功後 applyStatusChange() 折回 server 回的
   * 新狀態與 paid_at，KPI/表格保持與已持久化的真值一致。 */
  import { Button, Icon, LoadGate, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import OrdersTable from '$lib/admin/components/OrdersTable.svelte';
  // C4 批4:ORDER_STATUS/OrderStatus 改直取 $lib/api/wire(原經 $lib/admin/data 純
  // 轉手);Order 是 admin/data.ts 本檔真內容(.map 衍生形狀),續留原處。
  import { orderStatusBadge, type OrderStatus } from '$lib/api/wire';
  import type { Order } from '$lib/admin/data';
  import { toasts } from '$lib/admin/stores';
  import { createPagedLoadGate } from '$lib/load-gate';
  import { fmtNT } from '$lib/format';
  import { countByStatus } from '$lib/admin/components/orders-filter';
  import { revenueTotal, applyStatusChange, changeOrderStatus } from '$lib/admin/components/order-status';
  import { getOrders, updateOrderStatus } from '$lib/admin/api';
  import { apiErrorText } from '$lib/api/error-text';

  // Single source of truth for the orders surface: both the summary KPIs and the
  // table derive from this mutable copy, so 變更狀態 keeps the StatCards in sync
  // with the table (instead of the stats staying frozen on the original fixture).
  let orders: Order[] = [];
  $: counts = countByStatus(orders);
  $: revenue = revenueTotal(orders);

  const gate = createPagedLoadGate({
    fetch: (page) => getOrders(page),
    onData: (d) => { orders = d.orders.map((o) => ({ ...o })); }
  });

  async function changeStatus(o: Order, next: OrderStatus) {
    const outcome = await changeOrderStatus(o.orderId, next, { updateOrderStatus });
    switch (outcome.kind) {
      case 'changed':
        orders = applyStatusChange(orders, o.orderId, outcome.status, outcome.paidAt);
        toasts.notify('success', '狀態已更新', o.id + ' 已更新為「' + orderStatusBadge(outcome.status)[1] + '」。');
        break;
      case 'illegalTransition':
        toasts.notify('error', '狀態更新失敗', '狀態轉換不合法，請重新整理後再試。');
        break;
      case 'pointsShortfall':
        toasts.notify('error', '狀態更新失敗', '會員已使用本單回饋點數，餘額不足以扣回，無法退款或取消。');
        break;
      case 'failed':
        toasts.notify('error', '狀態更新失敗', apiErrorText(outcome.error, { 403: '沒有權限執行此操作。' }));
        break;
    }
  }
  function remind(o: Order) {
    toasts.notify('info', '已發送催繳', o.member + ' 將收到繳費提醒。');
  }
</script>

<LoadGate {gate}>
  <div data-testid="orders-skeleton" slot="loading">
    <div class="stats">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={70} r={10} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>

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
      label="本頁已收"
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
      label="本頁訂單"
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

  <!-- 複審修復（Finding 1）：OrdersTable 內部狀態分頁籤 + topbar 搜尋皆為純前端記憶體
       篩選（filterOrders），只作用在目前已載入的這一頁（見上 Task 17 分頁）。只在還有
       下一頁時才提示，避免全部資料剛好一頁裝得下時的多餘雜訊。 -->
  {#if $gate.total > $gate.perPage}
    <p class="scope-hint">搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。</p>
  {/if}

  <OrdersTable rows={orders} onChangeStatus={changeStatus} onRemind={remind} />
  <PaginationBar page={$gate.page} total={$gate.total} perPage={$gate.perPage} onPageChange={gate.changePage} />
</LoadGate>

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
  .scope-hint {
    margin: 0 0 20px;
    font-size: 13px;
    color: var(--df-text-light);
  }
</style>
