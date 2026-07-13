<script lang="ts">
  /* Inline note / hint row with a leading icon. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';
  export let icon: IconName = 'info';
  export let tone = 'var(--df-primary)';
</script>

<div class="note">
  <Icon name={icon} size={16} color={tone} style="margin-top:1px" />
  <div class="body"><slot /></div>
</div>

<style>
  .note {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    font-size: 13px;
    color: var(--df-text-light);
    background: var(--df-bg-light);
    border-radius: 9px;
    padding: 11px 13px;
    line-height: 1.55;
  }
  .body :global(b) {
    color: var(--df-text-dark);
  }
</style>
