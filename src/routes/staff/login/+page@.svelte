<script lang="ts">
  /* 員工後台登入 Staff Login — real credentials via authStore, then route by
   * role: staffPortals(roles) decides the destination (admin → /admin,
   * coach-only → /coach); no staff role blocks with 此帳號無後台權限.
   * `+page@.svelte` resets to the ROOT layout (full-screen). The root layout
   * already bypasses marketing chrome for /staff routes.
   * Legacy Svelte (no runes). Traditional Chinese copy. */
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Button, Checkbox, Icon } from '$lib/components/ui';
  import { authStore } from '$lib/stores/authStore';
  import { staffPortals, wantsBlockedNotice, ROLE_HOME } from '$lib/staff/roles';
  import { submitLogin } from '$lib/login-submit';

  let account = '';
  let pw = '';
  let show = false;
  let rememberMe = true;
  let busy = false;
  let error = '';

  /* per-field focus rings */
  let accountFocus = false;
  let pwFocus = false;

  // Bounced back by the admin/coach layout guard (?blocked=1) because the
  // logged-in visitor lacked the portal's role — show the same no-access
  // message a failed post-login role check below would show.
  $: if (wantsBlockedNotice($page.url)) {
    error = '此帳號無後台權限';
  }

  async function submit() {
    await submitLogin({
      busy: () => busy,
      setBusy: (b) => (busy = b),
      setError: (msg) => (error = msg),
      fields: [account, pw],
      login: () => authStore.login(account, pw),
      resolveTarget: () => {
        const target = staffPortals($authStore.roles)[0];
        return target ? ROLE_HOME[target] : null;
      },
      onNoAccess: () => authStore.logout(),
      navigate: goto
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<!-- ═══════════════ decorative blurred-blob backdrop ═══════════════ -->
<div class="page-root">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="center-wrap">
    <div class="card">

      <!-- brand lockup -->
      <div class="brand-lockup">
        <img src="/logo-df-monogram.png" alt="Dream Fly" class="brand-logo" />
        <div class="brand-name">Dream Fly 夢飛</div>
        <div class="brand-kicker">STAFF PORTAL · 員工後台</div>
      </div>

      <div class="divider-line"></div>

      <!-- heading -->
      <div class="heading-block">
        <h1 class="heading">登入帳號</h1>
        <p class="subheading">請使用您的教練 / 管理員帳號登入</p>
      </div>

      <!-- error banner -->
      {#if error}
        <div class="error-banner">
          <Icon name="circle-alert" size={16} color="var(--df-error)" />
          <span>{error}</span>
        </div>
      {/if}

      <!-- fields -->
      <div class="fields">
        <!-- 帳號 -->
        <div class="field-group">
          <label for="staff-account" class="field-label">帳號</label>
          <div class="field-box" class:focus={accountFocus}>
            <Icon name="user" size={17} color="var(--df-text-muted)" />
            <input
              id="staff-account"
              type="text"
              bind:value={account}
              placeholder="請輸入員工帳號"
              on:focus={() => (accountFocus = true)}
              on:blur={() => (accountFocus = false)}
              on:keydown={onKey}
              style="flex:1; border:none; outline:none; background:transparent;
                font-size:14px; font-family:var(--df-font-body);
                color:var(--df-text-dark); min-width:0;"
            />
          </div>
        </div>

        <!-- 密碼 -->
        <div class="field-group">
          <label for="staff-pw" class="field-label">密碼</label>
          <div class="field-box" class:focus={pwFocus}>
            <Icon name="lock" size={17} color="var(--df-text-muted)" />
            <input
              id="staff-pw"
              type={show ? 'text' : 'password'}
              bind:value={pw}
              placeholder="請輸入密碼"
              on:focus={() => (pwFocus = true)}
              on:blur={() => (pwFocus = false)}
              on:keydown={onKey}
              style="flex:1; border:none; outline:none; background:transparent;
                font-size:14px; font-family:var(--df-font-body);
                color:var(--df-text-dark); min-width:0;"
            />
            <button
              type="button"
              aria-label={show ? '隱藏密碼' : '顯示密碼'}
              on:click={() => (show = !show)}
              style="border:none; background:transparent; cursor:pointer; padding:0;
                display:inline-flex; color:var(--df-text-muted);"
            >
              <Icon name={show ? 'eye' : 'eye-off'} size={17} />
            </button>
          </div>
        </div>

        <!-- 記住我 + 忘記密碼 -->
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <Checkbox label="記住我" bind:checked={rememberMe} />
          <a
            href="/staff/login"
            on:click|preventDefault
            style="font-size:13px; color:var(--df-primary); text-decoration:none; font-weight:500;"
          >
            忘記密碼？
          </a>
        </div>

        <!-- 登入 button -->
        <Button variant="primary" size="lg" fullWidth disabled={busy} on:click={submit}>
          {busy ? '登入中…' : '登入'}
        </Button>
      </div>

      <!-- footer -->
      <div class="card-foot">
        <a
          href="/staff/login"
          on:click|preventDefault
          style="font-size:12.5px; color:var(--df-text-muted); text-decoration:none;"
        >
          聯絡系統管理員
        </a>
        <span style="color:var(--df-border-strong); font-size:12px;">·</span>
        <a
          href="/member/login"
          style="font-size:12.5px; color:var(--df-primary); text-decoration:none; font-weight:500;"
        >
          我是學員 / 家長，前往會員登入
        </a>
      </div>

    </div>
  </div>
</div>

<style>
  /* ── page shell ── */
  .page-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--df-bg-light);
    position: relative;
    overflow: hidden;
  }

  /* ── blurred decorative blobs (backdrop) ── */
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.55;
    pointer-events: none;
  }
  .blob-1 {
    width: 420px;
    height: 420px;
    background: rgba(0, 102, 204, 0.18);
    top: -80px;
    left: -100px;
  }
  .blob-2 {
    width: 360px;
    height: 360px;
    background: rgba(246, 173, 30, 0.22);
    bottom: -60px;
    right: -80px;
  }
  .blob-3 {
    width: 260px;
    height: 260px;
    background: rgba(0, 179, 120, 0.14);
    top: 50%;
    left: 55%;
    transform: translate(-50%, -50%);
  }

  /* ── centred card wrapper ── */
  .center-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 440px;
    padding: 24px 16px;
  }

  /* ── white card ── */
  .card {
    background: #fff;
    border-radius: 18px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.07),
      0 12px 40px -8px rgba(0, 0, 0, 0.13);
    padding: 40px 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* ── brand lockup ── */
  .brand-lockup {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .brand-logo {
    height: 44px;
    width: auto;
    display: block;
    margin-bottom: 4px;
  }
  .brand-name {
    font-family: var(--df-font-heading);
    font-size: 22px;
    font-weight: 800;
    color: var(--df-ink);
    letter-spacing: -0.3px;
  }
  .brand-kicker {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1.6px;
    color: var(--df-primary);
    background: var(--df-primary-bg);
    padding: 3px 10px;
    border-radius: 999px;
  }

  .divider-line {
    height: 1px;
    background: var(--df-border);
  }

  /* ── heading ── */
  .heading-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .heading {
    margin: 0;
    font-family: var(--df-font-heading);
    font-size: 22px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .subheading {
    margin: 0;
    font-size: 13.5px;
    color: var(--df-text-light);
  }

  /* ── error banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--df-radius-md);
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    font-size: 13px;
    color: var(--df-error);
    font-weight: 500;
  }

  /* ── fields container ── */
  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── field group (label + box) ── */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--df-text-dark);
  }

  /* ── icon-leading input box ── */
  .field-box {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 14px;
    border-radius: var(--df-radius-md);
    background: #fff;
    border: 1.5px solid var(--df-border-strong);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }
  .field-box.focus {
    border-color: var(--df-primary);
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.18);
  }

  /* ── card footer ── */
  .card-foot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
    padding-top: 4px;
  }

  /* ── responsive ── */
  @media (max-width: 600px) {
    .card {
      padding: 32px 22px 26px;
    }
  }
</style>
