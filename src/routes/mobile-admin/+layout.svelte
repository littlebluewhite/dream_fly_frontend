<script lang="ts">
  /* 行動版後台 · 共用外殼。負責 phone frame、tab bar、overlay host、toast，
   * 以及登入守門。
   *
   * 對應 app.jsx 的 .df-stage > .df-phone > (.df-island + .df-screen) 結構，
   * 並把 role/tab 從 React state 改為由路由推導。登入頁是 +page@.svelte breakout，
   * 不套用本 layout；本 layout 只服務 admin/coach 角色頁。
   *
   * Task 20：移除示範性的 `df_madmin_session`/`df_madmin_role` localStorage 旗標，
   * 改依真實 authStore 權杖 + 角色守門（同 admin/coach 桌面 layout 的
   * staffGuardTarget 模式，見 mobileAdminGuardTarget 的行內比較）——mobile-admin
   * 的守門對象是 pathname 的角色 segment（roleFromPath），角色不符或未登入一律
   * 導去 /mobile-admin/login（不是桌面的 /staff/login，那會跳出手機框架外）。
   * Reactive（非 onMount 一次性），session 過期或角色改變時也能被抓到。
   *
   * role store 現只做「目前所在分區」的展示用途（RoleSheet 目前選取樣式等）—— 真正
   * 的存取判斷完全交給下面的 guard；currentRole（從路徑推導）才是安全判斷的唯一
   * 依據，這裡把它同步進 role store 只是讓既有讀 $role 的畫面（更多／設定頁的身分
   * 卡）跟著路徑走，不會停在舊角色。 */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto, afterNavigate } from '$app/navigation';
  import { authStore } from '$lib/stores/authStore';
  import { overlay, role, toasts } from '$lib/mobile-admin/stores';
  import { roleFromPath } from '$lib/mobile-admin/nav';
  import { mobileAdminGuardTarget } from './guard';
  import TabBar from '$lib/mobile-admin/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile-admin/OverlayHost.svelte';
  import ToastStack from '$lib/components/toast/ToastStackMobile.svelte';
  import '$lib/styles/mobile-frame.css';

  $: currentRole = roleFromPath($page.url.pathname);
  $: if (currentRole) role.set(currentRole);

  $: if (browser) {
    const target = mobileAdminGuardTarget($page.url.pathname, $authStore.loggedIn, $authStore.roles);
    if (target) goto(target);
  }

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
      <ToastStack {toasts} />
    </div>
  </div>
</div>
