<script lang="ts">
  /* 課程 編輯 / 新增 sheet。forms.jsx ClassForm (75)。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('classForm',{k}) 都是新實例。
   * 儲存 → onSave(course, isNew)。Task 20：課程建立/編輯已接真
   * POST/PATCH /courses（見 mobile-admin classes 頁），呼叫端一律提供 onSave——
   * 不再有本地 store 假寫入 fallback（沒有 onSave 時單純不儲存，比起假裝成功更誠實）。
   * Task 2：新增課程的空白 ClassRow 改用 blankClassRow()（course-request.ts）——
   * 與桌面 classes/+page.svelte 共用同一份預設值。分類選項用 admin/data.ts 的 CATS。
   *
   * R13 Task 4(C2)：工作副本是桌面同一份 CourseDraft，主按鈕 disabled 依
   * checkCourseDraft() 的結果，送出的是驗證過的 ValidCourse。場地/招生狀態輸入已
   * 拿掉——場地後端沒有，招生狀態由後端依人數推導(列表卡與詳情 sheet 唯讀顯示)。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { get } from 'svelte/store';
  import { coaches as coachesStore } from '$lib/mobile-admin/stores';
  import { F_LEVELS } from '$lib/mobile-admin/form-options';
  import { CATS, type ClassRow } from '$lib/admin/data';
  import { blankClassRow, courseDraftOf, checkCourseDraft, type ValidCourse } from '$lib/admin/components/course-request';
  import type { Coach } from '$lib/domain/coaches';

  export let onClose: () => void;
  export let k: ClassRow | null = null;
  export let onSave: ((course: ValidCourse, isNew: boolean) => void | Promise<unknown>) | undefined = undefined;
  export let coaches: Coach[] = [];

  const isNew = !k;
  /* Coach options fall back to the live store when the host opens the form
   * without passing them (every current call site does). */
  const initCoaches = coaches.length ? coaches : get(coachesStore);
  let d = courseDraftOf(k ?? blankClassRow(initCoaches));

  $: coachOpts = coaches.length ? coaches : $coachesStore;
  $: check = checkCourseDraft(d, coachOpts);

  function save() {
    if (check.kind !== 'valid') return;
    if (onSave) onSave(check.course, isNew);
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增班級' : '編輯課程'}
  sub={isNew ? '建立新的開課班級' : '班級編號 ' + (k?.id ?? '')}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <Input label="班級名稱" bind:value={d.name} />
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Select label="分級" bind:value={d.level} options={F_LEVELS} />
      <Select label="課程類別" bind:value={d.cat} options={CATS} />
    </div>
    <Select label="授課教練" bind:value={d.coach} options={coachOpts.map((c) => c.name)} />
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="上課日" bind:value={d.day} />
      <Input label="時段" bind:value={d.time} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="適合年齡" bind:value={d.age} placeholder="例如 8–14 歲" />
      <Input label="人數上限" bind:value={d.capText} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="季費 (NT$)" bind:value={d.priceText} />
      <Input label="單堂時長（分鐘）" bind:value={d.durationText} />
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={check.kind !== 'valid'} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立班級' : '儲存課程'}
    </Button>
  </svelte:fragment>
</Sheet>
