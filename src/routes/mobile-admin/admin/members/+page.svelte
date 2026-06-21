<script lang="ts">
  /* 管理員 · 學員管理。admin.jsx MembersScreen (116)。
   * 清單由 $members store 提供;tap → sheet('member'),新增 → sheet('memberForm',{m:null})。 */
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { overlay, adminNotifs, adminUnreadCount, toasts } from '$lib/mobile-admin/stores';
  import { members } from '$lib/mobile-admin/stores';
  import { PAY_STATUS } from '$lib/mobile-admin/data';

  let tab = 'all';
  let q = '';

  const PAY_PILL: Record<string, [string, string]> = {
    paid: ['#10B98114', '#0F9F6E'],
    due: ['var(--df-warning-bg)', 'var(--df-warning)'],
    trial: ['#0EA5E914', '#0284C7']
  };

  function openNotif() {
    overlay.sheet('notif', { notifs: $adminNotifs, onReadAll: () => { adminNotifs.markAllRead(); toasts.notify('success', '已全部標為已讀', ''); overlay.closeSheet(); } });
  }

  $: counts = {
    all: $members.length,
    active: $members.filter((m) => m.status === 'active').length,
    warning: $members.filter((m) => m.status === 'warning').length,
    paused: $members.filter((m) => m.status === 'paused').length
  };
  $: chips = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'active', label: '在學中', count: counts.active },
    { key: 'warning', label: '出席偏低', count: counts.warning },
    { key: 'paused', label: '暫停中', count: counts.paused }
  ];
  $: rows = $members
    .filter((m) => tab === 'all' || m.status === tab)
    .filter((m) => !q || (m.name + m.id + m.course).toLowerCase().includes(q.toLowerCase()));
</script>

<ScreenHeader title="學員管理" sub={counts.all + ' 位在學學員'}>
  <div slot="right" style="display:flex; gap:8px;">
    <HeaderIcon icon="user-plus" label="新增學員" onClick={() => overlay.sheet('memberForm', { m: null })} />
    <HeaderIcon icon="bell" badge={$adminUnreadCount} label="通知" onClick={openNotif} />
  </div>
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border); display:flex; flex-direction:column; gap:11px;">
  <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋學員姓名、編號、課程…" />
  <FilterChips items={chips} value={tab} onChange={(k) => (tab = k)} />
</div>

<div class="df-scroll df-view">
  <div style="padding:16px; display:flex; flex-direction:column; gap:11px;">
    {#if rows.length === 0}
      <MEmpty icon="search-x" title="找不到符合的學員" body="換個關鍵字或篩選條件試試。" />
    {:else}
      {#each rows as m (m.id)}
        {@const pp = PAY_PILL[m.pay] || PAY_PILL.paid}
        <button
          on:click={() => overlay.sheet('member', { m })}
          class="df-tapscale"
          style="display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; border:1px solid var(--df-border);
            background:#fff; box-shadow:var(--df-shadow-card); cursor:pointer; text-align:left; width:100%;"
        >
          <Avatar name={m.initial} size="md" color={m.color} />
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
              <span style="font-size:15px; font-weight:700; color:var(--df-ink);">{m.name}</span>
              <span style="font-size:11px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{m.id}</span>
              <span style="font-size:10.5px; font-weight:700; color:{pp[1]}; background:{pp[0]}; padding:2px 8px; border-radius:999px; flex:none;">{(PAY_STATUS[m.pay] || ['', '-'])[1]}</span>
            </div>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{m.course} · 剩 {m.remain} 堂</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <div style="flex:1;"><MiniBar value={m.att} tone={m.att >= 80 ? 'primary' : 'warning'} height={5} /></div>
              <span style="font-size:12px; font-weight:700; color:{m.att >= 80 ? 'var(--df-text-dark)' : 'var(--df-warning)'}; width:34px; text-align:right;">{m.att}%</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:none;">
            <StatusBadgeM s={m.status} />
            <Icon name="chevron-right" size={18} color="var(--df-text-muted)" />
          </div>
        </button>
      {/each}
    {/if}
    <div style="height:8px;"></div>
  </div>
</div>
