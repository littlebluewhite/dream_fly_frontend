<script lang="ts">
  /* Cart → checkout → done modal, available across all member routes (mounted in
   * the layout, opened from the topbar cart button via the checkoutOpen store).
   * Ported from the prototype's CheckoutDialog. */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Stepper from '$lib/components/ui/Stepper.svelte';
  import EmptyState from './EmptyState.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import { cart, points, subscriptions, checkoutOpen, toasts, applyOrder } from '$lib/member/stores';
  import { fmtNT } from '$lib/member/format';
  import { commitCheckout, chargeableLines } from '$lib/member/checkout';
  import { checkoutMath, lookupCoupon } from '$lib/checkout-math';

  let step = 0;
  let code = '';
  let coupon: { code: string; off: number } | null = null;
  let codeErr = '';
  let usePoints = false;
  // Amounts + cart composition snapshotted at payment time so the success step
  // keeps showing them after the cart is cleared.
  let paid = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false };

  // Reset state whenever the dialog transitions closed → open.
  let wasOpen = false;
  $: {
    const open = $checkoutOpen;
    if (open && !wasOpen) {
      step = 0;
      code = '';
      coupon = null;
      codeErr = '';
      usePoints = false;
      paid = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false };
    }
    wasOpen = open;
  }

  $: items = $cart;
  // chargeableLines + checkoutMath：顯示與 commit 同源，避免計算漂移。
  $: chargeable = chargeableLines($cart, $subscriptions);
  $: m = checkoutMath(chargeable, coupon, $points, usePoints);

  function applyCode() {
    if (!code.trim()) return;                    // 保留空守衛：空輸入按「套用」不顯示錯誤（決策 #4）
    const hit = lookupCoupon(code);              // lookupCoupon 內部已 trim+toUpperCase，回 {code,off}|null
    if (hit) { coupon = hit; codeErr = ''; }
    else { coupon = null; codeErr = '優惠碼無效或已過期'; }
  }
  function close() {
    checkoutOpen.set(false);
  }
  function browse() {
    close();
    goto('/member/courses');
  }
  // Commit the order when the user confirms payment (step 1 → 2), NOT on the
  // final 完成 button — otherwise closing the success step via X/overlay/Escape
  // would leave the cart and points uncommitted while the UI says 已付款.
  function confirmPay() {
    // 本地補零 today（勿用 toISOString=UTC，台灣 UTC+8 近午夜會 off-by-one）；在函式內算，勿 module-scope。
    const n = new Date();
    const today = `${n.getFullYear()}/${String(n.getMonth() + 1).padStart(2, '0')}/${String(n.getDate()).padStart(2, '0')}`;
    const r = commitCheckout($cart, { points: $points, usePoints, coupon, ownedSubs: $subscriptions, today });
    paid = { total: r.total, earned: r.earned, ptRedeem: r.ptRedeem, hasCourse: r.hasCourse, hasPass: r.hasPass };
    applyOrder(r);
    const redeemNote = r.ptRedeem > 0 ? '，使用 ' + r.ptRedeem + ' 點折抵' : '';
    if (r.hasCourse) toasts.notify('success', '報名完成', '課程已加入你的日程' + (r.hasPass ? '，方案使用權已啟用' : '') + redeemNote + '，獲得 ' + r.earned + ' 點回饋。');
    else             toasts.notify('success', '訂閱開通', '方案已開通,使用權已啟用' + redeemNote + '，獲得 ' + r.earned + ' 點回饋。');
    step = 2;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $checkoutOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" on:click={close}>
    <div class="panel" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation>
      <div class="head">
        <h3>購物車與結帳</h3>
        <IconButton aria-label="關閉" variant="ghost" on:click={close}><Icon name="x" size={20} /></IconButton>
      </div>

      <div class="body df-scroll">
        <Stepper steps={['購物車', '結帳付款', '完成']} current={step} style="margin-bottom:26px" />

        {#if step === 0}
          {#if items.length === 0}
            <EmptyState icon="shopping-cart" title="購物車是空的" body="還沒有選擇任何課程，先去看看有哪些適合的課程吧。" pad="24px 0">
              <Button slot="action" variant="primary" on:click={browse}><Icon name="graduation-cap" size={16} /> 瀏覽課程</Button>
            </EmptyState>
          {/if}
          {#each items as c (c.id)}
            <div class="line">
              <div class="line-ic"><Icon name={c.icon} size={22} color="var(--df-primary)" /></div>
              <div class="line-info">
                <div class="line-name">{c.name}</div>
                <div class="line-sub">
                  {#if c.type === 'pass'}{c.duration}{:else if c.days}{c.days}{c.coach ? ` · ${c.coach} 教練` : ''}{:else}{c.duration}{/if}
                </div>
              </div>
              {#if c.type !== 'pass'}
                <div class="qty">
                  <button aria-label="減量" on:click={() => cart.updateQty(c.id, -1)} disabled={c.qty <= 1}><Icon name="minus" size={14} /></button>
                  <span class="qty-n">{c.qty}</span>
                  <button aria-label="加量" on:click={() => cart.updateQty(c.id, 1)}><Icon name="plus" size={14} /></button>
                </div>
              {/if}
              <div class="line-amt">{fmtNT(c.price * c.qty)}</div>
              <IconButton aria-label="移除" variant="ghost" on:click={() => cart.remove(c.id)}><Icon name="trash-2" size={16} color="var(--df-text-light)" /></IconButton>
            </div>
          {/each}
          {#if items.length > 0}
            <div class="extras">
              <div>
                <div class="extras-label">優惠碼</div>
                <div class="coupon-row">
                  <Input placeholder="輸入優惠碼（如 DREAMFLY100）" bind:value={code} error={codeErr} on:input={() => (codeErr = '')} style="flex:1" />
                  <Button variant="secondary" on:click={applyCode} style="height:44px">套用</Button>
                </div>
                {#if coupon}
                  <div class="coupon-ok">
                    <Icon name="badge-check" size={15} color="var(--df-success)" /> 已套用 {coupon.code}，折抵 {fmtNT(m.couponOff)}
                    <button class="link" on:click={() => { coupon = null; code = ''; }}>移除</button>
                  </div>
                {/if}
              </div>
              <div class="points-row">
                <div class="points-left">
                  <Icon name="star" size={18} color="var(--df-accent-dark)" />
                  <div>
                    <div class="pr-title">使用會員點數折抵</div>
                    <div class="pr-sub">可用 {$points.toLocaleString()} 點{usePoints && m.ptRedeem > 0 ? '，此單折抵 ' + fmtNT(m.ptRedeem) : '（1 點 = NT$1）'}</div>
                  </div>
                </div>
                <Switch bind:checked={usePoints} />
              </div>
            </div>
          {/if}
        {:else if step === 1}
          <div class="pay">
            <Input label="持卡人姓名" value="王小明" />
            <Input label="卡號" placeholder="0000 0000 0000 0000" />
            <div class="pay-row">
              <Input label="有效期限" placeholder="MM/YY" style="flex:1" />
              <Input label="安全碼" placeholder="CVC" style="flex:1" />
            </div>
            <div class="summary">
              <div class="sum-row"><span>小計</span><span class="mono">{fmtNT(m.subtotal)}</span></div>
              {#if m.couponOff > 0}<div class="sum-row ok"><span>優惠碼 {coupon?.code}</span><span class="mono">−{fmtNT(m.couponOff)}</span></div>{/if}
              {#if m.ptRedeem > 0}<div class="sum-row ok"><span>點數折抵</span><span class="mono">−{fmtNT(m.ptRedeem)}</span></div>{/if}
            </div>
            <div class="ssl"><Icon name="shield-check" size={16} color="var(--df-success)" /> 付款採 SSL 加密，資料安全無虞。</div>
          </div>
        {:else if paid.hasCourse}
          <SuccessBody title="報名完成！" body={`課程已加入你的日程${paid.hasPass ? '，方案使用權已啟用' : ''}，上課提醒將於課前一日發送。本次獲得 ${paid.earned} 點會員點數。`} />
        {:else}
          <SuccessBody title="訂閱開通！" body={`方案已開通,使用權已啟用,可在帳戶頁查看。本次獲得 ${paid.earned} 點會員點數。`} />
        {/if}
      </div>

      <div class="foot">
        <div class="total">
          {step === 2 ? '已付款' : '合計'}
          <span class="total-n">{fmtNT(step === 2 ? paid.total : m.total)}</span>
        </div>
        {#if step === 0}
          <Button variant="primary" disabled={items.length === 0} on:click={() => (step = 1)}>前往付款 <Icon name="arrow-right" size={16} /></Button>
        {:else if step === 1}
          <div class="foot-actions">
            <Button variant="secondary" on:click={() => (step = 0)}>返回</Button>
            <Button variant="primary" on:click={confirmPay}>確認付款</Button>
          </div>
        {:else}
          <Button variant="primary" on:click={close}>完成</Button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    font-family: var(--df-font-body);
  }
  .panel {
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    background: #fff;
    border-radius: 16px;
    box-shadow: var(--df-shadow-strong);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .head {
    padding: 22px 26px;
    border-bottom: 1px solid var(--df-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: none;
  }
  .head h3 {
    margin: 0;
    font-family: var(--df-font-heading);
    font-size: 20px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .body {
    padding: 24px 26px;
    overflow-y: auto;
    flex: 1;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 14px 0;
    border-bottom: 1px solid var(--df-border);
  }
  .line-ic {
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: var(--df-primary-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .line-info {
    flex: 1;
    min-width: 0;
  }
  .line-name {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .line-sub {
    font-size: 12.5px;
    color: var(--df-text-light);
  }
  .qty {
    display: flex;
    align-items: center;
    border: 1px solid var(--df-border);
    border-radius: 9px;
    overflow: hidden;
  }
  .qty button {
    width: 30px;
    height: 32px;
    border: none;
    background: var(--df-bg-light);
    cursor: pointer;
    color: var(--df-text-dark);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qty button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .qty-n {
    width: 32px;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--df-font-mono);
    color: var(--df-ink);
  }
  .line-amt {
    width: 86px;
    text-align: right;
    font-weight: 700;
    color: var(--df-ink);
    font-family: var(--df-font-mono);
  }
  .extras {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .extras-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--df-text-dark);
    margin-bottom: 7px;
  }
  .coupon-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .coupon-ok {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--df-success);
  }
  .link {
    border: none;
    background: none;
    color: var(--df-text-muted);
    cursor: pointer;
    text-decoration: underline;
    font-size: 12.5px;
  }
  .points-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--df-bg-light);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .points-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pr-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .pr-sub {
    font-size: 12.5px;
    color: var(--df-text-light);
  }
  .pay {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pay-row {
    display: flex;
    gap: 14px;
  }
  .summary {
    border-top: 1px solid var(--df-border);
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 13.5px;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    color: var(--df-text-light);
  }
  .sum-row.ok {
    color: var(--df-success);
  }
  .mono {
    font-family: var(--df-font-mono);
  }
  .ssl {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--df-text-light);
    background: var(--df-bg-light);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .foot {
    padding: 18px 26px;
    border-top: 1px solid var(--df-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: none;
  }
  .total {
    font-size: 14px;
    color: var(--df-text-light);
  }
  .total-n {
    font-size: 21px;
    font-weight: 800;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
    margin-left: 4px;
  }
  .foot-actions {
    display: flex;
    gap: 10px;
  }
</style>
