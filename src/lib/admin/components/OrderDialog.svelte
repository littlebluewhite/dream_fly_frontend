<script lang="ts">
  /* 訂單明細 — read-only order detail modal. Faithful port of admin.jsx
   * OrderDialog: a centered 訂單金額 (large) + status badge, then a 2-col field
   * grid covering 訂單編號/學員/項目/所屬分校/優惠/付款方式/收款時間/未稅金額/營業稅 5%/
   * 發票號碼/統一編號/經手人/建立時間, plus 退款原因 when the order is refunded.
   * Built on the shared Dialog (matches the source's ADialog). A pending order
   * gets a 標記已付款 primary + 發送催繳 secondary; otherwise just 關閉. Both
   * actions are surfaced as callbacks the page wires to toasts — the dialog
   * itself never mutates the order. */
  import { Dialog } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtNT } from '$lib/admin/format';
  import type { Order } from '$lib/admin/data';

  export let order: Order | null = null;
  export let onClose: () => void = () => {};
  export let onMarkPaid: (o: Order) => void = () => {};
  export let onRemind: (o: Order) => void = () => {};

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
  primaryAction={order && order.status === 'pending'
    ? { label: '標記已付款', onClick: () => onMarkPaid(order) }
    : { label: '關閉', onClick: onClose }}
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
