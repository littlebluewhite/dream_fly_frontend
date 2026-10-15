<script lang="ts" context="module">
  import type { AuthState } from '$lib/stores/authStore';
  import type { WarmSet } from '$lib/store-warm';
  import { hydrateConversations } from '$lib/coach/conversations';
  import { staffGuardTarget } from '$lib/staff/roles';

  // Guard: not logged in → /staff/login; logged in but missing the coach
  // portal role → /staff/login?blocked=1 (shows 此帳號無後台權限 there).
  // 身分範圍(SessionScope)反應式套用它,session 中途過期也抓得到;非教練被導走,也就不替他暖機。
  const GUARD = (_url: URL, auth: AuthState) => staffGuardTarget('coach', auth.loggedIn, auth.roles);

  // 暖機清單(R20 候選 02):側欄「訊息中心」角標讀教練對話列表的未讀對話數,進任何教練頁都要有。
  // 交給身分範圍以身分為 key 暖:每個身分只打一次 GET——閘門守衛擋重訪、在飛合併擋掉訊息頁/工作台 load 的重複
  // (第一次進頁仍是 1 次)、換身分時閘門自己重置。
  const WARM: WarmSet = [['訊息', hydrateConversations]];
</script>

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
  import SessionScope from '$lib/components/SessionScope.svelte';
  import { resolve } from '$lib/coach/nav';
  import { search, toasts } from '$lib/coach/stores';
  import '$lib/coach/coach.css';

  // 守門、暖機與頁面壽命交給身分範圍(SessionScope,包住 slot)。

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
      <SessionScope guard={GUARD} caller="coach +layout" warm={WARM}><slot /></SessionScope>
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
