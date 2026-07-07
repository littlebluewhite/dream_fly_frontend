<script lang="ts">
  /* Member-centre left rail: brand, primary nav (real route links with active
   * state), staff-portal entry and the signed-in member footer. */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import { unreadCount, toasts } from '$lib/member/stores';
  import { authStore } from '$lib/stores/authStore';

  // Real identity (Task 11 P2 cleanup — was the mock `ME` constant). A guest
  // render (no SSR route guard on /member) falls back to '?' / brand primary / 會員.
  $: member = $authStore.member;

  const NAV = [
    { href: '/member', label: '總覽', icon: 'layout-dashboard' },
    { href: '/member/courses', label: '課程介紹', icon: 'graduation-cap' },
    { href: '/member/mine', label: '我的課程', icon: 'calendar-check' },
    { href: '/member/schedule', label: '日程表', icon: 'calendar-days' },
    { href: '/member/reports', label: '成績單', icon: 'clipboard-list' },
    { href: '/member/points', label: '會員點數', icon: 'star' },
    { href: '/member/notifications', label: '通知', icon: 'bell' },
    { href: '/member/account', label: '帳戶', icon: 'user-round' }
  ];

  $: path = $page.url.pathname as string;
  const isActive = (href: string) => (href === '/member' ? path === '/member' : path.startsWith(href));

  function logout() {
    toasts.notify('success', '已登出', '期待你下次再來！');
    authStore.logout();
    goto('/member/login');
  }
</script>

<aside class="sidebar">
  <div class="brand">
    <img src="/logo-df-monogram.png" alt="Dream Fly" />
    <div class="brand-text">
      <div class="brand-name">DREAM FLY</div>
      <div class="brand-sub">會員中心</div>
    </div>
  </div>

  <nav>
    {#each NAV as n}
      <a href={n.href} class="navbtn df-navbtn" class:active={isActive(n.href)} data-sveltekit-preload-data="hover">
        <Icon name={n.icon} size={19} />
        <span>{n.label}</span>
        {#if n.href === '/member/notifications' && $unreadCount > 0}
          <span class="badge">{$unreadCount}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <div class="foot">
    <a class="staff" href="/staff/login" title="員工後台（示範切換）">
      <Icon name="shield-check" size={15} color="var(--df-text-muted)" />
      <span>員工後台入口</span>
      <Icon name="arrow-up-right" size={13} color="var(--df-text-muted)" />
    </a>
    <div class="me">
      <Avatar name={member?.initial ?? '?'} size="sm" color={member?.color ?? 'var(--df-primary)'} />
      <div class="me-text">
        <div class="me-name">{member?.name ?? '會員'}</div>
        <!-- P2: 「進階班學員」是硬編文字，非身分資料——後端無班級/等級欄位可回填，見 docs/adr/0006。 -->
        <div class="me-role">進階班學員</div>
      </div>
      <IconButton aria-label="登出" variant="ghost" on:click={logout}>
        <Icon name="log-out" size={17} color="var(--df-text-light)" />
      </IconButton>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 248px;
    flex: none;
    background: #fff;
    border-right: 1px solid var(--df-border);
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .brand {
    height: 72px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 22px;
    border-bottom: 1px solid var(--df-border);
  }
  .brand img {
    height: 34px;
  }
  .brand-name {
    font-family: var(--df-font-heading);
    font-weight: 800;
    font-size: 16px;
    color: var(--df-ink);
    letter-spacing: 0.3px;
    line-height: 1.2;
  }
  .brand-sub {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    color: var(--df-text-muted);
  }
  nav {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .navbtn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 9px;
    width: 100%;
    background: transparent;
    color: var(--df-text-dark);
    font-size: 15px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    transition: background 0.14s ease, color 0.14s ease;
  }
  .navbtn:hover {
    background: var(--df-bg-light);
  }
  .navbtn.active {
    background: var(--df-primary-bg);
    color: var(--df-primary);
    font-weight: 600;
  }
  .navbtn .badge {
    margin-left: auto;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--df-accent);
    color: var(--df-ink);
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .foot {
    padding: 14px;
    border-top: 1px solid var(--df-border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .staff {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 9px;
    border: 1px solid var(--df-border);
    background: var(--df-bg-light);
    color: var(--df-text-light);
    text-decoration: none;
    font-size: 12.5px;
    font-weight: 600;
  }
  .staff span {
    flex: 1;
  }
  .staff:hover {
    border-color: var(--df-border-strong);
  }
  .me {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px;
  }
  .me-text {
    flex: 1;
    min-width: 0;
  }
  .me-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .me-role {
    font-size: 12px;
    color: var(--df-text-light);
  }
</style>
