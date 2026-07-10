<script lang="ts">
  /* 購物車 / 結帳 sheet（3 步驟）。mobile/home.jsx CartSheet (245-337)。
   * (1) 課程明細 + 優惠碼 + 點數折抵；(2) 付款(卡片欄位是裝飾性、鏡射桌面
   * CheckoutDialog 的既有決定——後端本身就是 mock payment：下單成功即代表付款
   * 完成，見 integration-contract.md §1.8，desktop 的卡號等欄位同樣從未接上
   * 任何 state)；(3) SuccessBody。課程是報名不是數量，購物車行不再有增減數量
   * 的控制項（qty 鎖 1，見 stores.ts 的 cart.add()）。
   *
   * 確認付款 → 復用桌面 member 的結帳 seam 真下單（見 $lib/mobile/stores.ts 的
   * placeOrder()：syncCartToServer + POST /orders + refreshPoints），成功/失敗
   * 都以真實 API 回應為準——不再有本地假 checkout()、假成功 toast、假點數。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import NoteBox from '$lib/components/mobile/NoteBox.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Stepper from '$lib/components/ui/Stepper.svelte';
  import { onMount } from 'svelte';
  import { cart, toasts, placeOrder } from '$lib/mobile/stores';
  import { fmtNT, ME } from '$lib/mobile/data';
  import { checkoutMath } from '$lib/checkout-math';
  import { points, refreshPoints } from '$lib/member/stores';
  import { validateCoupon, orderErrorMessage } from '$lib/member/checkout';

  export let onClose: () => void;

  let step = 0;
  let code = '';
  let coupon: { code: string; off: number } | null = null;
  let codeErr = '';
  let usePoints = false;
  let paying = false;
  // 這次結帳流程唯一的一把 key。CartSheet 隨 sheet 開關掛載/卸載（見
  // OverlayHost：`{#if $overlay.sheet}<svelte:component .../>`），每次重新開
  // 啟本來就是全新的元件實例、全新的一次結帳嘗試——不需要桌面 CheckoutDialog
  // 那種「關閉重開沿用同一把 key」的額外狀態（那是因為桌面 dialog 整個結帳期
  // 間都不卸載，見該檔案註解）。
  const idempotencyKey = crypto.randomUUID();
  let paid = { total: 0, earned: 0, ptRedeem: 0, orderNumber: '' };

  // 開啟即水合真點數餘額——本地 mock 殘值只是 fail-safe，折抵預覽必須用真餘額
  // （同桌面 CheckoutDialog 開啟時呼叫 refreshPoints() 的既有慣例）。
  // best-effort：失敗就沿用目前的 store 值，送單時後端仍是最終防線。
  onMount(() => {
    void refreshPoints().catch(() => {});
  });

  $: m = checkoutMath($cart, coupon, $points, usePoints);

  async function applyCode() {
    if (!code.trim()) return; // 空輸入按「套用」不顯示錯誤（同桌面 CheckoutDialog 的決策）
    let hit: { code: string; off: number } | null;
    try {
      hit = await validateCoupon(code);
    } catch {
      hit = null; // 網路/未預期錯誤與「查無優惠碼」一視同仁，不另開技術性錯誤文案
    }
    if (hit) {
      coupon = hit;
      codeErr = '';
    } else {
      coupon = null;
      codeErr = '優惠碼無效或已過期';
    }
  }

  /* 確認付款 → 真下單（placeOrder：同步購物車 → POST /orders → 水合真點數 →
   * 清空購物車）。成功才進 step 2，顯示的金額/點數/訂單編號一律來自真實 API
   * 回應（paid.*），不是本地預覽（m.*）。失敗顯示後端錯誤訊息轉繁中，購物車
   * 不清空，讓使用者可以直接重試（沿用同一把 idempotencyKey，不會重複扣款）。 */
  async function confirmPayment() {
    if (paying) return;
    paying = true;
    try {
      const confirmation = await placeOrder(coupon?.code ?? '', usePoints, idempotencyKey);
      paid = {
        total: confirmation.total,
        earned: confirmation.earned,
        ptRedeem: confirmation.ptRedeem,
        orderNumber: confirmation.orderNumber
      };
      const redeemNote = paid.ptRedeem > 0 ? `，使用 ${paid.ptRedeem} 點折抵` : '';
      toasts.notify('success', '報名完成', `課程已加入你的日程${redeemNote}，獲得 ${paid.earned} 點回饋。`);
      step = 2;
    } catch (err) {
      toasts.notify('error', '結帳失敗', orderErrorMessage(err));
    } finally {
      paying = false;
    }
  }
  function done() {
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="92%"
  title={step === 2 ? '報名完成' : '購物車與結帳'}
  sub={$cart.length > 0 && step < 2 ? $cart.length + ' 門課程' : ''}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <Stepper steps={['購物車', '付款', '完成']} current={step} />

    {#if step === 0}
      {#if $cart.length === 0}
        <MEmpty icon="shopping-cart" title="購物車是空的" body="還沒有選擇任何課程，先去看看有哪些適合孩子的課程吧。">
          <svelte:fragment slot="action">
            <Button variant="primary" on:click={onClose} style="display:flex; align-items:center; gap:6px;">
              <Icon name="graduation-cap" size={16} />瀏覽課程
            </Button>
          </svelte:fragment>
        </MEmpty>
      {:else}
        <div style="display:flex; flex-direction:column; gap:10px;">
          {#each $cart as c (c.id)}
            <div style="display:flex; align-items:center; gap:11px; background:var(--df-bg-light); border-radius:13px; padding:11px;">
              <div style="width:44px; height:44px; border-radius:11px; background:#fff; display:flex; align-items:center; justify-content:center; flex:none;">
                <Icon name={c.icon as string} size={22} color="var(--df-primary)" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:14px; font-weight:700; color:var(--df-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{c.name}</div>
                <div style="font-size:12.5px; font-weight:700; color:var(--df-primary); margin-top:2px; font-family:var(--df-font-mono);">{fmtNT(c.price * c.qty)}</div>
              </div>
              <button
                aria-label="移除"
                on:click={() => cart.remove(c.id)}
                class="df-tapscale"
                style="width:32px; height:32px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;"
              >
                <Icon name="trash-2" size={16} color="var(--df-text-light)" />
              </button>
            </div>
          {/each}
        </div>
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--df-text-dark); margin-bottom:7px;">優惠碼</div>
          <div style="display:flex; gap:9px;">
            <Input placeholder="如 DREAMFLY100" bind:value={code} error={codeErr} on:input={() => (codeErr = '')} style="flex:1;" />
            <Button variant="secondary" on:click={applyCode} style="height:44px;">套用</Button>
          </div>
          {#if coupon}
            <div style="margin-top:8px; display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--df-success);">
              <Icon name="badge-check" size={15} color="var(--df-success)" />已套用 {coupon.code}，折抵 {fmtNT(m.couponOff)}
            </div>
          {/if}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--df-bg-light); border-radius:12px; padding:12px 14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <Icon name="star" size={18} color="var(--df-accent-dark)" />
            <div>
              <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">使用點數折抵</div>
              <div style="font-size:12px; color:var(--df-text-light);">可用 {$points.toLocaleString()} 點 (1 點 = NT$1)</div>
            </div>
          </div>
          <Switch bind:checked={usePoints} />
        </div>
      {/if}
    {/if}

    {#if step === 1}
      <div style="display:flex; flex-direction:column; gap:13px;">
        <Input label="持卡人姓名" value={ME.name} />
        <Input label="卡號" placeholder="0000 0000 0000 0000" />
        <div style="display:flex; gap:12px;">
          <Input label="有效期限" placeholder="MM/YY" style="flex:1;" />
          <Input label="安全碼" placeholder="CVC" style="flex:1;" />
        </div>
        <div style="border-top:1px solid var(--df-border); padding-top:13px; display:flex; flex-direction:column; gap:7px; font-size:13.5px;">
          <div style="display:flex; justify-content:space-between; color:var(--df-text-light);"><span>小計</span><span style="font-family:var(--df-font-mono);">{fmtNT(m.subtotal)}</span></div>
          {#if m.couponOff > 0}
            <div style="display:flex; justify-content:space-between; color:var(--df-success);"><span>優惠碼 {coupon?.code}</span><span style="font-family:var(--df-font-mono);">−{fmtNT(m.couponOff)}</span></div>
          {/if}
          {#if m.ptRedeem > 0}
            <div style="display:flex; justify-content:space-between; color:var(--df-success);"><span>點數折抵</span><span style="font-family:var(--df-font-mono);">−{fmtNT(m.ptRedeem)}</span></div>
          {/if}
        </div>
        <NoteBox icon="shield-check" tone="var(--df-success)">付款採 SSL 加密，資料安全無虞。</NoteBox>
      </div>
    {/if}

    {#if step === 2}
      <SuccessBody title="報名完成！" body={`課程已加入你的日程，上課提醒將於課前一日發送。本次獲得 ${paid.earned} 點會員點數（訂單編號 ${paid.orderNumber}）。`} />
    {/if}
  </div>

  <svelte:fragment slot="footer">
    {#if step === 0}
      <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:12px;">
        <div style="font-size:12.5px; color:var(--df-text-light);">合計<div style="font-size:20px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{fmtNT(m.total)}</div></div>
        <Button variant="primary" disabled={$cart.length === 0} on:click={() => (step = 1)} style="flex:1; max-width:200px; display:flex; align-items:center; justify-content:center; gap:6px;">前往付款<Icon name="arrow-right" size={16} /></Button>
      </div>
    {:else if step === 1}
      <div style="display:flex; gap:10px; width:100%;">
        <Button variant="secondary" disabled={paying} on:click={() => (step = 0)}>返回</Button>
        <Button variant="primary" disabled={paying} on:click={confirmPayment} style="flex:1;">{paying ? '處理中…' : `確認付款 ${fmtNT(m.total)}`}</Button>
      </div>
    {:else}
      <Button variant="primary" fullWidth on:click={done}>完成</Button>
    {/if}
  </svelte:fragment>
</Sheet>
