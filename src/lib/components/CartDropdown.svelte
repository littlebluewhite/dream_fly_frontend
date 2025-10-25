<script lang="ts">
  import { cartStore, totalPrice } from '$lib/stores/cartStore';

  export let isOpen = false;
  export let onClose: () => void;

  $: cart = $cartStore;
  $: total = $totalPrice;

  function increaseQuantity(itemId: string) {
    const item = cart.find((i) => i.id === itemId);
    if (item) {
      cartStore.updateQuantity(itemId, item.quantity + 1);
    }
  }

  function decreaseQuantity(itemId: string) {
    const item = cart.find((i) => i.id === itemId);
    if (item) {
      cartStore.updateQuantity(itemId, item.quantity - 1);
    }
  }

  function removeItem(itemId: string) {
    cartStore.removeFromCart(itemId);
  }
</script>

{#if isOpen}
  <div class="dropdown-overlay" on:click={onClose}></div>
  <div class="cart-dropdown">
    <div class="dropdown-header">
      <h3>購物車</h3>
      <button class="close-btn" on:click={onClose}>✕</button>
    </div>

    <div class="dropdown-body">
      {#if cart.length === 0}
        <div class="empty-state">
          <p>購物車是空的</p>
        </div>
      {:else}
        <div class="cart-items">
          {#each cart as item (item.id)}
            <div class="cart-item">
              <div class="item-info">
                <h4>{item.name}</h4>
                <p class="item-details">
                  {item.duration}
                  {#if item.level}
                    <span class="level-tag">{item.level}</span>
                  {/if}
                </p>
                <p class="item-price">NT$ {item.price.toLocaleString()}</p>
              </div>

              <div class="item-controls">
                <div class="quantity-control">
                  <button
                    class="qty-btn"
                    on:click={() => decreaseQuantity(item.id)}
                    aria-label="減少數量"
                  >
                    -
                  </button>
                  <span class="quantity">{item.quantity}</span>
                  <button
                    class="qty-btn"
                    on:click={() => increaseQuantity(item.id)}
                    aria-label="增加數量"
                  >
                    +
                  </button>
                </div>
                <button class="remove-btn" on:click={() => removeItem(item.id)} aria-label="移除">
                  🗑️
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
            <a href="/contact" class="btn btn-primary" on:click={onClose}>結帳</a>
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
    z-index: 999;
  }

  .cart-dropdown {
    position: fixed;
    top: 70px;
    right: 20px;
    width: 400px;
    max-width: calc(100vw - 40px);
    max-height: 500px;
    background-color: var(--color-white);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid #eee;
  }

  .dropdown-header h3 {
    margin: 0;
    color: var(--color-primary);
    font-size: 1.2rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text-light);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
  }

  .close-btn:hover {
    color: var(--color-text);
  }

  .dropdown-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xl) 0;
    color: var(--color-text-light);
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
    border-bottom: 1px solid #eee;
  }

  .cart-item:last-child {
    border-bottom: none;
  }

  .item-info {
    flex: 1;
  }

  .item-info h4 {
    margin: 0 0 0.25rem 0;
    color: var(--color-text);
    font-size: 1rem;
  }

  .item-details {
    font-size: 0.85rem;
    color: var(--color-text-light);
    margin: 0.25rem 0;
  }

  .level-tag {
    display: inline-block;
    background-color: var(--color-bg);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    margin-left: 0.5rem;
    font-size: 0.75rem;
  }

  .item-price {
    margin: 0.25rem 0 0 0;
    color: var(--color-primary);
    font-weight: 600;
  }

  .item-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-sm);
  }

  .quantity-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--color-bg);
    border-radius: 4px;
    padding: 0.25rem;
  }

  .qty-btn {
    background-color: var(--color-white);
    border: 1px solid #ddd;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: var(--color-primary);
    transition: all var(--transition-fast);
  }

  .qty-btn:hover {
    background-color: var(--color-primary);
    color: var(--color-white);
  }

  .quantity {
    min-width: 24px;
    text-align: center;
    font-weight: 600;
  }

  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    opacity: 0.6;
    transition: opacity var(--transition-fast);
  }

  .remove-btn:hover {
    opacity: 1;
  }

  .cart-footer {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 2px solid var(--color-accent);
  }

  .total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .total-price {
    color: var(--color-primary);
    font-size: 1.3rem;
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
