<script lang="ts">
  /* /mobile-admin 索引：依真實登入狀態導向角色首頁或登入頁（Task 20，取代示範性的
   * df_madmin_session/df_madmin_role localStorage 判斷）。Reactive（非 onMount 一次性）
   * ——根 layout（src/routes/+layout.svelte）已在 app mount 時呼叫過 authStore.hydrate()
   * 一次，這裡只需 reactive 讀 $authStore 決定導向哪裡，不必重複 hydrate，也不會在
   * hydrate 尚未完成前就用過期的「未登入」值誤導向登入頁（hydrate 完成後 store 更新，
   * 這個 reactive block 會再跑一次）。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/authStore';
  import { mobileAdminRootTarget } from './guard';

  $: if (browser) goto(mobileAdminRootTarget($authStore.loggedIn, $authStore.roles));
</script>

<div class="df-scroll" style="display:flex; align-items:center; justify-content:center; color:var(--df-text-muted); font-size:13px;">
  載入中…
</div>
