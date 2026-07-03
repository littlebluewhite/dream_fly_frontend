<script lang="ts">
  /* 通知 tab。account.jsx NotificationsScreen (6-45)。
   * ScreenHeader（右側「重新整理」+「全部已讀」，未讀>0 才顯示）、NOTIF_CATS 類別
   * chip（本地 cat）、notifs store 清單、點擊 → notifs.markRead(id)、全部已讀 →
   * notifs.markAllRead + toast、MEmpty fallback。
   * Legacy Svelte（無 runes）、繁體中文文案、mock-only。
   *
   * 資料改由 getNotifications()(mock-API 接縫)非同步水合共享 notifs store
   * (member notifications 範本同款):alive 旗標防 unmount 後 resolve 覆寫、
   * notifsHydrated 守衛防重訪重抓、refresh() 一律重新 fetch 供「重新整理」與
   * ErrorState 重試共用(不會被 load() 的守衛短路)。markRead/markAllRead 既有
   * mutation 不動。 */
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import { NOTIF_CATS, NOTIF_TONE_BG, NOTIF_TONE_FG } from '$lib/mobile/data';
  import { getNotifications } from '$lib/mobile/api';
  import { notifs, notifsHydrated, unread, toasts } from '$lib/mobile/stores';

  let alive = true;
  onDestroy(() => { alive = false; });

  let cat = 'all';
  let phase: 'loading' | 'error' | 'ready' = 'loading';

  // 首次 client mount 透過接縫水合一次 feed;重訪時守衛已為 true 就跳過 fetch
  // (不覆寫已讀狀態 / 未讀徽章)。
  function load() {
    phase = 'loading';
    if (get(notifsHydrated)) {
      phase = 'ready';
      return;
    }
    getNotifications()
      .then((d) => { if (!alive) return; notifs.set(d); notifsHydrated.set(true); phase = 'ready'; })
      .catch(() => { if (alive) phase = 'error'; });
  }
  onMount(load);

  $: list = $notifs.filter((n) => cat === 'all' || n.cat === cat);

  function markAll() {
    notifs.markAllRead();
    toasts.notify('success', '已全部標示為已讀');
  }

  // 使用者主動要求最新資料 → 一律重新 fetch(不受 hydration 守衛短路),
  // 供「重新整理」按鈕與 ErrorState 的重試共用。
  function refresh() {
    phase = 'loading';
    getNotifications()
      .then((d) => { if (!alive) return; notifs.set(d); notifsHydrated.set(true); phase = 'ready'; })
      .catch(() => { if (alive) phase = 'error'; });
  }
</script>

{#if phase === 'loading'}
  <div class="m-top-inset df-scroll df-view" data-testid="notifications-skeleton" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      {#each [50, 50, 50, 50, 50] as w, i (i)}
        <Skeleton {w} h={28} r={999} />
      {/each}
    </div>
    <SkelCard padding={0}>
      {#each [0, 1, 2, 3] as i (i)}
        <div
          style="display:flex; gap:12px; padding:13px; border-bottom:{i < 3
            ? '1px solid var(--df-border)'
            : 'none'}"
        >
          <Skeleton w={40} h={40} r={11} />
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            <Skeleton w="40%" h={13} />
            <Skeleton w="70%" h={11} />
          </div>
        </div>
      {/each}
    </SkelCard>
  </div>
{:else if phase === 'error'}
  <div class="m-top-inset df-scroll df-view" style="padding:14px;">
    <Card padding={0}><ErrorState onRetry={refresh} /></Card>
  </div>
{:else}
<ScreenHeader title="通知中心" sub={$unread > 0 ? $unread + ' 則未讀' : '全部已讀'}>
  <svelte:fragment slot="right">
    <div style="display:flex; gap:8px;">
      <button
        on:click={refresh}
        class="df-tapscale"
        style="border:none; background:var(--df-bg-light); color:var(--df-text-dark); font-size:12.5px;
          font-weight:700; padding:8px 12px; border-radius:9px; cursor:pointer; flex:none;
          display:flex; align-items:center; gap:5px;"
      ><Icon name="rotate-cw" size={14} />重新整理</button>
      {#if $unread > 0}
        <button
          on:click={markAll}
          class="df-tapscale"
          style="border:none; background:var(--df-primary-bg); color:var(--df-primary); font-size:12.5px;
            font-weight:700; padding:8px 12px; border-radius:9px; cursor:pointer; flex:none;"
        >全部已讀</button>
      {/if}
    </div>
  </svelte:fragment>
</ScreenHeader>

<div style="flex:none; background:#fff; border-bottom:1px solid var(--df-border);">
  <div class="df-hide-scrollbar" style="display:flex; gap:8px; overflow-x:auto; padding:0 14px 11px;">
    {#each NOTIF_CATS as [k, l] (k)}
      <button
        on:click={() => (cat = k)}
        class="df-tapscale"
        style="flex:none; height:32px; padding:0 13px; border-radius:999px;
          border:1.5px solid {cat === k ? 'var(--df-primary)' : 'var(--df-border)'};
          background:{cat === k ? 'var(--df-primary)' : '#fff'};
          color:{cat === k ? '#fff' : 'var(--df-text-dark)'}; font-size:12.5px;
          font-weight:{cat === k ? 700 : 500}; cursor:pointer; white-space:nowrap;"
      >{l}</button>
    {/each}
  </div>
</div>

<div class="df-scroll df-view">
  <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
    {#if list.length === 0}
      <MEmpty icon="bell-off" title="沒有通知" body="這個分類目前沒有任何通知。" />
    {:else}
      {#each list as n (n.id)}
        <button
          on:click={() => notifs.markRead(n.id)}
          class="df-tapscale"
          style="text-align:left; display:flex; gap:12px; padding:13px; border-radius:14px;
            border:1px solid var(--df-border); background:{n.read ? '#fff' : 'var(--df-primary-bg)'}; cursor:pointer;"
        >
          <div
            style="width:40px; height:40px; border-radius:11px; background:{NOTIF_TONE_BG[n.tone]};
              display:flex; align-items:center; justify-content:center; flex:none;"
          >
            <Icon name={n.icon} size={20} color={NOTIF_TONE_FG[n.tone]} />
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:7px; margin-bottom:3px;">
              <span style="font-size:14px; font-weight:700; color:var(--df-ink); flex:1; min-width:0;">{n.title}</span>
              {#if !n.read}
                <span style="width:8px; height:8px; border-radius:999px; background:var(--df-accent); flex:none;"></span>
              {/if}
            </div>
            <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.55;">{n.body}</div>
            <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:5px;">{n.time}</div>
          </div>
        </button>
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
{/if}
