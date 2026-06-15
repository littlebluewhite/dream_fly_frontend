<script lang="ts">
  /* 編輯學員資料 — edit form inside the shared EditModal. Faithful port of
   * admin.jsx MemberEditDialog: avatar preview (姓氏首字) +代表色 swatch row, then a
   * 2-col field grid (姓名 / 年齡 / 報名課程 / 授課教練 / 在學狀態 / 家長 / 聯絡電話 +
   * 緊急聯絡人). Holds a local `let f` copy of the member prop, reset whenever the
   * dialog transitions to open. On 儲存 it normalises (parse age, derive initial),
   * fires the onSave(updated) callback AND a success toast. */
  import { Avatar, Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import {
    MEMBER_COLORS,
    CLASSES,
    COACHES,
    MEMBER_STATUS,
    type Member,
    type MemberStatus
  } from '$lib/admin/data';

  export let member: Member | null = null;
  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Member) => void = () => {};

  // Course / coach / status option lists (course+coach drawn from the shared data).
  const courseOptions = CLASSES.map((c) => c.name);
  const coachOptions = COACHES.map((c) => c.name);
  const statusOptions = (Object.keys(MEMBER_STATUS) as MemberStatus[]).map((v) => ({
    value: v,
    label: MEMBER_STATUS[v][1]
  }));

  // Local editable copy. Re-sync from `member` whenever the dialog is open for a
  // new member (or freshly opened) — keyed on member id so it works regardless of
  // whether `open` and `member` flip in the same flush, and resets edits when a
  // different member is opened. `age` is edited as text and parsed back on save.
  let f: Member | null = null;
  let ageText = '';
  let syncedId: string | null = null;
  $: if (open && member && member.id !== syncedId) {
    f = { ...member };
    ageText = String(member.age);
    syncedId = member.id;
  }
  $: if (!open) syncedId = null;

  function onName(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (f) f = { ...f, name: v, initial: v.trim().charAt(0) || f.initial };
  }

  function pickColor(c: string) {
    if (f) f = { ...f, color: c };
  }

  function save() {
    if (!f) return;
    const ageNum = parseInt(ageText, 10);
    const updated: Member = {
      ...f,
      age: Number.isNaN(ageNum) ? f.age : ageNum,
      initial: f.name.trim().charAt(0) || f.initial || '學'
    };
    onSave(updated);
    toasts.notify('success', '已儲存', updated.name + ' 的資料已更新。');
  }
</script>

{#if f}
  <EditModal
    {open}
    title="編輯學員資料"
    sub={'會員編號 ' + f.id}
    icon="user-round"
    primaryLabel="儲存資料"
    {onClose}
    onSave={save}
  >
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
      <Avatar name={f.name.trim().charAt(0) || f.initial || '學'} size="lg" color={f.color} />
      <div style="font-size:13px;color:var(--df-text-light)">
        頭像以姓氏首字顯示<br />入會時間 {f.joined} · {f.points} 點
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:13px;font-weight:600;color:var(--df-text-dark);margin-bottom:8px">
        代表色 / 頭像底色
      </div>
      <div style="display:flex;gap:11px">
        {#each MEMBER_COLORS as c}
          <button
            type="button"
            aria-label={'選擇 ' + c}
            on:click={() => pickColor(c)}
            class="swatch"
            class:active={f.color === c}
            style="background:{c}"
          ></button>
        {/each}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <Input label="學員姓名" bind:value={f.name} on:input={onName} />
      <Input label="年齡" bind:value={ageText} />
      <Select
        label="報名課程"
        bind:value={f.course}
        options={courseOptions}
        style="grid-column:span 2"
      />
      <Select label="授課教練" bind:value={f.coach} options={coachOptions} />
      <Select label="在學狀態" bind:value={f.status} options={statusOptions} />
      <Input label="家長" bind:value={f.parent} />
      <Input label="聯絡電話" bind:value={f.phone} />
      <Input label="緊急聯絡人" bind:value={f.emName} />
      <Input label="緊急聯絡電話" bind:value={f.emPhone} />
    </div>
  </EditModal>
{/if}

<style>
  .swatch {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px var(--df-border);
    cursor: pointer;
    flex: none;
    padding: 0;
  }
  .swatch.active {
    border: 3px solid var(--df-ink);
  }
</style>
