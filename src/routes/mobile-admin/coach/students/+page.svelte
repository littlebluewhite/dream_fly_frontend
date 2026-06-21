<script lang="ts">
  /* 教練 · 我的學員。port coach.jsx CoachStudentsScreen (165-210)。
   * 點學員卡 → overlay.sheet('studentSkills',{student})；onBell → overlay.sheet('notif')。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import { overlay, coachNotifs, coachUnreadCount, closeNotifAfterReadAll, toasts } from '$lib/mobile-admin/stores';
  import { MEMBERS, SKILLS, type MemberRow } from '$lib/mobile-admin/data';

  const mine = MEMBERS.filter((m) => m.coach === '林雅婷');
  let q = '';

  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const openSkills = (student: MemberRow) => overlay.sheet('studentSkills', { student });
  const skillsOf = (m: MemberRow): [string, number][] => SKILLS[m.id] || [['基本動作', m.att], ['體能', Math.max(60, m.att - 8)]];

  $: list = q ? mine.filter((m) => (m.name + m.id + m.course).toLowerCase().includes(q.toLowerCase())) : mine;
</script>

<ScreenHeader title="我的學員" sub={mine.length + ' 位 · 競技啦啦隊 / 競技體操'}>
  <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={onBell} />
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
  <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋學員姓名、編號…" />
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
    {#if list.length === 0}
      <MEmpty icon="search-x" title="找不到符合的學員" />
    {:else}
      {#each list as m (m.id)}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; box-shadow:var(--df-shadow-card); padding:16px;">
          <button
            on:click={() => openSkills(m)}
            class="df-tapscale"
            style="display:flex; align-items:center; gap:12px; margin-bottom:13px; width:100%; border:none; background:none; padding:0; cursor:pointer; text-align:left;"
          >
            <Avatar name={m.initial} size="md" color={m.color} />
            <div style="flex:1; min-width:0;">
              <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{m.name}</div>
              <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{m.age} 歲 · {m.course}</div>
            </div>
            <StatusBadgeM s={m.status} />
          </button>
          <div style="display:flex; flex-direction:column; gap:9px; margin-bottom:13px;">
            {#each skillsOf(m) as [sk, v] (sk)}
              <div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;"><span style="color:var(--df-text-light);">{sk}熟練度</span><span style="font-weight:700; color:var(--df-text-dark);">{v}%</span></div>
                <MiniBar value={v} tone={v >= 85 ? 'success' : 'primary'} height={6} />
              </div>
            {/each}
          </div>
          <div style="display:flex; gap:8px;">
            <button
              on:click={() => openSkills(m)}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            ><Icon name="trending-up" size={15} color="var(--df-primary)" />更新評量</button>
            <button
              on:click={() => toasts.notify('info', '聯絡家長', m.parent + ' · ' + m.phone)}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"
            ><Icon name="message-circle" size={15} color="var(--df-primary)" />聯絡家長</button>
          </div>
        </div>
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
