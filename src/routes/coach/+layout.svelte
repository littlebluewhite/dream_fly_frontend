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
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { afterNavigate, goto } from '$app/navigation';
  import Sidebar from '$lib/coach/components/Sidebar.svelte';
  import Topbar from '$lib/coach/components/Topbar.svelte';
  import ToastStack from '$lib/components/toast/ToastStack.svelte';
  import { resolve } from '$lib/coach/nav';
  import { search, toasts } from '$lib/coach/stores';
  import { authStore, sessionKey, lastSessionKey } from '$lib/stores/authStore';
  import { hydrateConversations } from '$lib/coach/conversations';
  import { warmStores } from '$lib/store-warm';
  import { staffGuardTarget } from '$lib/staff/roles';
  import '$lib/coach/coach.css';

  // Guard: not logged in → /staff/login; logged in but missing the coach
  // portal role → /staff/login?blocked=1 (shows 此帳號無後台權限 there).
  // Reactive (not "once"), so a session that expires mid-visit is caught too.
  $: if (browser) {
    const guardTarget = staffGuardTarget('coach', $authStore.loggedIn, $authStore.roles);
    if (guardTarget) goto(guardTarget);
  }

  // 暖機清單(R20 候選 02):側欄「訊息中心」角標讀教練對話列表的未讀對話數,進任何教練頁都要有。
  // 以身分為 key 反應式呼叫(同 member/mobile-admin layout):已登入且過了教練角色 guard 時 key 為 member.id,否則 null
  // (非教練會被導走,不替他抓對話列表;同 mobile-admin 的 warmKey);
  // 每個身分只打一次 GET——閘門守衛擋重訪、在飛合併擋掉訊息頁/工作台 load 的重複(第一次進頁仍是 1 次)、
  // 換身分時閘門自己重置。
  $: warmKey = staffGuardTarget('coach', $authStore.loggedIn, $authStore.roles) === null ? $sessionKey : null;
  $: if (browser && warmKey !== null) void warmStores('coach +layout', [['訊息', hydrateConversations]]);

  // 頁面壽命 = 最近登入的身分:slot 以 {#key $lastSessionKey} 包住,換人即重掛載重抓;登出不重掛載,交給 guard。

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
      {#key $lastSessionKey}<slot />{/key}
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
