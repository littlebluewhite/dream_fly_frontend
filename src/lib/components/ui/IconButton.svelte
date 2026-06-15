<script lang="ts">
  /* Dream Fly IconButton — square, icon-only control for toolbars/headers.
   * Pass an <Icon> as the slot. Variants from the DS bundle; `primary` is an
   * alias for the solid blue fill (used by the chat send button). Forward
   * `aria-label` etc. via $$restProps. */
  type Variant = 'ghost' | 'soft' | 'outline' | 'solid' | 'primary';
  type Size = 'sm' | 'md' | 'lg';

  export let variant: Variant = 'ghost';
  export let size: Size = 'md';
  export let disabled = false;
  export let style = '';
  let className = '';
  export { className as class };

  const SIZES: Record<Size, number> = { sm: 32, md: 40, lg: 48 };
  $: dim = SIZES[size] ?? 40;
  $: v = variant === 'primary' ? 'solid' : variant;
</script>

<button
  type="button"
  class="iconbtn v-{v} {className}"
  {disabled}
  style="width:{dim}px;height:{dim}px;{style}"
  on:click
  {...$$restProps}
>
  <slot />
</button>

<style>
  .iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--df-radius-md);
    cursor: pointer;
    transition: background 0.15s ease, filter 0.15s ease;
  }
  .iconbtn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .v-ghost {
    background: transparent;
    color: var(--df-text-dark);
    border: 1.5px solid transparent;
  }
  .v-ghost:hover:not(:disabled) {
    background: var(--df-bg-light);
  }
  .v-soft {
    background: var(--df-primary-bg);
    color: var(--df-primary);
    border: 1.5px solid transparent;
  }
  .v-outline {
    background: #fff;
    color: var(--df-text-dark);
    border: 1.5px solid var(--df-border);
  }
  .v-solid {
    background: var(--df-primary);
    color: #fff;
    border: 1.5px solid var(--df-primary);
  }
  .v-soft:hover:not(:disabled),
  .v-outline:hover:not(:disabled),
  .v-solid:hover:not(:disabled) {
    filter: brightness(0.96);
  }
</style>
