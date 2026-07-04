<script lang="ts">
  /* 學員名單 — the shared learner table (admin.jsx MembersTable), used both
   * embedded in the dashboard (compact) and on the 學員管理 page (full).
   *
   * compact (dashboard preview, `rows` prop): UNCHANGED mock-data behaviour, out
   * of this task's scope (getMembers() wiring is 學員管理-page-only — see issue #8).
   * Shows 學員/課程/出席率/狀態, capped at 6 rows, and keeps its own mock-only 新增/編輯
   * flow (MemberEditDialog mutating local state — this was never backend-wired,
   * even before Task 5).
   *
   * full (學員管理 page, `members` prop) — Task 5: 誠實精簡表格. Real GET /users data
   * (MemberAccount: id/name/initial/phone/joined/status/points — the only fields
   * the backend actually returns for a generic account; see admin/api.ts's
   * getMembers()). Every column/action that depended on a no-backend-source field
   * (代表色, 課程, 分校, 授課教練, 出席率/近況, 繳費, 剩餘堂數, 續費, 生日, 會員分級, 緊急聯絡人…)
   * is hidden — not fake-filled — marked P2 below (issue #8). 新增/編輯 are hidden
   * too: integration-contract.md §3.2 has no admin create-or-edit-another-user
   * endpoint (only GET /users, GET /users/{id}, PATCH /users/me), so a working
   * add/edit form here would silently fail to persist. A read-only detail view
   * (MemberDialog's `account` branch) is offered instead of a fake-working edit
   * form. */
  import { Avatar, Card, Button, IconButton, Icon, Tabs, ProgressBar } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import MemberDialog from './MemberDialog.svelte';
  import MemberEditDialog from './MemberEditDialog.svelte';
  import { MEMBERS, type Member, type MemberAccount } from '$lib/admin/data';
  import { search, memberFilter } from '$lib/admin/stores';
  import { filterMembers, blankMember } from './members-filter';
  import { filterMemberAccounts, countByAccountStatus, type MemberAccountStatusFilter } from './member-account-filter';

  const COMPACT_PREVIEW_LIMIT = 6;

  export let compact = false;
  // compact-only（dashboard 預覽）：維持既有 mock Member[]，本次任務未變動範圍。
  export let rows: Member[] = MEMBERS;
  // 學員管理頁（!compact）：getMembers() 回傳的真實資料。
  export let members: MemberAccount[] = [];

  /* ───────────────────────── compact（dashboard 預覽，邏輯未變動） ───────────────────────── */

  // Local working copy so saves reflect immediately (mirrors the source useState).
  let compactRows: Member[] = rows;
  $: compactRows = rows;

  let active: Member | null = null;
  let editing: Member | null = null;
  let editOpen = false;

  $: visible = filterMembers(compactRows, { query: $search, status: 'all' }).slice(
    0,
    COMPACT_PREVIEW_LIMIT
  );

  function openEdit(m: Member) {
    active = null;
    editing = m;
    editOpen = true;
  }

  function onSaved(updated: Member) {
    compactRows = compactRows.map((x) => (x.id === updated.id ? updated : x));
    editOpen = false;
    editing = null;
  }

  // 新增學員 flow — compact-only (dashboard preview's mock add flow; unrelated to
  // 學員管理頁, which hides 新增 below — see the P2 note in the !compact branch).
  let addOpen = false;
  let adding: Member | null = null;
  export function openAdd() {
    adding = blankMember(compactRows.length);
    addOpen = true;
  }
  function onAdded(m: Member) {
    compactRows = [m, ...compactRows];
    addOpen = false;
    adding = null;
  }
  function closeAdd() {
    addOpen = false;
    adding = null;
  }

  /* ───────────────────────── !compact（學員管理頁，Task 5：真實 getMembers() 資料） ───────────────────────── */

  let accStatus: MemberAccountStatusFilter = 'all';
  let activeAccount: MemberAccount | null = null;

  $: accCounts = countByAccountStatus(members);
  $: accTabs = [
    { value: 'all', label: '全部', count: accCounts.all },
    { value: 'active', label: '啟用中', count: accCounts.active },
    { value: 'inactive', label: '已停用', count: accCounts.inactive }
  ];
  $: accVisible = filterMemberAccounts(members, {
    query: $search,
    status: accStatus,
    pointsMin: $memberFilter.pointsMin
  });
</script>

{#if compact}
  <Card padding={0} style="overflow:hidden">
    <PanelHead title="學員名單" sub={`最近活躍 ${COMPACT_PREVIEW_LIMIT} 位`}>
      <Button slot="right" size="sm" variant="primary" on:click={openAdd}>
        <Icon name="plus" size={15} />新增學員
      </Button>
    </PanelHead>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:var(--df-bg-light)">
          <th class="th">學員</th>
          <th class="th">課程</th>
          <th class="th">出席率</th>
          <th class="th">狀態</th>
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
            <td class="td"><StatusBadge kind="member" value={m.status} /></td>
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
{:else}
  <Card padding={0} style="overflow:hidden">
    <PanelHead title="學員名單" sub={accCounts.all + ' 位學員'} />
    <!-- P2 (issue #8): 新增學員按鈕已隱藏 —— integration-contract.md §3.2 沒有 admin
         新增使用者端點（只有 GET /users、GET /users/{id}、PATCH /users/me），假的新增
         表單無法真正持久化。 -->

    <div style="padding:4px 22px 0">
      <Tabs tabs={accTabs} bind:value={accStatus} />
    </div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <!-- P2 (issue #8): 代表色、課程、分校、授課教練、出席率/近況、繳費、剩餘堂數、續費、
             生日、會員分級、緊急聯絡人等欄位在 GET /users 沒有對應資料來源，誠實隱藏（不以假
             資料填充），僅保留下列 5 欄真實資料。 -->
        <tr style="background:var(--df-bg-light)">
          <th class="th">學員</th>
          <th class="th">電話</th>
          <th class="th">加入日</th>
          <th class="th">狀態</th>
          <th class="th">點數</th>
          <th class="th th-right"></th>
        </tr>
      </thead>
      <tbody>
        {#each accVisible as m (m.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <tr class="df-rowhover row" on:click={() => (activeAccount = m)}>
            <td class="td">
              <div style="display:flex;align-items:center;gap:11px">
                <Avatar name={m.initial} size="sm" />
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{m.name}</div>
                  <div
                    style="font-size:11.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)"
                  >{m.id}</div>
                </div>
              </div>
            </td>
            <td class="td td-muted">{m.phone || '—'}</td>
            <td class="td td-muted">{m.joined}</td>
            <td class="td"><StatusBadge kind="memberAccount" value={m.status} /></td>
            <td class="td td-dark">{m.points}</td>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <td class="td td-right" on:click|stopPropagation>
              <IconButton aria-label="檢視" variant="ghost" on:click={() => (activeAccount = m)}>
                <Icon name="chevron-right" size={18} color="var(--df-text-light)" />
              </IconButton>
            </td>
          </tr>
        {/each}
        {#if accVisible.length === 0}
          <tr>
            <td colspan="6" class="empty">找不到符合的學員</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </Card>

  <MemberDialog account={activeAccount} onClose={() => (activeAccount = null)} />
  <!-- P2 (issue #8): 編輯 affordance 已隱藏（不掛 MemberEditDialog、不傳 onEdit）——沒有
       admin 編輯他人 users 的端點，唯讀檢視即可，不留一個實際上存不進去的假編輯表單。 -->
{/if}

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
  .th-right {
    text-align: right;
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
  .empty {
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
</style>
