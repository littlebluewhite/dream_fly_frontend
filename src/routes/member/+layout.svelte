<script lang="ts">
  /* Member-centre shell: fixed sidebar + sticky top bar + scrolling content,
   * plus the cross-route checkout dialog and toast stack. The login route opts
   * out of this layout via +page@.svelte. */
  import { page } from '$app/stores';
  import Sidebar from '$lib/member/components/Sidebar.svelte';
  import Topbar from '$lib/member/components/Topbar.svelte';
  import CheckoutDialog from '$lib/member/components/CheckoutDialog.svelte';
  import ToastStack from '$lib/member/components/ToastStack.svelte';
  import '$lib/member/member.css';

  const TITLES: Record<string, string> = {
    '/member': '會員中心',
    '/member/courses': '課程介紹',
    '/member/mine': '我的課程',
    '/member/schedule': '日程表',
    '/member/reports': '學習成績單',
    '/member/points': '會員點數',
    '/member/notifications': '通知中心',
    '/member/account': '帳戶與訂單'
  };
  $: title = TITLES[$page.url.pathname] ?? '會員中心';
</script>

<div class="shell">
  <Sidebar />
  <div class="main">
    <Topbar {title} />
    <div class="content df-scroll"><slot /></div>
  </div>
  <CheckoutDialog />
  <ToastStack />
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
    padding: 28px;
  }
</style>
