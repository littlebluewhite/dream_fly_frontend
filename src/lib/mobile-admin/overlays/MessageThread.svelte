<script lang="ts">
  /* 訊息對話 push screen。port coach.jsx MessageThread (244-273)。
   *
   * Task 20：改讀真 GET /conversations/{id}/messages(getThread)、送出改真打
   * POST /conversations/{id}/messages(sendMessage)——取代舊版「送出為本地 echo，
   * 家長泡泡永遠是同一句 m.preview」的假聊天室(coach/api.ts，Task 12，
   * integration-contract.md §3.21)。m.id 即 conversation id(見 mobile-admin/api.ts
   * 的 getMessages() 映射，Conversation.id 穿透為 MessageRow.id)。已讀標記
   * (markRead)由列表頁點擊當下觸發(markMessageRead，stores.ts)，本畫面不重複呼叫。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import { ErrorState, Skeleton } from '$lib/components/ui';
  import { toasts } from '$lib/mobile-admin/stores';
  import { getThread, sendMessage, type ThreadMsg } from '$lib/mobile-admin/api';
  import type { MessageRow } from '$lib/mobile-admin/data';

  export let onBack: () => void;
  export let m: MessageRow | null = null;

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let messages: ThreadMsg[] = [];
  let reply = '';
  let sending = false;

  function load() {
    if (!m) { phase = 'error'; return; }
    const conversationId = m.id;
    phase = 'loading';
    getThread(conversationId)
      .then((d) => { messages = d.messages; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  async function send() {
    if (!m || !reply.trim() || sending) return;
    const body = reply.trim();
    sending = true;
    try {
      const msg = await sendMessage(m.id, body);
      messages = [...messages, msg];
      reply = '';
    } catch {
      toasts.notify('error', '傳送失敗', '連線發生問題，請稍後再試。');
    } finally {
      sending = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') send();
  }
</script>

<PushScreen>
  <ScreenHeader title={m ? m.from : '訊息'} sub="訊息紀錄" {onBack}>
    <HeaderIcon slot="right" icon="phone" label="撥打" onClick={() => m && toasts.notify('info', '聯絡對方', '撥打電話給 ' + m.from + '。')} />
  </ScreenHeader>

  {#if phase === 'ready'}
    <div class="df-scroll" style="background:var(--df-bg-light);">
      <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
        {#each messages as msg, i (i)}
          {#if msg.who === 'them'}
            <div style="display:flex; gap:9px; align-items:flex-end;">
              <Avatar name={m ? m.initial : '?'} size="sm" color={m ? m.color : 'var(--df-primary)'} />
              <div style="max-width:76%; background:#fff; border:1px solid var(--df-border); border-radius:4px 16px 16px 16px; padding:12px 14px; font-size:14px; color:var(--df-text-dark); line-height:1.55;">{msg.text}</div>
            </div>
          {:else}
            <div style="display:flex; justify-content:flex-end;">
              <div style="max-width:76%; background:var(--df-primary); color:#fff; border-radius:16px 4px 16px 16px; padding:12px 14px; font-size:14px; line-height:1.55;">{msg.text}</div>
            </div>
          {/if}
        {/each}
        {#if messages.length === 0}
          <div style="text-align:center; font-size:12.5px; color:var(--df-text-muted); padding:24px 0;">尚無訊息，開始對話吧。</div>
        {/if}
      </div>
    </div>

    <!-- reply bar -->
    <div style="flex:none; display:flex; gap:9px; padding:12px 14px calc(12px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid var(--df-border); align-items:center;">
      <input
        bind:value={reply}
        on:keydown={onKey}
        placeholder="輸入回覆…"
        style="flex:1; height:44px; padding:0 15px; border:1.5px solid var(--df-border-strong); border-radius:999px; font-size:14px; font-family:var(--df-font-body); outline:none; color:var(--df-text-dark);"
      />
      <button
        on:click={send}
        disabled={sending || !reply.trim()}
        aria-label="送出"
        class="df-tapscale"
        style="width:44px; height:44px; border-radius:999px; border:none; background:var(--df-primary); display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
      ><Icon name="send" size={19} color="#fff" /></button>
    </div>
  {:else if phase === 'error'}
    <ErrorState onRetry={load} />
  {:else}
    <div class="df-scroll" style="padding:16px; display:flex; flex-direction:column; gap:12px;" data-testid="thread-skeleton">
      <Skeleton w="60%" h={44} r={16} />
      <Skeleton w="55%" h={44} r={16} />
    </div>
  {/if}
</PushScreen>
