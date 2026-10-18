<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import ToastPublic from '$lib/components/toast/ToastPublic.svelte';
  import { toasts } from '$lib/stores/marketingToasts';
  import { authStore, sessionKey } from '$lib/stores/authStore';
  import { warmStores } from '$lib/store-warm';
  import { refreshSubscriptions } from '$lib/member/stores';
  import { hydrateAnnouncements } from '$lib/stores/notificationsStore';
  import '$lib/styles/global.css';

  // Confirm/refresh the session once on app mount: if a refresh token exists,
  // validate it and populate real member data; otherwise this is a no-op past
  // the localStorage check (see authStore.hydrate()).
  onMount(() => {
    authStore.hydrate();
  });

  /* App surfaces (member centre, admin back-office, coach work-portal, the
   * staff login, mobile and mobile-admin) bring their own chrome via a nested
   * layout (or a bare page), so the marketing header/footer must not wrap them.
   * A new app surface must add its path prefix here, or it inherits the
   * marketing chrome. global.css still loads here, so tokens/.btn/.card apply
   * everywhere. */
  $: isAppSurface =
    $page.url.pathname.startsWith('/member') ||
    $page.url.pathname.startsWith('/admin') ||
    $page.url.pathname.startsWith('/coach') ||
    $page.url.pathname.startsWith('/staff') ||
    $page.url.pathname.startsWith('/mobile-admin') ||
    $page.url.pathname.startsWith('/mobile');

  /* 行銷外殼的訂閱暖機:購物車頁與下拉的「已持有不計費」都吃 subscriptions,在此以登入身分為 key
   * 暖一次(auth 晚於頁面才水合、A 直接換登 B 都會重暖;app 介面自帶 layout,不在此暖)。
   * 結帳結算仍由各介面自己做(ADR-0003 / ADR-0025 F-5)。 */
  $: if (browser && !isAppSurface && $sessionKey !== null) void warmStores('root +layout', [['訂閱', refreshSubscriptions]]);

  /* 行銷公告暖機：公開端點與身分無關，故不看 $sessionKey、另起一行——每個頁面生命週期只暖一次
   * （閘門守衛擋重訪；失敗時維持未水合；此行只依賴 isAppSurface，行銷頁之間換頁不會重跑，
   * 要等進過 app 介面再回來或重新載入才會重試）。 */
  $: if (browser && !isAppSurface) void warmStores('root +layout', [['公告', hydrateAnnouncements]]);
</script>

{#if isAppSurface}
  <slot />
{:else}
  <div class="app">
    <Header />

    <main class="main-content">
      <slot />
    </main>

    <Footer />

    <ToastPublic {toasts} />
  </div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    width: 100%;
  }
</style>
