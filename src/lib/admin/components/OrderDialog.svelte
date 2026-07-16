<script lang="ts">
  /* 訂單明細 — order detail modal. Faithful port of admin.jsx OrderDialog: a
   * centered 訂單金額 (large) + status badge, then a 2-col field grid covering
   * 訂單編號/學員/項目/所屬分校/優惠/付款方式/收款時間/未稅金額/營業稅 5%/發票號碼/統一編號/
   * 經手人/建立時間, plus 退款原因 when the order is refunded. Built on the shared
   * Dialog (matches the source's ADialog). Footer is always 關閉 + (pending-only)
   * 發送催繳 — 發送催繳 stays a page-level toast only (no backend endpoint, out of
   * this task's scope).
   *
   * Task 8 piece 2: the old hardcoded "pending → 標記已付款" primary action is
   * replaced with a general 變更狀態 control in the body — a Select offering ONLY
   * legalNextStatuses(order.status) (契約 §3.10 狀態機), so the admin can never
   * pick an illegal transition, plus a 套用 button that calls onChangeStatus(order,
   * next). Terminal statuses (cancelled/refunded) have no legal next state, so the
   * control simply doesn't render. The dialog never mutates the order itself —
   * both actions are callbacks the page wires to the real PATCH call. */
  import { Dialog, Select, Button } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtNT } from '$lib/format';
  import { ORDER_STATUS, type Order, type OrderStatus } from '$lib/admin/data';
  import { legalNextStatuses } from './orders-filter';

  export let order: Order | null = null;
  export let onClose: () => void = () => {};
  export let onChangeStatus: (o: Order, next: OrderStatus) => void = () => {};
  export let onRemind: (o: Order) => void = () => {};

  $: legalNext = order ? legalNextStatuses(order.status) : [];
  $: nextOptions = legalNext.map((s) => ({ value: s, label: ORDER_STATUS[s][1] }));

  // Reset the chosen next-status whenever a different order opens (mirrors the
  // lastKlass/syncedId reset pattern elsewhere in this codebase).
  let nextStatus: OrderStatus | '' = '';
  let lastOrderId: string | null = null;
  $: if (order && order.orderId !== lastOrderId) {
    lastOrderId = order.orderId;
    nextStatus = legalNext[0] ?? '';
  }
  $: if (!order) lastOrderId = null;

  function applyChange() {
    if (order && nextStatus) onChangeStatus(order, nextStatus);
  }

  // [label, value, mono?] field grid — mirrors the source row list order.
  $: rows = order
    ? ([
        ['訂單編號', order.id, true],
        ['學員', order.member],
        ['項目', order.item],
        ['所屬分校', order.campus],
        ['優惠', order.discount],
        ['付款方式', order.method],
        ['收款時間', order.paidAt, true],
        ['未稅金額', fmtNT(order.net), true],
        ['營業稅 5%', fmtNT(order.tax), true],
        ['發票號碼', order.invoice, true],
        ['統一編號', order.taxId, true],
        ['經手人', order.handler],
        ['建立時間', order.date, true],
        ...(order.reason ? ([['退款原因', order.reason]] as [string, string][]) : [])
      ] as [string, string, boolean?][])
    : [];
</script>

<Dialog
  open={!!order}
  title="訂單明細"
  width={460}
  {onClose}
  primaryAction={{ label: '關閉', onClick: onClose }}
  secondaryAction={order && order.status === 'pending'
    ? { label: '發送催繳', onClick: () => onRemind(order) }
    : null}
>
  {#if order}
    <div style="text-align:center;padding:2px 0 14px">
      <div style="font-size:12.5px;color:var(--df-text-light)">訂單金額</div>
      <div
        style="font-size:32px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading);margin:4px 0 8px"
      >
        {fmtNT(order.amount)}
      </div>
      <StatusBadge kind="order" value={order.status} />
    </div>

    {#if legalNext.length > 0}
      <div class="status-change">
        <Select label="變更狀態為" bind:value={nextStatus} options={nextOptions} style="flex:1" />
        <Button variant="primary" size="sm" on:click={applyChange}>套用</Button>
      </div>
    {/if}

    <div
      style="display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;border-top:1px solid var(--df-border);padding-top:16px"
    >
      {#each rows as [k, v, mono]}
        <div>
          <div style="font-size:11.5px;color:var(--df-text-muted);margin-bottom:2px">{k}</div>
          <div
            style="font-size:14px;color:var(--df-text-dark);font-weight:500;font-family:{mono
              ? 'var(--df-font-mono)'
              : 'inherit'}"
          >{v}</div>
        </div>
      {/each}
    </div>
  {/if}
</Dialog>

<style>
  .status-change {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding-bottom: 16px;
  }
</style>
