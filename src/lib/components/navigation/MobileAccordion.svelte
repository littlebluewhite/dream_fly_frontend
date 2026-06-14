<script lang="ts">
  import type { NavCategory } from '$lib/data/navigationConfig';
  import { slide } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let category: NavCategory;
  export let isExpanded: boolean = false;

  const dispatch = createEventDispatcher();

  function toggleExpand() {
    isExpanded = !isExpanded;
  }

  function handleLinkClick() {
    dispatch('navigate');
  }
</script>

<div class="mobile-accordion">
  <button
    class="accordion-header"
    on:click={toggleExpand}
    aria-expanded={isExpanded}
    aria-controls="accordion-content-{category.title}"
  >
    <span class="accordion-title">
      <Icon name={category.icon} size={20} color="var(--df-primary)" />
      {category.title}
    </span>
    <span class="chevron" class:expanded={isExpanded}>
      <Icon name="chevron-right" size={20} />
    </span>
  </button>

  {#if isExpanded}
    <div
      id="accordion-content-{category.title}"
      class="accordion-content"
      transition:slide={{ duration: 200 }}
    >
      <ul class="accordion-items">
        {#each category.items as item}
          <li>
            <a href={item.href} class="accordion-link" on:click={handleLinkClick}>
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .mobile-accordion {
    border-bottom: 1px solid var(--df-border);
  }

  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    min-height: 44px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    color: var(--df-text-dark);
    text-align: left;
    transition: background-color var(--transition-fast);
  }

  .accordion-header:hover {
    background-color: var(--df-primary-bg);
  }

  .accordion-header:active {
    background-color: var(--df-primary-bg);
  }

  .accordion-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--df-text-dark);
  }

  .chevron {
    display: inline-flex;
    align-items: center;
    color: var(--df-text-light);
    transition: transform var(--transition-fast);
    transform: rotate(0deg);
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .accordion-content {
    background-color: var(--df-bg-light);
  }

  .accordion-items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .accordion-items li {
    margin: 0;
  }

  .accordion-link {
    display: block;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    min-height: 44px;
    color: var(--df-text-dark);
    text-decoration: none;
    transition: all var(--transition-fast);
    border-left: 3px solid transparent;
  }

  .accordion-link:hover {
    color: var(--df-primary);
    background-color: var(--df-primary-bg);
    border-left-color: var(--df-primary);
  }

  .accordion-link:active {
    background-color: var(--df-primary-bg);
  }
</style>
