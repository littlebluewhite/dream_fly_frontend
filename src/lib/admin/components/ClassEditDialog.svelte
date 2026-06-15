<script lang="ts">
  /* 編輯課程 / 新增班級 — edit form inside the shared EditModal. Faithful port of
   * admin.jsx ClassEditDialog: a 2-col field grid (班級名稱 spanning both cols,
   * then 分級 / 課程類別 / 授課教練 / 教室 / 上課日 / 時段 / 適合年齡 / 人數上限 / 本期期別 /
   * 本期堂數 / 季費 / 招生狀態). Holds a local `let f` copy of the class prop, reset
   * whenever the dialog transitions to open. Numeric fields (人數上限 / 本期堂數 /
   * 季費) are edited as text and parsed back on save. On 儲存 it fires
   * onSave(updated) AND a success toast. */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import { LEVELS, CATS, CLASS_STATUS, COACHES, type ClassRow } from '$lib/admin/data';

  export let klass: ClassRow | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: ClassRow) => void = () => {};

  const coachOptions = COACHES.map((c) => c.name);

  // Local editable copy, reset whenever the klass prop changes (mirrors React's
  // useEffect(() => setF(k), [k])). Numeric fields are edited as text
  // (Input.value is a string) and parsed back on save.
  let f: ClassRow | null = klass;
  let capText = klass ? String(klass.cap) : '';
  let priceText = klass ? String(klass.price) : '';
  let sessionsText = klass ? String(klass.sessions) : '';
  let lastKlass: ClassRow | null = klass;
  $: if (klass !== lastKlass) {
    lastKlass = klass;
    f = klass ? { ...klass } : null;
    capText = klass ? String(klass.cap) : '';
    priceText = klass ? String(klass.price) : '';
    sessionsText = klass ? String(klass.sessions) : '';
  }

  function save() {
    if (!f) return;
    const updated: ClassRow = {
      ...f,
      cap: parseInt(capText, 10) || 0,
      price: parseInt(priceText, 10) || 0,
      sessions: parseInt(sessionsText, 10) || 0
    };
    onSave(updated);
    toasts.notify('success', isNew ? '已新增班級' : '已儲存課程', '「' + updated.name + '」已' + (isNew ? '建立' : '更新') + '。');
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增班級' : '編輯課程'}
    sub={isNew ? '建立新的開課班級' : '班級編號 ' + f.id}
    icon="calendar-days"
    primaryLabel={isNew ? '建立班級' : '儲存課程'}
    {onClose}
    onSave={save}
  >
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="班級名稱" bind:value={f.name} style="grid-column:span 2" />
      <Select label="分級" bind:value={f.level} options={LEVELS} />
      <Select label="課程類別" bind:value={f.cat} options={CATS} />
      <Select label="授課教練" bind:value={f.coach} options={coachOptions} />
      <Input label="教室 / 場地" bind:value={f.room} />
      <Input label="上課日" bind:value={f.day} />
      <Input label="時段" bind:value={f.time} />
      <Input label="適合年齡" bind:value={f.age} />
      <Input label="人數上限" bind:value={capText} />
      <Input label="本期期別" bind:value={f.term} />
      <Input label="本期堂數" bind:value={sessionsText} />
      <Input label="季費 (NT$)" bind:value={priceText} />
      <Select label="招生狀態" bind:value={f.status} options={CLASS_STATUS} />
    </div>
  </EditModal>
{/if}
