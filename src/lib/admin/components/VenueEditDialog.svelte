<script lang="ts">
  /* 編輯場地 / 新增場地 — edit form inside the shared EditModal. Clone of
   * ClassEditDialog for the 場館管理 page: a 2-col field grid (場地代號 / 場地名稱 /
   * 場地簡介 spanning both cols / 狀態 spanning both cols / 器材配置 spanning both
   * cols, 、-separated text). Holds a local `let f` copy of the venue prop, reset
   * whenever the dialog transitions to open. 器材配置 is the 、/, -separated buffer
   * for the equip[] array.
   *
   * Task F4：欄位收斂到 VenueResponse 真實欄位(name/description/features/is_active)
   * ——移除無後端來源的 area/cap/今日排課 裝飾欄位(見 admin/api.ts mapVenue() 註解)。
   * 場地代號改顯示 slug(VenueResponse.slug)，固定唯讀：slug 由後端在建立時依名稱
   * 自動產生，新增模式下也不開放編輯，降低誤操作風險(選擇已於任務報告註明)。
   *
   * Task F4：儲存改為呼叫真實 POST/PATCH /venues（venues/+page.svelte 的 save() 是
   * 非同步的，可能失敗）——同 Task F1 的 TicketEditDialog，這裡不再樂觀地立刻丟成功
   * toast，成功/失敗 toast 一律由 page 在 API 呼叫結束後決定並顯示。
   *
   * Task F4 review 修正：本欄位標籤原為「場地類型」，但 buildVenueBody()
   * (routes/admin/venues/+page.svelte) 把它送進後端的 description，公開場地頁
   * (routes/venues/+page.svelte) 會把 description 渲染成客戶看到的場館介紹段落
   * ——標籤語意與實際去向不一致。改標籤為「場地簡介」並加一行 helper 提示；內部
   * 欄位名 f.type 不動(改名會漣漪到 Venue 型別與既有測試，不在本次範圍)。 */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { VENUE_STATUSES, VENUE_STATUS, type Venue } from '$lib/admin/data';

  export let venue: Venue | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Venue) => void = () => {};

  const statusOptions = VENUE_STATUSES.map((v) => ({ value: v, label: VENUE_STATUS[v][1] }));

  // Local editable copy + equipText buffer, reset whenever the venue prop changes
  // (mirrors React's useEffect(() => setF(v), [v])). equipText is the 、-separated
  // equip[] buffer.
  let f: Venue | null = venue ? { ...venue } : null;
  let equipText = venue ? venue.equip.join('、') : '';
  let lastVenue: Venue | null = venue;
  $: if (venue !== lastVenue) {
    lastVenue = venue;
    f = venue ? { ...venue } : null;
    equipText = venue ? venue.equip.join('、') : '';
  }

  function save() {
    if (!f) return;
    const updated: Venue = {
      ...f,
      equip: equipText
        .split(/[、,，]/)
        .map((e) => e.trim())
        .filter(Boolean)
    };
    return onSave(updated);
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增場地' : '編輯場地'}
    sub={isNew ? '建立新的訓練場地' : '場地代號 ' + f.slug}
    icon="building-2"
    primaryLabel={isNew ? '建立場地' : '儲存場地'}
    {onClose}
    onSave={save}
  >
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="場地代號" value={f.slug} disabled />
      <Input label="場地名稱" bind:value={f.name} />
      <Input
        label="場地簡介"
        bind:value={f.type}
        helper="此內容會顯示在公開的「場館介紹」頁面。"
        style="grid-column:span 2"
      />
      <Select label="狀態" bind:value={f.status} options={statusOptions} style="grid-column:span 2" />
      <Input label="器材配置（以、分隔）" bind:value={equipText} style="grid-column:span 2" />
    </div>
  </EditModal>
{/if}
