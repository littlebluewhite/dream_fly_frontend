<script lang="ts">
  /* 行動版後台 · 員工登入（全螢幕）。Task 20：從示範性的「選身分卡片 + 假帳密展示」
   * 改為真 staff 登入——比照 desktop src/routes/staff/login 的角色判定路徑：
   * authStore.login() 打真 POST /auth/login，成功後以 staffPortals(角色) 決定
   * 進 admin 或 coach 分區(第一個可進入的角色優先，同桌面)；沒有任何後台角色
   * 一律顯示「此帳號無後台權限」並登出，不留在已登入但無處可去的狀態。
   * `+page@.svelte` 重置回 ROOT layout 取得全螢幕，繞過 /mobile-admin/+layout 外殼。
   * 保留原型的深色漸層背景與品牌 lockup 視覺，僅將互動內容換成真實帳密表單。 */
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { authStore } from '$lib/stores/authStore';
  import { staffPortals, wantsBlockedNotice } from '$lib/staff/roles';
  import { adminPath } from '$lib/mobile-admin/nav';
  import { submitLogin } from '$lib/login-submit';
  import '$lib/styles/mobile-frame.css';

  let account = '';
  let pw = '';
  let show = false;
  let busy = false;
  let error = '';

  // Bounced back by the mobile-admin layout guard (?blocked=1) because the
  // logged-in visitor lacked a staff portal role — show the same no-access
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
        return target ? adminPath(target, target === 'admin' ? 'home' : 'today') : null;
      },
      onNoAccess: () => authStore.logout(),
      navigate: goto
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <div class="login-bg">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="m-top-inset"></div>
        <div class="df-scroll" style="position:relative;">
          <div class="login-content">
            <!-- brand lockup -->
            <div class="brand-row">
              <div class="brand-mark">
                <img src="/logo-df-monogram.png" alt="Dream Fly" style="width:100%; height:100%; object-fit:contain;" />
              </div>
              <div>
                <div class="brand-name">Dream Fly</div>
                <div class="brand-kicker">夢飛 · 行動後台</div>
              </div>
            </div>

            <!-- heading -->
            <div class="heading-block">
              <h1 class="heading">員工登入</h1>
              <p class="subheading">請使用您的教練 / 管理員帳號登入</p>
            </div>

            <!-- error banner -->
            {#if error}
              <div class="error-banner">
                <Icon name="circle-alert" size={16} color="#fff" />
                <span>{error}</span>
              </div>
            {/if}

            <!-- fields -->
            <div class="fields">
              <div class="field-group">
                <label for="madmin-account" class="field-label">帳號</label>
                <div class="field-box">
                  <Icon name="user" size={17} color="rgba(255,255,255,0.7)" />
                  <input
                    id="madmin-account"
                    type="text"
                    bind:value={account}
                    placeholder="請輸入員工帳號"
                    on:keydown={onKey}
                    class="field-input"
                  />
                </div>
              </div>

              <div class="field-group">
                <label for="madmin-pw" class="field-label">密碼</label>
                <div class="field-box">
                  <Icon name="lock" size={17} color="rgba(255,255,255,0.7)" />
                  <input
                    id="madmin-pw"
                    type={show ? 'text' : 'password'}
                    bind:value={pw}
                    placeholder="請輸入密碼"
                    on:keydown={onKey}
                    class="field-input"
                  />
                  <button
                    type="button"
                    aria-label={show ? '隱藏密碼' : '顯示密碼'}
                    on:click={() => (show = !show)}
                    style="border:none; background:transparent; cursor:pointer; padding:0; display:inline-flex; color:rgba(255,255,255,0.7);"
                  >
                    <Icon name={show ? 'eye' : 'eye-off'} size={17} />
                  </button>
                </div>
              </div>
            </div>

            <div style="flex:1; min-height:18px;"></div>
            <button
              on:click={submit}
              class="df-tapscale"
              disabled={busy}
              style="width:100%; height:52px; border-radius:14px; border:none; background:var(--df-accent);
                color:var(--df-ink); font-size:16px; font-weight:800; cursor:pointer; display:flex;
                align-items:center; justify-content:center; gap:8px; font-family:var(--df-font-body); margin-top:18px;"
            >
              {busy ? '登入中…' : '登入後台'}
              {#if !busy}<Icon name="arrow-right" size={19} color="var(--df-ink)" />{/if}
            </button>
            <a href="/mobile" class="member-link">我是家長 / 學員 → 前往會員 App</a>
            <div style="height:10px;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .login-bg {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, var(--df-ink) 0%, var(--df-primary-dark) 80%);
    color: #fff;
    position: relative;
    overflow: hidden;
  }
  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
  }
  .blob-1 {
    top: -50px;
    right: -40px;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.16), transparent 70%);
  }
  .blob-2 {
    bottom: -60px;
    left: -50px;
    width: 220px;
    height: 220px;
    background: radial-gradient(circle, rgba(0, 179, 120, 0.14), transparent 70%);
  }
  .login-content {
    padding: 30px 24px 24px;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    position: relative;
  }
  .brand-row {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-top: 8px;
  }
  .brand-mark {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px;
    flex: none;
  }
  .brand-name {
    font-weight: 800;
    font-size: 19px;
    font-family: var(--df-font-heading);
  }
  .brand-kicker {
    font-size: 11px;
    letter-spacing: 2px;
    opacity: 0.7;
    font-weight: 600;
  }
  .heading-block {
    margin-top: 40px;
  }
  .heading {
    margin: 0;
    font-size: 25px;
    font-weight: 800;
    font-family: var(--df-font-heading);
  }
  .subheading {
    margin: 10px 0 0;
    font-size: 14px;
    opacity: 0.8;
    line-height: 1.6;
  }
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 14px;
    border-radius: var(--df-radius-md);
    background: rgba(239, 68, 68, 0.22);
    border: 1px solid rgba(239, 68, 68, 0.4);
    font-size: 13px;
    font-weight: 500;
    margin-top: 20px;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 22px;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label {
    font-size: 12.5px;
    opacity: 0.78;
  }
  .field-box {
    display: flex;
    align-items: center;
    gap: 9px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 11px;
    padding: 0 14px;
    height: 48px;
  }
  .field-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14.5px;
    font-family: var(--df-font-body);
    color: #fff;
    min-width: 0;
  }
  .field-input::placeholder {
    color: rgba(255, 255, 255, 0.45);
  }
  .member-link {
    text-align: center;
    margin-top: 16px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
  }
</style>
