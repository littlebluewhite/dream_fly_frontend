<script lang="ts">
  /* 教練 · 工作台（首頁）。port coach.jsx CoachToday (6-61)。
   * 原型的 setTab(id) → goto(adminPath('coach',id))；onBell/onRole → overlay.sheet。
   *
   * 資料改由 getCoachHome()(mock-API 接縫)非同步載入,三態閘門(loading/error/
   * ready)。Task 20：改讀真 getDashboard()——hero 身分卡(姓名/職稱)改用真實教練
   * 資料(取代 PROFILES.coach 的固定假人名)；「今日課堂/今日學員」統計仍由
   * coachToday 動態算出(單一來源)；待辦事項的「待點名」「待回覆」改讀真
   * GET /reports/coach 的 pending_attendance/unread_messages 計數。原「我的學員
   * (86)」「技能評量待更新」提醒皆為頁面硬編、且後者指向已整個移除的假技能評量
   * 功能(coach/students 頁改為真的發證書/寫評語，見該頁註解)，一併移除，不留一個
   * 指向已移除功能的假提醒；找不到教練檔案(CoachNotFoundError)時顯示對應錯誤。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import { overlay, role, switchRole, coachNotifs, coachUnreadCount, closeNotifAfterReadAll } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { createLoadGate } from '$lib/load-gate';
  import { getCoachHome, CoachNotFoundError, type MCoachHomeData } from '$lib/mobile-admin/api';

  let data: MCoachHomeData | null = null;
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  const gate = createLoadGate({
    fetch: getCoachHome,
    onData: (d) => { data = d; },
    onError: (e) => {
      if (e instanceof CoachNotFoundError || (e instanceof Error && e.name === 'CoachNotFoundError')) {
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

  $: coachToday = data?.coachToday ?? [];
  $: classCount = coachToday.length;
  $: studentCount = coachToday.reduce((s, t) => s + t.count, 0);
  $: stats = [
    [String(classCount), '今日課堂', 'calendar-days', 'var(--df-primary)'],
    [String(studentCount), '今日學員', 'users', 'var(--df-success)']
  ] as [string, string, string, string][];
  $: tasks = data
    ? [
        { icon: 'calendar-check', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: data.pendingClasses + ' 待點名', action: '去點名', to: 'attendance' },
        { icon: 'message-circle', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', text: data.pendingReplies + ' 訊息待回覆', action: '查看', to: 'messages' }
      ]
    : [];

  const setTab = (id: string) => goto(adminPath('coach', id));
  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });
</script>

{#if $gate === 'ready' && data}
{@const p = { name: data.coach.name, initial: data.coach.initial, role: data.coach.role, desc: '', color: 'var(--df-primary)', id: data.coach.id }}
<HeroHeader
  role="coach"
  {p}
  unread={$coachUnreadCount}
  {onBell}
  {onRole}
  greeting={data.coach.display + '，午安 👋'}
  sub={'今天有 ' + classCount + ' 堂課、' + studentCount + ' 位學員，記得課後完成點名。'}
/>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:18px; margin-top:-2px;">
    <!-- stat pair -->
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:11px;">
      {#each stats as [v, l, ic, c] (l)}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:13px 8px; box-shadow:var(--df-shadow-card); text-align:center;">
          <Icon name={ic} size={19} color={c} />
          <div style="font-size:24px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading); margin-top:5px;">{v}</div>
          <div style="font-size:11px; color:var(--df-text-light); margin-top:1px;">{l}</div>
        </div>
      {/each}
    </div>

    <!-- today schedule -->
    <Panel title="今日課表" sub={'你負責的 ' + classCount + ' 堂課'} action="點名" onAction={() => setTab('attendance')}>
      {#each coachToday as t, i (i)}
        <div style="display:flex; align-items:center; gap:13px; padding:13px 16px; border-bottom:{i < coachToday.length - 1 ? '1px solid var(--df-border)' : 'none'};">
          <div style="font-family:var(--df-font-mono); font-size:16px; font-weight:700; color:var(--df-ink); width:48px; flex:none;">{t.time}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14.5px; font-weight:700; color:var(--df-text-dark);">{t.name}</div>
            <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{t.room} · {t.count} 位學員</div>
          </div>
          {#if t.taken}
            <Badge tone="success" dot>已點名</Badge>
          {:else}
            <button
              on:click={() => setTab('attendance')}
              class="df-tapscale"
              style="height:34px; padding:0 14px; border-radius:9px; border:none; background:var(--df-primary); color:#fff; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px;"
            ><Icon name="calendar-check" size={14} color="#fff" />點名</button>
          {/if}
        </div>
      {/each}
    </Panel>

    <!-- tasks -->
    <Panel title="待辦事項">
      <span slot="right" style="background:var(--df-accent); color:var(--df-ink); font-size:12px; font-weight:800; padding:2px 9px; border-radius:999px;">{tasks.length}</span>
      {#each tasks as t, i (i)}
        <button
          on:click={() => setTab(t.to)}
          class="df-tapscale"
          style="display:flex; align-items:center; gap:12px; padding:12px 16px; width:100%; border:none; border-bottom:{i < tasks.length - 1 ? '1px solid var(--df-border)' : 'none'}; background:#fff; cursor:pointer; text-align:left;"
        >
          <div style="width:34px; height:34px; border-radius:9px; background:{t.bg}; display:flex; align-items:center; justify-content:center; flex:none;"><Icon name={t.icon} size={16} color={t.tone} /></div>
          <div style="flex:1; font-size:13px; color:var(--df-text-dark); line-height:1.45;">{t.text}</div>
          <span style="color:var(--df-primary); font-weight:700; font-size:13px; white-space:nowrap; display:flex; align-items:center;">{t.action}<Icon name="chevron-right" size={15} color="var(--df-primary)" /></span>
        </button>
      {/each}
    </Panel>
    <div style="height:8px;"></div>
  </div>
</div>
{:else if $gate === 'error'}
  <Card padding={0}><ErrorState title={errorTitle} body={errorBody} onRetry={gate.refresh} /></Card>
{:else}
  <div class="df-scroll df-view" data-testid="mcoach-home-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:18px;">
    <SkelCard><Skeleton w="100%" h={90} r={16} /></SkelCard>
    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:11px;">
      {#each [0, 1] as i (i)}
        <SkelCard><Skeleton w="100%" h={80} r={14} /></SkelCard>
      {/each}
    </div>
    <SkelCard padding={0}><Skeleton w="100%" h={140} r={16} /></SkelCard>
  </div>
{/if}
