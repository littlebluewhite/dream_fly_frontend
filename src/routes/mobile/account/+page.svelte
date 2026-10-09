<script lang="ts">
  /* 帳戶 tab。app.jsx AccountScreen (48)。
   * 深色漸層 hero（Avatar + 編輯）→ 點數高光卡 → 選單卡（push points/orders/report/settings）
   * → 切換到管理後台（goto /mobile-admin）→ 登出（authStore.logout() + goto /mobile/login）。
   * Legacy Svelte（無 runes）。繁體中文文案。
   *
   * 訂單筆數改由 getAccount()(真後端接縫,見 $lib/member/api.ts)非同步取得:
   * onMount 進三態閘門(loading/error/ready)。Task 19:登出改真 authStore.logout()
   * (清 token,不再是示範性的 df_mobile_session)；會員點數改讀真 $lib/member/points
   * 的 points(本頁自己呼叫 refreshPoints() 側效水合,見下方 gate.fetch) — 不再是
   * mobile 本地、永遠停在 mock 種子值的 points store
   * (那顆本地 store 仍保留給 CartSheet 的既有假結帳流程使用,兩者現在是分開的,
   * 見 task-19-report.md 的顧慮)。hero 的名字讀 authStore(改名經 syncUser 同步)、
   * 加入年月讀會員資料 module 的 $selfAccount(本頁自己等它水合,R13 Task 3);
   * 後端沒有的會員編號拿掉。Task 7(架構深化 R15·F-4)：mobile/api.ts 原本的純轉手
   * getAccount()/MobileAccountData 已退役,本頁直取桌面 seam;selfAccount/points
   * 也改直取擁有者模組,不再經 $lib/mobile/stores 轉手。Task 8(架構深化 R15·F-2)：
   * getAccount() 只回訂單資料——個人資料水合與點數暖機改由本頁自己宣告，與主 GET
   * 並行發出；行動版帳戶頁只暖點數，不暖訂閱(不打 GET /subscriptions/me，本頁不
   * 顯示訂閱資訊)。 */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay } from '$lib/mobile/stores';
  import type { MobilePushId } from '$lib/mobile/stores';
  import { selfAccount, hydrateSelfAccount } from '$lib/self-account';
  import { points, refreshPoints } from '$lib/member/points';
  import { warmStores } from '$lib/store-warm';
  import { authStore } from '$lib/stores/authStore';
  import { createLoadGate } from '$lib/load-gate';
  import { getAccount, type AccountData } from '$lib/member/api';
  import type { IconName } from '$lib/icon-registry';

  type Item = { id: MobilePushId; icon: IconName; label: string; sub: string; tone: string; tint: string };

  let data: AccountData | null = null;
  const gate = createLoadGate({
    fetch: async () => {
      const [account] = await Promise.all([
        getAccount(),
        hydrateSelfAccount(),
        warmStores('mobile/account', [['點數', refreshPoints]])
      ]);
      return account;
    },
    onData: (d) => { data = d; }
  });

  $: items = [
    { id: 'points', icon: 'star', label: '會員點數', sub: $points.toLocaleString() + ' 點可用', tone: 'var(--df-accent-dark)', tint: '#FFF8DB' },
    { id: 'orders', icon: 'receipt', label: '我的訂單', sub: (data?.ordersTotal ?? 0) + ' 筆報名紀錄', tone: 'var(--df-primary)', tint: 'var(--df-primary-bg)' },
    { id: 'report', icon: 'clipboard-list', label: '成績單與證書', sub: '查看學習成果與獎狀', tone: 'var(--df-success)', tint: 'var(--df-success-bg)' },
    { id: 'settings', icon: 'settings', label: '帳號設定', sub: '個人資料與偏好設定', tone: 'var(--df-text-light)', tint: 'var(--df-bg-light)' }
  ] satisfies Item[];

  function logout() {
    authStore.logout();
    goto('/mobile/login');
  }
</script>

<LoadGate {gate}>
  <div class="m-top-inset df-scroll df-view" data-testid="account-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:16px;" slot="loading">
    <div style="display:flex; align-items:center; gap:14px;">
      <Skeleton w={56} h={56} r={999} />
      <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
        <Skeleton w="50%" h={18} />
        <Skeleton w="70%" h={12} />
      </div>
    </div>
    <SkelCard padding={18}><Skeleton w="100%" h={60} r={10} /></SkelCard>
    <SkelCard padding={0}>
      {#each [0, 1, 2, 3] as i (i)}
        <div style="display:flex; gap:13px; padding:14px 16px; border-bottom:{i < 3 ? '1px solid var(--df-border)' : 'none'};">
          <Skeleton w={38} h={38} r={11} />
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <Skeleton w="40%" h={14} />
            <Skeleton w="60%" h={11} />
          </div>
        </div>
      {/each}
    </SkelCard>
  </div>

  <div class="m-top-inset df-scroll df-view" style="padding:16px;" slot="error">
    <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
  </div>

  <div class="m-top-inset" style="flex:none; background:linear-gradient(125deg, var(--df-primary), var(--df-primary-dark)); color:#fff;">
    <div style="padding:4px 18px 22px; display:flex; align-items:center; gap:14px;">
      <Avatar name={$authStore.member?.initial ?? ''} size="lg" color="rgba(255,255,255,0.22)" />
      <div style="flex:1; min-width:0;">
        <div style="font-size:21px; font-weight:800; font-family:var(--df-font-heading);">{$authStore.member?.name ?? ''}</div>
        {#if $selfAccount}<div style="font-size:12.5px; opacity:0.85; margin-top:2px;">{$selfAccount.since} 加入</div>{/if}
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
</LoadGate>
