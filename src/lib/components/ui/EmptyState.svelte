<script lang="ts">
  /* Empty-state block — icon bubble, title, optional body, optional `action`
   * slot (e.g. a button). */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';
  export let icon: IconName = 'info';
  export let title = '';
  export let body = '';
  export let pad = '56px 24px';
</script>

<div class="empty" style="padding:{pad}">
  <div class="bubble"><Icon name={icon} size={30} color="var(--df-text-muted)" /></div>
  <div class="title">{title}</div>
  {#if body}<div class="body">{body}</div>{/if}
  {#if $$slots.action}<div class="action"><slot name="action" /></div>{/if}
</div>

<style>
  .empty {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .bubble {
    width: 66px;
    height: 66px;
    border-radius: 18px;
    background: var(--df-bg-light);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .title {
    font-size: 16px;
    font-weight: var(--df-weight-bold);
    color: var(--df-ink);
  }
  .body {
    font-size: 13.5px;
    color: var(--df-text-light);
    max-width: 360px;
    line-height: 1.6;
  }
  .action {
    margin-top: 12px;
  }
</style>
