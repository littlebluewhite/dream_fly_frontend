<script lang="ts">
  /* 訊息中心 對話列 — extracted from views_messages.jsx:58-80.
   * Renders one conversation row in the left panel list.
   * Dispatches "select" when clicked. */
  import { createEventDispatcher } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { type Conversation, type SlaTone } from '$lib/coach/data';

  export let c: Conversation;
  export let active: boolean = false;

  const dispatch = createEventDispatcher<{ select: string }>();

  const SLA_TONE: Record<SlaTone, { fg: string; icon: string }> = {
    warning: { fg: 'var(--df-warning)', icon: 'clock' },
    error: { fg: 'var(--df-error)', icon: 'triangle-alert' },
    success: { fg: 'var(--df-success-strong)', icon: 'check' },
    muted: { fg: 'var(--df-text-muted)', icon: 'clock' },
  };

  $: sla = SLA_TONE[c.slaTone] || SLA_TONE.muted;
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<button
  on:click={() => dispatch('select', c.id)}
  style="display:flex;gap:11px;padding:13px 16px;width:100%;text-align:left;border:none;border-bottom:1px solid var(--df-border);border-left:{active ? '3px solid var(--df-primary)' : '3px solid transparent'};background:{active ? 'var(--df-primary-bg)' : '#fff'};cursor:pointer;font-family:var(--df-font-body)"
>
  <!-- avatar + badge -->
  <div style="position:relative;flex:none">
    <span style="width:40px;height:40px;border-radius:50%;background:{c.color};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center">{c.initial}</span>
    {#if c.badge}
      <span style="position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;border-radius:999px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff">{c.badge}</span>
    {/if}
  </div>

  <!-- text body -->
  <div style="flex:1;min-width:0">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:13.5px;font-weight:700;color:var(--df-text-dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">{c.name}</span>
      <span style="font-size:10px;font-weight:600;color:var(--df-text-muted);background:var(--df-bg-light);border-radius:4px;padding:1px 6px;flex:none">{c.kind}</span>
      <span style="font-size:11px;color:var(--df-text-muted);flex:none">{c.time}</span>
    </div>
    <div style="font-size:12.5px;color:var(--df-text-light);margin-top:4px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{c.preview}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
      {#if c.urgent}
        <span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;color:var(--df-error);background:var(--df-error-bg);border-radius:4px;padding:1px 6px">
          <Icon name="flame" size={11} color="var(--df-error)" />緊急
        </span>
      {/if}
      <span style="display:inline-flex;align-items:center;gap:3px;font-size:10.5px;color:{sla.fg}">
        <Icon name={sla.icon} size={11} color={sla.fg} />{c.sla}
      </span>
    </div>
  </div>
</button>
