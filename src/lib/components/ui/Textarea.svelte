<script lang="ts">
  /* Dream Fly Textarea — matches Input styling, with optional char counter. */
  export let label = '';
  export let value = '';
  export let placeholder = '';
  export let helper = '';
  export let rows = 4;
  export let required = false;
  export let maxLength: number | undefined = undefined;
  export let style = '';
  let className = '';
  export { className as class };

  $: taId = label ? `df-ta-${label}` : undefined;
</script>

<div class="field {className}" {style}>
  {#if label}
    <label for={taId}>{label}{#if required}<span class="req">*</span>{/if}</label>
  {/if}
  <textarea
    id={taId}
    class="control"
    {placeholder}
    {rows}
    {required}
    maxlength={maxLength}
    bind:value
    on:input
    on:change
  ></textarea>
  {#if helper || maxLength}
    <div class="meta">
      <span>{helper}</span>
      {#if maxLength}<span class="count">{(value || '').length}/{maxLength}</span>{/if}
    </div>
  {/if}
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
  .control {
    width: 100%;
    padding: 11px 14px;
    font-size: var(--df-text-base);
    font-family: var(--df-font-body);
    color: var(--df-text-dark);
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    border-radius: var(--df-radius-md);
    outline: none;
    resize: vertical;
    line-height: 1.6;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .control:focus {
    border-color: var(--df-primary);
    box-shadow: var(--df-shadow-focus);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: var(--df-text-xs);
    color: var(--df-text-light);
  }
  .count {
    font-family: var(--df-font-mono);
  }
</style>
