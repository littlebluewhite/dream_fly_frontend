<script lang="ts">
  /* 聯絡教練 chat sheet。mobile/mine.jsx ContactSheet (293-337)。
   * CONTACT_THREAD 對話泡泡 + 輸入框；送出 push 本地訊息，1.4s 後 push 一則
   * COACH_REPLIES 罐頭回覆（含 typing 動畫）。包進 Sheet（footer=輸入列）。 */
  import { tick } from 'svelte';
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { CONTACT_THREAD, COACH_REPLIES, type ThreadMsg, type MyCourse } from '$lib/mobile/data';

  export let onClose: () => void;
  export let course: MyCourse | null = null;

  let thread: ThreadMsg[] = [...CONTACT_THREAD];
  let text = '';
  let typing = false;
  let bodyEl: HTMLDivElement;

  async function scrollDown() {
    await tick();
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    thread = [...thread, { from: 'me', text: t, time: '剛剛' }];
    text = '';
    typing = true;
    scrollDown();
    setTimeout(() => {
      typing = false;
      thread = [...thread, { from: 'coach', text: COACH_REPLIES[Math.floor(Math.random() * COACH_REPLIES.length)], time: '剛剛' }];
      scrollDown();
    }, 1400);
  }
</script>

{#if course}
  <Sheet open {onClose} maxHeight="90%" height="90%" pad={0} title={course.coach + ' 教練'} sub={'線上 · ' + course.name}>
    <div bind:this={bodyEl} class="df-scroll" style="height:100%; padding:16px; display:flex; flex-direction:column; gap:11px; background:var(--df-bg-light);">
      {#each thread as m, i (i)}
        {@const mine = m.from === 'me'}
        <div style="display:flex; flex-direction:column; align-items:{mine ? 'flex-end' : 'flex-start'}; gap:3px;">
          <div style="max-width:80%; padding:10px 13px; border-radius:15px; font-size:14px; line-height:1.5; background:{mine ? 'var(--df-primary)' : '#fff'}; color:{mine ? '#fff' : 'var(--df-text-dark)'}; border:{mine ? 'none' : '1px solid var(--df-border)'}; border-bottom-right-radius:{mine ? '4px' : '15px'}; border-bottom-left-radius:{mine ? '15px' : '4px'};">{m.text}</div>
          <span style="font-size:10.5px; color:var(--df-text-muted); padding:0 4px;">{m.time}</span>
        </div>
      {/each}
      {#if typing}
        <div style="align-self:flex-start; padding:11px 15px; border-radius:15px; border-bottom-left-radius:4px; background:#fff; border:1px solid var(--df-border); display:flex; gap:4px;">
          {#each [0, 1, 2] as i}
            <span style="width:7px; height:7px; border-radius:50%; background:var(--df-text-muted); animation:df-typing 1s ease infinite; animation-delay:{i * 0.15}s;"></span>
          {/each}
        </div>
      {/if}
    </div>
    <svelte:fragment slot="footer">
      <input
        bind:value={text}
        on:keydown={(e) => { if (e.key === 'Enter') send(); }}
        placeholder="輸入訊息…"
        style="flex:1; height:42px; border:1.5px solid var(--df-border-strong); border-radius:999px; padding:0 16px; font-size:14px; font-family:var(--df-font-body); outline:none; color:var(--df-text-dark);"
      />
      <button
        aria-label="傳送"
        on:click={send}
        class="df-tapscale"
        style="width:42px; height:42px; border-radius:999px; border:none; background:var(--df-primary); display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
      >
        <Icon name="send" size={18} color="#fff" />
      </button>
    </svelte:fragment>
  </Sheet>
{/if}
