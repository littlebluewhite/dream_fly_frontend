<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import ToastPublic from '$lib/components/toast/ToastPublic.svelte';
  import { toasts } from '$lib/stores/marketingToasts';
  import { authStore } from '$lib/stores/authStore';
  import '$lib/styles/global.css';

  // Confirm/refresh the session once on app mount: if a refresh token exists,
  // validate it and populate real member data; otherwise this is a no-op past
  // the localStorage check (see authStore.hydrate()).
  onMount(() => {
    authStore.hydrate();
  });

  /* App surfaces (member centre, admin back-office, coach work-portal, and the
   * staff login) bring their own chrome via a nested layout (or a bare page),
   * so the marketing header/footer must not wrap them. global.css still loads
   * here, so tokens/.btn/.card apply everywhere. */
  $: isAppSurface =
    $page.url.pathname.startsWith('/member') ||
    $page.url.pathname.startsWith('/admin') ||
    $page.url.pathname.startsWith('/coach') ||
    $page.url.pathname.startsWith('/staff') ||
    $page.url.pathname.startsWith('/mobile-admin') ||
    $page.url.pathname.startsWith('/mobile');
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
