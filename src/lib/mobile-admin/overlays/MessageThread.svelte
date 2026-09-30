<script lang="ts">
  /* 訊息對話 push screen。port coach.jsx MessageThread (244-273)。
   *
   * R14(候選 F5，ADR-0014 §2)：改接桌面同一套 $lib/coach/messages-controller(仿 R10 B
   * 案 attendance-controller 前例,commit 718844b)——取代本檔原本自管的
   * getThread/sendMessage 本地狀態機。deps(getThread/sendMessage/markRead/
   * getStudents/createConversation)已與桌面逐字相同(皆直取 $lib/coach/api,
   * 含 createConversation),controller 不必為行動版加行為旗標。
   *
   * 已讀角標改成「等後端 markRead ack 才清」(使用者裁決 F5,跟桌面一樣)：onMount 呼叫
   * ctrl.selectThread(m.id)取回 threadReady/badgeCleared 兩條互不等待的 promise——
   * threadReady 決定畫面顯示/失敗 ErrorState,badgeCleared 為 true 才呼叫
   * markMessageRead(m.id)(stores.ts,現只做本地標記 + gate.markMutated(),不再自帶
   * fire-and-forget 網路呼叫)；badgeCleared 為 false(markRead 失敗)則不呼叫,角標維持
   * 未讀。送出改走 ctrl.send；sending 防連點與失敗 toast 留在本檔(adapter)。 */
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { authStore } from '$lib/stores/authStore';
  import { sessionIdentity } from '$lib/session-gate';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import { ErrorState, Skeleton } from '$lib/components/ui';
  import { toasts, markMessageRead } from '$lib/mobile-admin/stores';
  import { getThread, sendMessage, markRead, getStudents, createConversation } from '$lib/coach/api';
  import { createMessagesController } from '$lib/coach/messages-controller';
  import type { ThreadMsg } from '$lib/coach/data';
  import type { MessageRow } from '$lib/mobile-admin/data';

  export let onBack: () => void;
  export let m: MessageRow | null = null;

  const ctrl = createMessagesController({ getThread, sendMessage, markRead, getStudents, createConversation });

  let thread: ThreadMsg[] | null = null;
  $: ({ thread } = $ctrl);
  $: msgs = thread ?? [];

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let reply = '';
  let sending = false;

  /** 與 session-gate 同源(sessionIdentity)。 */
  function identity(): string | null {
    return sessionIdentity(get(authStore));
  }

  function load() {
    if (!m) { phase = 'error'; return; }
    const target = m;
    const identityAtLoad = identity(); // load() 開始時捕捉，ack 落地時核對是否仍是同一人
    phase = 'loading';
    const { threadReady, badgeCleared } = ctrl.selectThread(target.id);
    threadReady.then((outcome) => {
      phase = outcome.kind === 'threadLoadFailed' ? 'error' : 'ready';
    });
    badgeCleared.then((cleared) => {
      if (cleared && identity() === identityAtLoad) markMessageRead(target.id);
    });
  }
  onMount(load);

  async function send() {
    if (!m || !reply.trim() || sending) return;
    const text = reply.trim();
    sending = true;
    try {
      const outcome = await ctrl.send(text);
      if (outcome.kind === 'messageSent') {
        reply = '';
      } else {
        toasts.notify('error', '傳送失敗', '連線發生問題，請稍後再試。');
      }
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
        {#each msgs as msg, i (i)}
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
        {#if msgs.length === 0}
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
