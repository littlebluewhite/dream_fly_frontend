<script lang="ts">
  /* 訊息中心 訊息輸入列 — reconstructed from spec.
   * paperclip → toast (faux); text input (bind:value); send button → dispatch "send". */
  import { createEventDispatcher } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { toasts } from '$lib/coach/stores';

  export let value: string = '';

  const dispatch = createEventDispatcher<{ send: string }>();

  function handleSend() {
    if (!value.trim()) return;
    dispatch('send', value);
    value = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--df-border);background:#fff">
  <IconButton variant="ghost" size="md" aria-label="附加檔案" on:click={() => toasts.notify('info', '附加檔案', '（示範）')}>
    <Icon name="paperclip" size={18} color="var(--df-text-light)" />
  </IconButton>
  <input
    type="text"
    bind:value
    on:keydown={handleKeydown}
    placeholder="輸入訊息…"
    style="flex:1;border:1px solid var(--df-border);border-radius:8px;padding:9px 14px;font-size:14px;font-family:var(--df-font-body);color:var(--df-text-dark);background:var(--df-bg-light);outline:none;line-height:1.4"
  />
  <IconButton variant="primary" size="md" aria-label="傳送" on:click={handleSend}>
    <Icon name="send" size={18} color="#fff" />
  </IconButton>
</div>
