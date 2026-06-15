<script lang="ts">
  /* Dream Fly Select — styled native select with a custom chevron. Options are
   * strings or {value,label}. Use bind:value; a placeholder renders as a
   * disabled hidden first option. */
  import Icon from './Icon.svelte';
  type Option = string | { value: string; label: string };

  export let label = '';
  export let value = '';
  export let options: Option[] = [];
  export let placeholder = '';
  export let required = false;
  export let disabled = false;
  export let helper = '';
  export let style = '';
  let className = '';
  export { className as class };

  $: selId = label ? `df-sel-${label}` : undefined;
  const optValue = (o: Option) => (typeof o === 'string' ? o : o.value);
  const optLabel = (o: Option) => (typeof o === 'string' ? o : o.label);
</script>

<div class="field {className}" {style}>
  {#if label}
    <label for={selId}>{label}{#if required}<span class="req">*</span>{/if}</label>
  {/if}
  <div class="wrap">
    <select
      id={selId}
      class="control"
      class:is-placeholder={!value}
      {disabled}
      {required}
      bind:value
      on:change
    >
      {#if placeholder}<option value="" disabled hidden>{placeholder}</option>{/if}
      {#each options as o}
        <option value={optValue(o)}>{optLabel(o)}</option>
      {/each}
    </select>
    <span class="chev"><Icon name="chevron-down" size={16} color="var(--df-text-light)" /></span>
  </div>
  {#if helper}<span class="hint">{helper}</span>{/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--df-font-body);
  }
  label {
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    color: var(--df-text-dark);
  }
  .req {
    color: var(--df-error);
    margin-left: 2px;
  }
  .wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .control {
    width: 100%;
    height: 44px;
    padding: 0 38px 0 14px;
    font-size: var(--df-text-base);
    font-family: var(--df-font-body);
    color: var(--df-text-dark);
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    border-radius: var(--df-radius-md);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .control.is-placeholder {
    color: var(--df-text-muted);
  }
  .control:focus {
    border-color: var(--df-primary);
    box-shadow: var(--df-shadow-focus);
  }
  .control:disabled {
    background: var(--df-bg-light);
  }
  .chev {
    position: absolute;
    right: 14px;
    pointer-events: none;
    display: inline-flex;
  }
  .hint {
    font-size: var(--df-text-xs);
    color: var(--df-text-light);
  }
</style>
