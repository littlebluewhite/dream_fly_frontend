<script lang="ts">
  /* 通知中心 sheet（完整 port）。ui.jsx NotifSheet (268-290)。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Sheet from '$lib/mobile-admin/components/Sheet.svelte';
  import type { AdminNotif } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let notifs: AdminNotif[] = [];
  export let onReadAll: (() => void) | undefined = undefined;

  $: unread = notifs.filter((n) => n.unread).length;
</script>

<Sheet open {onClose} maxHeight="80%" footer={unread > 0} title="通知中心" sub={unread > 0 ? unread + ' 則未讀' : '全部已讀'}>
  <div style="display:flex; flex-direction:column; gap:9px;">
    {#each notifs as n, i (i)}
      <div
        style="display:flex; gap:12px; padding:13px; border-radius:13px;
          background:{n.unread ? 'var(--df-primary-bg)' : 'var(--df-bg-light)'};"
      >
        <div
          style="width:38px; height:38px; border-radius:10px; background:{n.bg};
            display:flex; align-items:center; justify-content:center; flex:none;"
        >
          <Icon name={n.icon} size={18} color={n.tone} />
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span
              style="font-size:14px; font-weight:700; color:var(--df-text-dark); flex:1; min-width:0;
                overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
            >{n.title}</span>
            {#if n.unread}
              <span style="width:8px; height:8px; border-radius:999px; background:var(--df-primary); flex:none;"></span>
            {/if}
          </div>
          <div style="font-size:12.5px; color:var(--df-text-light); margin-top:3px; line-height:1.45;">{n.body}</div>
          <div style="font-size:11px; color:var(--df-text-muted); margin-top:4px;">{n.time}</div>
        </div>
      </div>
    {/each}
  </div>

  <svelte:fragment slot="footer">
    <button
      on:click={onReadAll}
      style="width:100%; height:46px; border:none; border-radius:11px; background:var(--df-bg-light);
        color:var(--df-primary); font-size:14.5px; font-weight:700; cursor:pointer; font-family:var(--df-font-body);"
    >全部標為已讀</button>
  </svelte:fragment>
</Sheet>
