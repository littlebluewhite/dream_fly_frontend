<script lang="ts">
  /* 個人設定 page — profile header card + 5 underline tabs */
  import { COACH } from '$lib/coach/data';
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

  // Stats — sensible values derived from data / mock
  const STATS = [
    { label: '授課時數', value: '312 hr' },
    { label: '學員數',   value: '36 人' },
    { label: '年資',     value: '6 年' }
  ];
</script>

<div style="display:flex;flex-direction:column;gap:16px">
  <!-- Profile header card -->
  <Card padding={24}>
    <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap">
      <!-- Avatar -->
      <CoachAvatar size={88} online />

      <!-- Name / role / chips -->
      <div style="flex:1;min-width:200px">
        <div
          style="font-size:var(--df-text-h2);font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading);letter-spacing:-0.5px;line-height:1.2"
        >
          {COACH.full}
        </div>
        <div style="font-size:var(--df-text-base);color:var(--df-text-light);margin-top:4px">
          {COACH.role} · {COACH.id}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
          {#each COACH.chips as chip}
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
      <ProfileTab />
    {:else if activeTab === 'credentials'}
      <CredentialsTab />
    {:else if activeTab === 'preferences'}
      <PreferencesTab />
    {:else if activeTab === 'notifications'}
      <NotifTab />
    {:else if activeTab === 'security'}
      <SecurityTab />
    {/if}
  </div>
</div>
