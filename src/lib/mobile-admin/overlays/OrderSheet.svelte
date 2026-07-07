<script lang="ts">
  /* 訂單明細 sheet。admin.jsx OrderSheet (346)。
   * Task 20：標記已付款改真打 PATCH /orders/{id}/status(updateOrderStatus，
   * admin/api.ts Task 8 piece 2)——用 orderId(真實後端 UUID，非顯示用的 order_
   * number)呼叫；成功後才用 markOrderPaid() 把確認後的狀態同步進 $orders store
   * (該函式的本地 store 機制本身沒問題，問題只在於它先前完全沒有真的打 API 就
   * 直接呼叫——同 desktop admin/orders/+page.svelte 的 changeStatus() 慣例)。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { toasts, markOrderPaid } from '$lib/mobile-admin/stores';
  import { ORDER_STATUS, fmtNT, type OrderRow } from '$lib/mobile-admin/data';
  import { updateOrderStatus } from '$lib/mobile-admin/api';
  import { ApiError } from '$lib/api/client';

  export let onClose: () => void;
  export let o: OrderRow | null = null;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  let saving = false;

  function statusErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 409) return '訂單狀態已變更，請重新整理後再試。';
      if (e.status === 403) return '沒有權限執行此操作。';
    }
    return '連線發生問題，請稍後再試。';
  }

  $: [tone, label] = (o ? ORDER_STATUS[o.status] : ['neutral', '-']) as [Tone, string];
  $: rows = o
    ? ((() => {
        const r: [string, string, string?][] = [
          ['訂單編號', o.id, 'var(--df-font-mono)'],
          ['學員', o.member],
          ['項目', o.item],
          ['所屬分校', o.campus],
          ['優惠', o.discount],
          ['付款方式', o.method],
          ['收款時間', o.paidAt, 'var(--df-font-mono)'],
          ['未稅金額', fmtNT(o.net), 'var(--df-font-mono)'],
          ['營業稅 5%', fmtNT(o.tax), 'var(--df-font-mono)'],
          ['發票號碼', o.invoice, 'var(--df-font-mono)'],
          ['統一編號', o.taxId, 'var(--df-font-mono)'],
          ['經手人', o.handler],
          ['建立時間', o.date, 'var(--df-font-mono)']
        ];
        if (o.reason) r.push(['退款原因', o.reason]);
        return r;
      })())
    : [];

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
      await updateOrderStatus(target.orderId, 'paid');
      markOrderPaid(target.id);
      toasts.notify('success', '已標記收款', target.id + ' · ' + fmtNT(target.amount) + ' 已入帳。');
      onClose();
    } catch (e) {
      toasts.notify('error', '標記失敗', statusErrorMessage(e));
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
        {#each rows as [k, v, f], i (k)}
          <div
            style="display:flex; justify-content:space-between; gap:14px; align-items:center; padding:12px 0;
              border-top:{i ? '1px solid var(--df-border)' : 'none'};"
          >
            <span style="font-size:13px; color:var(--df-text-light); flex:none;">{k}</span>
            <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark); text-align:right; font-family:{f || 'inherit'};">{v}</span>
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
