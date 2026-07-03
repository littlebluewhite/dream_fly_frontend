<script lang="ts">
  /* 教練檔案編輯 — edit form inside the shared EditModal. Faithful port of
   * admin.jsx CoachEditDialog: avatar preview (姓氏首字) + 代表色 swatch row, then a
   * 2-col field grid — 教練姓名 / 目前狀態(Select 線上·忙碌·離線) / 職稱(span 2) /
   * 專長標籤(span 2, 、-separated text) / 年資 / 聯絡電話 / 學員數 / 班級數 / 競賽獲獎數.
   *
   * Holds a local `let f` copy of the coach prop, reset on each open transition.
   * `tagsText` is the comma/、-separated editing buffer for the tags[] array;
   * numeric fields edit as text and are parsed on save. On 儲存 it normalises
   * (derive initial, split tags, parse numbers), fires onSave(updated) AND a
   * success toast — mirroring MemberEditDialog. */
  import { Avatar, Input, Select } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toasts } from '$lib/admin/stores';
  import { MEMBER_COLORS, type Coach, type CoachStatus } from '$lib/admin/data';
  import { COACH_STATUS } from './coach-status';

  export let coach: Coach | null = null;
  export let open = false;
  /** New-coach mode flips the title/subtitle/primary label + toast copy. */
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Coach) => void = () => {};

  const statusOptions = (Object.keys(COACH_STATUS) as CoachStatus[]).map((v) => ({
    value: v,
    label: COACH_STATUS[v][0]
  }));

  // Local editable copy + text buffers, reset on every coach-prop change —
  // INCLUDING coach → null on close — or when the dialog transitions to open
  // (single-stage pattern — mirrors ClassEditDialog/VenueEditDialog/
  // TicketEditDialog's unconditional `x !== lastX`). Two earlier shapes both
  // failed here:
  // - the two-stage `$: if (open && !wasOpen && coach) {…}` + `$: wasOpen =
  //   open;` pair never re-fired on a mounted instance (Svelte schedules the
  //   `wasOpen` assignment before the guard that reads it, so `!wasOpen` was
  //   always false);
  // - a `coach && (…)` short-circuit skipped the CLOSE transition (the parent
  //   clears open+coach together on 取消), freezing `wasOpen`/`lastCoach`/`f`
  //   at their open-time values, so re-opening the SAME coach showed the
  //   abandoned dirty draft. The guard must also run on coach → null; the
  //   body is null-safe instead.
  let f: Coach | null = coach;
  let tagsText = coach ? coach.tags.join('、') : '';
  let yearsText = coach ? String(coach.years) : '';
  let studentsText = coach ? String(coach.students) : '';
  let classesText = coach ? String(coach.classes) : '';
  let awardsText = coach ? String(coach.awards) : '';
  let lastCoach: Coach | null = coach;
  let wasOpen = open;
  $: if (coach !== lastCoach || (open && !wasOpen)) {
    wasOpen = open;
    lastCoach = coach;
    f = coach ? { ...coach } : null;
    tagsText = coach ? coach.tags.join('、') : '';
    yearsText = coach ? String(coach.years) : '';
    studentsText = coach ? String(coach.students) : '';
    classesText = coach ? String(coach.classes) : '';
    awardsText = coach ? String(coach.awards) : '';
  }

  function onName(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (f) f = { ...f, name: v, initial: v.trim().charAt(0) || f.initial };
  }

  function pickColor(c: string) {
    if (f) f = { ...f, color: c };
  }

  function num(s: string): number {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function save() {
    if (!f) return;
    const updated: Coach = {
      ...f,
      initial: f.name.trim().charAt(0) || f.initial || '教',
      tags: tagsText
        .split(/[、,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      years: num(yearsText),
      students: num(studentsText),
      classes: num(classesText),
      awards: num(awardsText)
    };
    onSave(updated);
    toasts.notify('success', isNew ? '已新增教練' : '已儲存', updated.name + ' 教練資料已更新。');
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增教練' : '編輯教練'}
    sub={isNew ? '建立教練檔案' : f.name + ' 教練'}
    icon="user-check"
    primaryLabel={isNew ? '建立教練' : '儲存'}
    {onClose}
    onSave={save}
  >
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
      <Avatar name={f.name.trim().charAt(0) || f.initial || '教'} size="lg" color={f.color} />
      <div style="display:flex;gap:9px">
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
      <Input label="教練姓名" bind:value={f.name} on:input={onName} />
      <Select label="目前狀態" bind:value={f.status} options={statusOptions} />
      <Input label="職稱 / 專業" bind:value={f.title} style="grid-column:span 2" />
      <Input label="專長標籤（以、分隔）" bind:value={tagsText} style="grid-column:span 2" />
      <Input label="年資（年）" bind:value={yearsText} />
      <Input label="聯絡電話" bind:value={f.phone} />
      <Input label="學員數" bind:value={studentsText} />
      <Input label="班級數" bind:value={classesText} />
      <Input label="競賽獲獎數" bind:value={awardsText} />
    </div>
  </EditModal>
{/if}

<style>
  .swatch {
    width: 28px;
    height: 28px;
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
