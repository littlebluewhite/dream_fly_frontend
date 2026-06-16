<script lang="ts">
  /* 帶標題的白卡。ui.jsx Panel (220-235)。slot `right` 取代 React `right` prop；
   * 若無 right 但有 action 則渲染 action 連結。default slot = 內容。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let title = '';
  export let sub = '';
  export let action = '';
  export let onAction: (() => void) | undefined = undefined;
  export let pad = 0;
</script>

<div
  style="background:#fff; border:1px solid var(--df-border); border-radius:16px;
    box-shadow:var(--df-shadow-card); overflow:hidden;"
>
  {#if title}
    <div
      style="display:flex; justify-content:space-between; align-items:center; padding:15px 16px 13px;
        border-bottom:1px solid var(--df-border);"
    >
      <div style="min-width:0;">
        <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);">{title}</h3>
        {#if sub}
          <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">{sub}</div>
        {/if}
      </div>
      {#if $$slots.right}
        <slot name="right" />
      {:else if action}
        <button
          on:click={onAction}
          style="border:none; background:none; font-size:13px; font-weight:600; color:var(--df-primary);
            cursor:pointer; display:flex; align-items:center; gap:2px;"
        >{action}<Icon name="chevron-right" size={15} /></button>
      {/if}
    </div>
  {/if}
  <div style="padding:{typeof pad === 'number' ? pad + 'px' : pad};"><slot /></div>
</div>
