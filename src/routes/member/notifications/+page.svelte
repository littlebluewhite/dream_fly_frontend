<script lang="ts">
  /* 通知中心 (Notifications) — category-filtered notification feed with a
   * loading / error / ready phase machine. Ported from the prototype's
   * Notifications + NotifSkeleton (client/views2.jsx). The list now lives in the
   * shared `notifications` store (the sidebar/topbar unread badge derives from
   * it), so all mutations go through the store rather than a local copy. */
  import { onMount } from 'svelte';
  import { Card, FilterChip, Button, Icon } from '$lib/components/ui';
  import Skeleton from '$lib/member/components/Skeleton.svelte';
  import SkelCard from '$lib/member/components/SkelCard.svelte';
  import EmptyState from '$lib/member/components/EmptyState.svelte';
  import ErrorState from '$lib/member/components/ErrorState.svelte';
  import { NOTIF_CATS, NOTIF_TONE_BG, NOTIF_TONE_FG } from '$lib/member/data';
  import { notifications, toasts } from '$lib/member/stores';

  let cat = 'all';
  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let refreshed = false;

  function run(fail: boolean) {
    phase = 'loading';
    setTimeout(() => (phase = fail ? 'error' : 'ready'), 720);
  }
  onMount(() => run(false));

  $: list = $notifications.filter((n) => cat === 'all' || n.cat === cat);
  $: unread = $notifications.filter((n) => !n.read).length;
  const countOf = (c: string) =>
    c === 'all' ? $notifications.length : $notifications.filter((n) => n.cat === c).length;

  const markRead = (id: string) =>
    notifications.update((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAll = () => {
    notifications.update((p) => p.map((n) => ({ ...n, read: true })));
    toasts.notify('success', '已全部標為已讀', '通知中心已清空未讀。');
  };
  // First manual refresh demonstrates an error → retry boundary; subsequent
  // refreshes succeed.
  const refresh = () => {
    const fail = !refreshed;
    refreshed = true;
    run(fail);
  };
</script>

{#if phase === 'loading'}
  <div class="df-view">
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
{:else if phase === 'error'}
  <div class="df-view">
    <Card padding={0}>
      <ErrorState onRetry={() => run(false)} />
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
        <Button variant="ghost" size="sm" on:click={refresh}>
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
