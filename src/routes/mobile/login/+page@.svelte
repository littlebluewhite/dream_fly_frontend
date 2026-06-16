<script lang="ts">
  /* 行動版會員 App · 啟動 / 登入入口。auth.jsx AuthScreen 的視覺移植（drop StatusBar）。
   * `+page@.svelte` 重置回 ROOT layout（全螢幕）→ 不套用 /mobile layout，避免重導迴圈。
   * 「登入」與「訪客瀏覽」皆寫入 df_mobile_session 並 goto('/mobile')，由 browser 守門。
   * Legacy Svelte（無 runes）。繁體中文文案。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { session } from '$lib/mobile/stores';
  import '$lib/styles/mobile-frame.css';

  let phone = '';
  let phoneFocus = false;

  const TRUST: [string, string, string][] = [
    ['shield-check', '安全有保障', '小班 6–8 人 · 雙教練保護'],
    ['sparkles', '先試再決定', '15 分鐘評估 + 60 分鐘體驗'],
    ['users', '專業教練群', '競賽選手出身 · 循序漸進']
  ];

  function enter() {
    if (!browser) return;
    try {
      localStorage.setItem('df_mobile_session', '1');
    } catch (_) {}
    session.set(true);
    goto('/mobile');
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
          <div style="padding:20px 22px calc(24px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; gap:18px;">
            <!-- 手機號碼 -->
            <div style="display:flex; flex-direction:column; gap:7px;">
              <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">手機號碼</span>
              <div
                style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff;
                  border:1.5px solid {phoneFocus ? 'var(--df-primary)' : 'var(--df-border-strong)'}; border-radius:12px;
                  box-shadow:{phoneFocus ? '0 0 0 3px rgba(0,102,204,.18)' : 'none'};
                  transition:border .15s ease, box-shadow .15s ease;"
              >
                <Icon name="smartphone" size={18} color="var(--df-text-muted)" />
                <input
                  bind:value={phone}
                  inputmode="tel"
                  placeholder="0912-345-678"
                  on:focus={() => (phoneFocus = true)}
                  on:blur={() => (phoneFocus = false)}
                  style="flex:1; border:none; background:transparent; outline:none; font-size:15px;
                    color:var(--df-text-dark); font-family:var(--df-font-body); height:100%; min-width:0;"
                />
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--df-text-muted);">
              <Icon name="info" size={14} color="var(--df-text-muted)" />示範用 · 直接登入或以訪客瀏覽
            </div>

            <Button variant="primary" size="lg" fullWidth on:click={enter}>登入</Button>

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

            <button
              on:click={enter}
              class="df-tapscale"
              style="align-self:center; border:none; background:transparent; cursor:pointer; font-size:13px;
                font-weight:600; color:var(--df-text-light); display:flex; align-items:center; gap:5px; padding:4px 8px;"
            >
              先以訪客身分瀏覽<Icon name="arrow-right" size={14} color="var(--df-text-light)" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
