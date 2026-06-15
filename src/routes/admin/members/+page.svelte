<script lang="ts">
  /* 學員管理 — learner management page (admin.jsx MembersView). Thin wrapper:
   * a PageHead (進階篩選 action, matching the source) over the full MembersTable,
   * which owns its own tabs / filter / sort / row dialogs AND the 新增學員 flow
   * (its header button), and reads the topbar `search` store. The shell layout
   * supplies the sidebar + topbar. */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import { Button, Icon } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';
</script>

<div class="df-view" style="display:flex;flex-direction:column;gap:20px">
  <PageHead title="學員管理" sub="管理報名、出席與會員資料">
    <Button
      slot="actions"
      variant="secondary"
      size="sm"
      on:click={() => toasts.notify('info', '進階篩選', '進階篩選面板開發中。')}
    >
      <Icon name="filter" size={15} />進階篩選
    </Button>
  </PageHead>

  <MembersTable />
</div>
