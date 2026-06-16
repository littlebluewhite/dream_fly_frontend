<script lang="ts">
  /* 課程卡（首頁熱門課程 + 課程介紹共用）。home.jsx CourseCard (17-48)。
   * onOpen → overlay.sheet('course',{course})；onAdd → cart.add + toast，由呼叫端傳入。
   * spots===0 → 已額滿 / 候補。 */
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import LevelBadge from './LevelBadge.svelte';
  import { fmtNT, type Course } from '$lib/mobile/data';

  export let c: Course;
  export let onOpen: () => void;
  export let onAdd: () => void;

  $: full = c.spots === 0;
</script>

<Card padding={0} style="overflow:hidden;">
  <button
    on:click={onOpen}
    class="df-tapscale"
    style="display:flex; align-items:center; gap:13px; padding:13px 14px; width:100%; border:none;
      background:transparent; cursor:pointer; text-align:left;"
  >
    <div
      style="width:52px; height:52px; border-radius:13px; background:var(--df-primary-bg); display:flex;
        align-items:center; justify-content:center; flex:none;"
    >
      <Icon name={c.icon} size={27} color="var(--df-primary)" />
    </div>
    <div style="flex:1; min-width:0;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
        <span
          style="font-size:15px; font-weight:700; color:var(--df-ink); white-space:nowrap; overflow:hidden;
            text-overflow:ellipsis;"
        >{c.name}</span>
        {#if c.hot}<Badge tone="accent" solid>熱門</Badge>{/if}
      </div>
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px;">
        <LevelBadge level={c.level} /><span style="font-size:12px; color:var(--df-text-light);">{c.age}</span>
      </div>
      <div style="font-size:12.5px; color:var(--df-text-light); display:flex; align-items:center; gap:5px;">
        <Icon name="clock" size={13} color="var(--df-text-muted)" />{c.days}
      </div>
    </div>
    <div style="text-align:right; flex:none;">
      <div style="font-size:15px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-heading);">{fmtNT(c.price)}</div>
      <div style="font-size:11px; color:var(--df-text-muted);">/ 季</div>
    </div>
  </button>
  <div
    style="display:flex; align-items:center; justify-content:space-between; padding:9px 14px;
      border-top:1px solid var(--df-border); background:var(--df-bg-light);"
  >
    <span
      style="font-size:12px; font-weight:600; color:{full
        ? 'var(--df-error)'
        : c.spots <= 2
          ? 'var(--df-warning)'
          : 'var(--df-text-light)'}; display:flex; align-items:center; gap:5px;"
    >
      <Icon name={full ? 'user-x' : 'users'} size={14} />{full ? '已額滿 · 可候補' : '尚餘 ' + c.spots + ' 個名額'}
    </span>
    <button
      on:click={onAdd}
      class="df-tapscale"
      style="display:flex; align-items:center; gap:5px; height:32px; padding:0 14px; border-radius:9px;
        border:none; background:{full ? 'var(--df-ink)' : 'var(--df-primary)'}; color:#fff; font-size:13px;
        font-weight:700; cursor:pointer;"
    >
      <Icon name={full ? 'bell-plus' : 'plus'} size={15} color="#fff" />{full ? '候補' : '加入'}
    </button>
  </div>
</Card>
