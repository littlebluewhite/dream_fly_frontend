<script lang="ts">
  /* 編輯票券 / 新增票券 — edit form inside the shared EditModal. Clone of
   * ClassEditDialog for the 票券管理 page: a 2-col field grid (票券名稱 spanning both
   * cols, 方案說明 spanning both cols, then 票券類型 / 票價 / 已售張數 / 配額). Holds a
   * local `let f` copy of the ticket prop, reset whenever the dialog transitions
   * to open. Numeric fields (票價 / 已售 / 配額) are edited as text and parsed back on
   * save. On 儲存 it fires onSave(updated) AND a success toast.
   *
   * Quota clamp: an empty/0 配額 would make max=0 in the ticket ProgressBar and
   * render NaN% (ProgressBar.svelte:15 divides by max), so we floor it at 1. */
  import { Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import { TICKET_TYPES, TICKET_TYPE, type Ticket } from '$lib/admin/data';

  export let ticket: Ticket | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Ticket) => void = () => {};

  const typeOptions = TICKET_TYPES.map((v) => ({ value: v, label: TICKET_TYPE[v][1] }));

  // Local editable copy, reset whenever the ticket prop changes (mirrors React's
  // useEffect(() => setF(t), [t])). Numeric fields are edited as text
  // (Input.value is a string) and parsed back on save.
  let f: Ticket | null = ticket;
  let priceText = ticket ? String(ticket.price) : '';
  let soldText = ticket ? String(ticket.sold) : '';
  let quotaText = ticket ? String(ticket.quota) : '';
  let lastTicket: Ticket | null = ticket;
  $: if (ticket !== lastTicket) {
    lastTicket = ticket;
    f = ticket ? { ...ticket } : null;
    priceText = ticket ? String(ticket.price) : '';
    soldText = ticket ? String(ticket.sold) : '';
    quotaText = ticket ? String(ticket.quota) : '';
  }

  function save() {
    if (!f) return;
    const updated: Ticket = {
      ...f,
      price: parseInt(priceText, 10) || 0,
      sold: parseInt(soldText, 10) || 0,
      // floor at 1 — a 0/empty quota makes the ProgressBar divide by zero → NaN%.
      quota: Math.max(1, parseInt(quotaText, 10) || 1)
    };
    onSave(updated);
    toasts.notify('success', isNew ? '已新增票券' : '已儲存票券', '「' + updated.name + '」已' + (isNew ? '建立' : '更新') + '。');
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增票券' : '編輯票券'}
    sub={isNew ? '建立新的票券方案' : '票券編號 ' + f.id}
    icon="ticket"
    primaryLabel={isNew ? '建立票券' : '儲存票券'}
    {onClose}
    onSave={save}
  >
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="票券名稱" bind:value={f.name} style="grid-column:span 2" />
      <Input label="方案說明" bind:value={f.desc} style="grid-column:span 2" />
      <Select label="票券類型" bind:value={f.type} options={typeOptions} />
      <Input label="票價 (NT$)" bind:value={priceText} />
      <Input label="已售張數" bind:value={soldText} />
      <Input label="配額" bind:value={quotaText} />
    </div>
  </EditModal>
{/if}
