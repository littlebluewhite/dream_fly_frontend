<script lang="ts">
  /* 編輯場地 / 新增場地 — edit form inside the shared EditModal. Clone of
   * ClassEditDialog for the 場館管理 page: a 2-col field grid (場地代號 / 場地名稱 /
   * 場地類型 spanning both cols / 面積 / 容納人數 / 今日排課 / 狀態 / 器材配置 spanning
   * both cols, 、-separated text). Holds a local `let f` copy of the venue prop,
   * reset whenever the dialog transitions to open. Numeric fields (容納 / 今日排課)
   * edit as text and parse back on save; 器材配置 is the 、/, -separated buffer for
   * the equip[] array. The 場地代號 (id) is disabled when editing so the keyed id
   * is never mutated. On 儲存 it fires onSave(updated) AND a success toast. */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import { VENUE_STATUSES, VENUE_STATUS, type Venue } from '$lib/admin/data';

  export let venue: Venue | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Venue) => void = () => {};

  const statusOptions = VENUE_STATUSES.map((v) => ({ value: v, label: VENUE_STATUS[v][1] }));

  // Local editable copy + text buffers, reset whenever the venue prop changes
  // (mirrors React's useEffect(() => setF(v), [v])). Numeric fields are edited as
  // text and parsed back on save; equipText is the 、-separated equip[] buffer.
  let f: Venue | null = venue;
  let equipText = venue ? venue.equip.join('、') : '';
  let capText = venue ? String(venue.cap) : '';
  let todayText = venue ? String(venue.today) : '';
  let lastVenue: Venue | null = venue;
  $: if (venue !== lastVenue) {
    lastVenue = venue;
    f = venue ? { ...venue } : null;
    equipText = venue ? venue.equip.join('、') : '';
    capText = venue ? String(venue.cap) : '';
    todayText = venue ? String(venue.today) : '';
  }

  function save() {
    if (!f) return;
    const updated: Venue = {
      ...f,
      cap: parseInt(capText, 10) || 0,
      today: parseInt(todayText, 10) || 0,
      equip: equipText
        .split(/[、,，]/)
        .map((e) => e.trim())
        .filter(Boolean)
    };
    onSave(updated);
    toasts.notify('success', isNew ? '已新增場地' : '已儲存場地', '「' + updated.name + '」已' + (isNew ? '建立' : '更新') + '。');
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增場地' : '編輯場地'}
    sub={isNew ? '建立新的訓練場地' : '場地代號 ' + f.id}
    icon="building-2"
    primaryLabel={isNew ? '建立場地' : '儲存場地'}
    {onClose}
    onSave={save}
  >
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="場地代號" bind:value={f.id} disabled={!isNew} />
      <Input label="場地名稱" bind:value={f.name} />
      <Input label="場地類型" bind:value={f.type} style="grid-column:span 2" />
      <Input label="面積" bind:value={f.area} />
      <Input label="容納人數" bind:value={capText} />
      <Input label="今日排課" bind:value={todayText} />
      <Select label="狀態" bind:value={f.status} options={statusOptions} />
      <Input label="器材配置（以、分隔）" bind:value={equipText} style="grid-column:span 2" />
    </div>
  </EditModal>
{/if}
