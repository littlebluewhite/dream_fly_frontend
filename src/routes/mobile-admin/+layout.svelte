<script lang="ts">
  /* 行動版後台 · 共用外殼。負責 phone frame、tab bar、overlay host、toast、
   * 以及示範性的登入守門（localStorage df_madmin_session/role）。
   *
   * 對應 app.jsx 的 .df-stage > .df-phone > (.df-island + .df-screen) 結構，
   * 並把 role/tab 從 React state 改為由路由推導。登入頁是 +page@.svelte breakout，
   * 不套用本 layout；本 layout 只服務 admin/coach 角色頁。
   *
   * SSR 安全：絕不在 module scope 讀 localStorage，一律在 onMount + browser 守門。 */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto, afterNavigate } from '$app/navigation';
  import { overlay, role, session } from '$lib/mobile-admin/stores';
  import { roleFromPath, type Role } from '$lib/mobile-admin/nav';
  import TabBar from '$lib/mobile-admin/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile-admin/OverlayHost.svelte';
  import ToastStack from '$lib/mobile-admin/components/ToastStack.svelte';
  import '$lib/styles/mobile-frame.css';

  $: currentRole = roleFromPath($page.url.pathname);

  onMount(() => {
    if (!browser) return;
    let authed = '';
    try {
      authed = localStorage.getItem('df_madmin_session') || '';
    } catch (_) {}
    if (!authed) {
      goto('/mobile-admin/login');
      return;
    }
    let r: Role = 'admin';
    try {
      r = localStorage.getItem('df_madmin_role') === 'coach' ? 'coach' : 'admin';
    } catch (_) {}
    role.set(r);
    session.set(true);
  });

  afterNavigate(() => overlay.closeAll());
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <slot />
      {#if $overlay.stack.length === 0 && currentRole}
        <TabBar role={currentRole} />
      {/if}
      <OverlayHost />
      <ToastStack />
    </div>
  </div>
</div>
