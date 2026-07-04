<script lang="ts">
  /* 編輯課程 / 新增班級 — edit form inside the shared EditModal. Faithful port of
   * admin.jsx ClassEditDialog: a 2-col field grid (班級名稱 spanning both cols,
   * then 分級 / 課程類別 / 授課教練 / 教室 / 上課日 / 時段 / 適合年齡 / 人數上限 / 本期期別 /
   * 本期堂數 / 季費 / 招生狀態). Holds a local `let f` copy of the class prop, reset
   * whenever the dialog transitions to open. Numeric fields (人數上限 / 本期堂數 /
   * 季費) are edited as text and parsed back on save.
   *
   * Task 8 piece 1: 儲存改為呼叫真實 POST/PATCH /courses（classes/+page.svelte 的
   * save() 是非同步的，可能失敗），這裡不再樂觀地立刻丟成功 toast——成功/失敗 toast
   * 一律由 page 在 API 呼叫結束後決定並顯示。單堂時長（duration_minutes）是 ClassRow
   * 沒有的欄位（唯讀映射本就無對應資料），只有「新增」流程需要它（POST 必填），故
   * 只在 isNew 時額外收集，並隨 onSave 的第二個參數一起送出。 */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { LEVELS, CATS, CLASS_STATUS, COACHES, type ClassRow, type Coach } from '$lib/admin/data';

  export let klass: ClassRow | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: ClassRow, durationMinutes: number) => void = () => {};
  // Caller (classes/+page.svelte) passes the getClasses() seam's coaches; the
  // COACHES import stays only as this prop's default (mirrors OrdersTable's
  // `export let rows: Order[] = ORDERS;`), so a standalone render still works.
  export let coaches: Coach[] = COACHES;

  const coachOptions = coaches.map((c) => c.name);

  // Local editable copy, reset whenever the klass prop changes (mirrors React's
  // useEffect(() => setF(k), [k])). Numeric fields are edited as text
  // (Input.value is a string) and parsed back on save.
  let f: ClassRow | null = klass;
  let capText = klass ? String(klass.cap) : '';
  let priceText = klass ? String(klass.price) : '';
  let sessionsText = klass ? String(klass.sessions) : '';
  // 單堂時長（分鐘）—— ClassRow 無此欄位，僅新增流程收集；預設 90 分鐘（沿用既有
  // fixture 常見值），可在送出前調整。
  let durationText = '90';
  let lastKlass: ClassRow | null = klass;
  $: if (klass !== lastKlass) {
    lastKlass = klass;
    f = klass ? { ...klass } : null;
    capText = klass ? String(klass.cap) : '';
    priceText = klass ? String(klass.price) : '';
    sessionsText = klass ? String(klass.sessions) : '';
    durationText = '90';
  }

  function save() {
    if (!f) return;
    const updated: ClassRow = {
      ...f,
      cap: parseInt(capText, 10) || 0,
      price: parseInt(priceText, 10) || 0,
      sessions: parseInt(sessionsText, 10) || 0
    };
    onSave(updated, parseInt(durationText, 10) || 0);
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
      {#if isNew}
        <Input label="單堂時長（分鐘）" bind:value={durationText} />
      {/if}
    </div>
  </EditModal>
{/if}
