<script lang="ts">
  import { page } from '$app/stores';
  import Navigation from './Navigation.svelte';
  import CartDropdown from './CartDropdown.svelte';
  import NotificationsDropdown from './NotificationsDropdown.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { totalItems } from '$lib/stores/cartStore';
  import { unreadCount } from '$lib/stores/notificationsStore';

  let mobileMenuOpen = false;
  let cartDropdownOpen = false;
  let notificationsDropdownOpen = false;

  $: cartItemCount = $totalItems;
  $: notificationCount = $unreadCount;

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  function toggleCartDropdown() {
    cartDropdownOpen = !cartDropdownOpen;
    notificationsDropdownOpen = false;
  }

  function toggleNotificationsDropdown() {
    notificationsDropdownOpen = !notificationsDropdownOpen;
    cartDropdownOpen = false;
  }

  function closeCartDropdown() {
    cartDropdownOpen = false;
  }

  function closeNotificationsDropdown() {
    notificationsDropdownOpen = false;
  }
</script>

<header class="header">
  <div class="container">
    <div class="header-content">
      <a href="/" class="logo-link" on:click={closeMobileMenu}>
        <img src="/logo-df-monogram.png" alt="Dream Fly" class="logo" height="38" />
        <span class="wordmark">
          <span class="wordmark-line1">DREAM FLY</span>
          <span class="wordmark-line2">夢飛體操館</span>
        </span>
      </a>

      <!-- Navigation in center -->
      <Navigation {mobileMenuOpen} on:close={closeMobileMenu} />

      <!-- Icons and menu at far right -->
      <div class="header-right">
        <a href="/tickets" class="ticket-link" on:click={closeMobileMenu}>
          <Icon name="ticket" size={18} />
          <span class="ticket-label">購票</span>
        </a>

        <div class="header-actions">
          <button
            class="icon-button"
            on:click={toggleNotificationsDropdown}
            aria-label="通知"
          >
            <Icon name="bell" size={22} />
            {#if notificationCount > 0}
              <span class="badge">{notificationCount}</span>
            {/if}
          </button>

          <button class="icon-button" on:click={toggleCartDropdown} aria-label="購物車">
            <Icon name="shopping-cart" size={22} />
            {#if cartItemCount > 0}
              <span class="badge">{cartItemCount}</span>
            {/if}
          </button>
        </div>

        <button
          class="mobile-menu-toggle"
          class:active={mobileMenuOpen}
          on:click={toggleMobileMenu}
          aria-label="選單"
        >
          <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={26} />
        </button>
      </div>
    </div>
  </div>

  <CartDropdown isOpen={cartDropdownOpen} onClose={closeCartDropdown} />
  <NotificationsDropdown isOpen={notificationsDropdownOpen} onClose={closeNotificationsDropdown} />
</header>

<style>
  .header {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--df-border);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 72px;
    gap: var(--df-space-3);
  }

  .logo-link {
    display: flex;
    align-items: center;
    gap: var(--df-space-3);
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo {
    height: 38px;
    width: auto;
    display: block;
  }

  .wordmark {
    display: flex;
    flex-direction: column;
    line-height: 1.05;
  }

  .wordmark-line1 {
    font-family: var(--df-font-heading);
    font-weight: 800;
    font-size: 19px;
    color: var(--df-ink);
    letter-spacing: 0.01em;
  }

  .wordmark-line2 {
    font-size: 11px;
    color: var(--df-text-light);
    letter-spacing: 0.18em;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--df-space-4);
    margin-left: auto;
    flex-shrink: 0;
  }

  .ticket-link {
    display: inline-flex;
    align-items: center;
    gap: var(--df-space-2);
    color: var(--df-text-dark);
    font-size: var(--df-text-sm);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .ticket-link:hover {
    color: var(--df-primary);
  }

  .header-actions {
    display: flex;
    gap: var(--df-space-2);
    align-items: center;
    flex-shrink: 0;
  }

  .icon-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--df-space-2);
    color: var(--df-text-dark);
    border-radius: var(--df-radius-md);
    transition: color var(--transition-fast), background-color var(--transition-fast);
  }

  .icon-button:hover {
    color: var(--df-primary);
    background-color: var(--df-primary-bg);
  }

  .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background-color: var(--df-accent);
    color: var(--df-primary-dark);
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: var(--df-radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
    border: 2px solid var(--df-white);
  }

  .mobile-menu-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--df-space-2);
    color: var(--df-ink);
    border-radius: var(--df-radius-md);
    z-index: 1001;
    flex-shrink: 0;
  }

  .mobile-menu-toggle:hover {
    background-color: var(--df-primary-bg);
    color: var(--df-primary);
  }

  /* Mobile */
  @media (max-width: 767px) {
    .mobile-menu-toggle {
      display: inline-flex;
    }

    .ticket-link .ticket-label {
      display: none;
    }

    .header-actions {
      gap: var(--df-space-1);
    }
  }
</style>
