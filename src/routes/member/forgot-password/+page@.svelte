<script lang="ts">
  /* 忘記密碼 Forgot Password — same split-screen shell as the login page (see
   * src/routes/member/login/+page@.svelte). `+page@.svelte` resets to the ROOT
   * layout, so this renders full-screen without the member sidebar/topbar
   * shell. Always shows the same neutral outcome regardless of whether the
   * email exists or the request even succeeded — the backend's anti-
   * enumeration response (POST /auth/password/forgot) already never reveals
   * that, so the page mirrors it rather than adding its own "email not found"
   * branch (see docs/api/integration-contract.md §3.1). */
  import { Button, Icon } from '$lib/components/ui';
  import { api } from '$lib/api/client';

  /* full-bleed gym photography under a navy gradient (DS hero pattern) */
  const HERO_IMG =
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=1400&q=80';

  let email = '';
  let busy = false;
  let submitted = false;

  async function submit() {
    if (busy) return;
    busy = true;
    try {
      await api('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
        auth: false
      });
    } catch {
      // Anti-enumeration: show the same neutral message no matter the outcome.
    } finally {
      busy = false;
      submitted = true;
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
          忘記密碼
        </h1>
        <p style="margin:0; font-size:14px; color:var(--df-text-light); text-align:center;">
          請輸入註冊時使用的 Email，我們將寄送重設密碼連結
        </p>
      </div>

      {#if submitted}
        <p style="margin:0; font-size:14px; line-height:1.7; color:var(--df-text-dark); text-align:center;">
          若該 Email 為已註冊帳號，我們已寄出密碼重設連結，請至信箱查收（連結 15 分鐘內有效）。
        </p>
        <div style="text-align:center;">
          <a
            href="/member/login"
            style="color:var(--df-primary); text-decoration:none; font-weight:600;"
          >
            返回登入
          </a>
        </div>
      {:else}
        <!-- fields -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- 電子信箱 -->
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label
              for="forgot-email"
              style="font-size:13px; font-weight:600; color:var(--df-text-dark);"
            >
              電子信箱
            </label>
            <div
              class="field-box"
              style="display:flex; align-items:center; gap:10px; height:48px; padding:0 16px;
                border-radius:var(--df-radius-md); background:#fff;"
            >
              <Icon name="mail" size={18} color="var(--df-text-muted)" />
              <input
                id="forgot-email"
                type="email"
                bind:value={email}
                placeholder="your@email.com"
                on:keydown={onKey}
                style="flex:1; border:none; outline:none; background:transparent; font-size:14px;
                  font-family:var(--df-font-body); color:var(--df-text-dark); min-width:0;"
              />
            </div>
          </div>

          <Button variant="primary" size="lg" fullWidth disabled={busy} on:click={submit}>
            {busy ? '寄送中…' : '寄送重設連結'}
          </Button>
        </div>

        <div style="text-align:center; font-size:13px; color:var(--df-text-light);">
          <a
            href="/member/login"
            style="color:var(--df-primary); text-decoration:none; font-weight:600;"
          >
            返回登入
          </a>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .field-box {
    border: 1.5px solid var(--df-border-strong);
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
