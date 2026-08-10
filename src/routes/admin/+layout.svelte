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
  import { resolve } from '$lib/admin/nav';
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
