<script lang="ts">
  /* Dream Fly button primitive. Renders an <a> when `href` is set, else a
   * <button>. Variant colours come from the global .btn-* classes (single
   * source of truth, shared with not-yet-migrated markup); size is layered on
   * here. Pass `class`/`style` through for context overrides (e.g. a secondary
   * button on the dark hero). */
  type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  type Size = 'sm' | 'md' | 'lg';

  export let variant: Variant = 'primary';
  export let size: Size = 'md';
  export let href: string | undefined = undefined;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
  export let disabled = false;
  export let style = '';
  let className = '';
  export { className as class };
</script>

{#if href}
  <a
    {href}
    class="btn btn-{variant} size-{size} {className}"
    class:full={fullWidth}
    class:is-disabled={disabled}
    {style}
    on:click
    {...$$restProps}
  >
    <slot />
  </a>
{:else}
  <button
    {type}
    {disabled}
    class="btn btn-{variant} size-{size} {className}"
    class:full={fullWidth}
    {style}
    on:click
    {...$$restProps}
  >
    <slot />
  </button>
{/if}

<style>
  .size-sm {
    padding: 8px 16px;
    font-size: var(--df-text-sm);
  }
  .size-md {
    padding: 12px 24px;
    font-size: var(--df-text-base);
  }
  .size-lg {
    padding: 15px 30px;
    font-size: var(--df-text-lg);
  }
  .full {
    width: 100%;
  }
  /* anchor-as-button cannot use :disabled */
  .is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
</style>
