<script lang="ts">
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let tabs: { id: string; label: string; icon: IconName }[];
  export let hrefFor: (id: string) => string;
  export let isActive: (href: string, path: string) => boolean;
  export let badges: Record<string, number> = {};

  $: path = $page.url.pathname;
</script>

<div
  class="m-bottom-inset"
  style="flex:none; display:flex; border-top:1px solid var(--df-border);
    background:rgba(255,255,255,0.94); backdrop-filter:blur(12px); padding-top:9px; padding-left:6px; padding-right:6px; z-index:40;"
>
  {#each tabs as t (t.id)}
    {@const href = hrefFor(t.id)}
    {@const active = isActive(href, path)}
    {@const b = badges[t.id]}
    <a
      {href}
      class="df-tapscale"
      style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
        text-decoration:none; cursor:pointer; color:{active ? 'var(--df-primary)' : 'var(--df-text-muted)'};
        padding:2px 0; position:relative;"
    >
      <div style="position:relative;">
        <Icon name={t.icon} size={23} />
        {#if b > 0}
          <span
            style="position:absolute; top:-4px; right:-7px; min-width:16px; height:16px; padding:0 4px;
              border-radius:999px; background:var(--df-accent); color:var(--df-ink); font-size:10px;
              font-weight:800; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff;"
          >{b}</span>
        {/if}
      </div>
      <span style="font-size:10.5px; font-weight:{active ? 700 : 500};">{t.label}</span>
    </a>
  {/each}
</div>
