<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { NavItem } from '$lib/data/navigationConfig';

  export let navItem: NavItem;
  export let isOpen: boolean = false;
  export let onClose: () => void;

  let megaMenuElement: HTMLDivElement;

  function handleClickOutside(event: MouseEvent) {
    if (megaMenuElement && !megaMenuElement.contains(event.target as Node)) {
      onClose();
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  onMount(() => {
    if (browser) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    }
  });

  function handleLinkClick() {
    onClose();
  }
</script>

{#if isOpen && navItem.categories}
  <div
    bind:this={megaMenuElement}
    class="mega-menu"
    class:venues={navItem.label === '場館介紹'}
    role="menu"
    aria-label="{navItem.label} menu"
  >
    <div class="mega-menu-content">
      {#each navItem.categories as category}
        <div class="category" role="group" aria-label={category.title}>
          <h3 class="category-title">
            <Icon name={category.icon} size={18} color="var(--df-primary)" />
            {category.title}
          </h3>
          <ul class="category-items">
            {#each category.items as item}
              <li>
                <a
                  href={item.href}
                  class="category-link"
                  role="menuitem"
                  on:click={handleLinkClick}
                >
                  {item.label}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .mega-menu {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    min-width: 700px;
    max-width: 1000px;
    background-color: var(--df-white);
    border: 1px solid var(--df-border);
    box-shadow: var(--df-shadow-lifted);
    border-radius: var(--df-radius-lg);
    padding: 2.5rem;
    z-index: 1000;
    opacity: 0;
    animation: fadeIn 200ms ease-out forwards;
    margin-top: 0.5rem;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .mega-menu-content {
    display: grid;
    gap: 2.5rem;
    grid-template-columns: 1fr;
  }

  .mega-menu.venues .mega-menu-content {
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
  }

  .category {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .category-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--df-primary);
    margin: 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--df-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .category-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .category-items li {
    margin: 0;
  }

  .category-link {
    display: block;
    padding: 0.625rem 0.875rem;
    color: var(--df-text-dark);
    text-decoration: none;
    border-radius: var(--df-radius-md);
    transition: all var(--transition-fast);
    font-size: 0.9375rem;
    line-height: 1.4;
  }

  .category-link:hover {
    color: var(--df-primary);
    background-color: var(--df-primary-bg);
    transform: translateX(4px);
  }

  .category-link:focus {
    outline: 2px solid var(--df-primary);
    outline-offset: 2px;
  }

  /* Large Desktop */
  @media (min-width: 1200px) {
    .mega-menu {
      min-width: 900px;
      max-width: 1100px;
    }
  }

  /* Tablet */
  @media (max-width: 1024px) {
    .mega-menu {
      min-width: 600px;
      max-width: 800px;
      padding: 2rem;
    }

    .mega-menu.venues .mega-menu-content {
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }
  }

  /* Mobile */
  @media (max-width: 767px) {
    .mega-menu {
      display: none;
    }
  }
</style>
