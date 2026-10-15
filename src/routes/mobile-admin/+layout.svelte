<script lang="ts" context="module">
  import type { AuthState } from '$lib/stores/authStore';
  import type { WarmSet } from '$lib/store-warm';
  import { hydrateConversations } from '$lib/coach/conversations';
  import { roleFromPath } from '$lib/mobile-admin/nav';
  import { mobileAdminGuardTarget } from './guard';

  const GUARD = (url: URL, auth: AuthState) => mobileAdminGuardTarget(url.pathname, auth.loggedIn, auth.roles);

  // 暖機清單(R14 候選 F3):只有教練分區有角標 store——訊息(TabBar 的未讀角標)。admin 分區
  // 的通知角標是沒有後端的 mock,不在清單內。暖機看的是所在分區(路徑),不是帳號角色:交給身分範圍
  // 時以 warmIn 限定教練分區,每個身分只打一次 GET(閘門守衛擋重訪、在飛合併擋掉訊息頁 load 的重複、
  // 換身分時閘門自己重置)。
  const WARM: WarmSet = [['訊息', hydrateConversations]];
  const IN_COACH_SECTION = (url: URL) => roleFromPath(url.pathname) === 'coach';
</script>

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
   * 守門交給身分範圍(SessionScope，包住 slot)反應式套用(非 onMount 一次性)，session 過期或角色改變時
   * 也能被抓到;暖機、頁面壽命與換人時關 overlay(overlay 在 slot 外面也會讀個人資料)也交給它。
   *
   * 角色只從路徑推導（roleFromPath）；不再有 role store。 */
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { overlay, toasts } from '$lib/mobile-admin/stores';
  import SessionScope from '$lib/components/SessionScope.svelte';
  import TabBar from '$lib/mobile-admin/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile-admin/OverlayHost.svelte';
  import ToastStack from '$lib/components/toast/ToastStackMobile.svelte';
  import '$lib/styles/mobile-frame.css';

  $: currentRole = roleFromPath($page.url.pathname);

  afterNavigate(() => overlay.closeAll());
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <SessionScope guard={GUARD} caller="mobile-admin +layout" warm={WARM} warmIn={IN_COACH_SECTION} {overlay}><slot /></SessionScope>
      {#if $overlay.stack.length === 0 && currentRole}
        <TabBar role={currentRole} />
      {/if}
      <OverlayHost />
      <ToastStack {toasts} />
    </div>
  </div>
</div>
