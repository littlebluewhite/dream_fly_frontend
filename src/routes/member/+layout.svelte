<script lang="ts" context="module">
  import type { AuthState } from '$lib/stores/authStore';
  import type { WarmSet } from '$lib/store-warm';
  import { hydrateNotifications } from '$lib/member/stores';
  import { wantsCheckout } from '$lib/checkout-gate';
  import { memberGuardTarget } from './guard';

  // Login guard: every /member/* page (this layout) requires login. Skipped
  // while wantsCheckout() is true — that case is already fully handled by the
  // checkout-gate receiver below (goto(checkoutTarget(false))), which preserves
  // the checkout intent through the login round-trip; the guard's own target
  // would otherwise fire a second, competing goto() that drops it. 身分範圍
  // (SessionScope) 反應式套用它(非「一次」),session 中途過期也抓得到。
  const GUARD = (url: URL, auth: AuthState) => (wantsCheckout(url) ? null : memberGuardTarget(url.pathname, auth.loggedIn));

  // 暖機清單(R14 候選 F3):本 surface 的共享角標 store——通知(Topbar/Sidebar 的未讀角標)。
  // 交給身分範圍以身分為 key 暖:每個身分只打一次 GET(閘門守衛擋重訪、在飛合併擋掉同頁通知頁 load 的重複)。
  const WARM: WarmSet = [['通知', hydrateNotifications]];
</script>

<script lang="ts">
  /* Member-centre shell: fixed sidebar + sticky top bar + scrolling content,
   * plus the cross-route checkout dialog and toast stack. The login route opts
   * out of this layout via +page@.svelte. 守門、暖機與頁面壽命交給身分範圍
   * (SessionScope,包住 slot)。 */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto, replaceState } from '$app/navigation';
  import Sidebar from '$lib/member/components/Sidebar.svelte';
  import Topbar from '$lib/member/components/Topbar.svelte';
  import CheckoutDialog from '$lib/member/components/CheckoutDialog.svelte';
  import ToastStack from '$lib/components/toast/ToastStack.svelte';
  import SessionScope from '$lib/components/SessionScope.svelte';
  import { checkoutOpen, toasts } from '$lib/member/stores';
  import { isLoggedIn } from '$lib/stores/authStore';
  import { checkoutTarget } from '$lib/checkout-gate';
  import '$lib/member/member.css';

  // Receiver half of the checkout gate. A landing URL carrying ?checkout=1
  // auto-opens the checkout dialog — but ONLY for a logged-in member; a guest who
  // reaches it directly is bounced through login (auth-at-checkout is enforced
  // here, not merely trusted from the trigger). Then we strip the query so a
  // reload / back-nav can't reopen it. Browser-only: replaceState throws on the
  // server and there is no dialog to open during SSR. Fires once per arrival.
  let handled = false;
  $: if (browser && wantsCheckout($page.url) && !handled) {
    handled = true;
    if ($isLoggedIn) {
      checkoutOpen.set(true);
      replaceState('/member', {});
    } else {
      goto(checkoutTarget(false));
    }
  }

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
    <div class="content df-scroll"><SessionScope guard={GUARD} caller="member +layout" warm={WARM}><slot /></SessionScope></div>
  </div>
  <CheckoutDialog />
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
    padding: 28px;
  }
</style>
