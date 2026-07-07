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
   * reactive 讀 $isLoggedIn 決定要不要導去登入頁，不必重複 hydrate。Reactive
   * (非 onMount 一次性)，session 過期時也能被抓到。 */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto, afterNavigate } from '$app/navigation';
  import { isLoggedIn } from '$lib/stores/authStore';
  import { overlay, toasts } from '$lib/mobile/stores';
  import { mobileGuardTarget } from './guard';
  import TabBar from '$lib/mobile/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile/OverlayHost.svelte';
  import ToastStack from '$lib/components/toast/ToastStackMobile.svelte';
  import '$lib/styles/mobile-frame.css';

  $: if (browser) {
    const target = mobileGuardTarget($page.url.pathname, $isLoggedIn);
    if (target) goto(target);
  }

  afterNavigate(() => overlay.closeAll());
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <slot />
      {#if $overlay.stack.length === 0}
        <TabBar />
      {/if}
      <OverlayHost />
      <ToastStack {toasts} />
    </div>
  </div>
</div>
