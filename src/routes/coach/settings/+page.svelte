<script lang="ts">
  /* 個人設定 page — profile header card + 5 underline tabs
   *
   * Data arrives async via getSettings()(mock-API seam): onMount loads coach 資料
   * 進三態閘門(loading/error/ready)。ProfileTab/CredentialsTab/SecurityTab 三個
   * 分頁元件原本各自 module-scope import COACH(元件樹檢查揪出) — 現改為 required
   * prop 下傳,由 check 把關漏傳。 */
  import { onMount } from 'svelte';
  import { createLoadGate } from '$lib/load-gate';
  import { getSettings, type CoachSettingsData } from '$lib/coach/api';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import CoachAvatar from '$lib/coach/components/CoachAvatar.svelte';
  import CoachTag from '$lib/coach/components/CoachTag.svelte';
  import ProfileTab     from '$lib/coach/components/settings/ProfileTab.svelte';
  import CredentialsTab from '$lib/coach/components/settings/CredentialsTab.svelte';
  import PreferencesTab from '$lib/coach/components/settings/PreferencesTab.svelte';
  import NotifTab       from '$lib/coach/components/settings/NotifTab.svelte';
  import SecurityTab    from '$lib/coach/components/settings/SecurityTab.svelte';

  const TABS = [
    { value: 'profile',      label: '個人資料' },
    { value: 'credentials',  label: '帳號憑證' },
    { value: 'preferences',  label: '教學偏好' },
    { value: 'notifications',label: '通知設定' },
    { value: 'security',     label: '帳號安全' }
  ];

  let activeTab = 'profile';

  let data: CoachSettingsData | null = null;
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  const gate = createLoadGate({
    fetch: getSettings,
    onData: (d) => { data = d; },
    onError: (e) => {
      // e.name(非 instanceof CoachNotFoundError)—— 頁面測試把 $lib/coach/api
      // 整支模組換成只有 getSettings 的假模組，import 進來的 class 會是 undefined。
      if (e instanceof Error && e.name === 'CoachNotFoundError') {
        errorTitle = '此帳號未綁定教練檔案';
        errorBody = '請聯繫系統管理員協助設定教練檔案。';
      } else {
        errorTitle = '載入失敗';
        errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';
      }
    }
  });
  onMount(() => {
    gate.load();
  });

  // Stats — sensible values derived from data / mock
  const STATS = [
    { label: '授課時數', value: '312 hr' },
    { label: '學員數',   value: '36 人' },
    { label: '年資',     value: '6 年' }
  ];
</script>

<LoadGate {gate} errorTitle={errorTitle} errorBody={errorBody}>
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="settings-skeleton" slot="loading">
    <SkelCard><Skeleton w="100%" h={140} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>

{#if data}
<div style="display:flex;flex-direction:column;gap:16px">
  <!-- Profile header card -->
  <Card padding={24}>
    <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap">
      <!-- Avatar -->
      <CoachAvatar size={88} online initial={data.coach.initial} />

      <!-- Name / role / chips -->
      <div style="flex:1;min-width:200px">
        <div
          style="font-size:var(--df-text-h2);font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading);letter-spacing:-0.5px;line-height:1.2"
        >
          {data.coach.full}
        </div>
        <div style="font-size:var(--df-text-base);color:var(--df-text-light);margin-top:4px">
          {data.coach.role} · {data.coach.id}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
          {#each data.coach.chips as chip}
            <CoachTag tone="accent">{chip}</CoachTag>
          {/each}
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
        {#each STATS as stat}
          <div style="text-align:center;min-width:64px">
            <div
              style="font-size:22px;font-weight:800;color:var(--df-primary);font-family:var(--df-font-body);letter-spacing:-0.5px"
            >
              {stat.value}
            </div>
            <div style="font-size:12px;color:var(--df-text-light);margin-top:2px">
              {stat.label}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </Card>

  <!-- Tabs + content -->
  <div>
    <Tabs tabs={TABS} bind:value={activeTab} />
    {#if activeTab === 'profile'}
      <ProfileTab coach={data.coach} />
    {:else if activeTab === 'credentials'}
      <CredentialsTab coach={data.coach} />
    {:else if activeTab === 'preferences'}
      <PreferencesTab />
    {:else if activeTab === 'notifications'}
      <NotifTab />
    {:else if activeTab === 'security'}
      <SecurityTab coach={data.coach} />
    {/if}
  </div>
</div>
{/if}
</LoadGate>
