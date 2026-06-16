<script lang="ts">
  /* 圓形 header icon 按鈕，可帶 dot badge。ui.jsx HeaderIcon (71-80). */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let icon: string;
  export let onClick: (() => void) | undefined = undefined;
  export let badge = 0;
  export let light = false;
  export let label = '';

  $: fg = light ? '#fff' : 'var(--df-ink)';
  $: bg = light ? 'rgba(255,255,255,0.16)' : 'var(--df-bg-light)';
</script>

<button
  aria-label={label}
  on:click={onClick}
  class="df-tapscale"
  style="position:relative; width:40px; height:40px; border-radius:999px; border:none;
    background:{bg}; display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
>
  <Icon name={icon} size={20} color={fg} />
  {#if badge > 0}
    <span
      style="position:absolute; top:-3px; right:-3px; min-width:18px; height:18px; padding:0 5px;
        border-radius:999px; background:var(--df-accent); color:var(--df-ink); font-size:11px;
        font-weight:800; display:flex; align-items:center; justify-content:center;
        border:2px solid {light ? 'var(--df-primary-dark)' : '#fff'};"
    >{badge}</span>
  {/if}
</button>
