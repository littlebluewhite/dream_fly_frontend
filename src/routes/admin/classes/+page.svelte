<script lang="ts">
  /* 課程管理 — faithful port of admin.jsx ClassesView. A PageHead (title +
   * 新增課程 primary), a category chip row (全部 + one FilterChip per CAT), then a
   * responsive grid of ClassCard for the classes filtered by the selected
   * category AND the topbar search store (matches name / coach). Clicking a card
   * opens the read-only ClassDialog; 編輯 / 新增課程 open the ClassEditDialog. The
   * row set is held locally so新增 / 儲存 reflect immediately (the prototype is
   * front-end only).
   *
   * Data now arrives async via getClasses() (mock-API seam): onMount loads it
   * into a three-state gate (loading/error/ready). `classes` is the local
   * mutable working copy 新增/編輯 edits in place; `coaches` is read-only here
   * (blankClass's default coach + the ClassEditDialog 授課教練 picker). */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import ClassCard from '$lib/admin/components/ClassCard.svelte';
  import ClassDialog from '$lib/admin/components/ClassDialog.svelte';
  import ClassEditDialog from '$lib/admin/components/ClassEditDialog.svelte';
  import { Button, Icon, FilterChip, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { filterClasses } from '$lib/admin/components/classes-filter';
  import { search } from '$lib/admin/stores';
  import { CATS, type ClassRow, type Coach } from '$lib/admin/data';
  import { getClasses } from '$lib/admin/api';

  // Blank班級 for the 新增 flow (ported from admin.jsx blankClass, enriched with
  // the ClassRow-only fields the detail view reads). Takes `coaches` as a
  // parameter (rather than reading the module-level seed) now that coaches
  // arrive through the getClasses() seam.
  const blankClass = (coaches: Coach[]): ClassRow => ({
    id: '',
    name: '',
    level: '基礎',
    cat: CATS[0],
    coach: coaches[0]?.name ?? '',
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

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let classes: ClassRow[] = [];
  let coaches: Coach[] = [];
  let cat = '全部';
  let detail: ClassRow | null = null;
  let edit: ClassRow | null = null;
  let editOpen = false;
  let addNew = false;

  function load() {
    phase = 'loading';
    getClasses()
      .then((d) => { classes = d.classes; coaches = d.coaches; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

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
    edit = blankClass(coaches);
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

{#if phase === 'ready'}
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
    <ClassEditDialog {coaches} klass={edit} open={editOpen} isNew={addNew} onClose={closeEdit} onSave={save} />
  </div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div class="view" data-testid="classes-skeleton">
    <Skeleton w={180} h={32} r={8} />
    <div class="chips">
      {#each [0, 1, 2, 3] as i (i)}
        <Skeleton w={72} h={32} r={16} />
      {/each}
    </div>
    <div class="grid">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={260} r={12} /></SkelCard>
      {/each}
    </div>
  </div>
{/if}

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
