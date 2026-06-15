<script lang="ts">
  /* 課程管理 — faithful port of admin.jsx ClassesView. A PageHead (title +
   * 新增課程 primary), a category chip row (全部 + one FilterChip per CAT), then a
   * responsive grid of ClassCard for the classes filtered by the selected
   * category AND the topbar search store (matches name / coach). Clicking a card
   * opens the read-only ClassDialog; 編輯 / 新增課程 open the ClassEditDialog. The
   * row set is held locally so新增 / 儲存 reflect immediately (the prototype is
   * front-end only). */
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import ClassCard from '$lib/admin/components/ClassCard.svelte';
  import ClassDialog from '$lib/admin/components/ClassDialog.svelte';
  import ClassEditDialog from '$lib/admin/components/ClassEditDialog.svelte';
  import { Button, Icon, FilterChip } from '$lib/components/ui';
  import { filterClasses } from '$lib/admin/components/classes-filter';
  import { search } from '$lib/admin/stores';
  import { CLASSES, CATS, COACHES, type ClassRow } from '$lib/admin/data';

  // Blank班級 for the 新增 flow (ported from admin.jsx blankClass, enriched with
  // the ClassRow-only fields the detail view reads).
  const blankClass = (): ClassRow => ({
    id: '',
    name: '',
    level: '基礎',
    cat: CATS[0],
    coach: COACHES[0].name,
    room: '',
    day: '',
    time: '',
    enrolled: 0,
    cap: 12,
    age: '',
    price: 3200,
    status: '招生中',
    wait: 0,
    term: '2026 春季',
    sessions: 16,
    startDate: '',
    checkinRate: 0,
    makeup: 0
  });

  const cats = ['全部', ...CATS];

  let classes: ClassRow[] = CLASSES;
  let cat = '全部';
  let detail: ClassRow | null = null;
  let edit: ClassRow | null = null;
  let editOpen = false;
  let addNew = false;

  $: list = filterClasses(classes, { cat, query: $search });

  function openDetail(k: ClassRow) {
    detail = k;
  }
  function openEdit(k: ClassRow) {
    detail = null;
    addNew = false;
    edit = k;
    editOpen = true;
  }
  function openNew() {
    detail = null;
    addNew = true;
    edit = blankClass();
    editOpen = true;
  }
  function closeEdit() {
    editOpen = false;
    edit = null;
    addNew = false;
  }
  function save(updated: ClassRow) {
    if (addNew) {
      const id = 'k' + (classes.length + 1);
      classes = [{ ...updated, id }, ...classes];
    } else {
      classes = classes.map((c) => (c.id === updated.id ? updated : c));
    }
    closeEdit();
  }
</script>

<div class="view">
  <PageHead title="課程管理" sub={classes.length + ' 個開課班級 · 本季招生中'}>
    <svelte:fragment slot="actions">
      <Button variant="primary" size="sm" on:click={openNew}>
        <Icon name="plus" size={15} />新增課程
      </Button>
    </svelte:fragment>
  </PageHead>

  <div class="chips">
    {#each cats as c}
      <FilterChip selected={cat === c} on:click={() => (cat = c)}>{c}</FilterChip>
    {/each}
  </div>

  <div class="grid">
    {#each list as k (k.id)}
      <ClassCard {k} onEdit={() => openEdit(k)} onOpen={() => openDetail(k)} />
    {/each}
  </div>

  {#if list.length === 0}
    <div class="empty">找不到符合的班級</div>
  {/if}

  <ClassDialog klass={detail} onClose={() => (detail = null)} onEdit={openEdit} />
  <ClassEditDialog klass={edit} open={editOpen} isNew={addNew} onClose={closeEdit} onSave={save} />
</div>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
    gap: 16px;
  }
  .empty {
    padding: 40px 0;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
  /* leading icon beside the PageHead action label */
  .view :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
