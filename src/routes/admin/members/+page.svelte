<script lang="ts">
  /* 學員管理 — learner management page (admin.jsx MembersView). Thin wrapper:
   * a PageHead (進階篩選 toggle, matching the source) over the full MembersTable,
   * which owns its own tabs / filter / sort / row dialogs AND the 新增學員 flow
   * (its header button), and reads the topbar `search` store. The 進階篩選 button
   * toggles the MemberFilterPanel, whose 套用 commits to the shared memberFilter
   * store that MembersTable folds into its filterMembers() call. The shell layout
   * supplies the sidebar + topbar. */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import MemberFilterPanel from '$lib/admin/components/MemberFilterPanel.svelte';
  import { Button, Icon } from '$lib/components/ui';

  let showFilter = false;
</script>

<div class="df-view" style="display:flex;flex-direction:column;gap:20px">
  <PageHead title="學員管理" sub="管理報名、出席與會員資料">
    <Button
      slot="actions"
      variant="secondary"
      size="sm"
      on:click={() => (showFilter = !showFilter)}
    >
      <Icon name="filter" size={15} />進階篩選
    </Button>
  </PageHead>

  <MemberFilterPanel open={showFilter} />

  <MembersTable />
</div>
