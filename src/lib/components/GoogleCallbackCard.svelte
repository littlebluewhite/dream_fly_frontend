<script lang="ts">
  /* Google OAuth callback 卡片（member + mobile 共用，C7 塌收自兩份逐字雙生頁：
   * routes/member/login/google/+page@.svelte 與 routes/mobile/login/google/
   * +page@.svelte）。呼叫端只傳兩個路徑，不用 surface enum——ADR 0006 記載後端
   * 的 Google 流程目前只發 member 角色，今日恰好兩個 adapter（member/mobile），
   * 顯式傳路徑比多一層列舉更直接。
   *
   * 流程順序是 P1 級契約，照現行兩頁逐字保留，不能重排：
   *   1. consumeGoogleOauthState(params.get('state')) 必須最先執行——一次性
   *      CSRF state 無論比對成功或失敗都要立刻清除、不能被重放。若把 ?error=
   *      判斷提前到 state 消費之前，取消/失敗的回呼會讓舊 state 殘留在
   *      sessionStorage，可被重放（這正是現行兩頁與此元件的測試釘住的行為）。
   *   2. 有 ?error= → 直接顯示錯誤，不看 state 比對結果、不呼叫後端。
   *   3. state 通過才用 ?code= 呼叫 authStore.loginWithGoogle()——內部走跟
   *      login()/register() 完全相同的 applySession（token 儲存 + authStore
   *      更新）路徑，不重造第二套邏輯。
   *   4. 成功 goto(successPath)；任何一步失敗都停在這頁顯示繁中錯誤 + 回登入頁
   *      （loginPath）連結。
   * 只在 onMount 執行（client-only）：sessionStorage/authStore 呼叫在 SSR 沒有
   * 意義，也不該在伺服器端執行。
   *
   * mobile 路由自此零 member/auth import：consumeGoogleOauthState 這裡直取
   * $lib/member/google-oauth 的實作單源。本檔位於 src/lib/components/，在 ADR
   * 0014 mobile 接縫掃描（只掃 src/lib/mobile、src/routes/mobile 兩目錄）範圍
   * 之外，不必再繞 $lib/mobile/auth 接縫轉手。$lib/mobile/auth.ts 本身依 ADR
   * 0014 枚舉保留不動——mobile 登入頁的 startGoogleLogin/isGoogleLoginEnabled
   * 仍照舊經那裡取用，其 identity pin 測試不受影響。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/authStore';
  import { consumeGoogleOauthState } from '$lib/member/google-oauth';

  export let successPath: string;
  export let loginPath: string;

  let error = '';

  onMount(async () => {
    const params = $page.url.searchParams;
    // Always consume (clear) the stashed state first — one-time use whether
    // or not this callback turns out to carry ?error=, so a cancelled/failed
    // attempt can't leave a replayable value behind.
    const stateOk = consumeGoogleOauthState(params.get('state'));

    if (params.has('error')) {
      error = 'Google 登入已取消或失敗，請重新嘗試';
      return;
    }
    const code = stateOk ? params.get('code') : null;
    if (!code) {
      error = '登入驗證失敗，請重新嘗試';
      return;
    }
    try {
      await authStore.loginWithGoogle(code);
      goto(successPath);
    } catch {
      error = 'Google 登入失敗，請稍後再試';
    }
  });
</script>

<div
  style="display:flex; min-height:100vh; align-items:center; justify-content:center; background:#fff;"
>
  <div
    style="width:100%; max-width:384px; display:flex; flex-direction:column;
      align-items:center; gap:16px; padding:48px 24px; text-align:center;"
  >
    <div
      style="width:52px; height:52px; border-radius:999px; background:var(--df-primary);
        display:flex; align-items:center; justify-content:center;
        font-family:var(--df-font-heading); font-size:19px; font-weight:700; color:#fff;
        box-shadow:0 8px 18px -4px rgba(0,102,204,.5);"
    >
      DF
    </div>

    {#if error}
      <p style="margin:0; font-size:14px; font-weight:600; color:var(--df-error);">{error}</p>
      <a href={loginPath} style="color:var(--df-primary); text-decoration:none; font-weight:600;">
        回到登入頁
      </a>
    {:else}
      <p style="margin:0; font-size:14px; color:var(--df-text-light);">正在使用 Google 登入…</p>
    {/if}
  </div>
</div>
