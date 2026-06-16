<script lang="ts">
  /* 行動版後台 · 員工登入（全螢幕）。port 自 app.jsx LoginScreen (5-76)。
   * `+page@.svelte` 重置回 ROOT layout 取得全螢幕，繞過 /mobile-admin/+layout 外殼。
   * 原型的 <StatusBar light/> 改成 <div class="m-top-inset"/> spacer。
   * 登入後寫 localStorage df_madmin_session/role 並導向角色首頁。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { role as roleStore, session } from '$lib/mobile-admin/stores';
  import type { Role } from '$lib/mobile-admin/nav';
  import '$lib/styles/mobile-frame.css';

  let role: Role = 'admin';

  const opts = [
    { id: 'admin' as Role, icon: 'shield-check', label: '管理後台', desc: '陳怡君 · 系統管理員' },
    { id: 'coach' as Role, icon: 'graduation-cap', label: '教練工作台', desc: '林雅婷 · 競技體操總教練' }
  ];

  function enter() {
    if (browser) {
      try {
        localStorage.setItem('df_madmin_session', '1');
        localStorage.setItem('df_madmin_role', role);
      } catch (_) {}
    }
    roleStore.set(role);
    session.set(true);
    goto('/mobile-admin/' + role);
  }
</script>

<div class="m-stage">
  <div class="m-phone">
    <div class="m-island"></div>
    <div class="m-screen">
      <div
        style="flex:1; display:flex; flex-direction:column;
          background:linear-gradient(160deg, var(--df-ink) 0%, var(--df-primary-dark) 80%);
          color:#fff; position:relative; overflow:hidden;"
      >
        <div
          style="position:absolute; top:-50px; right:-40px; width:200px; height:200px; border-radius:50%;
            background:radial-gradient(circle, rgba(255,215,0,.16), transparent 70%);"
        ></div>
        <div class="m-top-inset"></div>
        <div class="df-scroll" style="position:relative;">
          <div style="padding:30px 24px 24px; display:flex; flex-direction:column; min-height:100%;">
            <!-- brand lockup -->
            <div style="display:flex; align-items:center; gap:11px; margin-top:8px;">
              <div
                style="width:46px; height:46px; border-radius:12px; background:#fff; display:flex;
                  align-items:center; justify-content:center; padding:5px;"
              >
                <img src="/logo-df-monogram.png" alt="Dream Fly" style="width:100%; height:100%; object-fit:contain;" />
              </div>
              <div>
                <div style="font-weight:800; font-size:19px; font-family:var(--df-font-heading);">Dream Fly</div>
                <div style="font-size:11px; letter-spacing:2px; opacity:0.7; font-weight:600;">夢飛 · 行動後台</div>
              </div>
            </div>

            <!-- heading -->
            <div style="margin-top:44px;">
              <h1 style="margin:0; font-size:27px; font-weight:800; font-family:var(--df-font-heading); line-height:1.3;">
                歡迎回來，<br />請選擇登入身分
              </h1>
              <p style="margin:10px 0 0; font-size:14px; opacity:0.8; line-height:1.6;">使用您的工作帳號登入夢飛體操館後台。</p>
            </div>

            <!-- role picker -->
            <div style="margin-top:26px; display:flex; flex-direction:column; gap:11px;">
              {#each opts as o (o.id)}
                {@const on = role === o.id}
                <button
                  on:click={() => (role = o.id)}
                  class="df-tapscale"
                  style="display:flex; align-items:center; gap:13px; padding:15px; border-radius:15px;
                    border:2px solid {on ? 'var(--df-accent)' : 'rgba(255,255,255,0.16)'};
                    background:{on ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'};
                    cursor:pointer; text-align:left; color:#fff;"
                >
                  <div
                    style="width:46px; height:46px; border-radius:12px;
                      background:{on ? 'var(--df-accent)' : 'rgba(255,255,255,0.12)'};
                      display:flex; align-items:center; justify-content:center; flex:none;"
                  >
                    <Icon name={o.icon} size={23} color={on ? 'var(--df-ink)' : '#fff'} />
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:16px; font-weight:700;">{o.label}</div>
                    <div style="font-size:12.5px; opacity:0.78; margin-top:2px;">{o.desc}</div>
                  </div>
                  {#if on}
                    <Icon name="circle-check" size={23} color="var(--df-accent)" />
                  {:else}
                    <Icon name="circle" size={23} color="rgba(255,255,255,0.4)" />
                  {/if}
                </button>
              {/each}
            </div>

            <!-- mock credentials -->
            <div style="margin-top:22px; display:flex; flex-direction:column; gap:12px;">
              <div>
                <div style="font-size:12.5px; opacity:0.78; margin-bottom:6px;">員工帳號</div>
                <div
                  style="display:flex; align-items:center; gap:9px; background:rgba(255,255,255,0.1);
                    border:1px solid rgba(255,255,255,0.16); border-radius:11px; padding:0 14px; height:48px;"
                >
                  <Icon name="user-round" size={18} color="rgba(255,255,255,0.7)" />
                  <input
                    value={role === 'admin' ? 'admin@dreamfly.tw' : 'coach.lin@dreamfly.tw'}
                    style="flex:1; border:none; background:transparent; outline:none; font-size:14.5px;
                      color:#fff; font-family:var(--df-font-body); min-width:0;"
                  />
                </div>
              </div>
              <div>
                <div style="font-size:12.5px; opacity:0.78; margin-bottom:6px;">密碼</div>
                <div
                  style="display:flex; align-items:center; gap:9px; background:rgba(255,255,255,0.1);
                    border:1px solid rgba(255,255,255,0.16); border-radius:11px; padding:0 14px; height:48px;"
                >
                  <Icon name="lock" size={18} color="rgba(255,255,255,0.7)" />
                  <input
                    type="password"
                    value="********"
                    style="flex:1; border:none; background:transparent; outline:none; font-size:14.5px;
                      color:#fff; font-family:var(--df-font-body); letter-spacing:2px; min-width:0;"
                  />
                </div>
              </div>
            </div>

            <div style="flex:1; min-height:18px;"></div>
            <button
              on:click={enter}
              class="df-tapscale"
              style="width:100%; height:52px; border-radius:14px; border:none; background:var(--df-accent);
                color:var(--df-ink); font-size:16px; font-weight:800; cursor:pointer; display:flex;
                align-items:center; justify-content:center; gap:8px; font-family:var(--df-font-body); margin-top:18px;"
            >
              登入後台 <Icon name="arrow-right" size={19} color="var(--df-ink)" />
            </button>
            <a
              href="/mobile"
              style="text-align:center; margin-top:16px; font-size:13px; color:rgba(255,255,255,0.7); text-decoration:none;"
            >我是家長 / 學員 → 前往會員 App</a>
            <div style="height:10px;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
