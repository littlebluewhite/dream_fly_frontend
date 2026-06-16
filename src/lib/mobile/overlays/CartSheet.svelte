<script lang="ts">
  /* 購物車 / 結帳 sheet（3 步驟）。mobile/home.jsx CartSheet (245-337)。
   * (1) 課程明細 + 數量 stepper + 優惠碼 + 點數折抵；(2) 付款方式；(3) SuccessBody。
   * 確認付款 → checkout(ptRedeem, earned) + toast。金額計算抽到 cart-math.ts。 */
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import SuccessBody from '$lib/mobile/components/SuccessBody.svelte';
  import NoteBox from '$lib/mobile/components/NoteBox.svelte';
  import MEmpty from '$lib/mobile/components/MEmpty.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Stepper from '$lib/components/ui/Stepper.svelte';
  import { cart, points, checkout, toasts } from '$lib/mobile/stores';
  import { fmtNT, ME } from '$lib/mobile/data';
  import { lookupCoupon, checkoutMath } from '$lib/mobile/cart-math';

  export let onClose: () => void;

  let step = 0;
  let code = '';
  let coupon: { code: string; off: number } | null = null;
  let codeErr = '';
  let usePoints = false;
  let earnedFinal = 0;

  $: m = checkoutMath($cart, coupon, $points, usePoints);

  function applyCode() {
    const found = lookupCoupon(code);
    if (found) {
      coupon = found;
      codeErr = '';
    } else {
      coupon = null;
      codeErr = '優惠碼無效或已過期';
    }
  }

  /* Commit the checkout at 確認付款 (capturing `earned` first — `checkout` clears
   * the cart, which zeroes the reactive `m.earned`). The success screen then just
   * closes, so abandoning it via X / scrim / Escape never loses a paid checkout. */
  function confirmPayment() {
    earnedFinal = m.earned;
    checkout(m.ptRedeem, m.earned);
    toasts.notify('success', '報名完成', `本次獲得 ${earnedFinal} 點會員點數`);
    step = 2;
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
              <div style="display:flex; align-items:center; border:1px solid var(--df-border); border-radius:9px; overflow:hidden; background:#fff;">
                <button
                  aria-label="減"
                  on:click={() => cart.updateQty(c.id, -1)}
                  disabled={c.qty <= 1}
                  style="width:28px; height:30px; border:none; background:transparent; cursor:{c.qty <= 1 ? 'not-allowed' : 'pointer'}; opacity:{c.qty <= 1 ? 0.4 : 1}; display:flex; align-items:center; justify-content:center;"
                >
                  <Icon name="minus" size={13} />
                </button>
                <span style="width:26px; text-align:center; font-size:13px; font-weight:700; font-family:var(--df-font-mono);">{c.qty}</span>
                <button
                  aria-label="加"
                  on:click={() => cart.updateQty(c.id, 1)}
                  style="width:28px; height:30px; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center;"
                >
                  <Icon name="plus" size={13} />
                </button>
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
      <SuccessBody title="報名完成！" body={`課程已加入你的日程，上課提醒將於課前一日發送。本次獲得 ${earnedFinal} 點會員點數。`} />
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
        <Button variant="secondary" on:click={() => (step = 0)}>返回</Button>
        <Button variant="primary" on:click={confirmPayment} style="flex:1;">確認付款 {fmtNT(m.total)}</Button>
      </div>
    {:else}
      <Button variant="primary" fullWidth on:click={done}>完成</Button>
    {/if}
  </svelte:fragment>
</Sheet>
