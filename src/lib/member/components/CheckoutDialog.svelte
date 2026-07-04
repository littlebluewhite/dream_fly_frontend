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
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import { cart, points, subscriptions, checkoutOpen, toasts, placeOrder } from '$lib/member/stores';
  import { fmtNT } from '$lib/member/format';
  import { chargeableLines, validateCoupon } from '$lib/member/checkout';
  import { checkoutMath } from '$lib/checkout-math';
  import { ApiError } from '$lib/api/client';
  import { ntd } from '$lib/public/adapters';

  let step = 0;
  let code = '';
  let coupon: { code: string; off: number } | null = null;
  let codeErr = '';
  let usePoints = false;
  let paying = false;
  // 每次結帳流程（dialog 開啟）產生一次、重試沿用同一把，讓後端能辨識重放而不
  // 重複扣款/建立報名訂閱（integration-contract.md §1.7）。
  let idempotencyKey = crypto.randomUUID();
  // Amounts + cart composition snapshotted at payment time so the success step
  // keeps showing them after the cart is cleared. Now sourced straight from the
  // API's OrderResponse, not local math — only the pre-payment preview (m,
  // below) stays local.
  let paid = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false, orderNumber: '' };

  // 已知的後端英文錯誤訊息（integration-contract.md §3.10）→ 繁中 toast 文案；
  // 未命中的錯誤（網路失敗等）落回通用訊息。
  const ORDER_ERROR_MESSAGES: [string, string][] = [
    ['cart is empty', '購物車是空的，請先加入商品'],
    ['invalid coupon', '優惠碼無效，請確認後再試'],
    ['course is full', '課程已額滿，請改選候補或其他班別'],
    ['already enrolled', '你已經報名過這堂課程了'],
    ['insufficient points', '點數不足，請取消使用點數折抵'],
    ['insufficient stock', '商品庫存不足，請減少數量或移除該項目'],
    ['duplicate checkout', '訂單處理中，請稍候再試']
  ];
  function orderErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      const hit = ORDER_ERROR_MESSAGES.find(([needle]) => err.message.includes(needle));
      if (hit) return hit[1];
    }
    return '結帳失敗，請稍後再試';
  }

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
      paying = false;
      idempotencyKey = crypto.randomUUID();
      paid = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false, orderNumber: '' };
    }
    wasOpen = open;
  }

  $: items = $cart;
  // chargeableLines + checkoutMath：顯示用預覽，與送單前同源，避免計算漂移；
  // 成交金額改以 API 回應（paid.*）為準，見 confirmPay。
  $: chargeable = chargeableLines($cart, $subscriptions);
  $: m = checkoutMath(chargeable, coupon, $points, usePoints);

  async function applyCode() {
    if (!code.trim()) return;                    // 保留空守衛：空輸入按「套用」不顯示錯誤（決策 #4）
    let hit: { code: string; off: number } | null;
    try {
      hit = await validateCoupon(code);
    } catch {
      hit = null; // 網路/未預期錯誤與「查無優惠碼」一視同仁，不另開技術性錯誤文案
    }
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
  // placeOrder 打真實 POST /orders（mock payment：成功即付款完成）；任何失敗
  // 都不會清空本地購物車，只顯示錯誤 toast，讓使用者可以直接重試（沿用同一把
  // idempotencyKey，不會重複扣款/建立報名訂閱）。
  async function confirmPay() {
    if (paying) return; // 避免連點造成 syncCartToServer 競態
    paying = true;
    try {
      const order = await placeOrder(coupon?.code ?? '', usePoints, idempotencyKey);
      const hasCourse = order.items.some((i) => i.item_type === 'course');
      const hasPass = order.items.some((i) => i.item_type === 'product');
      paid = {
        total: ntd(order.total_cents),
        earned: order.points_earned,
        ptRedeem: order.points_used,
        hasCourse,
        hasPass,
        orderNumber: order.order_number
      };
      const redeemNote = paid.ptRedeem > 0 ? '，使用 ' + paid.ptRedeem + ' 點折抵' : '';
      if (hasCourse) toasts.notify('success', '報名完成', '課程已加入你的日程' + (hasPass ? '，方案使用權已啟用' : '') + redeemNote + '，獲得 ' + paid.earned + ' 點回饋。');
      else           toasts.notify('success', '訂閱開通', '方案已開通,使用權已啟用' + redeemNote + '，獲得 ' + paid.earned + ' 點回饋。');
      step = 2;
    } catch (err) {
      toasts.notify('error', '結帳失敗', orderErrorMessage(err));
    } finally {
      paying = false;
    }
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
                  {#if c.type === 'pass'}{c.desc ?? ''}{:else if c.days}{c.days}{:else}{c.desc ?? ''}{/if}
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
          <SuccessBody title="報名完成！" body={`課程已加入你的日程${paid.hasPass ? '，方案使用權已啟用' : ''}，上課提醒將於課前一日發送。本次獲得 ${paid.earned} 點會員點數（訂單編號 ${paid.orderNumber}）。`} />
        {:else}
          <SuccessBody title="訂閱開通！" body={`方案已開通,使用權已啟用,可在帳戶頁查看。本次獲得 ${paid.earned} 點會員點數（訂單編號 ${paid.orderNumber}）。`} />
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
            <Button variant="secondary" disabled={paying} on:click={() => (step = 0)}>返回</Button>
            <Button variant="primary" disabled={paying} on:click={confirmPay}>{paying ? '處理中…' : '確認付款'}</Button>
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
