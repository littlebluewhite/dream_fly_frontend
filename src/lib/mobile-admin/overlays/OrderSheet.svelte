<script lang="ts">
  /* 訂單明細 sheet。admin.jsx OrderSheet (346)。詳情欄位列共用 domain/order-detail.ts 的
   * orderDetailRows（與桌面 OrderDialog 共用同一份查表）。
   *
   * W-6 修正 1：唯讀明細。原「標記已付款」（markOrderPaid，PATCH pending→paid）已移除——
   * 後端 BE-3 起拒絕待付款→已付款（400），執行期也不產生 pending 訂單（僅月度種子對照單，
   * 只能取消，取消走桌面後台）。pending 列只留本地「發送催繳」提示。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { fmtNT } from '$lib/format';
  import type { Order as OrderRow } from '$lib/admin/data';
  import { orderStatusBadge } from '$lib/api/wire';
  import { orderDetailRows } from '$lib/domain/order-detail';

  export let onClose: () => void;
  export let o: OrderRow | null = null;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  $: [tone, label] = (o ? orderStatusBadge(o.status) : ['neutral', '-']) as [Tone, string];
  $: rows = o ? orderDetailRows(o) : [];

  function remind() {
    if (!o) return;
    toasts.notify('info', '已發送催繳', o.member + ' 將收到繳費提醒。');
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
      <Button variant="secondary" on:click={onClose} style="flex:1;">關閉</Button>
    {:else}
      <Button variant="secondary" fullWidth on:click={onClose}>關閉</Button>
    {/if}
  </svelte:fragment>
</Sheet>
