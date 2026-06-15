<script lang="ts">
  /* Dream Fly Checkbox — square check control with label. Use bind:checked. */
  export let label = '';
  export let checked = false;
  export let disabled = false;
  export let style = '';
  let className = '';
  export { className as class };
</script>

<label class="cb {className}" class:disabled {style}>
  <input type="checkbox" bind:checked {disabled} on:change />
  <span class="box" class:on={checked}>
    {#if checked}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    {/if}
  </span>
  {#if label}<span class="label">{label}</span>{/if}
</label>

<style>
  .cb {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--df-font-body);
    font-size: var(--df-text-base);
    color: var(--df-text-dark);
    cursor: pointer;
    user-select: none;
  }
  .cb.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: var(--df-radius-sm);
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .box.on {
    background: var(--df-primary);
    border-color: var(--df-primary);
  }
  input:focus-visible + .box {
    box-shadow: var(--df-shadow-focus);
  }
</style>
