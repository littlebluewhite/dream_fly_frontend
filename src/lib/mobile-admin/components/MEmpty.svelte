<script lang="ts">
  /* 空狀態。ui.jsx MEmpty (193-203)。slot `action` 取代 React `action` prop。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let icon = 'inbox';
  export let title: string;
  export let body = '';
  export let pad = '46px 24px';
</script>

<div style="text-align:center; padding:{pad}; display:flex; flex-direction:column; align-items:center; gap:6px;">
  <div
    style="width:62px; height:62px; border-radius:18px; background:var(--df-bg-light);
      display:flex; align-items:center; justify-content:center; margin-bottom:6px;"
  >
    <Icon name={icon} size={28} color="var(--df-text-muted)" />
  </div>
  <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{title}</div>
  {#if body}
    <div style="font-size:13px; color:var(--df-text-light); max-width:280px; line-height:1.6;">{body}</div>
  {/if}
  {#if $$slots.action}
    <div style="margin-top:10px;"><slot name="action" /></div>
  {/if}
</div>
