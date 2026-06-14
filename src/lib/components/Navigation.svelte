<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import { navigationConfig } from '$lib/data/navigationConfig';
  import MegaMenu from './navigation/MegaMenu.svelte';
  import MobileAccordion from './navigation/MobileAccordion.svelte';

  export let mobileMenuOpen = false;

  const dispatch = createEventDispatcher();

  let openMenuIndex: number | null = null;
  let hoverTimeout: number | null = null;
  let expandedCategories: Record<string, boolean> = {};

  function handleNavClick() {
    dispatch('close');
  }

  function handleMouseEnter(index: number, hasDropdown: boolean) {
    if (!hasDropdown || !browser) return;

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    hoverTimeout = window.setTimeout(() => {
      openMenuIndex = index;
    }, 200);
  }

  function handleMouseLeave() {
    if (!browser) return;

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    hoverTimeout = window.setTimeout(() => {
      openMenuIndex = null;
    }, 100);
  }

  function closeMegaMenu() {
    openMenuIndex = null;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  }

  function handleNavItemClick(item: typeof navigationConfig[0], index: number) {
    if (item.hasDropdown) {
      if (openMenuIndex === index) {
        closeMegaMenu();
      } else {
        openMenuIndex = index;
      }
    } else if (item.href) {
      handleNavClick();
    }
  }

  $: currentPath = $page.url.pathname;
</script>

<nav class="nav" class:mobile-open={mobileMenuOpen}>
  <ul class="nav-list desktop-nav">
    {#each navigationConfig as item, index}
      <li
        class="nav-item"
        on:mouseenter={() => handleMouseEnter(index, item.hasDropdown || false)}
        on:mouseleave={handleMouseLeave}
      >
        {#if item.hasDropdown}
          <button
            class="nav-link nav-button"
            class:active={currentPath.startsWith(item.label === '場館介紹' ? '/venues' : item.label === '教練介紹' ? '/coaches' : '/courses')}
            class:menu-open={openMenuIndex === index}
            on:click={() => handleNavItemClick(item, index)}
            aria-expanded={openMenuIndex === index}
            aria-haspopup="true"
          >
            {item.label}
            <span class="dropdown-arrow" class:open={openMenuIndex === index}>▼</span>
          </button>
          <MegaMenu
            navItem={item}
            isOpen={openMenuIndex === index}
            onClose={closeMegaMenu}
          />
        {:else}
          <a
            href={item.href}
            class="nav-link"
            class:active={currentPath === item.href}
            on:click={handleNavClick}
          >
            {item.label}
          </a>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="mobile-nav">
    {#each navigationConfig as item}
      {#if item.hasDropdown && item.categories}
        <div class="mobile-nav-section">
          <div class="mobile-nav-title">{item.label}</div>
          {#each item.categories as category}
            <MobileAccordion
              {category}
              bind:isExpanded={expandedCategories[category.title]}
              on:navigate={handleNavClick}
            />
          {/each}
        </div>
      {:else if item.href}
        <a
          href={item.href}
          class="mobile-nav-link"
          class:active={currentPath === item.href}
          on:click={handleNavClick}
        >
          {item.label}
        </a>
      {/if}
    {/each}
  </div>
</nav>

<style>
  .nav {
    display: flex;
  }

  .nav-list {
    display: flex;
    list-style: none;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    flex-wrap: nowrap;
    align-items: center;
  }

  .nav-item {
    margin: 0;
    position: relative;
    flex-shrink: 0;
  }

  .nav-link {
    display: block;
    padding: 0.5rem 0.75rem;
    color: var(--color-text);
    font-weight: 500;
    font-size: 0.9375rem;
    text-decoration: none;
    border-radius: 4px;
    transition: all var(--transition-fast);
    position: relative;
    white-space: nowrap;
  }

  .nav-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .dropdown-arrow {
    font-size: 0.7rem;
    transition: transform var(--transition-fast);
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
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

  .nav-link.menu-open {
    color: var(--color-primary);
    background-color: rgba(0, 102, 204, 0.05);
  }

  .mobile-nav {
    display: none;
  }

  .mobile-nav-section {
    margin-bottom: 1rem;
  }

  .mobile-nav-title {
    padding: 1rem;
    font-weight: 700;
    font-size: 0.875rem;
    color: var(--color-primary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: rgba(0, 102, 204, 0.05);
  }

  .mobile-nav-link {
    display: block;
    padding: 1rem;
    min-height: 44px;
    color: var(--color-text);
    text-decoration: none;
    border-bottom: 1px solid #eee;
    transition: all var(--transition-fast);
  }

  .mobile-nav-link:hover,
  .mobile-nav-link:active {
    background-color: rgba(0, 102, 204, 0.05);
    color: var(--color-primary);
  }

  .mobile-nav-link.active {
    background-color: rgba(0, 102, 204, 0.1);
    border-left: 4px solid var(--color-accent);
    color: var(--color-primary);
  }

  /* Desktop */
  @media (min-width: 768px) {
    .nav {
      display: flex;
    }

    .nav-list {
      flex-direction: row;
    }

    .mobile-nav {
      display: none;
    }

    .desktop-nav {
      display: flex;
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
      overflow-y: auto;
    }

    .nav.mobile-open {
      right: 0;
    }

    .desktop-nav {
      display: none;
    }

    .mobile-nav {
      display: block;
    }
  }
</style>
