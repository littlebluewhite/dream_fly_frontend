<script lang="ts">
  /* 帳戶 tab。app.jsx AccountScreen (48)。
   * 深色漸層 hero（Avatar + 編輯）→ 點數高光卡 → 選單卡（push points/orders/report/settings）
   * → 切換到管理後台（goto /mobile-admin）→ 登出（清 df_mobile_session + session.set(false) + goto /mobile/login）。
   * Legacy Svelte（無 runes）。繁體中文文案。 */
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { overlay, points, profile, session } from '$lib/mobile/stores';
  import { ORDERS } from '$lib/mobile/data';

  type Item = { id: string; icon: string; label: string; sub: string; tone: string; tint: string };
  $: items = [
    { id: 'points', icon: 'star', label: '會員點數', sub: $points.toLocaleString() + ' 點可用', tone: 'var(--df-accent-dark)', tint: '#FFF8DB' },
    { id: 'orders', icon: 'receipt', label: '我的訂單', sub: ORDERS.length + ' 筆報名紀錄', tone: 'var(--df-primary)', tint: 'var(--df-primary-bg)' },
    { id: 'report', icon: 'clipboard-list', label: '成績單與證書', sub: '查看學習成果與獎狀', tone: 'var(--df-success)', tint: 'var(--df-success-bg)' },
    { id: 'settings', icon: 'settings', label: '帳號設定', sub: '個人資料與偏好設定', tone: 'var(--df-text-light)', tint: 'var(--df-bg-light)' }
  ] as Item[];

  function logout() {
    if (browser) {
      try {
        localStorage.removeItem('df_mobile_session');
      } catch (_) {}
    }
    session.set(false);
    goto('/mobile/login');
  }
</script>

<div class="m-top-inset" style="flex:none; background:linear-gradient(125deg, var(--df-primary), var(--df-primary-dark)); color:#fff;">
  <div style="padding:4px 18px 22px; display:flex; align-items:center; gap:14px;">
    <Avatar name={$profile.initial} size="lg" color="rgba(255,255,255,0.22)" />
    <div style="flex:1; min-width:0;">
      <div style="font-size:21px; font-weight:800; font-family:var(--df-font-heading);">{$profile.name}</div>
      <div style="font-size:12.5px; opacity:0.85; margin-top:2px;">會員編號 {$profile.id} · {$profile.since} 加入</div>
    </div>
    <button
      on:click={() => overlay.sheet('editProfile')}
      aria-label="編輯個人資料"
      class="df-tapscale"
      style="width:40px; height:40px; border-radius:999px; border:none; background:rgba(255,255,255,0.16);
        display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
    >
      <Icon name="pencil-line" size={19} color="#fff" />
    </button>
  </div>
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
    <!-- points highlight -->
    <button
      on:click={() => overlay.push('points')}
      class="df-tapscale"
      style="text-align:left; border:none; cursor:pointer; border-radius:16px; padding:0; background:transparent; margin-top:-46px;"
    >
      <div style="background:linear-gradient(120deg, #1f2937, var(--df-ink)); border-radius:16px; padding:18px; color:#fff; box-shadow:var(--df-shadow-strong);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:12px; opacity:0.8; display:flex; align-items:center; gap:6px;"><Icon name="star" size={15} color="var(--df-accent)" />會員點數</div>
            <div style="font-size:32px; font-weight:800; font-family:var(--df-font-heading); margin-top:4px;">{$points.toLocaleString()}<span style="font-size:14px; font-weight:500; opacity:0.7; margin-left:5px;">點</span></div>
          </div>
          <div style="display:flex; align-items:center; gap:5px; background:rgba(255,255,255,0.14); border-radius:999px; padding:8px 13px; font-size:13px; font-weight:700;">兌換好禮<Icon name="chevron-right" size={15} color="#fff" /></div>
        </div>
      </div>
    </button>

    <Card padding={0} style="overflow:hidden;">
      {#each items as it, i (it.id)}
        <button
          on:click={() => overlay.push(it.id)}
          class="df-tapscale"
          style="display:flex; align-items:center; gap:13px; padding:14px 16px; border:none;
            border-bottom:{i === items.length - 1 ? 'none' : '1px solid var(--df-border)'};
            background:transparent; cursor:pointer; width:100%; text-align:left;"
        >
          <div style="width:38px; height:38px; border-radius:11px; background:{it.tint}; display:flex; align-items:center; justify-content:center; flex:none;">
            <Icon name={it.icon} size={20} color={it.tone} />
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14.5px; font-weight:600; color:var(--df-ink);">{it.label}</div>
            <div style="font-size:12px; color:var(--df-text-light);">{it.sub}</div>
          </div>
          <Icon name="chevron-right" size={18} color="var(--df-text-muted)" />
        </button>
      {/each}
    </Card>

    <button
      on:click={() => goto('/mobile-admin')}
      class="df-tapscale"
      style="display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px;
        border:1px solid var(--df-border); background:#fff; cursor:pointer; width:100%; text-align:left;"
    >
      <div style="width:38px; height:38px; border-radius:11px; background:var(--df-bg-light); display:flex; align-items:center; justify-content:center; flex:none;">
        <Icon name="shield-check" size={20} color="var(--df-text-light)" />
      </div>
      <div style="flex:1;">
        <div style="font-size:14.5px; font-weight:600; color:var(--df-ink);">切換到管理後台</div>
        <div style="font-size:12px; color:var(--df-text-light);">教練 / 行政人員專用</div>
      </div>
      <Icon name="external-link" size={17} color="var(--df-text-muted)" />
    </button>

    <button
      on:click={logout}
      class="df-tapscale"
      style="display:flex; align-items:center; justify-content:center; gap:8px; padding:13px;
        border-radius:14px; border:1px solid var(--df-border); background:#fff; cursor:pointer;
        color:var(--df-text-light); font-size:14px; font-weight:600;"
    >
      <Icon name="log-out" size={18} color="var(--df-text-light)" />登出
    </button>
    <div style="text-align:center; font-size:11.5px; color:var(--df-text-muted); padding:4px 0 8px;">Dream Fly 夢飛體操 · App v2.4.0</div>
  </div>
</div>
