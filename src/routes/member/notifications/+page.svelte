<script lang="ts">
  /* 通知中心 (Notifications) — category-filtered notification feed with a
   * $lib/load-gate three-state gate. Ported from the prototype's
   * Notifications + NotifSkeleton (client/views2.jsx). The list now lives in the
   * shared `notifications` store (the sidebar/topbar unread badge derives from
   * it), so all mutations go through the store rather than a local copy. */
  import { onMount } from 'svelte';
  import { Card, FilterChip, Button, Icon, Skeleton, SkelCard, EmptyState, ErrorState, LoadGate } from '$lib/components/ui';
  import { NOTIF_CATS, NOTIF_TONE_BG, NOTIF_TONE_FG } from '$lib/member/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getNotifications } from '$lib/member/api';
  import { notifications, notificationsHydrated, markRead, markAllRead, toasts } from '$lib/member/stores';

  let cat = 'all';

  // 水合協定改走 load-gate 的 hydrate 選項:guard 短路、post-await 重查(mutation
  // 勝出時放棄覆寫)、成功後翻旗都收進 gate 內部(同 $lib/hydration-gate 語意),
  // 頁面不再手焊 skip/onData。
  const gate = createLoadGate({
    fetch: getNotifications,
    hydrate: {
      flag: notificationsHydrated,
      into: (d) => notifications.set(d)
    }
  });
  onMount(() => {
    gate.load();
  });

  $: list = $notifications.filter((n) => cat === 'all' || n.cat === cat);
  $: unread = $notifications.filter((n) => !n.read).length;
  const countOf = (c: string) =>
    c === 'all' ? $notifications.length : $notifications.filter((n) => n.cat === c).length;

  // 已讀 mutation 收進 $lib/member/notifications 模組(C1；markRead/markAllRead)
  // ——樂觀更新、後端同步、併發判定的邏輯全部在模組裡(見該模組註解)，頁面只負責
  // 依回傳值顯示既有 toast 文案。
  const markAll = async () => {
    const result = await markAllRead();
    if (result === 'partial') {
      toasts.notify('error', '部分通知標記失敗', '部分通知未能同步已讀狀態，請稍後重新整理。');
    } else {
      toasts.notify('success', '已全部標為已讀', '通知中心已清空未讀。');
    }
  };
</script>

<LoadGate {gate}>
  <div class="df-view" data-testid="notifs-skeleton" slot="loading">
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

  <div class="df-view" slot="error">
    <Card padding={0}>
      <ErrorState onRetry={gate.refresh} />
    </Card>
  </div>
</LoadGate>

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
