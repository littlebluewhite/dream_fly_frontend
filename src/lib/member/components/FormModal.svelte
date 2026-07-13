<script lang="ts">
  /* Reusable modal shell for the member-centre form dialogs (請假 / 預約補課).
   * Centered overlay panel with an icon-tiled header, a scrolling body (default
   * slot) and an optional footer slot. Ported from the prototype's FormModal
   * (client/components.jsx). Overlay click and Escape both call onClose. */
  import { IconButton, Icon } from '$lib/components/ui';
  import type { IconName } from '$lib/icon-registry';

  export let open = false;
  export let onClose: () => void = () => {};
  export let icon: IconName | undefined = undefined;
  export let color = 'var(--df-primary)';
  export let title = '';
  export let subtitle = '';
  export let width = 540;

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" on:click={onClose}>
    <div
      class="panel"
      style="max-width:{width}px"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="head">
        {#if icon}
          <div class="icon-tile" style="background:{color}1A">
            <Icon name={icon} size={22} color={color} />
          </div>
        {/if}
        <div class="title-wrap">
          <h3>{title}</h3>
          {#if subtitle}<div class="subtitle">{subtitle}</div>{/if}
        </div>
        <IconButton aria-label="關閉" variant="ghost" on:click={onClose}>
          <Icon name="x" size={20} />
        </IconButton>
      </div>
      <div class="body"><slot /></div>
      {#if $$slots.footer}
        <div class="foot"><slot name="footer" /></div>
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
  .panel {
    width: 100%;
    background: #fff;
    border-radius: 16px;
    box-shadow: var(--df-shadow-strong);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .head {
    padding: 20px 24px;
    border-bottom: 1px solid var(--df-border);
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .icon-tile {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .title-wrap {
    flex: 1;
    min-width: 0;
  }
  .head h3 {
    margin: 0;
    font-family: var(--df-font-heading);
    font-size: 19px;
    font-weight: 800;
    color: var(--df-ink);
  }
  .subtitle {
    font-size: 13px;
    color: var(--df-text-light);
    margin-top: 2px;
  }
  .body {
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .foot {
    padding: 16px 24px;
    border-top: 1px solid var(--df-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
