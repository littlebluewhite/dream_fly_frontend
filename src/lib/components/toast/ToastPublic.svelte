<script lang="ts">
  /* Toast stack for the public/marketing surface. Light background, top-right
   * positioning, fly-in + fade-out transitions, progress bar per toast.
   * Driven by a `toasts` store prop. */
  import type { ToastTone, createToasts } from '$lib/stores/toasts';
  import { fade, fly } from 'svelte/transition';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let toasts: ReturnType<typeof createToasts>;

  const toastIconNames: Record<ToastTone, string> = {
    success: 'circle-check',
    error: 'circle-alert',
    info: 'info',
    warning: 'triangle-alert',
    accent: 'star'
  };
</script>

<div class="toast-container">
  {#each $toasts as t (t.id)}
    <div
      class="toast toast-{t.tone}"
      in:fly={{ x: 300, duration: 300 }}
      out:fade={{ duration: 200 }}
      role="status"
    >
      <div class="toast-icon">
        <Icon name={toastIconNames[t.tone] || 'info'} size={20} color="currentColor" />
      </div>
      <div class="toast-message">{t.title}</div>
      <button
        class="toast-close"
        on:click={() => toasts.dismiss(t.id)}
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

  .toast-warning {
    border-left: 4px solid var(--df-warning);
  }

  .toast-accent {
    border-left: 4px solid var(--df-accent);
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

  .toast-warning .toast-icon {
    background-color: var(--df-warning-bg, var(--df-warning));
    color: var(--df-warning);
  }

  .toast-accent .toast-icon {
    background-color: var(--df-accent-bg, var(--df-accent));
    color: var(--df-accent);
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

  .toast-warning .toast-progress {
    background-color: var(--df-warning);
    opacity: 0.4;
  }

  .toast-accent .toast-progress {
    background-color: var(--df-accent);
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
