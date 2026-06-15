<script lang="ts">
  import { page } from '$app/stores';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import '$lib/styles/global.css';

  /* App surfaces (member centre — and, later, coach/admin) bring their own
   * chrome via a nested layout, so the marketing header/footer must not wrap
   * them. global.css still loads here, so tokens/.btn/.card apply everywhere. */
  $: isAppSurface = $page.url.pathname.startsWith('/member') || $page.url.pathname.startsWith('/admin');
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

    <Toast />
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
