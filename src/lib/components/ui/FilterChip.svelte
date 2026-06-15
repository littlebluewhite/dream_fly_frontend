<script lang="ts">
  /* Dream Fly FilterChip — interactive selectable chip for category/filter rows
   * (the DS "Tag" interactive variant; the static Tag primitive stays as-is for
   * non-interactive keyword chips). */
  export let selected = false;
  export let style = '';
  let className = '';
  export { className as class };
</script>

<button type="button" class="chip {className}" class:selected {style} on:click>
  <slot />
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--df-radius-sm);
    background: var(--df-primary-bg);
    color: var(--df-primary);
    border: 1px solid transparent;
    font-family: var(--df-font-body);
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    line-height: 1.3;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .chip:hover:not(.selected) {
    filter: brightness(0.97);
  }
  .chip.selected {
    background: var(--df-primary);
    color: #fff;
  }
</style>
