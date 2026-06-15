<script lang="ts">
  /* 員工後台登入 Staff Login — CredentialsStep → RolePortal.
   * `+page@.svelte` resets to the ROOT layout (full-screen). The root layout
   * already bypasses marketing chrome for /staff routes.
   * Legacy Svelte (no runes). Traditional Chinese copy. */
  import { goto } from '$app/navigation';
  import { Button, Checkbox, Icon, Avatar } from '$lib/components/ui';

  /* ─── Step 1: Credentials ─── */
  let account = '';
  let pw = '';
  let show = false;
  let rememberMe = true;
  let busy = false;
  let error = '';

  /* per-field focus rings */
  let accountFocus = false;
  let pwFocus = false;

  /* ─── Step 2: Role Portal ─── */
  let authed = false;
  let rememberRole = true;

  function submit() {
    if (busy) return;
    if (!account.trim() || !pw.trim()) {
      error = '請輸入帳號與密碼';
      return;
    }
    error = '';
    busy = true;
    setTimeout(() => {
      authed = true;
      busy = false;
    }, 600);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  const ROLES = [
    {
      key: 'admin',
      icon: 'layout-dashboard',
      title: '管理後台',
      accent: 'var(--df-primary)',
      accentBg: 'var(--df-primary-bg)',
      chips: ['平台設定', '會員管理', '課程管理', '財務報表'],
      btnLabel: '進入後台',
      href: '/admin'
    },
    {
      key: 'coach',
      icon: 'graduation-cap',
      title: '教練工作台',
      accent: 'var(--df-accent)',
      accentBg: 'rgba(246,173,30,0.10)',
      chips: ['班級管理', '學員出勤', '我的課表', '學員訊息'],
      btnLabel: '進入工作台',
      href: '/coach'
    }
  ] as const;

  function enter(key: 'admin' | 'coach') {
    try {
      if (rememberRole) {
        localStorage.setItem('df_staff_last_role', key);
      } else {
        localStorage.removeItem('df_staff_last_role');
      }
    } catch (_) {}
    const role = ROLES.find((r) => r.key === key)!;
    goto(role.href);
  }
</script>

<!-- ═══════════════ decorative blurred-blob backdrop ═══════════════ -->
<div class="page-root">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <!-- ════════════════════ STEP 1: CREDENTIALS ════════════════════ -->
  {#if !authed}
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

  <!-- ════════════════════ STEP 2: ROLE PORTAL ════════════════════ -->
  {:else}
    <div
      style="min-height:100vh; display:flex; flex-direction:column; position:relative; z-index:1;"
    >
      <!-- header bar -->
      <header
        style="display:flex; align-items:center; gap:12px; padding:20px 40px;
          border-bottom:1px solid var(--df-border); background:rgba(255,255,255,0.72);
          backdrop-filter:blur(12px); position:sticky; top:0; z-index:10;"
      >
        <Avatar name="陳" size="md" color="var(--df-primary)" />
        <div style="line-height:1.25; flex:1;">
          <div
            style="font-size:11px; font-weight:500; letter-spacing:0.8px;
              color:var(--df-text-light);"
          >歡迎回來</div>
          <div
            style="font-size:15px; font-weight:700; color:var(--df-ink);"
          >陳教練</div>
        </div>
        <!-- facility pill -->
        <div
          style="display:inline-flex; align-items:center; gap:6px; padding:5px 12px;
            border-radius:999px; background:var(--df-bg-light); border:1px solid var(--df-border);
            font-size:12px; font-weight:600; color:var(--df-text-dark);"
        >
          <Icon name="map-pin" size={12} color="var(--df-text-muted)" />
          Dream Fly 夢飛體操館
        </div>
        <button
          type="button"
          on:click={() => { authed = false; account = ''; pw = ''; error = ''; }}
          style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px;
            border-radius:var(--df-radius-md); border:1.5px solid var(--df-border-strong);
            background:#fff; cursor:pointer; font-size:13px; font-weight:600;
            color:var(--df-text-dark); font-family:var(--df-font-body);"
        >
          <Icon name="log-out" size={14} color="var(--df-text-light)" />
          退出登入
        </button>
      </header>

      <!-- hero -->
      <div
        style="flex:1; display:flex; flex-direction:column; align-items:center;
          justify-content:flex-start; padding:56px 24px 48px;"
      >
        <div
          style="text-align:center; margin-bottom:8px; display:inline-flex;
            align-items:center; justify-content:center; width:56px; height:56px;
            border-radius:999px; background:var(--df-primary-bg);"
        >
          <Icon name="shield-check" size={28} color="var(--df-primary)" />
        </div>
        <h1
          style="margin:16px 0 8px; font-family:var(--df-font-heading); font-size:28px;
            font-weight:700; color:var(--df-ink); text-align:center;"
        >
          登入成功
        </h1>
        <p
          style="margin:0 0 28px; font-size:17px; color:var(--df-text-dark); text-align:center;"
        >
          陳教練，歡迎回來 👋
        </p>

        <!-- remember role checkbox -->
        <div style="margin-bottom:32px;">
          <Checkbox label="記住我的選擇" bind:checked={rememberRole} />
        </div>

        <!-- role cards -->
        <div class="role-grid">
          {#each ROLES as role}
            <div class="role-card" style="--rc-accent:{role.accent}; --rc-accent-bg:{role.accentBg};">
              <div class="role-icon-wrap">
                <Icon name={role.icon} size={28} color={role.accent} />
              </div>
              <div class="role-title">{role.title}</div>
              <div class="role-chips">
                {#each role.chips as chip}
                  <span class="role-chip">{chip}</span>
                {/each}
              </div>
              <Button
                variant={role.key === 'admin' ? 'primary' : 'accent'}
                size="md"
                fullWidth
                on:click={() => enter(role.key)}
              >
                {role.btnLabel}
              </Button>
            </div>
          {/each}
        </div>

      </div>
    </div>
  {/if}
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

  /* ── role cards grid ── */
  .role-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    width: 100%;
    max-width: 680px;
  }
  .role-card {
    background: #fff;
    border-radius: 16px;
    border: 1.5px solid var(--df-border);
    padding: 28px 22px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 2px 12px -4px rgba(0, 0, 0, 0.08);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .role-card:hover {
    border-color: var(--rc-accent);
    box-shadow: 0 4px 24px -6px rgba(0, 0, 0, 0.14);
  }
  .role-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: var(--rc-accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .role-title {
    font-family: var(--df-font-heading);
    font-size: 18px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .role-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .role-chip {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--rc-accent-bg);
    color: var(--rc-accent);
    font-size: 11.5px;
    font-weight: 600;
    border: 1px solid var(--rc-accent);
    opacity: 0.85;
  }

  /* ── responsive ── */
  @media (max-width: 600px) {
    .card {
      padding: 32px 22px 26px;
    }
    .role-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
