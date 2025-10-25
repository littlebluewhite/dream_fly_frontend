<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';

  export let mobileMenuOpen = false;

  const dispatch = createEventDispatcher();

  const navItems = [
    { href: '/', label: '首頁' },
    { href: '/venues', label: '場館介紹' },
    { href: '/coaches', label: '教練介紹' },
    { href: '/courses', label: '課程介紹' },
    { href: '/schedule', label: '日程表' },
    { href: '/tickets', label: '購票資訊' },
    { href: '/contact', label: '聯絡資訊' }
  ];

  function handleNavClick() {
    dispatch('close');
  }

  $: currentPath = $page.url.pathname;
</script>

<nav class="nav" class:mobile-open={mobileMenuOpen}>
  <ul class="nav-list">
    {#each navItems as item}
      <li class="nav-item">
        <a
          href={item.href}
          class="nav-link"
          class:active={currentPath === item.href}
          on:click={handleNavClick}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .nav {
    display: flex;
  }

  .nav-list {
    display: flex;
    list-style: none;
    gap: var(--spacing-sm);
    margin: 0;
    padding: 0;
  }

  .nav-item {
    margin: 0;
  }

  .nav-link {
    display: block;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--color-text);
    font-weight: 500;
    text-decoration: none;
    border-radius: 4px;
    transition: all var(--transition-fast);
    position: relative;
  }

  .nav-link:hover {
    color: var(--color-primary);
    background-color: rgba(0, 102, 204, 0.05);
  }

  .nav-link.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-link.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 3px;
    background-color: var(--color-accent);
    border-radius: 2px 2px 0 0;
  }

  /* Desktop */
  @media (min-width: 768px) {
    .nav {
      display: flex;
    }

    .nav-list {
      flex-direction: row;
    }
  }

  /* Mobile */
  @media (max-width: 767px) {
    .nav {
      position: fixed;
      top: 0;
      right: -100%;
      width: 80%;
      max-width: 300px;
      height: 100vh;
      background-color: var(--color-white);
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
      transition: right var(--transition-normal);
      padding-top: 80px;
      z-index: 999;
    }

    .nav.mobile-open {
      right: 0;
    }

    .nav-list {
      flex-direction: column;
      gap: 0;
      padding: var(--spacing-md);
    }

    .nav-link {
      padding: var(--spacing-md);
      border-bottom: 1px solid #eee;
    }

    .nav-link.active::after {
      display: none;
    }

    .nav-link.active {
      background-color: rgba(0, 102, 204, 0.1);
      border-left: 4px solid var(--color-accent);
    }
  }
</style>
