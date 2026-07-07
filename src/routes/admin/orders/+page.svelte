<script lang="ts">
  /* 訂單與金流 — 報名繳費紀錄. Faithful port of admin.jsx OrdersView: a PageHead
   * with an 匯出對帳單 action, four summary StatCards (本月已收 / 待付款 / 本月訂單 /
   * 退款), then the orders table. Filtering + the detail dialog live in
   * OrdersTable; the summary numbers derive from the same orders working copy.
   *
   * Data arrives async via getOrders() (admin seam): onMount loads it into a
   * three-state gate (loading/error/ready); `orders` is the local mutable
   * working copy.
   *
   * Task 8 piece 2: 變更狀態 now calls the real PATCH /orders/{id}/status
   * (updateOrderStatus) instead of only flipping status locally. OrderDialog only
   * offers legalNextStatuses(order.status), so a 400 illegal-transition shouldn't
   * be reachable by design — the catch branch below is a defensive fallback
   * (e.g. a concurrent change on the backend) with a 繁中 error toast; on success
   * applyStatusChange() folds the response's new status into the working copy,
   * so the KPIs + table stay consistent with the persisted truth. */
  import { onMount } from 'svelte';
  import { Button, Card, Icon, ErrorState, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import OrdersTable from '$lib/admin/components/OrdersTable.svelte';
  import { ORDER_STATUS, type Order, type OrderStatus } from '$lib/admin/data';
  import { toasts } from '$lib/admin/stores';
  import { createPagedLoadGate } from '$lib/load-gate';
  import { fmtNT } from '$lib/admin/format';
  import { countByStatus, paidRevenue, applyStatusChange } from '$lib/admin/components/orders-filter';
  import { getOrders, updateOrderStatus } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

  // Single source of truth for the orders surface: both the summary KPIs and the
  // table derive from this mutable copy, so 變更狀態 keeps the StatCards in sync
  // with the table (instead of the stats staying frozen on the original fixture).
  let orders: Order[] = [];
  $: counts = countByStatus(orders);
  $: revenue = paidRevenue(orders);

  const gate = createPagedLoadGate({
    fetch: (page) => getOrders(page),
    onData: (d) => { orders = d.orders.map((o) => ({ ...o })); }
  });
  onMount(() => {
    gate.load();
  });

  // 400（非法轉換，理論上不會發生——OrderDialog 只提供合法選項）/ 403 權限 →
  // 對應繁中提示；其餘（連線問題等）給通用訊息，同 classes 頁的 ApiError 判斷慣例。
  function statusErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 400) return '狀態轉換不合法，請重新整理後再試。';
      if (e.status === 403) return '沒有權限執行此操作。';
    }
    return '連線發生問題，請稍後再試。';
  }

  async function changeStatus(o: Order, next: OrderStatus) {
    try {
      const res = await updateOrderStatus(o.orderId, next);
      const newStatus = res.status as OrderStatus;
      orders = applyStatusChange(orders, o.orderId, newStatus);
      toasts.notify('success', '狀態已更新', o.id + ' 已更新為「' + ORDER_STATUS[newStatus][1] + '」。');
    } catch (e) {
      toasts.notify('error', '狀態更新失敗', statusErrorMessage(e));
    }
  }
  function remind(o: Order) {
    toasts.notify('info', '已發送催繳', o.member + ' 將收到繳費提醒。');
  }
</script>

{#if $gate.phase === 'ready'}
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

  <!-- 複審修復（Finding 1）：OrdersTable 內部狀態分頁籤 + topbar 搜尋皆為純前端記憶體
       篩選（filterOrders），只作用在目前已載入的這一頁（見上 Task 17 分頁）。只在還有
       下一頁時才提示，避免全部資料剛好一頁裝得下時的多餘雜訊。 -->
  {#if $gate.total > $gate.perPage}
    <p class="scope-hint">搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。</p>
  {/if}

  <OrdersTable rows={orders} onChangeStatus={changeStatus} onRemind={remind} />
  <PaginationBar page={$gate.page} total={$gate.total} perPage={$gate.perPage} onPageChange={gate.changePage} />
{:else if $gate.phase === 'error'}
  <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
{:else}
  <div data-testid="orders-skeleton">
    <div class="stats">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={70} r={10} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>
{/if}

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
