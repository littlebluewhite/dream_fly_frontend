<script lang="ts">
  import { goto } from '$app/navigation';
  import { cart } from '$lib/member/stores';
  import { isLoggedIn } from '$lib/stores/authStore';
  import { checkoutTarget } from '$lib/checkout-gate';
  import { toasts } from '$lib/stores/marketingToasts';
  import type { CartItem } from '$lib/member/data';
  import Icon from '$lib/components/ui/Icon.svelte';

  $: total = $cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function removeItem(item: CartItem) {
    cart.remove(item.id);
    toasts.notify('success', `已移除 ${item.name}`);
  }

  function clearAllItems() {
    if (confirm('確定要清空購物車嗎？')) {
      cart.clear();
      toasts.notify('info', '購物車已清空');
    }
  }

  function checkout() {
    goto(checkoutTarget($isLoggedIn));
  }
</script>

<svelte:head>
  <title>購物車 - Dream Fly 體操館</title>
</svelte:head>

<div class="cart-page">
  <section class="page-header">
    <div class="container">
      <h1>購物車</h1>
      <p>確認您的選購項目</p>
    </div>
  </section>

  <section class="cart-content">
    <div class="container">
      {#if $cart.length === 0}
        <div class="empty-cart card">
          <div class="empty-icon"><Icon name="shopping-cart" size={64} color="var(--df-primary)" /></div>
          <h2>購物車是空的</h2>
          <p>還沒有選購任何課程或票券</p>
          <div class="empty-actions">
            <a href="/courses" class="btn btn-primary">瀏覽課程</a>
            <a href="/tickets" class="btn btn-secondary">查看票券</a>
          </div>
        </div>
      {:else}
        <div class="cart-layout">
          <div class="cart-items-section">
            <div class="section-header">
              <h2>購物車項目</h2>
              <button class="clear-all-btn" on:click={clearAllItems}>清空購物車</button>
            </div>

            <div class="cart-items">
              {#each $cart as item (item.id)}
                <div class="cart-item card">
                  <div class="item-main">
                    <div class="item-info">
                      <h3>{item.name}</h3>
                      <div class="item-meta">
                        <span class="item-type">
                          {item.type === 'course' ? '課程' : '票券'}
                        </span>
                        {#if item.level}
                          <span class="item-level">{item.level}</span>
                        {/if}
                      </div>
                      <p class="item-duration">
                        {#if item.type === 'pass'}
                          {item.desc ?? ''}
                        {:else if item.days}
                          {item.days}
                        {:else}
                          {item.desc ?? ''}
                        {/if}
                      </p>
                    </div>

                    <div class="item-actions">
                      <div class="item-price-section">
                        <p class="unit-price">單價：NT$ {item.price.toLocaleString()}</p>
                        <p class="subtotal">
                          小計：NT$ {(item.price * item.qty).toLocaleString()}
                        </p>
                      </div>

                      <button class="remove-btn" on:click={() => removeItem(item)}>
                        移除
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="order-summary-section">
            <div class="order-summary card">
              <h2>訂單摘要</h2>

              <div class="summary-details">
                <div class="summary-row">
                  <span>項目總數</span>
                  <span>{$cart.reduce((sum, item) => sum + item.qty, 0)} 項</span>
                </div>
                <div class="summary-row">
                  <span>商品總計</span>
                  <span>NT$ {total.toLocaleString()}</span>
                </div>
                <div class="summary-row highlight">
                  <span class="total-label">總計</span>
                  <span class="total-amount">NT$ {total.toLocaleString()}</span>
                </div>
              </div>

              <div class="summary-actions">
                <button class="btn btn-primary btn-large" on:click={checkout}>前往結帳</button>
                <a href="/courses" class="btn btn-secondary">繼續選購</a>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary), var(--df-primary-dark));
    color: var(--df-white);
    padding: var(--df-space-8) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-white);
    font-size: 2.5rem;
    margin-bottom: var(--df-space-4);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .cart-content {
    padding: var(--df-space-8) 0;
    min-height: 60vh;
  }

  .empty-cart {
    text-align: center;
    padding: var(--df-space-8) var(--df-space-6);
    max-width: 500px;
    margin: 0 auto;
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    margin-bottom: var(--df-space-5);
  }

  .empty-cart h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-4);
  }

  .empty-cart p {
    color: var(--df-text-light);
    margin-bottom: var(--df-space-6);
  }

  .empty-actions {
    display: flex;
    gap: var(--df-space-5);
    justify-content: center;
  }

  .cart-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--df-space-6);
    align-items: start;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--df-space-5);
  }

  .section-header h2 {
    color: var(--df-primary);
    margin: 0;
  }

  .clear-all-btn {
    background: none;
    border: 1px solid var(--df-error);
    color: var(--df-error);
    padding: 0.5rem 1rem;
    border-radius: var(--df-radius-md);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all var(--transition-fast);
  }

  .clear-all-btn:hover {
    background-color: var(--df-error);
    color: var(--df-white);
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: var(--df-space-5);
  }

  .cart-item {
    transition: transform var(--transition-fast);
  }

  .cart-item:hover {
    transform: translateX(4px);
  }

  .item-main {
    display: flex;
    justify-content: space-between;
    gap: var(--df-space-6);
  }

  .item-info {
    flex: 1;
  }

  .item-info h3 {
    color: var(--df-primary);
    margin: 0 0 var(--df-space-4) 0;
    font-size: 1.2rem;
  }

  .item-meta {
    display: flex;
    gap: var(--df-space-4);
    margin-bottom: var(--df-space-2);
  }

  .item-type,
  .item-level {
    display: inline-block;
    background-color: var(--df-bg-light);
    padding: 0.2rem 0.6rem;
    border-radius: var(--df-radius-md);
    font-size: 0.85rem;
    color: var(--df-text-light);
  }

  .item-duration {
    color: var(--df-text-light);
    font-size: 0.9rem;
    margin: 0;
  }

  .item-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--df-space-4);
  }

  .item-price-section {
    text-align: right;
  }

  .unit-price {
    margin: 0 0 0.25rem 0;
    color: var(--df-text-light);
    font-size: 0.9rem;
  }

  .subtotal {
    margin: 0;
    color: var(--df-primary);
    font-weight: 700;
    font-size: 1.1rem;
  }

  .remove-btn {
    background: none;
    border: 1px solid var(--df-error);
    color: var(--df-error);
    padding: 0.5rem 1rem;
    border-radius: var(--df-radius-md);
    cursor: pointer;
    font-size: 0.9rem;
    transition: all var(--transition-fast);
  }

  .remove-btn:hover {
    background-color: var(--df-error);
    color: var(--df-white);
  }

  .order-summary {
    position: sticky;
    top: 90px;
  }

  .order-summary h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
    font-size: 1.3rem;
  }

  .summary-details {
    border-top: 1px solid var(--df-border);
    border-bottom: 2px solid var(--df-accent);
    padding: var(--df-space-5) 0;
    margin-bottom: var(--df-space-5);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: var(--df-space-4) 0;
  }

  .summary-row.highlight {
    padding-top: var(--df-space-5);
    margin-top: var(--df-space-4);
    border-top: 1px solid var(--df-border);
  }

  .total-label {
    font-weight: 700;
    font-size: 1.1rem;
  }

  .total-amount {
    color: var(--df-primary);
    font-weight: 700;
    font-size: 1.3rem;
  }

  .summary-actions {
    display: flex;
    flex-direction: column;
    gap: var(--df-space-4);
    margin-bottom: var(--df-space-5);
  }

  .summary-actions .btn {
    width: 100%;
    text-align: center;
  }

  .btn-large {
    padding: 1rem;
    font-size: 1.1rem;
  }

  @media (max-width: 1024px) {
    .cart-layout {
      grid-template-columns: 1fr;
    }

    .order-summary {
      position: static;
    }
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .item-main {
      flex-direction: column;
    }

    .item-actions {
      align-items: stretch;
    }

    .item-price-section {
      text-align: left;
    }

    .empty-actions {
      flex-direction: column;
    }
  }
</style>
