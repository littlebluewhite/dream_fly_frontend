<script lang="ts">
  /* 通知中心 (Notifications) — category-filtered notification feed with a
   * $lib/load-gate three-state gate. Ported from the prototype's
   * Notifications + NotifSkeleton (client/views2.jsx). The list now lives in the
   * shared `notifications` store (the sidebar/topbar unread badge derives from
   * it), so all mutations go through the store rather than a local copy. */
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { Card, FilterChip, Button, Icon, Skeleton, SkelCard, EmptyState, ErrorState } from '$lib/components/ui';
  import { NOTIF_CATS, NOTIF_TONE_BG, NOTIF_TONE_FG } from '$lib/member/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getNotifications } from '$lib/member/api';
  import { notifications, notificationsHydrated, toasts } from '$lib/member/stores';
  import { api } from '$lib/api/client';

  let cat = 'all';

  // First client mount hydrates the feed once via the seam; re-visits skip the
  // fetch (guard already true) so read-state / unread badge aren't clobbered.
  const gate = createLoadGate({
    fetch: getNotifications,
    skip: () => get(notificationsHydrated),
    onData: (d) => { notifications.set(d); notificationsHydrated.set(true); }
  });
  onMount(() => {
    gate.load();
  });

  $: list = $notifications.filter((n) => cat === 'all' || n.cat === cat);
  $: unread = $notifications.filter((n) => !n.read).length;
  const countOf = (c: string) =>
    c === 'all' ? $notifications.length : $notifications.filter((n) => n.cat === c).length;

  // 樂觀更新本地 store,再送 PATCH 到後端;失敗只記錄錯誤、不還原(避免使用者感覺
  // 「點了又跳回未讀」的閃爍)。markAll 的後端同步策略見其上方註解。
  const markRead = (id: string) => {
    notifications.update((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api(`/notifications/${id}/read`, { method: 'PATCH' }).catch((err) => {
      console.error('Failed to mark notification as read:', err);
    });
  };
  // 全部已讀:同 markRead 的樂觀更新,但後端只有單筆 PATCH 端點(無批次已讀),
  // 對每個「目前未讀」的 id 各發一次(allSettled 併發;已讀的不重發)。全部成功才報
  // 成功;任何失敗改報「部分通知標記失敗」——本地已讀狀態一律不還原(與 markRead
  // 的不閃爍原則一致;成功的那些後端已落地,失敗的重新整理後會恢復未讀)。
  const markAll = async () => {
    const unreadIds = get(notifications).filter((n) => !n.read).map((n) => n.id);
    notifications.update((p) => p.map((n) => ({ ...n, read: true })));
    const results = await Promise.allSettled(
      unreadIds.map((id) => api(`/notifications/${id}/read`, { method: 'PATCH' }))
    );
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failures.length > 0) {
      failures.forEach((f) => console.error('Failed to mark notification as read:', f.reason));
      toasts.notify('error', '部分通知標記失敗', '部分通知未能同步已讀狀態，請稍後重新整理。');
    } else {
      toasts.notify('success', '已全部標為已讀', '通知中心已清空未讀。');
    }
  };
</script>

{#if $gate === 'loading'}
  <div class="df-view" data-testid="notifs-skeleton">
    <div style="display:flex;gap:8px;margin-bottom:18px">
      {#each [60, 50, 50, 50, 50] as w, i (i)}
        <Skeleton {w} h={30} r={999} />
      {/each}
    </div>
    <SkelCard padding={0}>
      {#each [0, 1, 2, 3] as i (i)}
        <div
          style="display:flex;gap:14px;padding:16px 22px;border-bottom:{i < 3
            ? '1px solid var(--df-border)'
            : 'none'}"
        >
          <Skeleton w={40} h={40} r={11} />
          <div style="flex:1;display:flex;flex-direction:column;gap:9px">
            <Skeleton w="38%" h={13} />
            <Skeleton w="72%" h={11} />
          </div>
          <Skeleton w={50} h={11} />
        </div>
      {/each}
    </SkelCard>
  </div>
{:else if $gate === 'error'}
  <div class="df-view">
    <Card padding={0}>
      <ErrorState onRetry={gate.refresh} />
    </Card>
  </div>
{:else}
  <div class="df-view">
    <div
      style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px"
    >
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        {#each NOTIF_CATS as [v, l] (v)}
          <FilterChip selected={cat === v} on:click={() => (cat = v)}>
            {l}
            {#if countOf(v) > 0}<span style="opacity:0.7">· {countOf(v)}</span>{/if}
          </FilterChip>
        {/each}
      </div>
      <div style="display:flex;gap:8px">
        <Button variant="ghost" size="sm" on:click={gate.refresh}>
          <Icon name="rotate-cw" size={15} />重新整理
        </Button>
        <Button variant="secondary" size="sm" disabled={unread === 0} on:click={markAll}>
          <Icon name="check-check" size={15} />全部標為已讀
        </Button>
      </div>
    </div>
    <Card padding={0} style="overflow:hidden">
      {#if list.length === 0}
        <EmptyState
          icon="bell-off"
          title="目前沒有通知"
          body="這個分類底下沒有任何訊息，切換其他分類看看吧。"
        />
      {:else}
        {#each list as n, i (n.id)}
          <button
            type="button"
            class="df-rowhover notif-row"
            on:click={() => markRead(n.id)}
            style="border-bottom:{i < list.length - 1
              ? '1px solid var(--df-border)'
              : 'none'};background:{n.read ? 'transparent' : 'var(--df-primary-bg)'}"
          >
            <div
              style="width:40px;height:40px;border-radius:11px;background:{NOTIF_TONE_BG[
                n.tone
              ]};display:flex;align-items:center;justify-content:center;flex:none"
            >
              <Icon name={n.icon} size={20} color={NOTIF_TONE_FG[n.tone]} />
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:14.5px;font-weight:{n.read ? 600 : 700};color:var(--df-ink)"
                  >{n.title}</span
                >
                {#if !n.read}
                  <span
                    style="width:8px;height:8px;border-radius:50%;background:var(--df-primary);flex:none"
                  ></span>
                {/if}
              </div>
              <div style="font-size:13px;color:var(--df-text-light);margin-top:3px;line-height:1.55">
                {n.body}
              </div>
            </div>
            <div style="font-size:12px;color:var(--df-text-muted);white-space:nowrap;padding-top:2px">
              {n.time}
            </div>
          </button>
        {/each}
      {/if}
    </Card>
  </div>
{/if}

<style>
  /* Clickable notification row rendered as a real <button> (keyboard-/SR-
   * accessible) with the button chrome reset so the ported flex layout holds. */
  .notif-row {
    display: flex;
    gap: 14px;
    padding: 16px 22px;
    width: 100%;
    border: none;
    border-radius: 0;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    color: inherit;
  }
</style>
