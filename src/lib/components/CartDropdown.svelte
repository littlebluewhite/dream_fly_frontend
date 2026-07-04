<script lang="ts">
  import { goto } from '$app/navigation';
  import { cart } from '$lib/member/stores';
  import { isLoggedIn } from '$lib/stores/authStore';
  import { checkoutTarget } from '$lib/checkout-gate';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let isOpen = false;
  export let onClose: () => void;

  $: total = $cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  function removeItem(itemId: string) {
    cart.remove(itemId);
  }

  function checkout() {
    onClose();
    goto(checkoutTarget($isLoggedIn));
  }
</script>

{#if isOpen}
  <button type="button" class="dropdown-overlay" on:click={onClose} aria-label="關閉購物車"></button>
  <div class="cart-dropdown">
    <div class="dropdown-header">
      <h3>
        <Icon name="shopping-cart" size={18} color="var(--df-primary)" />
        購物車
      </h3>
      <button class="close-btn" on:click={onClose} aria-label="關閉">
        <Icon name="x" size={18} color="currentColor" />
      </button>
    </div>

    <div class="dropdown-body">
      {#if $cart.length === 0}
        <div class="empty-state">
          <p>購物車是空的</p>
        </div>
      {:else}
        <div class="cart-items">
          {#each $cart as item (item.id)}
            <div class="cart-item">
              <div class="item-info">
                <h4>{item.name}</h4>
                <p class="item-details">
                  {#if item.type === 'pass'}
                    {item.desc ?? ''}
                  {:else if item.days}
                    {item.days}
                  {:else}
                    {item.desc ?? ''}
                  {/if}
                  {#if item.level}
                    <span class="level-tag">{item.level}</span>
                  {/if}
                </p>
                <p class="item-price">NT$ {item.price.toLocaleString()}</p>
              </div>

              <div class="item-controls">
                <!-- FE#13 item 1：課程是報名、方案是使用權，qty 恆為 1，不提供
                     +/- stepper（課程原本渲染死控制項——cart.updateQty 對
                     type==='course' 已是 no-op，round 2 移除；與 CheckoutDialog
                     的課程行一致）。 -->
                <button class="remove-btn" on:click={() => removeItem(item.id)} aria-label="移除">
                  <Icon name="trash-2" size={16} color="currentColor" />
                </button>
              </div>
            </div>
          {/each}
        </div>

        <div class="cart-footer">
          <div class="total">
            <span>總計：</span>
            <span class="total-price">NT$ {total.toLocaleString()}</span>
          </div>

          <div class="action-buttons">
            <a href="/cart" class="btn btn-secondary" on:click={onClose}>查看購物車</a>
            <button class="btn btn-primary" on:click={checkout}>結帳</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    z-index: 999;
  }

  .cart-dropdown {
    position: fixed;
    top: 70px;
    right: 20px;
    width: 400px;
    max-width: calc(100vw - 40px);
    max-height: 500px;
    background-color: var(--df-surface);
    border-radius: var(--df-radius-lg);
    border: 1px solid var(--df-border);
    box-shadow: var(--df-shadow-lifted);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--df-border);
  }

  .dropdown-header h3 {
    margin: 0;
    color: var(--df-primary);
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--df-text-light);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
    border-radius: var(--df-radius-md);
  }

  .close-btn:hover {
    color: var(--df-text-dark);
    background-color: var(--df-bg-light);
  }

  .dropdown-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xl) 0;
    color: var(--df-text-light);
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .cart-item {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--df-border);
  }

  .cart-item:last-child {
    border-bottom: none;
  }

  .item-info {
    flex: 1;
  }

  .item-info h4 {
    margin: 0 0 0.25rem 0;
    color: var(--df-text-dark);
    font-size: 1rem;
  }

  .item-details {
    font-size: 0.85rem;
    color: var(--df-text-light);
    margin: 0.25rem 0;
  }

  .level-tag {
    display: inline-block;
    background-color: var(--df-primary-bg);
    color: var(--df-primary);
    padding: 0.1rem 0.4rem;
    border-radius: var(--df-radius-md);
    margin-left: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .item-price {
    margin: 0.25rem 0 0 0;
    color: var(--df-primary);
    font-weight: 600;
    font-family: var(--df-font-mono);
  }

  .item-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-sm);
  }

  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--df-text-muted);
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--df-radius-md);
    transition: color var(--transition-fast), background-color var(--transition-fast);
  }

  .remove-btn:hover {
    color: var(--df-error);
    background-color: var(--df-error-bg);
  }

  .cart-footer {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 2px solid var(--df-accent);
  }

  .total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--df-text-dark);
  }

  .total-price {
    color: var(--df-primary);
    font-size: 1.3rem;
    font-family: var(--df-font-mono);
  }

  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
  }

  .action-buttons .btn {
    flex: 1;
    text-align: center;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
  }

  @media (max-width: 767px) {
    .cart-dropdown {
      right: 10px;
      width: calc(100vw - 20px);
      max-height: 400px;
    }
  }
</style>
