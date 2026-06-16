<script lang="ts">
  /* Section title row。ui.jsx SectionTitle (83-90)。default slot = 標題；action/onAction = 右側連結。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let action = '';
  export let onAction: (() => void) | undefined = undefined;
</script>

<div style="display:flex; justify-content:space-between; align-items:baseline; margin:2px 0 12px;">
  <h3 style="margin:0; font-family:var(--df-font-heading); font-size:17px; font-weight:700; color:var(--df-ink);">
    <slot />
  </h3>
  {#if action}
    <button
      on:click={onAction}
      style="border:none; background:none; font-size:13px; font-weight:600; color:var(--df-primary);
        cursor:pointer; display:flex; align-items:center; gap:2px; padding:0;"
    >{action}<Icon name="chevron-right" size={15} /></button>
  {/if}
</div>
