<script lang="ts">
  import { page } from '$app/stores';
  import Navigation from './Navigation.svelte';
  import CartDropdown from './CartDropdown.svelte';
  import NotificationsDropdown from './NotificationsDropdown.svelte';
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
        <img src="/logo.png" alt="Dream Fly Logo" class="logo" />
        <span class="site-title">Dream Fly</span>
      </a>

      <!-- Navigation in center -->
      <Navigation {mobileMenuOpen} on:close={closeMobileMenu} />

      <!-- Icons and menu at far right -->
      <div class="header-right">
        <div class="header-actions">
          <button
            class="icon-button"
            on:click={toggleNotificationsDropdown}
            aria-label="通知"
          >
            <span class="icon">🔔</span>
            {#if notificationCount > 0}
              <span class="badge">{notificationCount}</span>
            {/if}
          </button>

          <button class="icon-button" on:click={toggleCartDropdown} aria-label="購物車">
            <span class="icon">🛒</span>
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
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </div>

  <CartDropdown isOpen={cartDropdownOpen} onClose={closeCartDropdown} />
  <NotificationsDropdown isOpen={notificationsDropdownOpen} onClose={closeNotificationsDropdown} />
</header>

<style>
  .header {
    background-color: var(--color-white);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    gap: 0.75rem;
  }

  .logo-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    flex-shrink: 0;
    margin-right: 0.5rem;
  }

  .logo {
    height: 50px;
    width: auto;
  }

  .site-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    display: none;
  }

  .mobile-menu-toggle {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    z-index: 1001;
    flex-shrink: 0;
  }

  .mobile-menu-toggle span {
    display: block;
    width: 25px;
    height: 3px;
    background-color: var(--color-primary);
    transition: all var(--transition-fast);
    border-radius: 2px;
  }

  .mobile-menu-toggle.active span:nth-child(1) {
    transform: rotate(45deg) translate(7px, 7px);
  }

  .mobile-menu-toggle.active span:nth-child(2) {
    opacity: 0;
  }

  .mobile-menu-toggle.active span:nth-child(3) {
    transform: rotate(-45deg) translate(6px, -6px);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-shrink: 0;
  }

  .icon-button {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    transition: transform var(--transition-fast);
  }

  .icon-button:hover {
    transform: scale(1.1);
  }

  .icon {
    font-size: 1.5rem;
    display: block;
  }

  .badge {
    position: absolute;
    top: 0;
    right: 0;
    background-color: var(--color-accent);
    color: var(--color-primary);
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 2px solid var(--color-white);
  }

  /* Tablet and up */
  @media (min-width: 768px) {
    .logo {
      height: 60px;
    }

    .site-title {
      display: block;
    }
  }

  /* Mobile */
  @media (max-width: 767px) {
    .mobile-menu-toggle {
      display: flex;
    }

    .logo {
      height: 40px;
    }

    .header-actions {
      gap: 0.25rem;
    }

    .icon-button {
      padding: 0.4rem;
    }

    .icon {
      font-size: 1.3rem;
    }
  }
</style>
