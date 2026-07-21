<script lang="ts">
  /* 會員登入 Member Login. Ported from the prototype (client/login.jsx +
   * login.html), now wired to the real backend instead of the fake social
   * login it launched with. The `+page@.svelte` filename resets to the ROOT
   * layout, so this renders full-screen without the member sidebar/topbar
   * shell. The prototype's custom Field (icon input + password toggle) isn't
   * in the foundation, so it's inline markup here. Button / Checkbox / Icon
   * come from the shared foundation.
   *
   * Task 9: the Google button is back, this time wired for real — an
   * authorization-code redirect (not the fake social-login stub the
   * prototype had, and not a Google Identity Services popup). Progressive
   * enhancement: no VITE_GOOGLE_CLIENT_ID configured → no button, the
   * password flow above works unchanged. See $lib/member/google-oauth for
   * the redirect URL construction + CSRF `state` handling, and the callback
   * route at ./google/+page@.svelte for the return leg. LINE stays out
   * (never wired — out of this task's scope). */
  import { Button, Checkbox, Icon } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/authStore';
  import { safeRedirect } from '$lib/checkout-gate';
  import { submitLogin } from '$lib/login-submit';
  import { isGoogleLoginEnabled, startGoogleLogin } from '$lib/member/google-oauth';

  const googleEnabled = isGoogleLoginEnabled();

  /* full-bleed gym photography under a navy gradient (DS hero pattern) */
  const HERO_IMG =
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1400&q=80';

  let email = '';
  let pw = '';
  let show = false;
  let remember = true;
  let busy = false;
  let error = '';

  /* per-field focus → blue focus ring, matching the prototype's Field state */
  let emailFocus = false;
  let pwFocus = false;

  async function submit() {
    await submitLogin({
      busy: () => busy,
      setBusy: (b) => (busy = b),
      setError: (msg) => (error = msg),
      login: () => authStore.login(email, pw),
      resolveTarget: () => safeRedirect($page.url.searchParams.get('redirect')),
      navigate: goto
    });
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };
</script>

<div style="display:flex; min-height:100vh; background:#fff;">
  <!-- ---- Left: brand / photography ---- -->
  <div
    class="hero-pane"
    style="position:relative; flex:1 1 0; min-width:0; display:flex;
      background-image:url({HERO_IMG}); background-size:cover; background-position:center;"
  >
    <div
      style="position:absolute; inset:0;
        background:linear-gradient(160deg, rgba(15,23,42,.86) 0%, rgba(15,23,42,.55) 48%, rgba(15,23,42,.30) 100%);"
    ></div>
    <div
      style="position:relative; margin-top:auto; padding:0 56px 64px;
        display:flex; flex-direction:column; gap:16px; max-width:520px;"
    >
      <img
        src="/logo-wolfclaw-full.png"
        alt="Dream Fly"
        style="width:132px; height:auto; margin-bottom:4px;"
      />
      <div
        style="font-family:var(--df-font-heading); font-size:40px; font-weight:700;
          color:#fff; letter-spacing:-0.5px; line-height:1.15;"
      >
        翻轉人生，<br />從這一躍開始
      </div>
      <div style="font-size:16px; font-weight:600; color:var(--df-accent);">
        Dream Fly 夢飛體操館
      </div>
      <p style="margin:0; font-size:14px; line-height:1.8; color:rgba(255,255,255,.82);">
        台灣專業的體操訓練中心。<br />加入我們，開啟孩子的體操之旅。
      </p>
    </div>
  </div>

  <!-- ---- Right: form panel ---- -->
  <div
    class="form-pane"
    style="flex:0 0 520px; max-width:100%; display:flex; flex-direction:column;
      justify-content:center; align-items:center; padding:48px 56px;"
  >
    <div style="width:100%; max-width:384px; display:flex; flex-direction:column; gap:24px;">
      <!-- head -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
        <div
          style="width:52px; height:52px; border-radius:999px; background:var(--df-primary);
            display:flex; align-items:center; justify-content:center;
            font-family:var(--df-font-heading); font-size:19px; font-weight:700; color:#fff;
            box-shadow:0 8px 18px -4px rgba(0,102,204,.5);"
        >
          DF
        </div>
        <h1
          style="margin:4px 0 0; font-family:var(--df-font-heading); font-size:28px;
            font-weight:700; color:var(--df-ink);"
        >
          登入帳號
        </h1>
        <p style="margin:0; font-size:14px; color:var(--df-text-light);">
          歡迎回來！請輸入您的帳號密碼
        </p>
      </div>

      <!-- fields -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- 電子信箱 -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label
            for="login-email"
            style="font-size:13px; font-weight:600; color:var(--df-text-dark);"
          >
            電子信箱
          </label>
          <div
            class="field-box"
            class:focus={emailFocus}
            style="display:flex; align-items:center; gap:10px; height:48px; padding:0 16px;
              border-radius:var(--df-radius-md); background:#fff;"
          >
            <Icon name="mail" size={18} color="var(--df-text-muted)" />
            <input
              id="login-email"
              type="email"
              bind:value={email}
              placeholder="your@email.com"
              on:keydown={onKey}
              on:focus={() => (emailFocus = true)}
              on:blur={() => (emailFocus = false)}
              style="flex:1; border:none; outline:none; background:transparent; font-size:14px;
                font-family:var(--df-font-body); color:var(--df-text-dark); min-width:0;"
            />
          </div>
        </div>

        <!-- 密碼 -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label
            for="login-pw"
            style="font-size:13px; font-weight:600; color:var(--df-text-dark);"
          >
            密碼
          </label>
          <div
            class="field-box"
            class:focus={pwFocus}
            style="display:flex; align-items:center; gap:10px; height:48px; padding:0 16px;
              border-radius:var(--df-radius-md); background:#fff;"
          >
            <Icon name="lock" size={18} color="var(--df-text-muted)" />
            <input
              id="login-pw"
              type={show ? 'text' : 'password'}
              bind:value={pw}
              placeholder="請輸入密碼"
              on:keydown={onKey}
              on:focus={() => (pwFocus = true)}
              on:blur={() => (pwFocus = false)}
              style="flex:1; border:none; outline:none; background:transparent; font-size:14px;
                font-family:var(--df-font-body); color:var(--df-text-dark); min-width:0;"
            />
            <button
              type="button"
              aria-label={show ? '隱藏密碼' : '顯示密碼'}
              on:click={() => (show = !show)}
              style="border:none; background:transparent; cursor:pointer; padding:0;
                display:inline-flex; color:var(--df-text-muted);"
            >
              <Icon name={show ? 'eye' : 'eye-off'} size={18} />
            </button>
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between;">
          <Checkbox
            label="記住我"
            bind:checked={remember}
            style="font-size:13px; color:var(--df-text-light);"
          />
          <a
            href="/member/forgot-password"
            style="font-size:13px; color:var(--df-primary); text-decoration:none; font-weight:500;"
          >
            忘記密碼？
          </a>
        </div>

        {#if error}
          <p style="margin:0; font-size:13px; font-weight:600; color:var(--df-error);">{error}</p>
        {/if}

        <Button variant="primary" size="lg" fullWidth disabled={busy} on:click={submit}>
          {busy ? '登入中…' : '登入'}
        </Button>

        {#if googleEnabled}
          <!-- divider -->
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="flex:1; height:1px; background:var(--df-border);"></div>
            <span style="font-size:13px; color:var(--df-text-light);">或</span>
            <div style="flex:1; height:1px; background:var(--df-border);"></div>
          </div>

          <!-- Google（authorization-code redirect — 見 $lib/member/google-oauth） -->
          <button
            type="button"
            class="social-btn"
            aria-label="使用 Google 登入"
            on:click={() => startGoogleLogin()}
            style="height:48px; display:inline-flex; align-items:center;
              justify-content:center; gap:8px; border-radius:var(--df-radius-md); cursor:pointer;
              font-size:14px; font-weight:600; font-family:var(--df-font-body);
              background:#fff; color:var(--df-text-dark); border:1.5px solid var(--df-border-strong);"
          >
            <span style="font-family:var(--df-font-heading); font-weight:700; font-size:15px;">G</span>
            使用 Google 登入
          </button>
        {/if}
      </div>

      <!-- footer -->
      <div style="text-align:center; font-size:13px; color:var(--df-text-light);">
        還沒有帳號？<a
          href="/member/register"
          style="color:var(--df-primary); text-decoration:none; font-weight:600; margin-left:4px;"
        >
          立即註冊
        </a>
      </div>
      <div style="text-align:center;">
        <a
          href="/staff/login"
          style="display:inline-flex; align-items:center; gap:6px; font-size:13px;
            color:var(--df-text-muted); text-decoration:none;"
        >
          <Icon name="shield-check" size={14} /> 教練 / 管理員登入
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  /* icon-leading field box: 1.5px border, blue focus ring (prototype Field) */
  .field-box {
    border: 1.5px solid var(--df-border-strong);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .field-box.focus {
    border-color: var(--df-primary);
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.18);
  }
  .social-btn {
    transition: filter 0.15s ease;
  }
  .social-btn:hover {
    filter: brightness(0.96);
  }
  /* responsive: drop the photo pane on narrow viewports */
  @media (max-width: 860px) {
    .hero-pane {
      display: none;
    }
    .form-pane {
      flex: 1 1 auto;
    }
  }
</style>
