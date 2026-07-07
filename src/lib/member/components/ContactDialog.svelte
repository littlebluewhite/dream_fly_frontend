<script lang="ts">
  /* 聯絡教練 / 訊息 (Contact coach) — a live chat thread with the course's
   * coach. Sending a message echoes it, shows a typing indicator, then appends
   * a canned coach reply. Its own chat-layout modal (not FormModal). Ported from
   * the prototype's ContactDialog (client/components.jsx). */
  import { tick } from 'svelte';
  import { Avatar, IconButton, Icon } from '$lib/components/ui';
  import { CONTACT_THREAD, COACH_REPLIES, type EnrolledCourse, type ChatMessage } from '$lib/member/data';

  export let open = false;
  export let course: EnrolledCourse | null = null;
  export let onClose: () => void = () => {};

  let thread: ChatMessage[] = [...CONTACT_THREAD];
  let text = '';
  let typing = false;
  let bodyEl: HTMLDivElement | null = null;

  // Reset the thread each time the dialog transitions to open. Check-and-update
  // must live in ONE reactive statement (mirrors CouponCreateDialog's lastOpen
  // idiom) — splitting the write into its own trailing `$:` statement (as this
  // used to) is unreliable: Svelte topologically orders reactive statements by
  // dependency, so the writer runs BEFORE this reader in the same flush, making
  // the transition undetectable (FE#19 — an unsent draft or sent message could
  // survive a close → reopen on the same mounted instance).
  let lastOpen = false;
  $: {
    if (open && !lastOpen) {
      thread = [...CONTACT_THREAD];
      text = '';
      typing = false;
    }
    lastOpen = open;
  }

  // Auto-scroll to the latest message whenever the thread or typing state changes.
  $: scrollToBottom(thread, typing);
  async function scrollToBottom(..._deps: unknown[]) {
    await tick();
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') onClose();
  }

  function send() {
    const t = text.trim();
    if (!t) return;
    thread = [...thread, { from: 'me', text: t, time: '剛剛' }];
    text = '';
    typing = true;
    setTimeout(() => {
      typing = false;
      const reply = COACH_REPLIES[Math.floor(Math.random() * COACH_REPLIES.length)];
      thread = [...thread, { from: 'coach', text: reply, time: '剛剛' }];
    }, 1400);
  }
</script>

<svelte:window on:keydown={onKey} />

{#if open && course}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" on:click={onClose}>
    <div class="panel" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation>
      <div class="head">
        <Avatar name={course.coach} size="md" color={course.color} status="online" />
        <div class="head-meta">
          <div class="coach-name">{course.coach} 教練</div>
          <div class="online"><span class="dot"></span>線上 · {course.name}</div>
        </div>
        <IconButton aria-label="關閉" variant="ghost" on:click={onClose}>
          <Icon name="x" size={20} />
        </IconButton>
      </div>

      <div class="body" bind:this={bodyEl}>
        {#each thread as m, i (i)}
          {@const mine = m.from === 'me'}
          <div class="msg-row" style="align-items:{mine ? 'flex-end' : 'flex-start'}">
            <div class="bubble" class:mine>{m.text}</div>
            <span class="time">{m.time}</span>
          </div>
        {/each}
        {#if typing}
          <div class="typing">
            {#each [0, 1, 2] as i (i)}
              <span class="tdot" style="animation-delay:{i * 0.15}s"></span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="foot">
        <input
          class="composer"
          bind:value={text}
          on:keydown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="輸入訊息…"
        />
        <IconButton aria-label="傳送" variant="primary" on:click={send}>
          <Icon name="send" size={18} color="#fff" />
        </IconButton>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(2px);
    padding: 24px;
    font-family: var(--df-font-body);
  }
  .panel {
    width: 100%;
    max-width: 520px;
    height: 600px;
    max-height: 90vh;
    background: #fff;
    border-radius: 16px;
    box-shadow: var(--df-shadow-strong);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .head {
    padding: 16px 20px;
    border-bottom: 1px solid var(--df-border);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head-meta {
    flex: 1;
  }
  .coach-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
  }
  .online {
    font-size: 12.5px;
    color: var(--df-success);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .online .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--df-success);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--df-bg-light);
  }
  .msg-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .bubble {
    max-width: 78%;
    padding: 10px 14px;
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    font-size: 14px;
    line-height: 1.55;
    background: #fff;
    color: var(--df-text-dark);
    border: 1px solid var(--df-border);
  }
  .bubble.mine {
    background: var(--df-primary);
    color: #fff;
    border: none;
    border-bottom-right-radius: 4px;
    border-bottom-left-radius: 14px;
  }
  .time {
    font-size: 11px;
    color: var(--df-text-muted);
    padding: 0 4px;
  }
  .typing {
    align-self: flex-start;
    padding: 11px 16px;
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    background: #fff;
    border: 1px solid var(--df-border);
    display: flex;
    gap: 4px;
  }
  .tdot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--df-text-muted);
    animation: df-typing 1s ease infinite;
  }
  .foot {
    padding: 12px 16px;
    border-top: 1px solid var(--df-border);
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .composer {
    flex: 1;
    height: 44px;
    border: 1.5px solid var(--df-border-strong);
    border-radius: 999px;
    padding: 0 18px;
    font-size: 14px;
    font-family: var(--df-font-body);
    outline: none;
    color: var(--df-text-dark);
  }
  .composer:focus {
    border-color: var(--df-primary);
    box-shadow: var(--df-shadow-focus);
  }
</style>
