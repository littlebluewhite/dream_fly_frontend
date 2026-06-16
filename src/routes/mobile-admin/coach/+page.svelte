<script lang="ts">
  /* 教練 · 工作台（首頁）。port coach.jsx CoachToday (6-61)。
   * 原型的 setTab(id) → goto(adminPath('coach',id))；onBell/onRole → overlay.sheet。 */
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import HeroHeader from '$lib/mobile-admin/components/HeroHeader.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import { overlay, role, switchRole, coachNotifs, coachUnreadCount, closeNotifAfterReadAll } from '$lib/mobile-admin/stores';
  import { adminPath, type Role } from '$lib/mobile-admin/nav';
  import { COACH_TODAY, PROFILES } from '$lib/mobile-admin/data';

  const p = PROFILES.coach;
  const stats: [string, string, string, string][] = [
    ['2', '今日課堂', 'calendar-days', 'var(--df-primary)'],
    ['23', '今日學員', 'users', 'var(--df-success)'],
    ['86', '我的學員', 'graduation-cap', 'var(--df-accent-dark)']
  ];
  const tasks = [
    { icon: 'calendar-check', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '19:00 競技啦啦隊 進階班 尚未點名', action: '去點名', to: 'attendance' },
    { icon: 'message-circle', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', text: '2 則家長訊息待回覆', action: '查看', to: 'messages' },
    { icon: 'award', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '選手班 3 位學員技能評量待更新', action: '更新', to: 'students' }
  ];

  const setTab = (id: string) => goto(adminPath('coach', id));
  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const onRole = () => overlay.sheet('role', { role: $role, setRole: (r: Role) => { switchRole(r); goto(adminPath(r, r === 'admin' ? 'home' : 'today')); } });
</script>

<HeroHeader
  role="coach"
  {p}
  unread={$coachUnreadCount}
  {onBell}
  {onRole}
  greeting={p.name + ' 教練，午安 👋'}
  sub="今天有 2 堂課、23 位學員，記得課後完成點名。"
/>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:18px; margin-top:-2px;">
    <!-- stat trio -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:11px;">
      {#each stats as [v, l, ic, c] (l)}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:13px 8px; box-shadow:var(--df-shadow-card); text-align:center;">
          <Icon name={ic} size={19} color={c} />
          <div style="font-size:24px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading); margin-top:5px;">{v}</div>
          <div style="font-size:11px; color:var(--df-text-light); margin-top:1px;">{l}</div>
        </div>
      {/each}
    </div>

    <!-- today schedule -->
    <Panel title="今日課表" sub="你負責的 2 堂課" action="點名" onAction={() => setTab('attendance')}>
      {#each COACH_TODAY as t, i (i)}
        <div style="display:flex; align-items:center; gap:13px; padding:13px 16px; border-bottom:{i < COACH_TODAY.length - 1 ? '1px solid var(--df-border)' : 'none'};">
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
      <span slot="right" style="background:var(--df-accent); color:var(--df-ink); font-size:12px; font-weight:800; padding:2px 9px; border-radius:999px;">3</span>
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
