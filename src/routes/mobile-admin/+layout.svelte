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
   * 角色只從路徑推導（roleFromPath）；不再有 role store。 */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto, afterNavigate } from '$app/navigation';
  import { authStore, sessionKey } from '$lib/stores/authStore';
  import { overlay, toasts, hydrateMessages } from '$lib/mobile-admin/stores';
  import { warmStores } from '$lib/store-warm';
  import { roleFromPath } from '$lib/mobile-admin/nav';
  import { mobileAdminGuardTarget } from './guard';
  import TabBar from '$lib/mobile-admin/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile-admin/OverlayHost.svelte';
  import ToastStack from '$lib/components/toast/ToastStackMobile.svelte';
  import '$lib/styles/mobile-frame.css';

  $: currentRole = roleFromPath($page.url.pathname);

  $: if (browser) {
    const target = mobileAdminGuardTarget($page.url.pathname, $authStore.loggedIn, $authStore.roles);
    if (target) goto(target);
  }

  // 暖機清單(R14 候選 F3):只有教練分區有角標 store——訊息(TabBar 的未讀角標)。admin 分區
  // 的通知角標是沒有後端的 mock,不在清單內。已登入、守門不導走且位於教練分區時 key 為
  // member.id,否則 null;每個身分只打一次 GET(閘門守衛擋重訪、在飛合併擋掉訊息頁 load 的
  // 重複、換身分時閘門自己重置)。
  $: warmKey =
    currentRole === 'coach' &&
    $authStore.loggedIn &&
    mobileAdminGuardTarget($page.url.pathname, $authStore.loggedIn, $authStore.roles) === null
      ? $sessionKey
      : null;
  $: if (browser && warmKey !== null) void warmStores('mobile-admin +layout', [['訊息', hydrateMessages]]);

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
