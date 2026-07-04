<script lang="ts">
  /* 會員註冊 Member Register — same split-screen shell as the login page
   * (see src/routes/member/login/+page@.svelte). `+page@.svelte` resets to the
   * ROOT layout, so this renders full-screen without the member sidebar/topbar
   * shell. Button / Icon come from the shared foundation. */
  import { Button, Icon } from '$lib/components/ui';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/authStore';
  import { safeRedirect } from '$lib/checkout-gate';

  /* full-bleed gym photography under a navy gradient (DS hero pattern) */
  const HERO_IMG =
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1400&q=80';

  let name = '';
  let email = '';
  let pw = '';
  let show = false;
  let busy = false;
  let error = '';

  /* per-field focus → blue focus ring, matching the login page's Field state */
  let nameFocus = false;
  let emailFocus = false;
  let pwFocus = false;

  async function submit() {
    if (busy) return;
    error = '';
    busy = true;
    try {
      await authStore.register(name, email, pw);
      goto(safeRedirect($page.url.searchParams.get('redirect')));
    } catch {
      error = '註冊失敗，請確認資料或稍後再試';
    } finally {
      busy = false;
    }
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
          建立帳號
        </h1>
        <p style="margin:0; font-size:14px; color:var(--df-text-light);">
          加入 Dream Fly，開始你的體操之旅
        </p>
      </div>

      <!-- fields -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- 姓名 -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label
            for="register-name"
            style="font-size:13px; font-weight:600; color:var(--df-text-dark);"
          >
            姓名
          </label>
          <div
            class="field-box"
            class:focus={nameFocus}
            style="display:flex; align-items:center; gap:10px; height:48px; padding:0 16px;
              border-radius:var(--df-radius-md); background:#fff;"
          >
            <Icon name="user" size={18} color="var(--df-text-muted)" />
            <input
              id="register-name"
              type="text"
              bind:value={name}
              placeholder="您的姓名"
              minlength="2"
              maxlength="100"
              on:keydown={onKey}
              on:focus={() => (nameFocus = true)}
              on:blur={() => (nameFocus = false)}
              style="flex:1; border:none; outline:none; background:transparent; font-size:14px;
                font-family:var(--df-font-body); color:var(--df-text-dark); min-width:0;"
            />
          </div>
        </div>

        <!-- 電子信箱 -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label
            for="register-email"
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
              id="register-email"
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
            for="register-pw"
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
              id="register-pw"
              type={show ? 'text' : 'password'}
              bind:value={pw}
              placeholder="至少 8 個字元"
              minlength="8"
              maxlength="128"
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

        {#if error}
          <p style="margin:0; font-size:13px; font-weight:600; color:var(--df-error);">{error}</p>
        {/if}

        <Button variant="primary" size="lg" fullWidth disabled={busy} on:click={submit}>
          {busy ? '註冊中…' : '註冊'}
        </Button>
      </div>

      <!-- footer -->
      <div style="text-align:center; font-size:13px; color:var(--df-text-light);">
        已經有帳號？<a
          href="/member/login"
          style="color:var(--df-primary); text-decoration:none; font-weight:600; margin-left:4px;"
        >
          前往登入
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
