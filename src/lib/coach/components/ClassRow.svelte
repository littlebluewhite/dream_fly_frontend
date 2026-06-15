<script lang="ts">
  /* 教練端 dashboard class row (views_dashboard.jsx:120-138). ACTION-FREE: blue
   * time block (start + level) + name + room/count meta + status badge; the
   * whole row is clickable via the optional `onClick` (dashboard → /coach/today).
   * The today view uses a SEPARATE TodayClassCard with action buttons — do not
   * confuse the two. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import { CLASS_STATUS, type TodayClass } from '$lib/coach/data';

  export let c: TodayClass;
  export let onClick: (() => void) | null = null;

  $: st = CLASS_STATUS[c.status];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="df-rowhover"
  on:click={() => onClick?.()}
  style="display:flex;align-items:center;gap:14px;background:var(--df-bg-light);border-radius:8px;padding:14px;cursor:{onClick
    ? 'pointer'
    : 'default'}"
>
  <div
    style="background:var(--df-primary);border-radius:8px;padding:8px 12px;display:flex;flex-direction:column;align-items:center;flex:none"
  >
    <span style="font-size:16px;font-weight:800;color:#fff;font-family:var(--df-font-mono)">{c.start}</span>
    <span style="font-size:11px;color:rgba(255,255,255,0.8)">{c.level}</span>
  </div>
  <div style="flex:1;min-width:0">
    <div style="font-size:15px;font-weight:600;color:var(--df-text-dark)">{c.name}</div>
    <div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light)">
        <Icon name="map-pin" size={13} color="var(--df-text-light)" />{c.room}
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light)">
        <Icon name="users" size={13} color="var(--df-text-light)" />{c.count} 人
      </span>
    </div>
  </div>
  <span
    style="background:{st.bg};color:{st.fg};font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;flex:none"
  >
    {st.label}
  </span>
</div>
