<script lang="ts">
  /* Dream Fly Tabs — underline tab bar. Use bind:value; also dispatches
   * `change` with the new value. Tabs are {value,label,count?}. */
  import { createEventDispatcher } from 'svelte';
  type Tab = { value: string; label: string; count?: number };

  export let tabs: Tab[] = [];
  export let value: string = tabs[0]?.value ?? '';
  export let style = '';
  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{ change: string }>();
  function select(v: string) {
    value = v;
    dispatch('change', v);
  }
</script>

<div class="tabs {className}" {style} role="tablist">
  {#each tabs as t (t.value)}
    {@const active = t.value === value}
    <button
      type="button"
      role="tab"
      aria-selected={active}
      class="tab"
      class:active
      on:click={() => select(t.value)}
    >
      <span>{t.label}</span>
      {#if t.count != null}<span class="count" class:active>{t.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--df-border);
    font-family: var(--df-font-body);
  }
  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--df-text-base);
    font-family: var(--df-font-body);
    font-weight: var(--df-weight-medium);
    color: var(--df-text-light);
    transition: color 0.15s ease;
  }
  .tab.active {
    font-weight: var(--df-weight-bold);
    color: var(--df-primary);
  }
  .tab::after {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: -1px;
    height: 2.5px;
    border-radius: 2px 2px 0 0;
    background: transparent;
  }
  .tab.active::after {
    background: var(--df-primary);
  }
  .count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--df-radius-pill);
    background: var(--df-bg-light);
    color: var(--df-text-muted);
    font-size: var(--df-text-xs);
    font-weight: var(--df-weight-bold);
  }
  .count.active {
    background: var(--df-primary-bg);
    color: var(--df-primary);
  }
</style>
