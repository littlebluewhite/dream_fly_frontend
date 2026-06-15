<script lang="ts">
  /* Bottom-right toast stack, driven by the member `toasts` store. Title + body
   * + tone bar, matching the DS Toast. */
  import { fly } from 'svelte/transition';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toasts, type ToastTone } from '$lib/member/stores';

  const ICONS: Record<ToastTone, string> = {
    success: 'circle-check',
    info: 'info',
    warning: 'triangle-alert',
    error: 'circle-x'
  };
  const BAR: Record<ToastTone, string> = {
    success: 'var(--df-success)',
    info: 'var(--df-info)',
    warning: 'var(--df-warning)',
    error: 'var(--df-error)'
  };
</script>

<div class="stack">
  {#each $toasts as t (t.id)}
    <div
      class="toast"
      style="border-left-color:{BAR[t.tone]}"
      role="status"
      transition:fly={{ y: 12, duration: 200 }}
    >
      <span class="ic"><Icon name={ICONS[t.tone]} size={18} color={BAR[t.tone]} /></span>
      <div class="msg">
        {#if t.title}<div class="title">{t.title}</div>{/if}
        {#if t.body}<div class="body">{t.body}</div>{/if}
      </div>
      <button class="close" aria-label="關閉" on:click={() => toasts.dismiss(t.id)}>×</button>
    </div>
  {/each}
</div>

<style>
  .stack {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 280px;
    max-width: 420px;
    padding: 14px 16px;
    background: #fff;
    border-radius: var(--df-radius-md);
    box-shadow: var(--df-shadow-lifted);
    border-left: 4px solid var(--df-success);
    font-family: var(--df-font-body);
  }
  .ic {
    display: inline-flex;
    margin-top: 1px;
  }
  .msg {
    flex: 1;
  }
  .title {
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-bold);
    color: var(--df-text-dark);
    margin-bottom: 2px;
  }
  .body {
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
    line-height: 1.5;
  }
  .close {
    border: none;
    background: transparent;
    color: var(--df-text-muted);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0;
  }
  @media (max-width: 720px) {
    .stack {
      right: 12px;
      left: 12px;
      bottom: 12px;
    }
    .toast {
      min-width: 0;
      max-width: 100%;
    }
  }
</style>
