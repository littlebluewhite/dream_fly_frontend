<script lang="ts">
  /* 教練端 shell: navy sidebar + 68px sticky topbar (breadcrumb + title) +
   * scrolling content, plus the bottom-right toast stack. Mirrors the admin
   * layout skeleton; the title/crumb derive from the route via nav.resolve().
   *
   * afterNavigate clears the topbar search and resets the inner .content
   * scroller (the prototype's setView did both, app.jsx:29-33; SvelteKit's
   * built-in scroll reset only covers window, not this inner element).
   *
   * 訊息中心 gets slightly reduced content padding (20px 26px vs 26px,
   * app.jsx:58,65) so its fixed-height 3-column card fits. */
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import Sidebar from '$lib/coach/components/Sidebar.svelte';
  import Topbar from '$lib/coach/components/Topbar.svelte';
  import ToastStack from '$lib/components/toast/ToastStack.svelte';
  import { resolve } from '$lib/coach/nav';
  import { search, toasts } from '$lib/coach/stores';
  import '$lib/coach/coach.css';

  let content: HTMLElement;
  $: [crumb, title] = resolve($page.url.pathname);
  $: isMessages = $page.url.pathname === '/coach/messages';

  afterNavigate(() => {
    search.set('');
    if (content) content.scrollTop = 0;
  });
</script>

<div class="shell">
  <Sidebar />
  <div class="main">
    <Topbar {crumb} {title} />
    <div class="content df-view df-scroll" class:msg={isMessages} bind:this={content}>
      <slot />
    </div>
  </div>
  <ToastStack {toasts} />
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
    background: var(--df-bg-light);
    font-family: var(--df-font-body);
    overflow: hidden;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .content {
    flex: 1;
    overflow: auto;
    padding: 26px;
  }
  .content.msg {
    padding: 20px 26px;
  }
</style>
