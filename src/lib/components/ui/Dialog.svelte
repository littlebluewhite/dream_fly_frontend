<script lang="ts">
  /* Dream Fly Dialog — centered modal with overlay, title and an action row.
   * Body is the default slot; actions are passed as {label,onClick,variant?}.
   * Overlay click and Escape both call onClose. */
  import Button from './Button.svelte';
  type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  type Action = { label: string; onClick: () => void; variant?: Variant };

  export let open = false;
  export let title = '';
  export let width = 440;
  export let onClose: () => void = () => {};
  export let primaryAction: Action | null = null;
  export let secondaryAction: Action | null = null;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" on:click={onClose}>
    <div
      class="dialog"
      style="max-width:{width}px"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:click|stopPropagation
    >
      {#if title}<div class="head"><h3>{title}</h3></div>{/if}
      <div class="body"><slot /></div>
      {#if primaryAction || secondaryAction}
        <div class="foot">
          {#if secondaryAction}
            <Button variant={secondaryAction.variant ?? 'secondary'} on:click={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          {/if}
          {#if primaryAction}
            <Button variant={primaryAction.variant ?? 'primary'} on:click={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    padding: 24px;
    font-family: var(--df-font-body);
  }
  .dialog {
    width: 100%;
    background: #fff;
    border-radius: var(--df-radius-xl);
    box-shadow: var(--df-shadow-strong);
    overflow: hidden;
  }
  .head {
    padding: 24px 24px 0;
  }
  .head h3 {
    margin: 0;
    font-family: var(--df-font-heading);
    font-size: var(--df-text-h3);
    font-weight: var(--df-weight-bold);
    color: var(--df-ink);
  }
  .body {
    padding: 12px 24px 0;
    font-size: var(--df-text-base);
    color: var(--df-text-light);
    line-height: 1.6;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 24px;
    margin-top: 8px;
  }
</style>
