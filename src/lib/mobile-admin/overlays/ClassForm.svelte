<script lang="ts">
  /* 課程 編輯 / 新增 sheet。forms.jsx ClassForm (75)。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('classForm',{k}) 都是新實例。
   * 儲存 → onSave(rec, durationMinutes, isNew)。Task 20：課程建立/編輯已接真
   * POST/PATCH /courses（見 admin/classes/+page.svelte 的 save()），呼叫端一律
   * 提供 onSave——不再有本地 store 假寫入 fallback（沒有 onSave 時單純不儲存，
   * 比起假裝成功更誠實）。單堂時長欄位比照桌面 ClassEditDialog：新增預設 90
   * 分鐘，編輯帶入該課程既有的 durationMinutes。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { get } from 'svelte/store';
  import { coaches as coachesStore } from '$lib/mobile-admin/stores';
  import { F_LEVELS, F_CATS, F_CLASS_STATUS } from '$lib/mobile-admin/form-options';
  import type { ClassRow, Coach } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let k: ClassRow | null = null;
  export let onSave: ((rec: ClassRow, durationMinutes: number, isNew: boolean) => void) | undefined = undefined;
  export let coaches: Coach[] = [];

  const isNew = !k;
  /* Coach options fall back to the live store when the host opens the form
   * without passing them (every current call site does). */
  const initCoaches = coaches.length ? coaches : get(coachesStore);
  /* Seed a COMPLETE ClassRow for new classes — ClassSheet renders term,
   * startDate, sessions, checkinRate, wait, makeup, so a partial record shows
   * `undefined` in the detail sheet. */
  let f: ClassRow = k
    ? { ...k }
    : {
        id: '',
        name: '',
        level: '基礎',
        cat: F_CATS[0],
        coach: (initCoaches[0] && initCoaches[0].name) || '',
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
        startDate: '2026/03/01',
        checkinRate: 90,
        makeup: 0,
        durationMinutes: 90
      };

  let capStr = String(f.cap ?? '');
  let priceStr = String(f.price ?? '');
  let durationStr = String(f.durationMinutes ?? '90');

  $: valid = !!(f.name || '').trim() && !!f.coach;
  $: coachOpts = coaches.length ? coaches : $coachesStore;

  function save() {
    const rec: ClassRow = {
      ...f,
      cap: parseInt(capStr, 10) || 0,
      price: parseInt(priceStr, 10) || 0,
      enrolled: f.enrolled || 0
    };
    if (onSave) onSave(rec, parseInt(durationStr, 10) || 0, isNew);
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增班級' : '編輯課程'}
  sub={isNew ? '建立新的開課班級' : '班級編號 ' + f.id}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <Input label="班級名稱" bind:value={f.name} />
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Select label="分級" bind:value={f.level} options={F_LEVELS} />
      <Select label="課程類別" bind:value={f.cat} options={F_CATS} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Select label="授課教練" bind:value={f.coach} options={coachOpts.map((c) => c.name)} />
      <Input label="教室 / 場地" bind:value={f.room} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="上課日" bind:value={f.day} />
      <Input label="時段" bind:value={f.time} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="適合年齡" bind:value={f.age} />
      <Input label="人數上限" bind:value={capStr} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="季費 (NT$)" bind:value={priceStr} />
      <Select label="招生狀態" bind:value={f.status} options={F_CLASS_STATUS} />
    </div>
    <Input label="單堂時長（分鐘）" bind:value={durationStr} />
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={!valid} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立班級' : '儲存課程'}
    </Button>
  </svelte:fragment>
</Sheet>
