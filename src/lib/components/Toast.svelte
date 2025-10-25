<script lang="ts">
  import { toastStore } from '$lib/stores/toastStore';
  import { fade, fly } from 'svelte/transition';

  $: toasts = $toastStore;

  const toastIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      in:fly={{ x: 300, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <div class="toast-icon">{toastIcons[toast.type]}</div>
      <div class="toast-message">{toast.message}</div>
      <button
        class="toast-close"
        on:click={() => toastStore.removeToast(toast.id)}
        aria-label="關閉"
      >
        ✕
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
    background-color: var(--color-white);
    padding: var(--spacing-md);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 300px;
    max-width: 400px;
    pointer-events: auto;
    overflow: hidden;
  }

  .toast-success {
    border-left: 4px solid #28a745;
  }

  .toast-error {
    border-left: 4px solid #dc3545;
  }

  .toast-info {
    border-left: 4px solid var(--color-primary);
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-weight: bold;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .toast-success .toast-icon {
    background-color: #28a745;
    color: white;
  }

  .toast-error .toast-icon {
    background-color: #dc3545;
    color: white;
  }

  .toast-info .toast-icon {
    background-color: var(--color-primary);
    color: white;
  }

  .toast-message {
    flex: 1;
    color: var(--color-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .toast-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-light);
    font-size: 1.2rem;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
    flex-shrink: 0;
  }

  .toast-close:hover {
    color: var(--color-text);
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 100%;
    background-color: rgba(0, 0, 0, 0.1);
    animation: progress 3000ms linear forwards;
  }

  .toast-success .toast-progress {
    background-color: rgba(40, 167, 69, 0.3);
  }

  .toast-error .toast-progress {
    background-color: rgba(220, 53, 69, 0.3);
  }

  .toast-info .toast-progress {
    background-color: rgba(0, 102, 204, 0.3);
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
