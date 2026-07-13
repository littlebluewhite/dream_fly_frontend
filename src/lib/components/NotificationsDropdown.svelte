<script lang="ts">
  import { notificationsStore } from '$lib/stores/notificationsStore';
  import { getRelativeTime } from '$lib/utils/timeUtils';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let isOpen = false;
  export let onClose: () => void;

  $: notifications = $notificationsStore;

  function handleNotificationClick(notificationId: string) {
    notificationsStore.markAsRead(notificationId);
  }

  function markAllRead() {
    notificationsStore.markAllAsRead();
  }

  // Map notification types to Lucide icon names
  const notificationIconNames: Record<string, IconName> = {
    reminder: 'clock',
    promotion: 'sparkles',
    schedule: 'calendar-days',
    announcement: 'bell'
  };
</script>

{#if isOpen}
  <button type="button" class="dropdown-overlay" on:click={onClose} aria-label="關閉通知"></button>
  <div class="notifications-dropdown">
    <div class="dropdown-header">
      <h3>
        <Icon name="bell" size={18} color="var(--df-primary)" />
        通知
      </h3>
      <button class="close-btn" on:click={onClose} aria-label="關閉">
        <Icon name="x" size={18} color="currentColor" />
      </button>
    </div>

    <div class="dropdown-body">
      {#if notifications.length === 0}
        <div class="empty-state">
          <p>沒有通知</p>
        </div>
      {:else}
        <div class="notifications-actions">
          <button class="mark-all-read-btn" on:click={markAllRead}>全部標記為已讀</button>
        </div>

        <div class="notifications-list">
          {#each notifications as notification (notification.id)}
            <div
              class="notification-item"
              class:unread={!notification.read}
              on:click={() => handleNotificationClick(notification.id)}
              on:keypress={(e) => e.key === 'Enter' && handleNotificationClick(notification.id)}
              role="button"
              tabindex="0"
            >
              <div class="notification-icon">
                <Icon
                  name={notificationIconNames[notification.type] || 'info'}
                  size={20}
                  color="var(--df-primary)"
                />
              </div>
              <div class="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <span class="notification-time">{getRelativeTime(notification.timestamp)}</span>
              </div>
              {#if !notification.read}
                <div class="unread-indicator"></div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    z-index: 999;
  }

  .notifications-dropdown {
    position: fixed;
    top: 70px;
    right: 20px;
    width: 400px;
    max-width: calc(100vw - 40px);
    max-height: 500px;
    background-color: var(--df-surface);
    border-radius: var(--df-radius-lg);
    border: 1px solid var(--df-border);
    box-shadow: var(--df-shadow-lifted);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--df-border);
  }

  .dropdown-header h3 {
    margin: 0;
    color: var(--df-primary);
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--df-text-light);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast);
    border-radius: var(--df-radius-md);
  }

  .close-btn:hover {
    color: var(--df-text-dark);
    background-color: var(--df-bg-light);
  }

  .dropdown-body {
    flex: 1;
    overflow-y: auto;
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-xl) 0;
    color: var(--df-text-light);
  }

  .notifications-actions {
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--df-border);
  }

  .mark-all-read-btn {
    background: none;
    border: none;
    color: var(--df-primary);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.25rem 0.5rem;
    transition: opacity var(--transition-fast);
  }

  .mark-all-read-btn:hover {
    opacity: 0.7;
  }

  .notifications-list {
    display: flex;
    flex-direction: column;
  }

  .notification-item {
    display: flex;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--df-border);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    position: relative;
  }

  .notification-item:hover {
    background-color: var(--df-bg-light);
  }

  .notification-item.unread {
    background-color: var(--df-primary-bg);
  }

  .notification-icon {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    padding-top: 2px;
  }

  .notification-content {
    flex: 1;
  }

  .notification-content h4 {
    margin: 0 0 0.25rem 0;
    color: var(--df-text-dark);
    font-size: 0.95rem;
    font-weight: 600;
  }

  .notification-content p {
    margin: 0 0 0.5rem 0;
    color: var(--df-text-light);
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .notification-time {
    font-size: 0.75rem;
    color: var(--df-text-muted);
  }

  .unread-indicator {
    position: absolute;
    top: 50%;
    right: var(--spacing-md);
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    background-color: var(--df-primary);
    border-radius: 50%;
  }

  @media (max-width: 767px) {
    .notifications-dropdown {
      right: 10px;
      width: calc(100vw - 20px);
      max-height: 400px;
    }
  }
</style>
