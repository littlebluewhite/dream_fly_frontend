<script lang="ts">
  /* 底部 tab bar。ui.jsx TabBar (71-88)。
   * React 的 tab/setTab 在路由化後改為 <a href={mobilePath(id)}>，active 由 $page 推導。
   * notifications tab badge = 未讀通知數（unread store）。 */
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { TABS, mobilePath, isActive } from '$lib/mobile/nav';
  import { unread } from '$lib/mobile/stores';

  $: path = $page.url.pathname;
</script>

<div
  class="m-bottom-inset"
  style="flex:none; display:flex; border-top:1px solid var(--df-border);
    background:rgba(255,255,255,0.94); backdrop-filter:blur(12px); padding-top:9px; padding-left:6px; padding-right:6px; z-index:40;"
>
  {#each TABS as t (t.id)}
    {@const href = mobilePath(t.id)}
    {@const active = isActive(href, path)}
    <a
      {href}
      class="df-tapscale"
      style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
        text-decoration:none; cursor:pointer; color:{active ? 'var(--df-primary)' : 'var(--df-text-muted)'};
        padding:2px 0; position:relative;"
    >
      <div style="position:relative;">
        <Icon name={t.icon} size={23} />
        {#if t.id === 'notifications' && $unread > 0}
          <span
            style="position:absolute; top:-4px; right:-7px; min-width:16px; height:16px; padding:0 4px;
              border-radius:999px; background:var(--df-accent); color:var(--df-ink); font-size:10px;
              font-weight:800; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff;"
          >{$unread}</span>
        {/if}
      </div>
      <span style="font-size:10.5px; font-weight:{active ? 700 : 500};">{t.label}</span>
    </a>
  {/each}
</div>
