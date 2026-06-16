<script lang="ts">
  /* 課程介紹 tab。home.jsx CoursesScreen (159-198)。
   * ScreenHeader（右側購物車）、搜尋框、類別 chip（本地 cat）、CATALOG 篩選清單、MEmpty fallback。
   * 課程卡 onOpen → overlay.sheet('course',{course})；onAdd → cart.add + toast。
   * Legacy Svelte（無 runes）、繁體中文文案、mock-only。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import ScreenHeader from '$lib/mobile/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile/components/HeaderIcon.svelte';
  import MEmpty from '$lib/mobile/components/MEmpty.svelte';
  import CourseCard from '$lib/mobile/components/CourseCard.svelte';
  import { CATALOG } from '$lib/mobile/data';
  import { overlay, cart, toasts } from '$lib/mobile/stores';

  /* category taxonomy — home.jsx CATS (6-13). */
  const CATS: { key: string; label: string; icon: string }[] = [
    { key: '幼兒體操', label: '幼兒', icon: 'baby' },
    { key: '兒童基礎', label: '兒童', icon: 'rotate-cw' },
    { key: '競技啦啦隊', label: '啦啦隊', icon: 'sparkles' },
    { key: '競技體操', label: '競技', icon: 'medal' },
    { key: '成人體操', label: '成人', icon: 'dumbbell' },
    { key: '跑酷', label: '跑酷', icon: 'flame' }
  ];
  const CHIPS = [{ key: 'all', label: '全部' }, ...CATS];

  let cat = 'all';
  let q = '';

  $: list = CATALOG.filter(
    (c) =>
      (cat === 'all' || c.cat === cat) &&
      (!q || (c.name + c.cat + c.coach).toLowerCase().includes(q.toLowerCase()))
  );

  function addToCart(c: (typeof CATALOG)[number]) {
    const r = cart.add(c);
    toasts.notify(
      r === 'waitlisted' ? 'info' : 'success',
      r === 'waitlisted' ? '已加入候補' : '已加入購物車',
      c.name
    );
  }
</script>

<ScreenHeader title="課程介紹" sub="先試一堂，再決定孩子的體操路線">
  <HeaderIcon slot="right" icon="shopping-cart" badge={$cart.reduce((s, c) => s + c.qty, 0)} label="購物車" onClick={() => overlay.sheet('cart')} />
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
  <div
    style="display:flex; align-items:center; gap:8px; background:var(--df-bg-light); border:1px solid var(--df-border);
      border-radius:11px; padding:0 13px; height:42px; margin-bottom:11px;"
  >
    <Icon name="search" size={17} color="var(--df-text-muted)" />
    <input
      bind:value={q}
      placeholder="搜尋課程、教練…"
      style="flex:1; border:none; background:transparent; outline:none; font-size:14px; color:var(--df-text-dark); font-family:var(--df-font-body); min-width:0;"
    />
    {#if q}
      <button on:click={() => (q = '')} style="border:none; background:none; cursor:pointer; padding:0; display:flex;">
        <Icon name="x" size={16} color="var(--df-text-muted)" />
      </button>
    {/if}
  </div>
  <div class="df-hide-scrollbar" style="display:flex; gap:8px; overflow-x:auto; margin:0 -14px; padding:0 14px 2px;">
    {#each CHIPS as cc (cc.key)}
      <button
        on:click={() => (cat = cc.key)}
        class="df-tapscale"
        style="flex:none; height:34px; padding:0 14px; border-radius:999px;
          border:1.5px solid {cat === cc.key ? 'var(--df-primary)' : 'var(--df-border)'};
          background:{cat === cc.key ? 'var(--df-primary)' : '#fff'};
          color:{cat === cc.key ? '#fff' : 'var(--df-text-dark)'}; font-size:13px;
          font-weight:{cat === cc.key ? 700 : 500}; cursor:pointer; white-space:nowrap;"
      >{cc.label}</button>
    {/each}
  </div>
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#if list.length === 0}
      <MEmpty icon="search-x" title="找不到符合的課程" body="換個關鍵字或類別試試看，或聯絡櫃台為你推薦適合的課程。" />
    {:else}
      <div style="font-size:12.5px; color:var(--df-text-light); padding:2px 2px;">共 {list.length} 門課程</div>
      {#each list as c (c.id)}
        <CourseCard {c} onOpen={() => overlay.sheet('course', { course: c })} onAdd={() => addToCart(c)} />
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
