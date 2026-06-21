<script lang="ts">
  /* 學員名單 — the shared learner table (admin.jsx MembersTable), used both
   * embedded in the dashboard (compact) and on the 學員管理 page (full).
   *
   * Full columns: 學員 (avatar+name+id) / 課程 / 分校 / 授課教練 / 近況 (6-dot
   * attendance strip, each dot coloured via ATT_MARK[mark][0]) / 出席率 (bar + %,
   * sortable) / 繳費 (pay StatusBadge) / 狀態 (member StatusBadge) / 剩餘堂數 / row
   * action (chevron → opens MemberDialog). Compact drops 分校/授課教練/近況/繳費/
   * 剩餘堂數, hides the tabs, and caps at 6 rows.
   *
   * Filtering/sort live in the pure filterMembers() (members-filter.ts). The
   * topbar `search` store feeds the query. Editing opens MemberEditDialog and
   * updates the local working copy on save. */
  import { Avatar, Card, Button, IconButton, Icon, Tabs, ProgressBar } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import MemberDialog from './MemberDialog.svelte';
  import MemberEditDialog from './MemberEditDialog.svelte';
  import { MEMBERS, ATT_MARK, type Member } from '$lib/admin/data';
  import { search, memberFilter } from '$lib/admin/stores';
  import {
    filterMembers,
    countByStatus,
    blankMember,
    type MemberStatusFilter,
    type MembersSort
  } from './members-filter';

  const COMPACT_PREVIEW_LIMIT = 6;

  export let compact = false;
  export let rows: Member[] = MEMBERS;

  // Local working copy so saves reflect immediately (mirrors the source useState).
  let members: Member[] = rows;
  $: members = rows;

  let tab: MemberStatusFilter = 'all';
  let sort: MembersSort = { key: null, dir: 'desc' };

  let active: Member | null = null;
  let editing: Member | null = null;
  let editOpen = false;

  $: counts = countByStatus(members);
  $: tabs = [
    { value: 'all', label: '全部', count: counts.all },
    { value: 'active', label: '在學中', count: counts.active },
    { value: 'warning', label: '出席偏低', count: counts.warning },
    { value: 'paused', label: '暫停中', count: counts.paused }
  ];

  // status tab + the 進階篩選 store only apply in the full variant; compact always
  // shows 'all' with no advanced narrowing (it is the dashboard preview).
  $: visible = (() => {
    const out = filterMembers(members, {
      query: $search,
      status: compact ? 'all' : tab,
      ...(compact ? {} : $memberFilter),
      sort
    });
    return compact ? out.slice(0, COMPACT_PREVIEW_LIMIT) : out;
  })();

  function toggleSort() {
    sort =
      sort.key === 'att' && sort.dir === 'desc'
        ? { key: 'att', dir: 'asc' }
        : { key: 'att', dir: 'desc' };
  }

  function openEdit(m: Member) {
    active = null;
    editing = m;
    editOpen = true;
  }

  function onSaved(updated: Member) {
    members = members.map((x) => (x.id === updated.id ? updated : x));
    editOpen = false;
    editing = null;
  }

  // 新增學員 flow — owned here (the source opens it from this table's header).
  // Exposed via openAdd() so the 學員管理 page can trigger it too (bind:this).
  let addOpen = false;
  let adding: Member | null = null;
  export function openAdd() {
    adding = blankMember(members.length);
    addOpen = true;
  }
  function onAdded(m: Member) {
    members = [m, ...members];
    addOpen = false;
    adding = null;
  }
  function closeAdd() {
    addOpen = false;
    adding = null;
  }
</script>

<Card padding={0} style="overflow:hidden">
  <PanelHead title="學員名單" sub={compact ? `最近活躍 ${COMPACT_PREVIEW_LIMIT} 位` : counts.all + ' 位在學學員'}>
    <Button slot="right" size="sm" variant="primary" on:click={openAdd}>
      <Icon name="plus" size={15} />新增學員
    </Button>
  </PanelHead>

  {#if !compact}
    <div style="padding:4px 22px 0">
      <Tabs {tabs} bind:value={tab} />
    </div>
  {/if}

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:var(--df-bg-light)">
        <th class="th">學員</th>
        <th class="th">課程</th>
        {#if !compact}
          <th class="th">分校</th>
          <th class="th">授課教練</th>
          <th class="th">近況</th>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <th
          class="th"
          class:sortable={!compact}
          on:click={!compact ? toggleSort : undefined}
        >
          出席率{#if !compact}<span class="sort-caret" style="opacity:{sort.key === 'att'
                ? 1
                : 0.35}">{sort.key === 'att' && sort.dir === 'asc' ? '↑' : '↓'}</span>{/if}
        </th>
        {#if !compact}<th class="th">繳費</th>{/if}
        <th class="th">狀態</th>
        {#if !compact}<th class="th">剩餘堂數</th>{/if}
        <th class="th th-right"></th>
      </tr>
    </thead>
    <tbody>
      {#each visible as m (m.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <tr class="df-rowhover row" on:click={() => (active = m)}>
          <td class="td">
            <div style="display:flex;align-items:center;gap:11px">
              <Avatar name={m.initial} size="sm" color={m.color} />
              <div>
                <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{m.name}</div>
                <div
                  style="font-size:11.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)"
                >{m.id}</div>
              </div>
            </div>
          </td>
          <td class="td td-muted">{m.course}</td>
          {#if !compact}
            <td class="td td-muted">{m.campus}</td>
            <td class="td td-muted">{m.coach}</td>
            <td class="td">
              <div style="display:flex;gap:4px">
                {#each m.recent as mk}
                  <span class="att-dot" style="background:{ATT_MARK[mk][0]}" title={ATT_MARK[mk][1]}
                  ></span>
                {/each}
              </div>
            </td>
          {/if}
          <td class="td" style="width:150px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1">
                <ProgressBar value={m.att} height={6} tone={m.att >= 80 ? 'success' : 'warning'} />
              </div>
              <span
                style="font-size:13px;font-weight:700;color:var(--df-text-dark);width:34px;text-align:right"
              >{m.att}%</span>
            </div>
          </td>
          {#if !compact}
            <td class="td"><StatusBadge kind="pay" value={m.pay} /></td>
          {/if}
          <td class="td"><StatusBadge kind="member" value={m.status} /></td>
          {#if !compact}
            <td class="td td-dark">{m.remain} 堂</td>
          {/if}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <td class="td td-right" on:click|stopPropagation>
            <IconButton aria-label="檢視" variant="ghost" on:click={() => (active = m)}>
              <Icon name="chevron-right" size={18} color="var(--df-text-light)" />
            </IconButton>
          </td>
        </tr>
      {/each}
      {#if visible.length === 0}
        <tr>
          <td colspan="12" class="empty">找不到符合的學員</td>
        </tr>
      {/if}
    </tbody>
  </table>
</Card>

<MemberDialog member={active} onClose={() => (active = null)} onEdit={openEdit} />
<MemberEditDialog
  member={editing}
  open={editOpen}
  onClose={() => {
    editOpen = false;
    editing = null;
  }}
  onSave={onSaved}
/>
<MemberEditDialog member={adding} open={addOpen} onClose={closeAdd} onSave={onAdded} />

<style>
  .th {
    text-align: left;
    padding: 11px 22px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--df-text-light);
    letter-spacing: 0.03em;
    white-space: nowrap;
    user-select: none;
  }
  .th.sortable {
    color: var(--df-text-dark);
    cursor: pointer;
  }
  .th-right {
    text-align: right;
  }
  .sort-caret {
    margin-left: 4px;
  }
  .row {
    border-bottom: 1px solid var(--df-border);
    cursor: pointer;
  }
  .row:last-child {
    border-bottom: none;
  }
  .td {
    padding: 13px 22px;
  }
  .td-muted {
    font-size: 13.5px;
    color: var(--df-text-light);
  }
  .td-dark {
    font-size: 13.5px;
    color: var(--df-text-dark);
    font-weight: 600;
  }
  .td-right {
    text-align: right;
  }
  .att-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex: none;
  }
  .empty {
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
</style>
