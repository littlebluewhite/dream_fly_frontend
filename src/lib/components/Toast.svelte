<script lang="ts">
  import { toastStore } from '$lib/stores/toastStore';
  import { fade, fly } from 'svelte/transition';
  import Icon from '$lib/components/ui/Icon.svelte';

  $: toasts = $toastStore;

  const toastIconNames: Record<string, string> = {
    success: 'circle-check',
    error: 'circle-alert',
    info: 'info'
  };
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      in:fly={{ x: 300, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <div class="toast-icon">
        <Icon name={toastIconNames[toast.type] || 'info'} size={20} color="currentColor" />
      </div>
      <div class="toast-message">{toast.message}</div>
      <button
        class="toast-close"
        on:click={() => toastStore.removeToast(toast.id)}
        aria-label="關閉"
      >
        <Icon name="x" size={16} color="currentColor" />
      </button>
      <div class="toast-progress"></div>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    pointer-events: none;
  }

  .toast {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background-color: var(--df-surface);
    padding: var(--spacing-md);
    border-radius: var(--df-radius-lg);
    box-shadow: var(--df-shadow-lifted);
    min-width: 300px;
    max-width: 400px;
    pointer-events: auto;
    overflow: hidden;
  }

  .toast-success {
    border-left: 4px solid var(--df-success);
  }

  .toast-error {
    border-left: 4px solid var(--df-error);
  }

  .toast-info {
    border-left: 4px solid var(--df-info);
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .toast-success .toast-icon {
    background-color: var(--df-success-bg);
    color: var(--df-success-strong);
  }

  .toast-error .toast-icon {
    background-color: var(--df-error-bg);
    color: var(--df-error-strong);
  }

  .toast-info .toast-icon {
    background-color: var(--df-info-bg);
    color: var(--df-info);
  }

  .toast-message {
    flex: 1;
    color: var(--df-text-dark);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--df-text-muted);
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
    flex-shrink: 0;
    border-radius: var(--df-radius-sm);
  }

  .toast-close:hover {
    color: var(--df-text-dark);
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 100%;
    animation: progress 3000ms linear forwards;
    transform-origin: left;
  }

  .toast-success .toast-progress {
    background-color: var(--df-success);
    opacity: 0.4;
  }

  .toast-error .toast-progress {
    background-color: var(--df-error);
    opacity: 0.4;
  }

  .toast-info .toast-progress {
    background-color: var(--df-info);
    opacity: 0.4;
  }

  @keyframes progress {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  @media (max-width: 767px) {
    .toast-container {
      right: 10px;
      left: 10px;
    }

    .toast {
      min-width: auto;
      max-width: 100%;
    }
  }
</style>
