<script lang="ts">
  /* 管理後台 shell: dark fixed sidebar + sticky top bar + scrolling content,
   * plus the bottom-right toast stack. The page title/sub derive from the
   * route via longest-prefix match (so nested routes inherit their module's
   * heading). Admin-only — coach is a separate future app. */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Sidebar from '$lib/admin/components/Sidebar.svelte';
  import Topbar from '$lib/admin/components/Topbar.svelte';
  import ToastStack from '$lib/components/toast/ToastStack.svelte';
  import { toasts } from '$lib/admin/stores';
  import { authStore } from '$lib/stores/authStore';
  import { staffGuardTarget } from '$lib/staff/roles';
  import '$lib/admin/admin.css';

  // Guard: not logged in → /staff/login; logged in but missing the admin
  // portal role → /staff/login?blocked=1 (shows 此帳號無後台權限 there).
  // Reactive (not "once"), so a session that expires mid-visit is caught too.
  $: if (browser) {
    const guardTarget = staffGuardTarget('admin', $authStore.loggedIn, $authStore.roles);
    if (guardTarget) goto(guardTarget);
  }

  const TITLES: Record<string, [string, string]> = {
    '/admin': ['營運總覽', '全館即時概況'],
    '/admin/members': ['學員管理', '報名與出席'],
    '/admin/coaches': ['教練團隊', '專任教練'],
    '/admin/classes': ['課程管理', '班級與招生'],
    '/admin/orders': ['訂單與金流', '繳費紀錄'],
    '/admin/coupons': ['優惠碼管理', '折扣代碼與使用期限'],
    '/admin/venues': ['場館管理', '場地與器材'],
    '/admin/tickets': ['票券管理', '方案與銷售'],
    '/admin/reports': ['報表分析', '營運數據概覽'],
    '/admin/settings': ['系統設定', '場館與權限']
  };

  /* Longest-prefix match: '/admin' matches only exactly, deeper routes match
   * by prefix and the most specific key wins. */
  function resolve(path: string): [string, string] {
    let best: [string, string] = ['營運總覽', '全館即時概況'];
    let bestLen = -1;
    for (const [href, meta] of Object.entries(TITLES)) {
      const hit = href === '/admin' ? path === '/admin' : path.startsWith(href);
      if (hit && href.length > bestLen) {
        best = meta;
        bestLen = href.length;
      }
    }
    return best;
  }

  $: [title, sub] = resolve($page.url.pathname);
</script>

<div class="shell">
  <Sidebar />
  <div class="main">
    <Topbar {title} {sub} />
    <div class="content df-view df-scroll"><slot /></div>
  </div>
  <ToastStack {toasts} />
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
    background: var(--df-bg-light);
    font-family: var(--df-font-body);
    overflow: hidden;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .content {
    flex: 1;
    overflow: auto;
    padding: 26px;
  }
</style>
