<script lang="ts">
  /* 學員管理 — learner management page (admin.jsx MembersView). Thin wrapper:
   * PageHead (新增學員 action) over the full MembersTable, which owns its own
   * tabs / filter / sort / row-view + edit dialogs and reads the topbar `search`
   * store. The shell layout supplies the sidebar + topbar.
   *
   * 新增學員 here opens a MemberEditDialog seeded with a blank Member (the
   * prototype's blankMember). NOTE: the frozen MemberEditDialog is edit-only — it
   * always reads "編輯學員資料" and fires its own "已儲存" success toast on save —
   * so this page does not add a second toast; onSave just closes the dialog.
   * The dialog is mounted under {#if addOpen} (fresh, with member already set +
   * open=true) so it renders its body on the same flush — matching the frozen
   * component's tested mount path. */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import MembersTable from '$lib/admin/components/MembersTable.svelte';
  import MemberEditDialog from '$lib/admin/components/MemberEditDialog.svelte';
  import { Button, Icon } from '$lib/components/ui';
  import { CLASSES, COACHES, type Member } from '$lib/admin/data';

  const FIRST_COURSE = CLASSES[0].name;
  const FIRST_COACH = COACHES[0].name;

  /* A fresh blank Member (mirrors admin.jsx blankMember + the Member-only fields). */
  function blankMember(): Member {
    return {
      id: '',
      name: '',
      initial: '',
      color: '#0066CC',
      course: FIRST_COURSE,
      coach: FIRST_COACH,
      att: 100,
      status: 'active',
      age: 0,
      parent: '',
      phone: '',
      joined: '2026/06',
      points: 0,
      pay: 'trial',
      remain: 0,
      lastSeen: '—',
      recent: [],
      emName: '',
      emPhone: '',
      campus: '美村本館',
      source: '官網預約表單',
      birthday: '—',
      tier: '一般會員',
      tierColor: '#64748B',
      renewDue: '體驗 06/30 到期',
      lineId: ''
    };
  }

  let newMember: Member = blankMember();
  let addOpen = false;

  function openAdd() {
    newMember = blankMember();
    addOpen = true;
  }

  function closeAdd() {
    addOpen = false;
  }
</script>

<div class="df-view" style="display:flex;flex-direction:column;gap:20px">
  <PageHead title="學員管理" sub="管理報名、出席與會員資料">
    <Button slot="actions" variant="primary" size="sm" on:click={openAdd}>
      <Icon name="plus" size={15} />新增學員
    </Button>
  </PageHead>

  <MembersTable />
</div>

{#if addOpen}
  <MemberEditDialog member={newMember} open={true} onClose={closeAdd} onSave={closeAdd} />
{/if}
