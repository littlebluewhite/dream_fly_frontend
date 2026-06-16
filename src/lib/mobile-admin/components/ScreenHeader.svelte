<script lang="ts">
  /* 白底 screen header（可選返回鍵）。ui.jsx ScreenHeader (53-68)。
   * outer 套 m-top-inset 以清除瀏海 / 動態島。slot `right` 取代 React `right` prop。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let title: string;
  export let sub = '';
  export let onBack: (() => void) | undefined = undefined;
  export let border = true;
</script>

<div
  class="m-top-inset"
  style="flex:none; background:#fff; border-bottom:{border ? '1px solid var(--df-border)' : 'none'};"
>
  <div style="display:flex; align-items:center; gap:8px; padding:4px 14px 12px; min-height:52px;">
    {#if onBack}
      <button
        aria-label="返回"
        on:click={onBack}
        class="df-tapscale"
        style="width:38px; height:38px; border-radius:11px; border:none; background:var(--df-bg-light);
          display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
      >
        <Icon name="chevron-left" size={22} color="var(--df-ink)" />
      </button>
    {/if}
    <div style="flex:1; min-width:0; padding-left:{onBack ? '2px' : '8px'};">
      <h2
        style="margin:0; font-family:var(--df-font-heading); font-size:20px; font-weight:700;
          color:var(--df-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
      >{title}</h2>
      {#if sub}
        <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{sub}</div>
      {/if}
    </div>
    <slot name="right" />
  </div>
</div>
