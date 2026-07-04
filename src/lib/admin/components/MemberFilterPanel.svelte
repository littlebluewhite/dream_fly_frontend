<script lang="ts">
  /* 進階篩選 — collapsible filter Card for 學員管理 (學員管理頁, MembersTable's !compact
   * variant). Holds local field state; 套用 commits to the shared `memberFilter`
   * store (folded into MembersTable's filterMemberAccounts call), 重設 clears both
   * the local field and the store back to pass-through.
   *
   * Task 5 (issue #8): retyped to the real GET /users shape (MemberAccount) — 報名
   * 課程 / 繳費狀態 / 出席率區間 removed, since a plain user account has no course/pay/
   * attendance data (P2: 需後端欄位). Only 最低點數 remains (MemberAccount.points is
   * real). 狀態 (啟用中/已停用) narrowing stays local to MembersTable's own tabs, same
   * as before (never lived in this panel/store). */
  import { get } from 'svelte/store';
  import { Button, Card, Input, Icon } from '$lib/components/ui';
  import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

  export let open = false;

  // Local field buffer (committed to the store only on 套用). Hydrate from the
  // persisted store so a filter applied before navigating away stays visible on
  // remount, instead of showing blank while the table is still narrowed.
  const seed = get(memberFilter);
  let pointsMinText = seed.pointsMin != null ? String(seed.pointsMin) : '';

  function parsePoints(s: string): number | undefined {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? undefined : n;
  }

  function apply() {
    memberFilter.set({ pointsMin: parsePoints(pointsMinText) });
  }

  function reset() {
    pointsMinText = '';
    memberFilter.set({ ...MEMBER_FILTER_DEFAULT });
  }
</script>

{#if open}
  <Card padding={20}>
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
      <Icon name="filter" size={16} color="var(--df-primary)" />
      <span style="font-size:14px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);">
        進階篩選
      </span>
    </div>

    <!-- P2 (issue #8): 報名課程 / 繳費狀態 / 出席率區間 篩選已移除 —— GET /users（真實
         getMembers() 資料）沒有對應資料來源。狀態篩選改用 MembersTable 的全部/啟用中/
         已停用分頁籤（對應 MemberAccount.status），不在此面板重複提供。 -->
    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
      <Input label="最低點數" type="number" bind:value={pointsMinText} placeholder="0" />
    </div>

    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
      <Button variant="secondary" size="sm" on:click={reset}>重設</Button>
      <Button variant="primary" size="sm" on:click={apply}>套用</Button>
    </div>
  </Card>
{/if}
