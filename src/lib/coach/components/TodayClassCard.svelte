<script lang="ts">
  /* 今日課程卡片 — faithful port of views_dashboard.jsx:233-262.
   * Inline-style: colours/px from source exactly. Legacy Svelte, no runes. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import { goto } from '$app/navigation';
  import { toasts } from '$lib/coach/stores';
  import { CLASS_STATUS, type TodayClass } from '$lib/coach/data';

  export let c: TodayClass;

  $: st = CLASS_STATUS[c.status];
  $: acted = c.status === 'done';

  const btnPrimary = 'display:inline-flex;align-items:center;gap:6px;background:var(--df-primary);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--df-font-body)';
  const btnGhost   = 'display:inline-flex;align-items:center;gap:6px;background:#fff;color:var(--df-text-light);border:1px solid var(--df-border);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--df-font-body)';
</script>

<div style="background:var(--df-bg-light);border-radius:10px;padding:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
  <!-- blue time block -->
  <div style="background:var(--df-primary);border-radius:8px;padding:8px 14px;display:flex;flex-direction:column;align-items:center;flex:none">
    <span style="font-size:15px;font-weight:800;color:#fff;font-family:var(--df-font-mono)">{c.start}</span>
    <span style="font-size:11px;color:rgba(255,255,255,0.8);font-family:var(--df-font-mono)">{c.end}</span>
  </div>

  <!-- name + meta -->
  <div style="flex:1 1 180px;min-width:160px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:15px;font-weight:700;color:var(--df-text-dark)">{c.name}</span>
      <span style="background:{st.bg};color:{st.fg};font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">{st.label}</span>
    </div>
    <div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light)">
        <Icon name="map-pin" size={12} color="var(--df-text-light)" />{c.room}
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light)">
        <Icon name="users" size={12} color="var(--df-text-light)" />{c.count} 位
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light)">
        <Icon name="signal" size={12} color="var(--df-text-light)" />{c.level}
      </span>
    </div>
  </div>

  <!-- action buttons -->
  <div style="display:flex;gap:8px;flex:none">
    {#if acted}
      <button style={btnGhost} on:click={() => goto('/coach/attendance')}>查看記錄</button>
    {:else}
      <button style={btnPrimary} on:click={() => goto('/coach/attendance')}>點名</button>
    {/if}
    <button style={btnGhost} on:click={() => toasts.notify('info', c.name, '顯示班級學員名單（示範）。')}>查看名單</button>
    <button aria-label="傳訊息" style="{btnGhost};padding:8px 10px" on:click={() => goto('/coach/messages')}>
      <Icon name="message-circle" size={15} color="var(--df-text-light)" />
    </button>
  </div>
</div>
