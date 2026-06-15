<script lang="ts">
  /* 訊息中心 訊息泡泡 — reconstructed from spec (views_messages.jsx cuts off at L102).
   * m.who='them' → left/white; 'me' → right/primary.
   * Handles plain text, file attachment (attach), and failed message (failed). */
  import Icon from '$lib/components/ui/Icon.svelte';
  import { type ThreadMsg } from '$lib/coach/data';

  export let m: ThreadMsg;

  $: isMe = m.who === 'me';
</script>

<div style="display:flex;flex-direction:column;align-items:{isMe ? 'flex-end' : 'flex-start'};gap:2px">
  {#if m.failed}
    <!-- failed message: error-tinted bubble -->
    <div style="max-width:72%;background:var(--df-error-bg);border:1px solid var(--df-error);border-radius:{isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'};padding:10px 14px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:34px;height:34px;border-radius:8px;background:var(--df-error);display:flex;align-items:center;justify-content:center;flex:none">
          <Icon name="file" size={16} color="#fff" />
        </div>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--df-error);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{m.failed.name}</div>
          <div style="font-size:11px;color:var(--df-error);margin-top:2px">{m.failed.meta}</div>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--df-error);margin-top:6px;font-weight:500">未送出 · 點選重試</div>
    </div>
  {:else if m.attach}
    <!-- attachment bubble -->
    <div style="max-width:72%;background:{isMe ? 'var(--df-primary)' : '#fff'};border:{isMe ? 'none' : '1px solid var(--df-border)'};border-radius:{isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'};padding:10px 14px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:34px;height:34px;border-radius:8px;background:{isMe ? 'rgba(255,255,255,0.2)' : 'var(--df-primary-bg)'};display:flex;align-items:center;justify-content:center;flex:none">
          <Icon name={m.attach.kind === 'video' ? 'circle-play' : 'file'} size={16} color={isMe ? '#fff' : 'var(--df-primary)'} />
        </div>
        <div style="min-width:0">
          <div style="font-size:13px;font-weight:600;color:{isMe ? '#fff' : 'var(--df-text-dark)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{m.attach.name}</div>
          <div style="font-size:11px;color:{isMe ? 'rgba(255,255,255,0.75)' : 'var(--df-text-muted)'};margin-top:2px">{m.attach.meta}</div>
        </div>
      </div>
    </div>
  {:else}
    <!-- plain text bubble -->
    <div style="max-width:72%;background:{isMe ? 'var(--df-primary)' : '#fff'};border:{isMe ? 'none' : '1px solid var(--df-border)'};border-radius:{isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'};padding:10px 14px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
      <div style="font-size:14px;line-height:1.5;color:{isMe ? '#fff' : 'var(--df-text-dark)'}">{m.text}</div>
    </div>
  {/if}
  <div style="font-size:11px;color:var(--df-text-muted);padding:0 4px">{m.time}</div>
</div>
