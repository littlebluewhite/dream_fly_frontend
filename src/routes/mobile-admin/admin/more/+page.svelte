<script lang="ts">
  /* 管理員 · 更多(延伸模組 hub)。admin2.jsx MoreScreen (6)。
   * 列表項 → overlay.push(screen);profile/role chip → sheet('role');logout 清 session。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import SectionTitle from '$lib/mobile-admin/components/SectionTitle.svelte';
  import { overlay, role, switchRole, session } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { PROFILES, COACHES, VENUES, TICKETS } from '$lib/mobile-admin/data';

  const p = PROFILES.admin;

  const groups: [string, [string, string, string, string][]][] = [
    ['營運管理', [
      ['教練管理', 'user-check', COACHES.length + ' 位專任教練', 'coaches'],
      ['場館管理', 'building-2', VENUES.length + ' 個場地 · 器材', 'venues'],
      ['票券管理', 'ticket', TICKETS.length + ' 種方案 · 銷售', 'tickets'],
      ['報表分析', 'bar-chart-3', '營收與課程數據', 'reports']
    ]],
    ['系統', [
      ['系統設定', 'settings', '場館資訊與通知', 'settings']
    ]]
  ];

  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });
  function logout() {
    if (browser) {
      try {
        localStorage.removeItem('df_madmin_session');
        localStorage.removeItem('df_madmin_role');
      } catch (_) {}
    }
    session.set(false);
    goto('/mobile-admin/login');
  }
</script>

<HeroHeader role="admin" {p} unread={0} onBell={() => {}} {onRole} greeting="更多功能" sub="管理後台延伸模組" />

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:20px; margin-top:-2px;">
    <button
      on:click={onRole}
      class="df-tapscale"
      style="display:flex; align-items:center; gap:13px; padding:15px; border-radius:16px; border:1px solid var(--df-border);
        background:#fff; box-shadow:var(--df-shadow-card); cursor:pointer; text-align:left; width:100%;"
    >
      <div style="width:50px; height:50px; border-radius:999px; background:var(--df-primary); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:20px; font-family:var(--df-font-heading); flex:none;">{p.initial}</div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:7px;">
          <span style="font-size:16.5px; font-weight:800; color:var(--df-ink);">{p.name}</span>
          <Badge tone="primary">管理員</Badge>
        </div>
        <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{p.role} · 點此切換身分</div>
      </div>
      <Icon name="chevrons-up-down" size={18} color="var(--df-text-muted)" />
    </button>

    {#each groups as [title, items] (title)}
      <div>
        <SectionTitle>{title}</SectionTitle>
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); overflow:hidden;">
          {#each items as [label, icon, desc, screen], i (label)}
            <button
              on:click={() => overlay.push(screen)}
              class="df-rowhover df-tapscale"
              style="display:flex; align-items:center; gap:13px; padding:14px 15px; width:100%; border:none;
                border-bottom:{i < items.length - 1 ? '1px solid var(--df-border)' : 'none'}; background:#fff; cursor:pointer; text-align:left;"
            >
              <div style="width:40px; height:40px; border-radius:11px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none;">
                <Icon name={icon} size={20} color="var(--df-primary)" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:14.5px; font-weight:600; color:var(--df-text-dark);">{label}</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{desc}</div>
              </div>
              <Icon name="chevron-right" size={18} color="var(--df-text-muted)" />
            </button>
          {/each}
        </div>
      </div>
    {/each}

    <div style="display:flex; flex-direction:column; gap:10px;">
      <a
        href="/mobile"
        class="df-tapscale"
        style="display:flex; align-items:center; justify-content:center; gap:8px; height:48px; border-radius:12px;
          border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-light); font-size:14px; font-weight:600; text-decoration:none;"
      >
        <Icon name="smartphone" size={17} color="var(--df-text-muted)" /> 切換至會員 App
      </a>
      <button
        on:click={logout}
        class="df-tapscale"
        style="display:flex; align-items:center; justify-content:center; gap:8px; height:48px; border-radius:12px;
          border:none; background:#FEF2F2; color:var(--df-error); font-size:14px; font-weight:700; cursor:pointer;"
      >
        <Icon name="log-out" size={17} color="var(--df-error)" /> 登出
      </button>
    </div>
    <div style="text-align:center; font-size:11.5px; color:var(--df-text-muted); padding-bottom:8px;">Dream Fly 夢飛體操館 · 後台 v1.0</div>
  </div>
</div>
