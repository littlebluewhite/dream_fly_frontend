<script lang="ts">
  /* 行動版會員 App · 登入頁。auth.jsx AuthScreen 的視覺移植（drop StatusBar）。
   * `+page@.svelte` 重置回 ROOT layout（全螢幕）→ 不套用 /mobile layout，避免重導迴圈。
   *
   * Task 19：移除示範性的「手機號碼 + 訪客瀏覽」假登入（寫 df_mobile_session
   * 即視為登入，未驗證任何憑證）——改真 email/密碼表單打 POST /auth/login
   * （authStore.login，同 member 登入頁的既有 token 路徑：$lib/stores/
   * authStore.ts 的 setTokens/refresh 機制不變，這裡只是換一張表單）。沒有
   * 「訪客瀏覽」：mobile 是會員專屬 app，後端沒有訪客身分,不再假裝有。沒有
   * 忘記密碼連結(mobile 無對應路由,不硬連去 /member/forgot-password 混淆兩個
   * surface)。
   *
   * Round 4 F2:Google 登入接線,復用 member 登入頁同一套 authorization-code
   * redirect(見 $lib/member/google-oauth——callbackPath 已參數化,這裡明確傳
   * '/mobile/login/google')與 googleEnabled 漸進增強(沒有
   * VITE_GOOGLE_CLIENT_ID 時不顯示按鈕,密碼流程不受影響)。callback 頁見
   * ./google/+page@.svelte。 */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { authStore } from '$lib/stores/authStore';
  import { isGoogleLoginEnabled, startGoogleLogin } from '$lib/member/google-oauth';
  import '$lib/styles/mobile-frame.css';

  const googleEnabled = isGoogleLoginEnabled();

  let email = '';
  let password = '';
  let showPw = false;
  let busy = false;
  let error = '';
  let emailFocus = false;
  let pwFocus = false;

  const TRUST: [string, string, string][] = [
    ['shield-check', '安全有保障', '小班 6–8 人 · 雙教練保護'],
    ['sparkles', '先試再決定', '15 分鐘評估 + 60 分鐘體驗'],
    ['users', '專業教練群', '競賽選手出身 · 循序漸進']
  ];

  async function submit() {
    if (busy) return;
    error = '';
    busy = true;
    try {
      await authStore.login(email, password);
      goto('/mobile');
    } catch {
      error = 'Email 或密碼錯誤';
    } finally {
      busy = false;
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; background:var(--df-bg-light);">
        <!-- ── 品牌 hero ── -->
        <div
          class="m-top-inset"
          style="flex:none; position:relative; overflow:hidden; color:#fff;
            background:linear-gradient(150deg, #0F3C7A 0%, var(--df-primary) 55%, var(--df-primary-dark) 100%);
            padding-bottom:30px;"
        >
          <div style="position:absolute; inset:0; background:radial-gradient(120% 80% at 80% 0%, rgba(255,255,255,.12), transparent 60%);"></div>
          <div style="position:absolute; top:-60px; right:-50px; width:220px; height:220px; border-radius:50%; background:radial-gradient(circle, rgba(255,215,0,.28), transparent 70%);"></div>
          <div style="position:relative;">
            <div style="padding:24px 26px 0; display:flex; flex-direction:column; align-items:center; text-align:center;">
              <div
                style="width:86px; height:86px; border-radius:26px; background:#fff; display:flex;
                  align-items:center; justify-content:center; box-shadow:0 14px 30px rgba(2,6,23,.35); margin-bottom:16px;"
              >
                <img src="/logo-df-monogram.png" alt="Dream Fly" style="width:58px; height:58px; object-fit:contain;" />
              </div>
              <div style="font-size:26px; font-weight:800; font-family:var(--df-font-heading); letter-spacing:0.5px;">
                Dream Fly <span style="font-weight:700;">夢飛</span>
              </div>
              <div style="font-size:13.5px; opacity:0.9; margin-top:6px; line-height:1.5;">先試一堂，再決定孩子的體操路線</div>
            </div>
          </div>
        </div>

        <!-- ── 表單卡 ── -->
        <div class="df-scroll" style="flex:1;">
          <div style="padding:20px 22px calc(24px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:14px;">
            <!-- Email -->
            <div style="display:flex; flex-direction:column; gap:7px;">
              <label for="mlogin-email" style="font-size:13px; font-weight:600; color:var(--df-text-dark);">電子信箱</label>
              <div
                style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff;
                  border:1.5px solid {emailFocus ? 'var(--df-primary)' : 'var(--df-border-strong)'}; border-radius:12px;
                  box-shadow:{emailFocus ? '0 0 0 3px rgba(0,102,204,.18)' : 'none'};
                  transition:border .15s ease, box-shadow .15s ease;"
              >
                <Icon name="mail" size={18} color="var(--df-text-muted)" />
                <input
                  id="mlogin-email"
                  type="email"
                  bind:value={email}
                  placeholder="your@email.com"
                  on:keydown={onKey}
                  on:focus={() => (emailFocus = true)}
                  on:blur={() => (emailFocus = false)}
                  style="flex:1; border:none; background:transparent; outline:none; font-size:15px;
                    color:var(--df-text-dark); font-family:var(--df-font-body); height:100%; min-width:0;"
                />
              </div>
            </div>

            <!-- 密碼 -->
            <div style="display:flex; flex-direction:column; gap:7px;">
              <label for="mlogin-pw" style="font-size:13px; font-weight:600; color:var(--df-text-dark);">密碼</label>
              <div
                style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff;
                  border:1.5px solid {pwFocus ? 'var(--df-primary)' : 'var(--df-border-strong)'}; border-radius:12px;
                  box-shadow:{pwFocus ? '0 0 0 3px rgba(0,102,204,.18)' : 'none'};
                  transition:border .15s ease, box-shadow .15s ease;"
              >
                <Icon name="lock" size={18} color="var(--df-text-muted)" />
                <input
                  id="mlogin-pw"
                  type={showPw ? 'text' : 'password'}
                  bind:value={password}
                  placeholder="請輸入密碼"
                  on:keydown={onKey}
                  on:focus={() => (pwFocus = true)}
                  on:blur={() => (pwFocus = false)}
                  style="flex:1; border:none; background:transparent; outline:none; font-size:15px;
                    color:var(--df-text-dark); font-family:var(--df-font-body); height:100%; min-width:0;"
                />
                <button
                  type="button"
                  aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
                  on:click={() => (showPw = !showPw)}
                  style="border:none; background:transparent; cursor:pointer; padding:0;
                    display:inline-flex; color:var(--df-text-muted);"
                >
                  <Icon name={showPw ? 'eye' : 'eye-off'} size={18} />
                </button>
              </div>
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
                aria-label="使用 Google 登入"
                on:click={() => startGoogleLogin('/mobile/login/google')}
                style="height:50px; display:inline-flex; align-items:center;
                  justify-content:center; gap:8px; border-radius:12px; cursor:pointer;
                  font-size:14px; font-weight:600; font-family:var(--df-font-body);
                  background:#fff; color:var(--df-text-dark); border:1.5px solid var(--df-border-strong);"
              >
                <span style="font-family:var(--df-font-heading); font-weight:700; font-size:15px;">G</span>
                使用 Google 登入
              </button>
            {/if}

            <!-- 信任列 -->
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px; padding:16px 0 4px; border-top:1px solid var(--df-border);">
              {#each TRUST as [ic, t, s] (t)}
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:38px; height:38px; border-radius:11px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none;">
                    <Icon name={ic} size={19} color="var(--df-primary)" />
                  </div>
                  <div>
                    <div style="font-size:13.5px; font-weight:700; color:var(--df-ink);">{t}</div>
                    <div style="font-size:12px; color:var(--df-text-light);">{s}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
