<script lang="ts">
  /* 訂單明細 sheet。admin.jsx OrderSheet (346)。
   * Task 20：標記已付款改真打 PATCH /orders/{id}/status。R12 起整段(用 orderId
   * ——真實後端 UUID，非顯示用的 order_number——PATCH、成功後以 applyStatusChange
   * 套回 $orders)收進 store 的 markOrderPaid(order)；本頁只留 saving 防連點與
   * toast / 錯誤文案表。
   *
   * R13 Task 5(C4)：markOrderPaid 改回傳 changeOrderStatus 的 outcome（不再
   * throw）；詳情欄位列改共用 domain/order-detail.ts 的 orderDetailRows（與桌面
   * OrderDialog 共用同一份查表）。舊碼把「並發衝突」文案掛在 409 上是判錯狀態
   * 碼——已對過後端 update_order_status：非法轉換/並發衝突一律 400，改掛
   * illegalTransition；409（pointsShortfall）是退款/取消補償撞點數不足，
   * markOrderPaid 只會 pending→paid（無補償路徑），理論上打不到，仍給文案以求
   * 判別完整、不留 unreachable 的 UI 空白。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { toasts, markOrderPaid } from '$lib/mobile-admin/stores';
  import { fmtNT } from '$lib/format';
  import type { OrderRow } from '$lib/mobile-admin/data';
  import { apiErrorText } from '$lib/api/error-text';
  import { orderStatusBadge } from '$lib/api/wire';
  import { orderDetailRows } from '$lib/domain/order-detail';

  export let onClose: () => void;
  export let o: OrderRow | null = null;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  let saving = false;

  // PATCH /orders/{id}/status:403 權限 → 繁中文案查表(apiErrorText)，其餘通用訊息。
  const STATUS_ERROR_TEXT: Record<number, string> = {
    403: '沒有權限執行此操作。'
  };

  $: [tone, label] = (o ? orderStatusBadge(o.status) : ['neutral', '-']) as [Tone, string];
  $: rows = o ? orderDetailRows(o) : [];

  function remind() {
    if (!o) return;
    toasts.notify('info', '已發送催繳', o.member + ' 將收到繳費提醒。');
    onClose();
  }
  async function markPaid() {
    if (!o || saving) return;
    const target = o;
    saving = true;
    try {
      const outcome = await markOrderPaid(target);
      if (outcome.kind === 'changed') {
        toasts.notify('success', '已標記收款', target.id + ' · ' + fmtNT(target.amount) + ' 已入帳。');
        onClose();
      } else if (outcome.kind === 'illegalTransition') {
        toasts.notify('error', '標記失敗', '訂單狀態已變更，請重新整理後再試。');
      } else if (outcome.kind === 'pointsShortfall') {
        toasts.notify('error', '標記失敗', '會員已使用本單回饋點數，餘額不足以扣回，無法退款或取消。');
      } else {
        toasts.notify('error', '標記失敗', apiErrorText(outcome.error, STATUS_ERROR_TEXT));
      }
    } finally {
      saving = false;
    }
  }
</script>

<Sheet open {onClose} title="訂單明細">
  {#if o}
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div style="text-align:center; padding:6px 0;">
        <div style="font-size:12px; color:var(--df-text-light);">訂單金額</div>
        <div style="font-size:34px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading); margin:4px 0 8px;">{fmtNT(o.amount)}</div>
        <Badge {tone} dot>{label}</Badge>
      </div>

      <div style="background:var(--df-bg-light); border-radius:14px; padding:4px 15px;">
        {#each rows as [k, v, mono], i (k)}
          <div
            style="display:flex; justify-content:space-between; gap:14px; align-items:center; padding:12px 0;
              border-top:{i ? '1px solid var(--df-border)' : 'none'};"
          >
            <span style="font-size:13px; color:var(--df-text-light); flex:none;">{k}</span>
            <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark); text-align:right; font-family:{mono ? 'var(--df-font-mono)' : 'inherit'};">{v}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    {#if o && o.status === 'pending'}
      <button
        on:click={remind}
        class="df-tapscale"
        style="flex:1; height:48px; border-radius:12px; border:1.5px solid var(--df-border); background:#fff;
          color:var(--df-text-dark); font-size:14.5px; font-weight:700; cursor:pointer;"
      >發送催繳</button>
      <Button variant="primary" disabled={saving} on:click={markPaid} style="flex:1;">{saving ? '處理中…' : '標記已付款'}</Button>
    {:else}
      <Button variant="secondary" fullWidth on:click={onClose}>關閉</Button>
    {/if}
  </svelte:fragment>
</Sheet>
