<script lang="ts">
  /* 請假 sheet。mobile/mine.jsx LeaveSheet (217-250)。
   * 選課堂（COURSE_SESSIONS[course.id]）+ 事由（LEAVE_REASONS）→ toast + 切成功畫面。 */
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import SuccessBody from '$lib/mobile/components/SuccessBody.svelte';
  import NoteBox from '$lib/mobile/components/NoteBox.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import { toasts } from '$lib/mobile/stores';
  import { COURSE_SESSIONS, LEAVE_REASONS, type MyCourse } from '$lib/mobile/data';

  export let onClose: () => void;
  export let course: MyCourse | null = null;

  let session = '';
  let reason = '';
  let note = '';
  let makeup = true;
  let isDone = false;

  $: sessions = course ? COURSE_SESSIONS[course.id] || [] : [];
  $: valid = !!session && !!reason;

  function submit() {
    if (!course) return;
    isDone = true;
    toasts.notify('warning', '請假已送出', course.name);
  }
</script>

{#if course}
  {#if isDone}
    <Sheet open {onClose} title="請假申請" sub={course.name}>
      <SuccessBody
        icon="calendar-check"
        title="請假申請已送出"
        body={makeup ? '已為你保留補課額度，可至課程詳情預約補課時段。' : '教練將收到通知，課堂出席將標記為請假。'}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" fullWidth on:click={onClose}>完成</Button>
      </svelte:fragment>
    </Sheet>
  {:else}
    <Sheet open {onClose} title="請假申請" sub={course.name + ' · ' + course.coach + ' 教練'} maxHeight="90%">
      <div style="display:flex; flex-direction:column; gap:15px;">
        <Select label="請假日期" required placeholder="選擇要請假的課堂" bind:value={session} options={sessions} />
        <Select label="請假事由" required placeholder="選擇事由" bind:value={reason} options={LEAVE_REASONS} />
        <Textarea label="補充說明" placeholder="（選填）補充更多資訊…" rows={3} maxLength={120} bind:value={note} />
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:14px; font-weight:600; color:var(--df-text-dark);">同時保留補課額度</div>
            <div style="font-size:12px; color:var(--df-text-light);">稍後可自行預約補課時段</div>
          </div>
          <Switch bind:checked={makeup} />
        </div>
        <NoteBox icon="clock">請於課程開始 <b style="color:var(--df-text-dark);">24 小時前</b> 提出，逾時恕無法保留補課額度。</NoteBox>
      </div>
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={submit}>
          <Icon name="check" size={16} />送出申請
        </Button>
      </svelte:fragment>
    </Sheet>
  {/if}
{/if}
