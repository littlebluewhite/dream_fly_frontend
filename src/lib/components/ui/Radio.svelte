<script lang="ts">
  /* Dream Fly Radio — single radio control with label. Group several via a shared
   * bind:group + distinct value (the documented pattern). Keep group & value the
   * same type (both string or both number) — selection uses strict equality.
   * A grouped radio also needs a shared, non-empty `name`: bind:group only drives
   * Svelte state, while native keyboard navigation, form submission, and
   * assistive-tech grouping all rely on the name attribute. */
  export let label = '';
  export let value: string | number = '';
  export let group: string | number | undefined = undefined;
  export let name = '';
  export let disabled = false;
  export let style = '';
  let className = '';
  export { className as class };

  $: selected = group === value;

  // Dev guard: grouping via bind:group without a native `name` is a silent failure —
  // the dot follows Svelte state, but keyboard/form/assistive-tech grouping is broken.
  $: if (import.meta.env.DEV && group !== undefined && !name) {
    console.warn(
      '[Radio] grouped radios (bind:group) need a shared, non-empty `name` for native keyboard, form-submission, and assistive-tech grouping.'
    );
  }
</script>

<label class="rb {className}" class:disabled {style}>
  <input {...$$restProps} type="radio" {name} {value} {disabled} bind:group on:change />
  <span class="dot" class:on={selected}>
    {#if selected}<span class="inner"></span>{/if}
  </span>
  {#if label}<span class="label">{label}</span>{/if}
</label>

<style>
  .rb {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--df-font-body);
    font-size: var(--df-text-base);
    color: var(--df-text-dark);
    cursor: pointer;
    user-select: none;
  }
  .rb.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 50%;
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    transition: border-color 0.15s ease;
  }
  .dot.on {
    border-color: var(--df-primary);
  }
  .inner {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--df-primary);
  }
  input:focus-visible + .dot {
    box-shadow: var(--df-shadow-focus);
  }
</style>
