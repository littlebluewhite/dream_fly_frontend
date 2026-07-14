<script context="module" lang="ts">
  /* Active-state rule, extracted as a pure function so it can be unit-tested
   * without mocking `$page`. The dashboard (`/admin`) is active ONLY on the
   * exact root path; every other item matches by prefix. */
  export function isActive(href: string, path: string): boolean {
    return href === '/admin' ? path === '/admin' : path.startsWith(href);
  }
</script>

<script lang="ts">
  /* 管理後台 left rail: dark brand header, single nav group (9 real route
   * links with active state), and an admin profile menu in the footer
   * (avatar + name + role, popover with a 切換至其他身分 → 教練工作台 role
   * switch, then 個人設定 / 帳號管理 / 登出). */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { toasts } from '$lib/admin/stores';
  import { rememberStaffRole, ROLE_HOME } from '$lib/staff/roles';
  import { authStore } from '$lib/stores/authStore';
  import type { IconName } from '$lib/icon-registry';

  const NAV: { href: string; label: string; icon: IconName }[] = [
    { href: '/admin', label: '儀表板總覽', icon: 'layout-dashboard' },
    { href: '/admin/members', label: '會員管理', icon: 'users' },
    { href: '/admin/coaches', label: '教練管理', icon: 'user-check' },
    { href: '/admin/classes', label: '課程管理', icon: 'book-open' },
    { href: '/admin/orders', label: '訂單管理', icon: 'shopping-bag' },
    { href: '/admin/coupons', label: '優惠碼管理', icon: 'percent' },
    { href: '/admin/venues', label: '場館管理', icon: 'building-2' },
    { href: '/admin/tickets', label: '票券管理', icon: 'ticket' },
    { href: '/admin/reports', label: '報表分析', icon: 'bar-chart-3' },
    { href: '/admin/settings', label: '系統設定', icon: 'settings' }
  ];

  const PROFILE = {
    role: '系統管理員',
    desc: '可存取全平台後台 · 9 個功能模組',
    color: '#0066CC'
  };

  $: path = $page.url.pathname as string;
  $: member = $authStore.member;
  $: profileName = member?.name ?? '管理員';
  $: profileInitial = member?.initial ?? '?';

  let menuOpen = false;
  function logout() {
    menuOpen = false;
    toasts.notify('success', '已登出', '結束目前工作階段。');
    goto('/admin');
  }
  function profileAction(label: string) {
    menuOpen = false;
    toasts.notify('info', label, '此功能將於後續階段實作。');
  }

  function switchRole() {
    menuOpen = false;
    rememberStaffRole('coach');
    goto(ROLE_HOME.coach);
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <div class="brand-logo"><img src="/logo-df-monogram.png" alt="Dream Fly" /></div>
    <div class="brand-text">
      <div class="brand-name">Dream Fly</div>
      <div class="brand-sub">ADMIN · 後台</div>
    </div>
  </div>

  <nav>
    <div class="nav-group-label">主要功能</div>
    {#each NAV as n}
      <a
        href={n.href}
        class="navbtn"
        class:active={isActive(n.href, path)}
        data-sveltekit-preload-data="hover"
      >
        <Icon name={n.icon} size={18} />
        <span>{n.label}</span>
      </a>
    {/each}
  </nav>

  <div class="foot">
    {#if menuOpen}
      <button class="scrim" type="button" aria-label="關閉選單" on:click={() => (menuOpen = false)}
      ></button>
      <div class="menu" role="menu">
        <div class="menu-head">
          <Avatar name={profileInitial} size="sm" color={PROFILE.color} />
          <div class="menu-head-text">
            <div class="menu-head-name">{profileName}</div>
            <div class="menu-head-desc">{PROFILE.desc}</div>
          </div>
        </div>
        <div class="menu-switch-label">
          <span class="menu-switch-title">切換至其他身分</span>
          <span class="menu-switch-avail">1 個可用</span>
        </div>
        <div class="menu-switch-wrap">
          <button class="menu-switch" type="button" role="menuitem" on:click={switchRole}>
            <span class="menu-switch-ic"><Icon name="graduation-cap" size={20} color="var(--df-ink)" /></span>
            <span class="menu-switch-text">
              <span class="menu-switch-row">
                <span class="menu-switch-name">教練工作台</span>
                <span class="menu-switch-tag">教練</span>
              </span>
              <span class="menu-switch-desc">管理班級、學員出勤與訊息</span>
            </span>
            <span class="menu-switch-go"><Icon name="arrow-right" size={14} color="#fff" /></span>
          </button>
        </div>
        <div class="menu-sep"></div>
        <button class="menu-row" type="button" role="menuitem" on:click={() => profileAction('個人設定')}>
          <span class="menu-row-ic"><Icon name="settings" size={14} color="var(--df-text-dark)" /></span>
          <span class="menu-row-text">
            <span class="menu-row-title">個人設定</span>
            <span class="menu-row-sub">編輯個人資料與通知偏好</span>
          </span>
          <Icon name="chevron-right" size={14} color="var(--df-border-strong)" />
        </button>
        <button class="menu-row" type="button" role="menuitem" on:click={() => profileAction('帳號管理')}>
          <span class="menu-row-ic"><Icon name="key-round" size={14} color="var(--df-text-dark)" /></span>
          <span class="menu-row-text">
            <span class="menu-row-title">帳號管理</span>
            <span class="menu-row-sub">密碼、雙重驗證、登入紀錄</span>
          </span>
          <Icon name="chevron-right" size={14} color="var(--df-border-strong)" />
        </button>
        <div class="menu-logout-wrap">
          <button class="menu-row danger" type="button" role="menuitem" on:click={logout}>
            <span class="menu-row-ic danger"><Icon name="log-out" size={14} color="#EF4444" /></span>
            <span class="menu-row-text">
              <span class="menu-row-title danger">登出</span>
              <span class="menu-row-sub danger">結束目前工作階段</span>
            </span>
            <Icon name="chevron-right" size={14} color="#FCA5A5" />
          </button>
        </div>
      </div>
    {/if}
    <button class="profile" class:open={menuOpen} type="button" on:click={() => (menuOpen = !menuOpen)}>
      <Avatar name={profileInitial} size="sm" color={PROFILE.color} />
      <div class="profile-text">
        <div class="profile-name">{profileName}</div>
        <div class="profile-role">{PROFILE.role}</div>
      </div>
      <Icon name="chevrons-up-down" size={16} color="rgba(255,255,255,0.5)" />
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 248px;
    flex: none;
    background: var(--df-ink);
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    font-family: var(--df-font-admin);
  }
  .brand {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .brand-logo {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    padding: 3px;
  }
  .brand-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .brand-text {
    line-height: 1.25;
    white-space: nowrap;
  }
  .brand-name {
    color: #fff;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 0.3px;
  }
  .brand-sub {
    color: rgba(255, 255, 255, 0.55);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
  }
  nav {
    padding: 12px 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    overflow-y: auto;
  }
  .nav-group-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
    color: rgba(255, 255, 255, 0.34);
    padding: 2px 13px 8px;
  }
  .navbtn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 13px;
    border-radius: 9px;
    width: 100%;
    background: transparent;
    color: rgba(255, 255, 255, 0.62);
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    transition: background 0.14s ease, color 0.14s ease;
  }
  .navbtn span {
    flex: 1;
  }
  .navbtn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }
  .navbtn.active {
    background: var(--df-primary);
    color: #fff;
    font-weight: 600;
    box-shadow: 0 6px 16px rgba(0, 102, 204, 0.4);
  }
  .foot {
    padding: 12px;
    position: relative;
  }
  .profile {
    width: 100%;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 11px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 11px;
    cursor: pointer;
    text-align: left;
  }
  .profile.open {
    background: rgba(255, 255, 255, 0.08);
  }
  .profile-text {
    flex: 1;
    min-width: 0;
  }
  .profile-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }
  .profile-role {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: none;
    background: transparent;
    cursor: default;
  }
  .menu {
    position: absolute;
    bottom: 70px;
    left: 12px;
    right: 12px;
    background: #fff;
    border-radius: 14px;
    box-shadow: var(--df-shadow-strong);
    z-index: 70;
    /* cap height so the taller (role-switch) popover scrolls instead of clipping
       above the height:100vh / overflow:hidden shell on short or split-screen viewports */
    max-height: calc(100vh - 96px);
    overflow-x: hidden;
    overflow-y: auto;
    animation: df-fade-up 0.16s ease both;
  }
  .menu-head {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 16px 16px 14px;
  }
  .menu-head-text {
    min-width: 0;
  }
  .menu-head-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--df-primary-dark);
    line-height: 1.4;
  }
  .menu-head-desc {
    font-size: 11px;
    color: var(--df-text-light);
    margin-top: 3px;
    line-height: 1.4;
  }
  .menu-sep {
    height: 1px;
    background: #f1f5f9;
    margin: 0 18px 6px;
  }
  .menu-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s ease;
  }
  .menu-row:hover {
    background: #fafbfc;
  }
  .menu-row-ic {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--df-bg-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .menu-row-text {
    flex: 1;
    min-width: 0;
  }
  .menu-row-title {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .menu-row-sub {
    display: block;
    font-size: 11px;
    color: var(--df-text-light);
  }
  .menu-logout-wrap {
    padding: 4px 8px 12px;
  }
  .menu-row.danger {
    border-radius: 8px;
    background: #fef2f2;
    padding: 10px 12px;
  }
  .menu-row.danger:hover {
    background: #fee2e2;
  }
  .menu-row-ic.danger {
    background: #fff;
  }
  .menu-row-title.danger {
    color: #dc2626;
  }
  .menu-row-sub.danger {
    color: #f87171;
  }
  .menu-switch-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 18px 6px;
  }
  .menu-switch-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.4px;
    color: var(--df-text-muted);
  }
  .menu-switch-avail {
    font-size: 10px;
    font-weight: 600;
    color: var(--df-border-strong);
  }
  .menu-switch-wrap {
    padding: 0 8px 4px;
  }
  .menu-switch {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--df-accent);
    background: #fffbeb;
    cursor: pointer;
    text-align: left;
  }
  .menu-switch-ic {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--df-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .menu-switch-text {
    flex: 1;
    min-width: 0;
  }
  .menu-switch-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .menu-switch-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--df-text-dark);
  }
  .menu-switch-tag {
    background: var(--df-warning-bg);
    color: #b45309;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .menu-switch-desc {
    display: block;
    font-size: 11px;
    color: var(--df-text-light);
    margin-top: 3px;
  }
  .menu-switch-go {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--df-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
</style>
