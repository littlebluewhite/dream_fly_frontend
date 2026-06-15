<script lang="ts">
  /* Dream Fly Input — labelled text field (44px, 1.5px border, blue focus ring).
   * Use bind:value. Forwards input/change/focus/blur/keydown. */
  export let label = '';
  export let value = '';
  /* Svelte forbids a dynamic `type` attribute together with bind:value, so we
   * set the input type imperatively via this action (default 'text'). */
  export let type = 'text';
  function applyType(node: HTMLInputElement, t: string) {
    node.type = t;
    return {
      update(next: string) {
        node.type = next;
      }
    };
  }
  export let placeholder = '';
  export let helper = '';
  export let error = '';
  export let required = false;
  export let disabled = false;
  export let id: string | undefined = undefined;
  export let style = '';
  let className = '';
  export { className as class };

  $: inputId = id || (label ? `df-in-${label}` : undefined);
</script>

<div class="field {className}" {style}>
  {#if label}
    <label for={inputId}>{label}{#if required}<span class="req">*</span>{/if}</label>
  {/if}
  <input
    id={inputId}
    use:applyType={type}
    class="control"
    class:has-error={error}
    {placeholder}
    {disabled}
    {required}
    bind:value
    on:input
    on:change
    on:focus
    on:blur
    on:keydown
  />
  {#if error || helper}
    <span class="hint" class:err={error}>{error || helper}</span>
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
    height: 44px;
    padding: 0 14px;
    font-size: var(--df-text-base);
    font-family: var(--df-font-body);
    color: var(--df-text-dark);
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    border-radius: var(--df-radius-md);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .control:focus {
    border-color: var(--df-primary);
    box-shadow: var(--df-shadow-focus);
  }
  .control.has-error {
    border-color: var(--df-error);
  }
  .control.has-error:focus {
    box-shadow: none;
  }
  .control:disabled {
    background: var(--df-bg-light);
  }
  .hint {
    font-size: var(--df-text-xs);
    color: var(--df-text-light);
  }
  .hint.err {
    color: var(--df-error);
  }
</style>
