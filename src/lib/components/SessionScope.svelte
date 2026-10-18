<script lang="ts">
  /* 身分範圍 (Session Scope):member / mobile / coach / mobile-admin 四個身分相依 layout 把 slot 交給它,
   * 它負責四件事,layout 只交出自己的守門函式、暖機清單(module-level 常數)與要不要關的 overlay:
   *   - 守門:guard(url, 登入狀態) 回傳目標就 goto;反應式(非「一次」),session 中途過期也抓得到。
   *   - 暖機准入:只替 guard 放行、且 warmIn(url) 的身分暖機,key 是 $sessionKey——每個身分暖一次、A→B 重暖、
   *     登出不暖(之後的重複由閘門守衛與在飛合併擋)。
   *   - 頁面壽命:slot 以 {#key $lastSessionKey} 包住,換人(A→B、null→A)即重掛載、以新身分重抓;登出不重掛載,
   *     交給 guard 導頁。lastSessionKey 只用在這裡,閘門不得用(它吞掉登出,ADR-0026 §6、ADR-0028 §2)。
   *   - 換人時關 overlay:overlay 在 slot 外面也會讀個人資料。
   * 結帳接收(member)、afterNavigate 與 key 外面的外框(CheckoutDialog、TabBar…)留在各 layout。
   * 不是 ADR-0024 否決的 registry(沒有 module-level 清單、import 無副作用),也不是身分 hook(不提供訂閱 API,
   * 只讀 sessionKey / lastSessionKey)。root 與 admin layout 不用它(ADR-0028 §2)。 */
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore, sessionKey, lastSessionKey, type AuthState } from '$lib/stores/authStore';
  import { warmStores, type WarmSet } from '$lib/store-warm';

  export let guard: (url: URL, auth: AuthState) => string | null;
  export let caller: string;
  export let warm: WarmSet;
  export let warmIn: (url: URL) => boolean = () => true;
  export let overlay: { closeAll(): void } | undefined = undefined;

  // 每次 $page / $authStore 變動都重評估、有目標就 goto,不只在目標字串改變時(導頁被打斷後換到另一個
  // 同目標的受守門網址也要再導)。target 只出現在 = 左邊,才不會變成這段的相依。
  let target: string | null = null;
  $: {
    const to = guard($page.url, $authStore);
    target = to;
    if (browser && to) goto(to);
  }

  $: warmKey = target === null && warmIn($page.url) ? $sessionKey : null;
  $: if (browser && warmKey !== null) void warmStores(caller, warm);

  $: if (browser && $lastSessionKey !== null) overlay?.closeAll();
</script>

{#key $lastSessionKey}<slot />{/key}
