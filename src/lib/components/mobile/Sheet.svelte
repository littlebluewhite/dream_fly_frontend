<script lang="ts">
  /* 底部 sheet。
   * default slot = 內容；slot `footer` = 底部按鈕列。Escape 關閉；點 scrim 關閉。
   * a11y 比照 Dialog.svelte（svelte-ignore + role/aria/tabindex）。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let open = false;
  export let onClose: () => void;
  export let title = '';
  export let sub = '';
  export let height = 'auto';
  export let maxHeight = '90%';
  export let pad = 18;
  /** Gate the footer region alongside the `footer` slot (lets callers hide it
   *  conditionally while keeping the slot a direct child). */
  export let footer = true;

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="df-scrim"
    on:click={onClose}
    style="position:absolute; inset:0; z-index:80; background:rgba(15,23,42,0.5);
      backdrop-filter:blur(2px); display:flex; flex-direction:column; justify-content:flex-end;"
  >
    <div
      class="df-sheet"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      style="background:#fff; border-top-left-radius:26px; border-top-right-radius:26px;
        max-height:{maxHeight}; height:{height}; display:flex; flex-direction:column;
        box-shadow:0 -16px 50px rgba(2,6,23,0.32); overflow:hidden;"
    >
      <div style="flex:none; padding-top:8px;">
        <div style="width:38px; height:4px; border-radius:999px; background:var(--df-border-strong); margin:0 auto;"></div>
      </div>
      {#if title}
        <div
          style="flex:none; display:flex; align-items:center; gap:10px; padding:12px 18px 12px;
            border-bottom:1px solid var(--df-border);"
        >
          <div style="flex:1; min-width:0;">
            <h3 style="margin:0; font-family:var(--df-font-heading); font-size:18px; font-weight:700; color:var(--df-ink);">{title}</h3>
            {#if sub}
              <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{sub}</div>
            {/if}
          </div>
          <button
            aria-label="關閉"
            on:click={onClose}
            class="df-tapscale"
            style="width:34px; height:34px; border-radius:999px; border:none; background:var(--df-bg-light);
              display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
          >
            <Icon name="x" size={19} color="var(--df-text-light)" />
          </button>
        </div>
      {/if}
      <div class="df-scroll" style="padding:{typeof pad === 'number' ? pad + 'px' : pad};"><slot /></div>
      {#if footer && $$slots.footer}
        <div
          style="flex:none; padding:14px 18px calc(14px + env(safe-area-inset-bottom));
            border-top:1px solid var(--df-border); display:flex; gap:10px;"
        >
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}
