<script lang="ts">
  /* 訊息對話 push screen。port coach.jsx MessageThread (244-273)。
   * notify → toasts.notify；送出為本地 echo（家長泡泡來自 m.preview）。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile-admin/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile-admin/components/HeaderIcon.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import type { MessageRow } from '$lib/mobile-admin/data';

  export let onBack: () => void;
  export let m: MessageRow | null = null;

  let reply = '';
  let sent: string[] = [];

  function send() {
    if (!m || !reply.trim()) return;
    sent = [...sent, reply.trim()];
    reply = '';
    toasts.notify('success', '已送出', '回覆已傳送給 ' + m.from + '。');
  }
</script>

<PushScreen>
  <ScreenHeader title={m ? m.from : '訊息'} sub="家長訊息" {onBack}>
    <HeaderIcon slot="right" icon="phone" label="撥打" onClick={() => m && toasts.notify('info', '聯絡家長', '撥打電話給 ' + m.from + '。')} />
  </ScreenHeader>

  <div class="df-scroll" style="background:var(--df-bg-light);">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      <div style="text-align:center; font-size:11.5px; color:var(--df-text-muted);">{m ? m.time : ''}</div>
      {#if m}
        <div style="display:flex; gap:9px; align-items:flex-end;">
          <Avatar name={m.initial} size="sm" color={m.color} />
          <div style="max-width:76%; background:#fff; border:1px solid var(--df-border); border-radius:4px 16px 16px 16px; padding:12px 14px; font-size:14px; color:var(--df-text-dark); line-height:1.55;">{m.preview}</div>
        </div>
      {/if}
      {#each sent as s, i (i)}
        <div style="display:flex; justify-content:flex-end;">
          <div style="max-width:76%; background:var(--df-primary); color:#fff; border-radius:16px 4px 16px 16px; padding:12px 14px; font-size:14px; line-height:1.55;">{s}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- reply bar -->
  <div style="flex:none; display:flex; gap:9px; padding:12px 14px calc(12px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid var(--df-border); align-items:center;">
    <input
      bind:value={reply}
      on:keydown={(e) => { if (e.key === 'Enter') send(); }}
      placeholder="輸入回覆…"
      style="flex:1; height:44px; padding:0 15px; border:1.5px solid var(--df-border-strong); border-radius:999px; font-size:14px; font-family:var(--df-font-body); outline:none; color:var(--df-text-dark);"
    />
    <button
      on:click={send}
      aria-label="送出"
      class="df-tapscale"
      style="width:44px; height:44px; border-radius:999px; border:none; background:var(--df-primary); display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
    ><Icon name="send" size={19} color="#fff" /></button>
  </div>
</PushScreen>
