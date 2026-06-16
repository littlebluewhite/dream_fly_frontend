<script lang="ts">
  /* 行動版會員 App · 共用外殼。負責 phone frame、tab bar、overlay host、toast、
   * 以及示範性的登入守門（localStorage df_mobile_session）。
   *
   * 對應 app.jsx 的 .df-stage > .df-phone > (.df-island + .df-screen) 結構，
   * 並把 tab 從 React state 改為由路由推導。登入頁是 +page@.svelte breakout，
   * 不套用本 layout，避免重導迴圈。
   *
   * SSR 安全：絕不在 module scope 讀 localStorage，一律在 onMount + browser 守門。 */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto, afterNavigate } from '$app/navigation';
  import { overlay, session } from '$lib/mobile/stores';
  import TabBar from '$lib/mobile/components/TabBar.svelte';
  import OverlayHost from '$lib/mobile/OverlayHost.svelte';
  import ToastStack from '$lib/mobile/components/ToastStack.svelte';
  import '$lib/styles/mobile-frame.css';

  onMount(() => {
    if (!browser) return;
    let authed = '';
    try {
      authed = localStorage.getItem('df_mobile_session') || '';
    } catch (_) {}
    if (!authed) {
      goto('/mobile/login');
      return;
    }
    session.set(true);
  });

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
      <ToastStack />
    </div>
  </div>
</div>
