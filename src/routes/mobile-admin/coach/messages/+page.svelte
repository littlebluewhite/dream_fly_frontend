<script lang="ts">
  /* 教練 · 訊息。port coach.jsx CoachMessagesScreen (213-242)。
   * 點訊息 → overlay.push('messageThread',{m})；onBell → overlay.sheet('notif')。
   *
   * 資料改由 getMessages()(mock-API 接縫)非同步水合共享 messages store(mobile
   * notifications 範本同款):alive 旗標防 unmount 後 resolve 覆寫、messagesHydrated
   * 守衛防重訪重抓、refresh() 一律重新 fetch 供 ErrorState 重試共用(不會被
   * load() 的守衛短路)。markMessageRead 既有 mutation 不動。 */
  import { onMount, onDestroy } from 'svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import { overlay, coachNotifs, coachUnreadCount, closeNotifAfterReadAll, messages, markMessageRead, hydrateMessages, refreshMessages } from '$lib/mobile-admin/stores';
  import type { MessageRow } from '$lib/mobile-admin/data';

  let alive = true;
  onDestroy(() => { alive = false; });

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let q = '';

  function load() {
    phase = 'loading';
    hydrateMessages()
      .then(() => { if (alive) phase = 'ready'; })
      .catch(() => { if (alive) phase = 'error'; });
  }
  onMount(load);
  function refresh() {
    phase = 'loading';
    refreshMessages()
      .then(() => { if (alive) phase = 'ready'; })
      .catch(() => { if (alive) phase = 'error'; });
  }

  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const openThread = (m: MessageRow) => { markMessageRead(m.id); overlay.push('messageThread', { m }); };

  $: list = q ? $messages.filter((m) => (m.from + m.preview).toLowerCase().includes(q.toLowerCase())) : $messages;
</script>

{#if phase === 'ready'}
<ScreenHeader title="訊息" sub="家長與館務溝通">
  <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={onBell} />
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
  <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋家長、訊息內容…" />
</div>

<div class="df-scroll df-view">
  <div style="padding:10px 0;">
    {#if list.length === 0}
      <MEmpty icon="search-x" title="沒有符合的訊息" />
    {:else}
      {#each list as m (m.id)}
        <button
          on:click={() => openThread(m)}
          class="df-tapscale"
          style="display:flex; gap:12px; padding:13px 16px; width:100%; border:none; border-bottom:1px solid var(--df-border); background:{m.unread ? 'var(--df-primary-bg)' : '#fff'}; cursor:pointer; text-align:left;"
        >
          <Avatar name={m.initial} size="md" color={m.color} />
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
              <span style="font-size:14px; font-weight:700; color:var(--df-text-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{m.from}</span>
              <span style="font-size:11px; color:var(--df-text-muted); flex:none;">{m.time}</span>
            </div>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-top:3px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">{m.preview}</div>
          </div>
          {#if m.unread}
            <span style="width:9px; height:9px; border-radius:999px; background:var(--df-primary); flex:none; margin-top:6px;"></span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={refresh} /></Card>
{:else}
  <div class="df-scroll df-view" data-testid="messages-skeleton" style="padding:14px; display:flex; flex-direction:column; gap:10px;">
    <Skeleton w="100%" h={42} r={11} />
    <SkelCard padding={0}>
      {#each [0, 1, 2, 3] as i (i)}
        <div style="display:flex; gap:12px; padding:13px 16px; border-bottom:{i < 3 ? '1px solid var(--df-border)' : 'none'}">
          <Skeleton w={40} h={40} r={999} />
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            <Skeleton w="40%" h={13} />
            <Skeleton w="80%" h={11} />
          </div>
        </div>
      {/each}
    </SkelCard>
  </div>
{/if}
