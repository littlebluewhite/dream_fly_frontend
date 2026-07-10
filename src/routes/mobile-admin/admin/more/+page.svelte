<script lang="ts">
  /* 管理員 · 更多(延伸模組 hub)。admin2.jsx MoreScreen (6)。
   * 列表項 → overlay.push(screen);profile/role chip → sheet('role')；logout 真登出
   * (Task 20：authStore.logout()，取代示範性的 localStorage 旗標清除)。
   *
   * 資料改由 getMore()(mock-API 接縫)非同步載入,三態閘門(loading/error/ready);
   * `data` 是本頁本地一次性快照(非共享 store)；coaches/venues/tickets 現讀真桌面
   * admin seam(Task 20)，profiles(身分卡)維持 mock，見 mobile-admin/api.ts 附註。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import SectionTitle from '$lib/components/mobile/SectionTitle.svelte';
  import { overlay, role, switchRole } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { createLoadGate } from '$lib/load-gate';
  import { getMore, type MoreData } from '$lib/mobile-admin/api';
  import { authStore } from '$lib/stores/authStore';

  let data: MoreData | null = null;
  const gate = createLoadGate({
    fetch: getMore,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: groups = data
    ? ([
        ['營運管理', [
          ['教練管理', 'user-check', data.coaches.length + ' 位專任教練', 'coaches'],
          ['場館管理', 'building-2', data.venues.length + ' 個場地 · 器材', 'venues'],
          ['票券管理', 'ticket', data.tickets.length + ' 種方案 · 銷售', 'tickets'],
          ['報表分析', 'bar-chart-3', '營收與課程數據', 'reports']
        ]],
        ['系統', [
          ['系統設定', 'settings', '場館資訊與通知', 'settings']
        ]]
      ] as [string, [string, string, string, string][]][])
    : [];

  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });
  // Task 20：真登出（POST /auth/logout best-effort revoke + 清 token），取代示範性的
  // localStorage 旗標清除。
  async function logout() {
    await authStore.logout();
    goto('/mobile-admin/login');
  }
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="more-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:20px;" slot="loading">
    <SkelCard><Skeleton w="100%" h={80} r={16} /></SkelCard>
    {#each [0, 1] as i (i)}
      <SkelCard padding={0}>
        <div style="padding:14px 15px; display:flex; flex-direction:column; gap:14px;">
          {#each [0, 1] as j (j)}
            <Skeleton w="100%" h={40} r={11} />
          {/each}
        </div>
      </SkelCard>
    {/each}
  </div>

  {#if data}
    {@const p = data.profiles.admin}
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
  {/if}
</LoadGate>
