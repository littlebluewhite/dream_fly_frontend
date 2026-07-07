<script lang="ts">
  /* 學員名單 — the shared learner table (admin.jsx MembersTable), used both
   * embedded in the dashboard (compact) and on the 學員管理 page (full).
   *
   * compact (dashboard preview) — Task 15: shares the SAME real GET /users data
   * as the full page (`members` prop, MemberAccount[]), just capped at 6 rows and
   * without the status tabs. Still no 新增/編輯 here (Task 16) — this is a preview
   * surface (dashboard glance), not the management page; those actions live only
   * in the full variant below.
   *
   * full (學員管理 page, `members` prop) — Task 5: 誠實精簡表格. Real GET /users data
   * (MemberAccount: id/name/initial/phone/joined/status/points — the only fields
   * the backend actually returns for a generic account; see admin/api.ts's
   * getMembers()). Every column that depends on a no-backend-source field (代表色,
   * 課程, 分校, 授課教練, 出席率/近況, 繳費, 剩餘堂數, 續費, 生日, 會員分級, 緊急聯絡人…) is still
   * hidden — not fake-filled — marked P2 below (issue #8, unchanged).
   *
   * 新增/編輯 (Task 16): now wired for real — integration-contract.md §3.2 gained
   * POST /users (admin) and PATCH /users/{id} (admin) since Round 2 Task 5 hid
   * these buttons. `onNew`/`onEdit` are plain callback props fired on click; this
   * component owns no dialog or API-call state of its own — members/+page.svelte
   * owns MemberCreateDialog/MemberEditDialog, the createMember/updateMember
   * calls, the success/error toasts, and the post-save getMembers() refresh
   * (same ownership split as classes/venues/coupons +page.svelte use for their
   * own 新增/編輯 flows). The read-only MemberDialog (`account` branch) is
   * unchanged — row click still opens it for a detail glance; the new 編輯 icon
   * button opens the edit form directly, without routing through that read-only
   * step. */
  import { Avatar, Button, Card, IconButton, Icon, Tabs } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import MemberDialog from './MemberDialog.svelte';
  import type { MemberAccount } from '$lib/admin/data';
  import { search, memberFilter } from '$lib/admin/stores';
  import { filterMemberAccounts, countByAccountStatus, type MemberAccountStatusFilter } from './member-account-filter';

  const COMPACT_PREVIEW_LIMIT = 6;

  export let compact = false;
  // 兩種模式共用同一份真實資料（GET /users，見 admin/api.ts 的 getMembers()）。
  export let members: MemberAccount[] = [];
  // 複審修復（Finding 2）：!compact 標題「N 位學員」要用 getMembers() 回應的未篩選總數，
  // 不是目前這一頁的 members.length（Task 17 分頁後 members 只剩該頁 ≤20 筆，會低報）。
  // 未提供時退回 members.length，維持 compact（dashboard 預覽，不讀這個值）等既有呼叫端相容。
  export let total: number = members.length;
  // !compact-only（Task 16）：新增/編輯的實際 dialog + API 呼叫由 members/+page.svelte
  // 負責，這裡只是單純的按鈕/圖示觸發。
  export let onNew: () => void = () => {};
  export let onEdit: (m: MemberAccount) => void = () => {};

  /* ───────────────────────── compact（dashboard 預覽，Task 15：改吃真實 members） ───────────────────────── */

  let activePreview: MemberAccount | null = null;

  $: visible = filterMemberAccounts(members, { query: $search, status: 'all' }).slice(
    0,
    COMPACT_PREVIEW_LIMIT
  );

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
    <PanelHead title="學員名單" sub={`最近活躍 ${COMPACT_PREVIEW_LIMIT} 位`} />
    <!-- Task 16: 新增學員按鈕刻意不在這裡渲染——雖然 POST /users 端點現已存在（見下方
         !compact 分支的 PanelHead），但這是 dashboard 預覽（compact），不是學員管理頁，
         新增/編輯操作只在完整頁面提供。 -->

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <!-- P2 (issue #8)：課程/出席率/分校/繳費等欄位在 GET /users 沒有對應資料來源，誠實
             隱藏——欄位與下方 !compact 分支完全一致（5 欄真實資料）。 -->
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
        {#each visible as m (m.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <tr class="df-rowhover row" on:click={() => (activePreview = m)}>
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
              <IconButton aria-label="檢視" variant="ghost" on:click={() => (activePreview = m)}>
                <Icon name="chevron-right" size={18} color="var(--df-text-light)" />
              </IconButton>
            </td>
          </tr>
        {/each}
        {#if visible.length === 0}
          <tr>
            <td colspan="6" class="empty">找不到符合的學員</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </Card>

  <MemberDialog account={activePreview} onClose={() => (activePreview = null)} />
{:else}
  <Card padding={0} style="overflow:hidden">
    <PanelHead title="學員名單" sub={total + ' 位學員'}>
      <Button slot="right" size="sm" variant="primary" on:click={onNew}>
        <Icon name="plus" size={15} />新增學員
      </Button>
    </PanelHead>

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
              <div style="display:flex;gap:4px;justify-content:flex-end">
                <IconButton aria-label="編輯" variant="ghost" on:click={() => onEdit(m)}>
                  <Icon name="pencil-line" size={17} color="var(--df-text-light)" />
                </IconButton>
                <IconButton aria-label="檢視" variant="ghost" on:click={() => (activeAccount = m)}>
                  <Icon name="chevron-right" size={18} color="var(--df-text-light)" />
                </IconButton>
              </div>
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
  <!-- Task 16: 編輯 affordance 是上面每列的獨立 pencil-line 圖示（onEdit(m)），不是這顆
       唯讀 MemberDialog 的按鈕——契約 §3.2 的 PATCH /users/{id} 只能改 name/phone/
       is_active 三欄，跟這顆 dialog 顯示的欄位組合不同，直接開獨立編輯表單更誠實，不必
       先繞進唯讀檢視再找編輯入口。 -->
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
