<script lang="ts">
  /* 教練 · 訊息。port coach.jsx CoachMessagesScreen (213-242)。
   * 點訊息 → overlay.push('messageThread',{m})；onBell → openCoachNotif()。
   *
   * 資料經 messagesPageEntry(訊息閘門的頁面進場包,R14 F1)非同步水合共享 messages store,三態
   * 閘門(loading/error/ready);閘門的 guard 防止第二次進頁的 fetch 覆寫
   * markMessageRead 的已讀狀態,ErrorState 重試走 load-gate 的 refresh(不受守衛短路)。
   * unmount 後解析的 in-flight fetch 由 createLoadGate($lib/load-gate)內建的
   * generation/destroy 機制擋下,不再需要頁面自帶的 alive 旗標。
   *
   * R14(候選 F5)：openThread 不再樂觀清未讀——本頁只做 push,改由 MessageThread.svelte
   * 開啟對話串後立即呼叫 markMessageRead(id, badgeCleared)——訊息閘門的 write() 等 ack 為 true 才翻已讀,
   * 跟桌面一樣「等後端確認已讀才清角標」(使用者裁決;R17 起 ack 交進 store,不在呼叫端等)。 */
  import { onMount } from 'svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, openCoachNotif, coachUnreadCount, messages, messagesPageEntry } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import type { MessageRow } from '$lib/mobile-admin/data';

  let q = '';

  const gate = createLoadGate({ ...messagesPageEntry });
  onMount(() => {
    gate.load();
  });

  // R14(候選 F5)：不再樂觀清未讀——真正的已讀是 MessageThread.svelte 開啟對話串後
  // 立即呼叫 markMessageRead(id, badgeCleared)(write() 等 ack 才翻已讀)，本頁只負責 push。
  const openThread = (m: MessageRow) => { overlay.push('messageThread', { m }); };

  $: list = q ? $messages.filter((m) => (m.from + m.preview).toLowerCase().includes(q.toLowerCase())) : $messages;
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="messages-skeleton" style="padding:14px; display:flex; flex-direction:column; gap:10px;" slot="loading">
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

  <ScreenHeader title="訊息" sub="家長與館務溝通">
    <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={openCoachNotif} />
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
</LoadGate>
