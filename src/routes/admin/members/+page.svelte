<script lang="ts">
  /* 學員管理 — learner management page (admin.jsx MembersView). A PageHead (進階篩選
   * toggle) over the full MembersTable, which owns its own status tabs / row
   * dialog and reads the topbar `search` store. The 進階篩選 button toggles the
   * MemberFilterPanel, whose 套用 commits to the shared memberFilter store that
   * MembersTable folds into its filter call. The shell layout supplies the
   * sidebar + topbar.
   *
   * Task 5: data now arrives async via getMembers() (GET /users, admin — see
   * admin/api.ts). onMount loads it into a three-state gate (loading/error/ready),
   * matching how the other admin pages (orders/tickets/classes/coaches, Task 18)
   * hydrate their real seams. MembersTable renders the fetched MemberAccount[] as
   * an honest, slimmed table — no course/campus/coach/attendance/pay/tier columns
   * (P2: no backend data source, see issue #8), and no working 新增/編輯 (P2: no
   * admin create-or-edit-another-user endpoint, contract §3.2). */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import MemberFilterPanel from '$lib/admin/components/MemberFilterPanel.svelte';
  import { Button, Icon, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import type { MemberAccount } from '$lib/admin/data';
  import { getMembers } from '$lib/admin/api';

  let showFilter = false;

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let members: MemberAccount[] = [];

  function load() {
    phase = 'loading';
    getMembers()
      .then((d) => { members = d.members; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);
</script>

{#if phase === 'ready'}
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

    <MembersTable {members} />
  </div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div class="df-view" style="display:flex;flex-direction:column;gap:20px" data-testid="members-skeleton">
    <Skeleton w={180} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>
{/if}
