<script lang="ts">
  /* 購物車 / 結帳 sheet（3 步驟）。mobile/home.jsx CartSheet (245-337)。
   * (1) 課程明細 + 優惠碼 + 點數折抵；(2) 付款(卡片欄位是裝飾性、鏡射桌面
   * CheckoutDialog 的既有決定——後端本身就是 mock payment：下單成功即代表付款
   * 完成，見 integration-contract.md §1.8，desktop 的卡號等欄位同樣從未接上
   * 任何 state)；(3) SuccessBody。課程是報名不是數量，購物車行不再有增減數量
   * 的控制項（qty 鎖 1，見 stores.ts 的 cart.add()）。
   *
   * 確認付款 → 復用桌面 member 的結帳 seam 真下單（見 $lib/mobile/stores.ts 的
   * checkout 單例：createCheckout 的私有 placeOrder，syncCartToServer + POST
   * /orders + refreshPoints），成功/失敗都以真實 API 回應為準——不再有本地假
   * checkout()、假成功 toast、假點數。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import NoteBox from '$lib/components/mobile/NoteBox.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Stepper from '$lib/components/ui/Stepper.svelte';
  import { onMount, onDestroy } from 'svelte';
  // Task 7(架構深化 R15·F-4)：points/orderErrorMessage 改直取擁有者模組
  // （$lib/member/points、$lib/member/checkout），不再經 $lib/mobile/stores 轉手。
  // C2(R11)/C3(R13)：checkout 仍經 mobile/stores 取用——付款狀態機與桌面共用
  // 同一份機器，這裡拿的是 stores.ts 的模組級單例（見下方）。Task 5(R14·F4)：
  // 優惠碼套用與可計費預覽（chargeableLines + checkoutMath）也收進該單例，本
  // 元件只讀 $checkout.preview；Task 9(R15·F-5)：真點數水合也收進該單例
  // （createCheckout 的 refreshOnOpen），本元件不再自己 refreshPoints()。
  import { cart, toasts, checkout } from '$lib/mobile/stores';
  import { points } from '$lib/member/points';
  import { orderErrorMessage } from '$lib/member/checkout';
  import { fmtNT } from '$lib/format';
  import { authStore } from '$lib/stores/authStore';

  export let onClose: () => void;

  /* ── 付款狀態機（step/paying/paid、idempotencyKey 生命週期、防重複扣款守衛）與桌面
   * CheckoutDialog 共用同一顆 checkout-controller（C2/R11 雙生收斂，經 seam 取用）；
   * 本元件退化為快照鏡射 + 表單 bind + outcome → toast 文案的薄 adapter。
   *
   * C3/R13：controller 改為 stores.ts 的模組級單例，生命週期比本元件（CartSheet 隨
   * sheet 開關掛載/卸載，見 OverlayHost：`{#if $overlay.sheet} <svelte:component .../>`）
   * 活得久——不再每開一次就 new 一顆。掛載/卸載時呼叫 setOpen(true/false)（同桌面
   * CheckoutDialog 的 $checkoutOpen 閉→開偵測），讓「sheet 在付款飛行中被外力關閉
   * （如導航觸發的 closeAll）又重開」也能延續同一把 idempotencyKey、鎖住 paying，
   * 不會開出第二張真訂單。 ── */
  let step = 0;
  let paying = false;
  // paid：付款時的成交快照（金額/點數以 API 回應為準，非本地試算 m.*），購物車清空後
  // 完成步仍照快照顯示。型別即 controller 的 PaidSummary，不在這裡窄化——行動版只是用
  // 不到 hasCourse/hasPass（購物車只產 course，無方案動線，文案不分支）。
  let paid = { total: 0, earned: 0, ptRedeem: 0, hasCourse: false, hasPass: false, orderNumber: '' };
  $: ({ step, paying, paid } = $checkout);
  // m：本地預覽（chargeableLines + checkoutMath，由 controller 算）。
  $: m = $checkout.preview;

  // Task 5(R14·F4)：結算表單住 controller（checkout.form），付款飛行中卸載再重開仍保留
  // （resumedInFlight），freshCheckout 才重置——見 checkout-controller 檔頭。
  const form = checkout.form;

  // 掛載 = setOpen(true)、卸載 = setOpen(false)（C3/R13：controller 是模組級單例，
  // 靠這兩個邊沿讓機器知道「本次是哪一次結帳嘗試」）。freshCheckout（無飛行中）時
  // 的真點數餘額水合已收進 checkout 單例本身（Task 9(R15·F-5)：createCheckout 的
  // refreshOnOpen，見 $lib/mobile/stores.ts），本元件不必再自己判斷 outcome。
  onMount(() => {
    checkout.setOpen(true);
  });
  onDestroy(() => {
    checkout.setOpen(false);
  });

  // C6：預覽金額只算「可計費項目」——checkout 單例的 lines（stores.ts）是 chargeableLines
  // 的輸出，與請款（createCheckout 的 placeOrder）同一產地，型別強制「預覽合計 ≡ 實際請款」。
  // 下方明細列表（{#each $cart}）仍照舊渲染整車，對照 desktop CheckoutDialog 同款:
  // 使用者看得到自己加了什麼，只是合計不把已持有的 pass 重複計費。
  // 刻意不在 onMount 加 refreshSubscriptions():mobile 購物車只產 course
  // （cart.add 只收 Course），過濾恆 no-op 的保證來自這裡——並非 subscriptions 恆空
  // （R15 候選 F2 起行動版帳戶頁不再暖這支，desktop 帳戶頁的暖機才可能水合它）;
  // 未來方案動線上架時，在上方 onMount 補一次 refreshSubscriptions() 水合
  // 即可（座標留此，desktop CheckoutDialog 開啟即水合訂閱是既有先例）。

  /* 確認付款 → 真下單（placeOrder：同步購物車 → POST /orders → 水合真點數 →
   * 清空購物車）。送單機器與「成功才進 step 2」在 controller（送單讀它
   * 自己那份表單與優惠碼）；這裡只把 outcome 轉 toast 文案。顯示的金額/點數/訂單編號一律來自
   * 真實 API 回應（paid.*），不是本地預覽（m.*）。失敗顯示後端錯誤訊息轉繁中，購物車
   * 不清空，讓使用者可以直接重試（沿用同一把 idempotencyKey，不會重複扣款）。
   * 行動版不做付款方式選擇 UI（Round 4 P4-F4 裁決），form 的付款方式恆為預設 credit_card；
   * alreadyPaying／nothingChargeable 是按鈕 disabled 之外的第二道防線，靜默返回。 */
  async function confirmPayment() {
    const outcome = await checkout.confirmPay();
    if (outcome.kind === 'orderPlaced') {
      const { earned, ptRedeem } = outcome.paid;
      const redeemNote = ptRedeem > 0 ? `，使用 ${ptRedeem} 點折抵` : '';
      toasts.notify('success', '報名完成', `課程已加入你的日程${redeemNote}，獲得 ${earned} 點回饋。`);
    } else if (outcome.kind === 'orderFailed') {
      toasts.notify('error', '結帳失敗', orderErrorMessage(outcome.error));
    }
  }
  // 付款請求飛行中不可關閉（X／遮罩／Esc 都走 Sheet 的 onClose，見下方 <Sheet
  // onClose={close}>）：同桌面 CheckoutDialog 的 close() 守衛——鎖住直到 promise 落定，
  // 否則使用者會被跟付款結果隔開。導航觸發的 closeAll() 不經這裡，繞過守衛直接關閉
  // （見 stores.ts 的 overlay.closeAll），重開走 onMount 的 resumedInFlight。
  function close() {
    if (paying) return;
    onClose();
  }
  function done() {
    onClose();
  }
</script>

<Sheet
  open
  onClose={close}
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
                <Icon name={c.icon} size={22} color="var(--df-primary)" />
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
            <Input placeholder="如 DREAMFLY100" bind:value={$form.code} error={$checkout.codeErr} on:input={checkout.clearCodeErr} style="flex:1;" />
            <Button variant="secondary" on:click={checkout.applyCode} style="height:44px;">套用</Button>
          </div>
          {#if $checkout.coupon}
            <div style="margin-top:8px; display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--df-success);">
              <Icon name="badge-check" size={15} color="var(--df-success)" />已套用 {$checkout.coupon.code}，折抵 {fmtNT(m.couponOff)}
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
          <Switch bind:checked={$form.usePoints} />
        </div>
      {/if}
    {/if}

    {#if step === 1}
      <div style="display:flex; flex-direction:column; gap:13px;">
        <Input label="持卡人姓名" value={$authStore.member?.name ?? ''} />
        <Input label="卡號" placeholder="0000 0000 0000 0000" />
        <div style="display:flex; gap:12px;">
          <Input label="有效期限" placeholder="MM/YY" style="flex:1;" />
          <Input label="安全碼" placeholder="CVC" style="flex:1;" />
        </div>
        <div style="border-top:1px solid var(--df-border); padding-top:13px; display:flex; flex-direction:column; gap:7px; font-size:13.5px;">
          <div style="display:flex; justify-content:space-between; color:var(--df-text-light);"><span>小計</span><span style="font-family:var(--df-font-mono);">{fmtNT(m.subtotal)}</span></div>
          {#if m.couponOff > 0}
            <div style="display:flex; justify-content:space-between; color:var(--df-success);"><span>優惠碼 {$checkout.coupon?.code}</span><span style="font-family:var(--df-font-mono);">−{fmtNT(m.couponOff)}</span></div>
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
        <Button variant="primary" disabled={$cart.length === 0} on:click={checkout.toPayment} style="flex:1; max-width:200px; display:flex; align-items:center; justify-content:center; gap:6px;">前往付款<Icon name="arrow-right" size={16} /></Button>
      </div>
    {:else if step === 1}
      <div style="display:flex; gap:10px; width:100%;">
        <Button variant="secondary" disabled={paying} on:click={checkout.backToCart}>返回</Button>
        <Button variant="primary" disabled={paying} on:click={confirmPayment} style="flex:1;">{paying ? '處理中…' : `確認付款 ${fmtNT(m.total)}`}</Button>
      </div>
    {:else}
      <Button variant="primary" fullWidth on:click={done}>完成</Button>
    {/if}
  </svelte:fragment>
</Sheet>
