<script lang="ts">
  /* 訂單明細 sheet。admin.jsx OrderSheet (346)。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { toasts, markOrderPaid } from '$lib/mobile-admin/stores';
  import { ORDER_STATUS, fmtNT, type OrderRow } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let o: OrderRow | null = null;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

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
  function markPaid() {
    if (!o) return;
    markOrderPaid(o.id);
    toasts.notify('success', '已標記收款', o.id + ' · ' + fmtNT(o.amount) + ' 已入帳。');
    onClose();
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
      <Button variant="primary" on:click={markPaid} style="flex:1;">標記已付款</Button>
    {:else}
      <Button variant="secondary" fullWidth on:click={onClose}>關閉</Button>
    {/if}
  </svelte:fragment>
</Sheet>
