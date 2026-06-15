<script lang="ts">
  /* 請假申請 (Leave request) — pick a session + reason, optional note, and a
   * "keep makeup credit" toggle; submitting shows a success confirmation.
   * Ported from the prototype's LeaveDialog (client/components.jsx). */
  import { Button, Select, Switch, Icon } from '$lib/components/ui';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import FormModal from './FormModal.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import NoteBox from './NoteBox.svelte';
  import { COURSE_SESSIONS, LEAVE_REASONS, type EnrolledCourse } from '$lib/member/data';

  export let open = false;
  export let course: EnrolledCourse | null = null;
  export let onClose: () => void = () => {};
  export let onSubmit: ((d: { session: string; reason: string; makeup: boolean }) => void) | undefined =
    undefined;

  let session = '';
  let reason = '';
  let note = '';
  let makeup = true;
  let done = false;

  // Reset all state each time the dialog transitions to open.
  let wasOpen = false;
  $: if (open && !wasOpen) {
    session = '';
    reason = '';
    note = '';
    makeup = true;
    done = false;
  }
  $: wasOpen = open;

  $: sessions = course ? COURSE_SESSIONS[course.id] || [] : [];
  $: valid = !!session && !!reason;

  function submit() {
    done = true;
    onSubmit?.({ session, reason, makeup });
  }
</script>

{#if open && course}
  {#if done}
    <FormModal
      open
      {onClose}
      icon="calendar-off"
      color="var(--df-warning)"
      title="請假申請"
      subtitle={course.name}
    >
      <SuccessBody
        title="請假申請已送出"
        body={makeup
          ? '已為你保留補課額度，可至「我的課程 → 預約補課」選擇時段。'
          : '教練將收到通知，課堂出席將標記為請假。'}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" on:click={onClose}>完成</Button>
      </svelte:fragment>
    </FormModal>
  {:else}
    <FormModal
      open
      {onClose}
      icon="calendar-off"
      color="var(--df-warning)"
      title="請假申請"
      subtitle={course.name + ' · ' + course.coach + ' 教練'}
    >
      <Select
        label="請假日期"
        required
        placeholder="選擇要請假的課堂"
        bind:value={session}
        options={sessions}
      />
      <Select
        label="請假事由"
        required
        placeholder="選擇事由"
        bind:value={reason}
        options={LEAVE_REASONS}
      />
      <Textarea
        label="補充說明"
        placeholder="（選填）若需提供更多資訊，可在此說明…"
        bind:value={note}
        rows={3}
        maxLength={120}
      />
      <div class="switch-row">
        <div>
          <div class="switch-title">同時保留補課額度</div>
          <div class="switch-sub">稍後可自行預約補課時段</div>
        </div>
        <Switch bind:checked={makeup} />
      </div>
      <NoteBox icon="clock">
        請於課程開始 <b>24 小時前</b> 提出，逾時恕無法保留補課額度。
      </NoteBox>
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid} on:click={submit}>
          <Icon name="check" size={16} />送出申請
        </Button>
      </svelte:fragment>
    </FormModal>
  {/if}
{/if}

<style>
  .switch-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 2px;
  }
  .switch-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .switch-sub {
    font-size: 12.5px;
    color: var(--df-text-light);
  }
</style>
