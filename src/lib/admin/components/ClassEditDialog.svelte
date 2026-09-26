<script lang="ts">
  /* 編輯課程 / 新增班級 — edit form inside the shared EditModal. Faithful port of
   * admin.jsx ClassEditDialog: a 2-col field grid (班級名稱 spanning both cols,
   * then 分級 / 課程類別 / 授課教練 / 上課日 / 時段 / 適合年齡 / 人數上限 / 季費 /
   * 單堂時長), plus a read-only 招生狀態 badge.
   *
   * R13 Task 4(C2):工作副本是 course-request.ts 的 CourseDraft(只含後端可寫欄位，
   * 數字欄位是文字緩衝)。場地/期別/堂數後端沒有，輸入已拿掉；招生狀態由後端依人數
   * 推導，改唯讀徽章。儲存時 checkCourseDraft() 驗證：不過就顯示錯誤、不呼叫 onSave；
   * 過了就把 ValidCourse 交給 onSave。成功/失敗 toast 一律由 page 在 API 呼叫結束後
   * 決定並顯示(Task 8 piece 1)。
   *
   * Reset(ADR-0015 entity 族):klass prop 變更時重建 draft(courseDraftOf 每次產生
   * 新物件，不別名呼叫端傳入的原實體)。 */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { LEVELS } from '$lib/domain/course-level';
  import type { Coach } from '$lib/domain/coaches';
  import { CATS, type ClassRow } from '$lib/admin/data';
  import { courseDraftOf, checkCourseDraft, type CourseDraft, type CourseErrors, type ValidCourse } from './course-request';

  export let klass: ClassRow | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (course: ValidCourse) => void | Promise<void> = () => {};
  // Caller (classes/+page.svelte) passes the getClasses() seam's coaches — required,
  // no mock fallback (Task 11 P2 cleanup); standalone renders (tests) must supply it.
  export let coaches: Coach[];

  const coachOptions = coaches.map((c) => c.name);

  let d: CourseDraft | null = klass ? courseDraftOf(klass) : null;
  let errors: CourseErrors = {};
  let lastKlass: ClassRow | null = klass;
  $: if (klass !== lastKlass) {
    lastKlass = klass;
    d = klass ? courseDraftOf(klass) : null;
    errors = {};
  }

  function save() {
    if (!d) return;
    const r = checkCourseDraft(d, coaches);
    if (r.kind === 'invalid') {
      errors = r.errors;
      return;
    }
    errors = {};
    return onSave(r.course);
  }
</script>

{#if d && klass}
  <EditModal
    {open}
    title={isNew ? '新增班級' : '編輯課程'}
    sub={isNew ? '建立新的開課班級' : '班級編號 ' + klass.id}
    icon="calendar-days"
    primaryLabel={isNew ? '建立班級' : '儲存課程'}
    {onClose}
    onSave={save}
  >
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="班級名稱" bind:value={d.name} error={errors.name ?? ''} style="grid-column:span 2" />
      <Select label="分級" bind:value={d.level} options={LEVELS} />
      <Select label="課程類別" bind:value={d.cat} options={CATS} />
      <Select label="授課教練" bind:value={d.coach} options={coachOptions} helper={errors.coach ?? ''} />
      <div class="status">
        <span class="status-label">招生狀態</span>
        <StatusBadge kind="classStatus" value={klass.status} />
      </div>
      <Input label="上課日" bind:value={d.day} />
      <Input label="時段" bind:value={d.time} />
      <Input label="適合年齡" bind:value={d.age} error={errors.age ?? ''} placeholder="例如 8–14 歲 / 12 歲以上 / 9 歲以下" />
      <Input label="人數上限" bind:value={d.capText} error={errors.cap ?? ''} />
      <Input label="季費 (NT$)" bind:value={d.priceText} error={errors.price ?? ''} />
      <Input label="單堂時長（分鐘）" bind:value={d.durationText} error={errors.duration ?? ''} />
    </div>
  </EditModal>
{/if}

<style>
  .status {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
  .status-label {
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    color: var(--df-text-dark);
  }
</style>
