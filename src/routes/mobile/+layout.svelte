<script lang="ts" context="module">
  import type { AuthState } from '$lib/stores/authStore';
  import type { WarmSet } from '$lib/store-warm';
  import { hydrateNotifications } from '$lib/member/notifications';
  import { mobileGuardTarget } from './guard';

  const GUARD = (url: URL, auth: AuthState) => mobileGuardTarget(url.pathname, auth.loggedIn);

  // 暖機清單(R14 候選 F3):通知(TabBar 的未讀角標),與 member +layout 同一份宣告、同一顆閘門。
  // 交給身分範圍以身分為 key 暖,每個身分只打一次 GET。
  const WARM: WarmSet = [['通知', hydrateNotifications]];
</script>

<script lang="ts">
  /* 行動版會員 App · 共用外殼。負責 phone frame、tab bar、overlay host、toast、
   * 以及登入守門。
   *
   * 對應 app.jsx 的 .df-stage > .df-phone > (.df-island + .df-screen) 結構，
   * 並把 tab 從 React state 改為由路由推導。登入頁是 +page@.svelte breakout，
   * 不套用本 layout，避免重導迴圈。
   *
   * Task 19：移除示範性的 `df_mobile_session` localStorage 旗標，改依真實
   * authStore/token 守門(同 member +layout 的 memberGuardTarget 模式)——
   * authStore.hydrate() 已由根 layout(src/routes/+layout.svelte)在 app mount
   * 時呼叫一次(對 refresh token 打 /auth/refresh + GET /users/me)，這裡只需
   * 讀登入狀態決定要不要導去登入頁，不必重複 hydrate。守門(反應式，session 過期時也能被抓到)、
   * 暖機、頁面壽命交給身分範圍(SessionScope，包住 slot);5 個 overlay 在 slot 外面也會讀個人資料，
   * 交給它換人時一併關掉。 */
  import { afterNavigate } from '$app/navigation';
  import { overlay, toasts } from '$lib/mobile/stores';
  import SessionScope from '$lib/components/SessionScope.svelte';
  import TabBar from '$lib/mobile/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile/OverlayHost.svelte';
  import ToastStack from '$lib/components/toast/ToastStackMobile.svelte';
  import '$lib/styles/mobile-frame.css';

  afterNavigate(() => overlay.closeAll());
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <SessionScope guard={GUARD} caller="mobile +layout" warm={WARM} {overlay}><slot /></SessionScope>
      {#if $overlay.stack.length === 0}
        <TabBar />
      {/if}
      <OverlayHost />
      <ToastStack {toasts} />
    </div>
  </div>
</div>
