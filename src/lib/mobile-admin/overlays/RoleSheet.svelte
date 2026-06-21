<script lang="ts">
  /* 切換身分 sheet（完整 port）。ui.jsx RoleSheet (293-318)。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Sheet from '$lib/mobile-admin/components/Sheet.svelte';
  import NoteBox from '$lib/components/mobile/NoteBox.svelte';
  import { PROFILES } from '$lib/mobile-admin/data';
  import type { Role } from '$lib/mobile-admin/nav';

  export let onClose: () => void;
  export let role: Role;
  export let setRole: (r: Role) => void;

  const opts = [
    { id: 'admin' as Role, icon: 'shield-check', label: '管理後台', desc: PROFILES.admin.name + ' · ' + PROFILES.admin.role, tone: 'var(--df-primary)' },
    { id: 'coach' as Role, icon: 'graduation-cap', label: '教練工作台', desc: PROFILES.coach.name + ' · ' + PROFILES.coach.role, tone: 'var(--df-accent-dark)' }
  ];

  function pick(id: Role, on: boolean) {
    if (!on) setRole(id);
    onClose();
  }
</script>

<Sheet open {onClose} title="切換身分" sub="選擇要使用的後台角色">
  <div style="display:flex; flex-direction:column; gap:10px;">
    {#each opts as o (o.id)}
      {@const on = role === o.id}
      <button
        on:click={() => pick(o.id, on)}
        class="df-tapscale"
        style="display:flex; align-items:center; gap:13px; padding:14px; border-radius:14px;
          border:2px solid {on ? 'var(--df-primary)' : 'var(--df-border)'};
          background:{on ? 'var(--df-primary-bg)' : '#fff'}; cursor:pointer; text-align:left; width:100%;"
      >
        <div
          style="width:46px; height:46px; border-radius:12px;
            background:{on ? 'var(--df-primary)' : 'var(--df-bg-light)'};
            display:flex; align-items:center; justify-content:center; flex:none;"
        >
          <Icon name={o.icon} size={23} color={on ? '#fff' : o.tone} />
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{o.label}</div>
          <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{o.desc}</div>
        </div>
        {#if on}
          <Icon name="circle-check" size={22} color="var(--df-primary)" />
        {:else}
          <Icon name="circle" size={22} color="var(--df-border-strong)" />
        {/if}
      </button>
    {/each}
  </div>
  <div style="margin-top:14px;">
    <NoteBox icon="info">
      你目前擁有 <b style="color:var(--df-text-dark);">管理員</b> 與
      <b style="color:var(--df-text-dark);">教練</b> 兩種身分權限，可隨時切換。
    </NoteBox>
  </div>
</Sheet>
