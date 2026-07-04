<script lang="ts">
  /* 課程管理 — faithful port of admin.jsx ClassesView. A PageHead (title +
   * 新增課程 primary), a category chip row (全部 + one FilterChip per CAT), then a
   * responsive grid of ClassCard for the classes filtered by the selected
   * category AND the topbar search store (matches name / coach). Clicking a card
   * opens the read-only ClassDialog; 編輯 / 新增課程 open the ClassEditDialog.
   *
   * Data now arrives async via getClasses() (public seam): onMount loads it into
   * a three-state gate (loading/error/ready). `classes` is the local mutable
   * working copy 新增/編輯 edits in place; `coaches` is read-only here (blankClass's
   * default coach + the ClassEditDialog 授課教練 picker).
   *
   * Task 8 piece 1: 新增/編輯 now submit to the real POST /courses / PATCH
   * /courses/{id} (createCourse/updateCourse, admin/api.ts) instead of only
   * mutating `classes` locally. buildCourseBody() (course-request.ts) assembles
   * the request body from the edited ClassRow; on success the response is mapped
   * back through the same mapCourse() the read seam uses (so the row shown here
   * matches exactly what a fresh getClasses() would render) and merged into
   * `classes`; on failure the list is left untouched and a 繁中 error toast shows
   * — the dialog stays open so the admin can correct and retry. */
  import { onMount } from 'svelte';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import ClassCard from '$lib/admin/components/ClassCard.svelte';
  import ClassDialog from '$lib/admin/components/ClassDialog.svelte';
  import ClassEditDialog from '$lib/admin/components/ClassEditDialog.svelte';
  import { Button, Icon, FilterChip, Card, ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { filterClasses } from '$lib/admin/components/classes-filter';
  import { buildCourseBody } from '$lib/admin/components/course-request';
  import { search, toasts } from '$lib/admin/stores';
  import { CATS, type ClassRow, type Coach } from '$lib/admin/data';
  import { getClasses, createCourse, updateCourse, mapCourse } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

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

  // 422 驗證 / 403 權限 / 409 衝突（如同名課程 slug 撞號）→ 對應的繁中錯誤提示；
  // 其餘（連線問題等）給通用訊息，同 coach/+page.svelte 的 ApiError 判斷慣例。
  function courseErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 422) return '輸入資料不符規則，請確認後再試。';
      if (e.status === 403) return '沒有權限執行此操作。';
      if (e.status === 409) return '課程名稱或代碼已存在，請調整後再試。';
    }
    return '連線發生問題，請稍後再試。';
  }

  async function save(updated: ClassRow, durationMinutes: number) {
    const body = buildCourseBody(updated, coaches);
    const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));
    try {
      if (addNew) {
        const created = await createCourse({ ...body, duration_minutes: durationMinutes });
        classes = [mapCourse(created, coachNameById), ...classes];
        toasts.notify('success', '已新增班級', '「' + updated.name + '」已建立。');
      } else {
        const saved = await updateCourse(updated.id, body);
        classes = classes.map((c) => (c.id === updated.id ? mapCourse(saved, coachNameById) : c));
        toasts.notify('success', '已儲存課程', '「' + updated.name + '」已更新。');
      }
      closeEdit();
    } catch (e) {
      toasts.notify('error', addNew ? '新增失敗' : '儲存失敗', courseErrorMessage(e));
    }
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
