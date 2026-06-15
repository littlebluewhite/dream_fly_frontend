<script lang="ts">
  /* Generic ~560px form-modal shell for the admin back-office edit dialogs
   * (ClassEditDialog / CoachEditDialog / OrderDialog / MemberEditDialog / 變更密碼).
   * Centered overlay card with a header (optional icon tile + title + subtitle +
   * close X), a scrolling body (default slot) and a footer (取消 secondary +
   * primary primaryLabel). Ported from admin.jsx's EditModal; mirrors the
   * member-centre FormModal conventions (open / onClose / close-on-overlay /
   * Escape). Body is fully slotted and the primary label is overridable so
   * downstream dialogs can wrap it. Overlay click and Escape both call onClose. */
  import { Button, IconButton, Icon } from '$lib/components/ui';

  export let open = false;
  export let title = '';
  export let sub = '';
  export let icon: string | undefined = undefined;
  export let primaryLabel = '儲存';
  export let onClose: () => void = () => {};
  export let onSave: () => void = () => {};

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" on:click={onClose}>
    <div
      class="card"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:click|stopPropagation
    >
      <div class="head">
        {#if icon}
          <div class="icon-tile"><Icon name={icon} size={20} color="var(--df-primary)" /></div>
        {/if}
        <div class="title-wrap">
          <h3>{title}</h3>
          {#if sub}<div class="sub">{sub}</div>{/if}
        </div>
        <IconButton aria-label="關閉" variant="ghost" on:click={onClose}>
          <Icon name="x" size={20} />
        </IconButton>
      </div>
      <div class="body"><slot /></div>
      <div class="foot">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" on:click={onSave}>
          <Icon name="check" size={16} />
          {primaryLabel}
        </Button>
      </div>
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
  .card {
    width: 100%;
    max-width: 560px;
    background: #fff;
    border-radius: 16px;
    box-shadow: var(--df-shadow-strong);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 88vh;
  }
  .head {
    padding: 20px 24px;
    border-bottom: 1px solid var(--df-border);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .icon-tile {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--df-primary-bg);
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
  .sub {
    font-size: 12.5px;
    color: var(--df-text-light);
    margin-top: 2px;
  }
  .body {
    padding: 24px;
    overflow-y: auto;
  }
  .foot {
    padding: 16px 24px;
    border-top: 1px solid var(--df-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  /* match admin.jsx's primary button: leading check icon beside the label */
  .foot :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
</style>
