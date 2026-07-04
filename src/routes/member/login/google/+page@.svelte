<script lang="ts">
  /* Google OAuth callback（member 登入，authorization-code redirect 流程，
   * Task 9）。`+page@.svelte` resets to the ROOT layout — same as
   * ../+page@.svelte — so this renders full-screen without the member
   * sidebar/topbar shell.
   *
   * Google 帶使用者從 ../+page@.svelte 的「使用 Google 登入」按鈕導到
   * accounts.google.com、同意後導回這裡，帶 `?code=`&`?state=`（使用者取消或
   * 失敗則帶 `?error=`，見 onMount 底下的分支）。流程：
   *   1. 有 ?error= → 直接顯示錯誤，不驗 state、不呼叫後端。
   *   2. 驗證 ?state= 是否等於導向前存在 sessionStorage 的值（CSRF 防護，見
   *      $lib/member/google-oauth 的 consumeGoogleOauthState——無論比對成功
   *      或失敗都會清除，一次性使用，不能被重放）。
   *   3. state 通過才用 ?code= 呼叫 authStore.loginWithGoogle()——內部走跟
   *      login()/register() 完全相同的 applySession（token 儲存 + authStore
   *      更新）路徑，不重造第二套邏輯。
   *   4. 成功導回會員首頁；任何一步失敗都停在這頁顯示繁中錯誤 + 回登入頁連結。
   * 只在 onMount 執行（client-only）：sessionStorage/authStore 呼叫在 SSR
   * 沒有意義，也不該在伺服器端執行。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/authStore';
  import { consumeGoogleOauthState } from '$lib/member/google-oauth';

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
      goto('/member');
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
      <a href="/member/login" style="color:var(--df-primary); text-decoration:none; font-weight:600;">
        回到登入頁
      </a>
    {:else}
      <p style="margin:0; font-size:14px; color:var(--df-text-light);">正在使用 Google 登入…</p>
    {/if}
  </div>
</div>
