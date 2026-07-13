<script lang="ts">
  /* 提示框（灰底）。ported from ui.jsx NoteBox。default slot = 內容。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let icon: IconName = 'info';
  export let tone = 'var(--df-primary)';
</script>

<div
  style="display:flex; align-items:flex-start; gap:9px; font-size:13px; color:var(--df-text-light);
    background:var(--df-bg-light); border-radius:11px; padding:11px 13px; line-height:1.55;"
>
  <span style="margin-top:1px; flex:none; display:flex;">
    <Icon name={icon} size={16} color={tone} />
  </span>
  <div><slot /></div>
</div>
