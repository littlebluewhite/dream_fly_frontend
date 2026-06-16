<script lang="ts">
  /* 課程介紹 sheet。mobile/home.jsx CourseDetailSheet (201-242)。
   * 加入購物車 → cart.add + toast，然後 onClose。候補（spots 0）走加入候補名單文案。 */
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import NoteBox from '$lib/mobile/components/NoteBox.svelte';
  import LevelBadge from '$lib/mobile/components/LevelBadge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { cart, toasts, type CartInput } from '$lib/mobile/stores';
  import { fmtNT, type Course } from '$lib/mobile/data';

  export let onClose: () => void;
  export let course: Course | null = null;

  $: c = course;
  $: full = !!c && c.spots === 0;
  $: rows = c
    ? ([
        ['clock', '上課時段', c.days],
        ['user-round', '授課教練', c.coach + ' 教練'],
        ['cake', '適合年齡', c.age],
        ['layers', '課程類別', c.cat],
        ['bar-chart-3', '程度', c.level]
      ] as [string, string, string][])
    : [];

  function add() {
    if (!c) return;
    cart.add(c as CartInput);
    toasts.notify('success', full ? '已加入候補名單' : '已加入購物車', c.name);
    onClose();
  }
</script>

{#if c}
  <Sheet open {onClose} maxHeight="92%">
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:66px; height:66px; border-radius:18px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none;">
          <Icon name={c.icon} size={34} color="var(--df-primary)" />
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:7px; margin-bottom:5px;">
            <LevelBadge level={c.level} />
            {#if c.hot}<Badge tone="accent" solid>熱門</Badge>{/if}
          </div>
          <h2 style="margin:0; font-family:var(--df-font-heading); font-size:21px; font-weight:800; color:var(--df-ink);">{c.name}</h2>
        </div>
      </div>
      <p style="margin:0; font-size:14px; line-height:1.7; color:var(--df-text-dark);">{c.desc}</p>
      <div style="background:var(--df-bg-light); border-radius:14px; padding:6px 14px;">
        {#each rows as [ic, k, v], i}
          <div style="display:flex; align-items:center; gap:11px; padding:11px 0; {i ? 'border-top:1px solid var(--df-border);' : ''}">
            <Icon name={ic} size={17} color="var(--df-primary)" />
            <span style="font-size:13px; color:var(--df-text-light); width:76px; flex:none;">{k}</span>
            <span style="font-size:14px; font-weight:600; color:var(--df-text-dark); text-align:right; flex:1;">{v}</span>
          </div>
        {/each}
      </div>
      <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:{full ? 'var(--df-error)' : c.spots <= 2 ? 'var(--df-warning)' : 'var(--df-success)'};">
        <Icon name={full ? 'user-x' : 'user-check'} size={16} />
        {full ? '本期已額滿，加入候補後有名額將立即通知你。' : '本期尚餘 ' + c.spots + ' 個名額，建議盡早報名。'}
      </div>
      <NoteBox icon="shield-check" tone="var(--df-success)">小班制 6–8 人 · 雙教練保護，<b style="color:var(--df-text-dark);">首堂可預約 15 分鐘評估 + 60 分鐘免費體驗</b>。</NoteBox>
    </div>
    <svelte:fragment slot="footer">
      <div style="flex:none; display:flex; flex-direction:column; justify-content:center;">
        <span style="font-size:11px; color:var(--df-text-muted);">季費</span>
        <span style="font-size:19px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{fmtNT(c.price)}</span>
      </div>
      <Button variant={full ? 'secondary' : 'primary'} on:click={add} style="flex:1; display:flex; align-items:center; justify-content:center; gap:7px;">
        <Icon name={full ? 'bell-plus' : 'shopping-cart'} size={17} />{full ? '加入候補名單' : '加入購物車'}
      </Button>
    </svelte:fragment>
  </Sheet>
{/if}
