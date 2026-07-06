<script lang="ts">
  /* 請假申請 (Leave request) — Task 11：integration-contract.md §3.20 + §3.18。
   * 開啟時打 GET /courses/{course_id}/sessions 列出未來場次；選場次 + 選填事由 →
   * 送出打 POST /leave-requests。核准後的補課預約是另一個獨立動作（在「我的
   * 請假」清單裡，見 MakeupDialog），本 dialog 不再有舊 mock 版的「同時保留補課
   * 額度」開關——契約裁決 4 明確把兩者分成兩步。 */
  import { Button, Select, Icon, Skeleton, ErrorState, EmptyState } from '$lib/components/ui';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import FormModal from './FormModal.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import NoteBox from './NoteBox.svelte';
  import { sessionOptions } from '$lib/member/session-format';
  import {
    getCourseSessions,
    createLeaveRequest,
    leaveRequestErrorMessage,
    toasts,
    type CourseSession
  } from '$lib/member/stores';
  import type { EnrolledCourse } from '$lib/member/data';

  export let open = false;
  export let course: EnrolledCourse | null = null;
  export let onClose: () => void = () => {};

  let sessionsPhase: 'loading' | 'error' | 'ready' = 'loading';
  let sessions: CourseSession[] = [];
  let sessionId = '';
  let reason = '';
  let submitting = false;
  let done = false;

  function loadSessions(courseId: string) {
    sessionsPhase = 'loading';
    getCourseSessions(courseId)
      .then((list) => {
        sessions = list;
        sessionsPhase = 'ready';
      })
      .catch(() => {
        sessionsPhase = 'error';
      });
  }

  // Reset all state each time the dialog transitions to open, and kick off the
  // sessions fetch. Check-and-update must live in ONE reactive statement (the
  // CouponCreateDialog idiom) — splitting the `lastOpen` write into its own
  // trailing `$:` (as PasswordDialog does) is unreliable: Svelte topologically
  // orders reactive statements by dependency, so the writer can run BEFORE this
  // reader in the same flush, making the transition undetectable.
  let lastOpen = false;
  $: {
    if (open && !lastOpen && course) {
      sessionId = '';
      reason = '';
      submitting = false;
      done = false;
      // course_id 在 EnrolledCourse 型別上因 mobile/mock 未提供而標為 optional；
      // 這個 dialog 只會被桌面 member/mine 頁掛載（真實 getMine() 資料），
      // course_id 保證存在。
      loadSessions(course.course_id!);
    }
    lastOpen = open;
  }

  $: valid = !!sessionId;

  async function submit() {
    if (!course || !valid || submitting) return;
    submitting = true;
    try {
      await createLeaveRequest(sessionId, reason.trim() || undefined);
      done = true;
      toasts.notify('success', '請假申請已送出', course.name + '，請等候教練或管理員審核。');
    } catch (err) {
      toasts.notify('error', '請假申請失敗', leaveRequestErrorMessage(err));
    } finally {
      submitting = false;
    }
  }
</script>

{#if open && course}
  {#if done}
    <FormModal open {onClose} icon="calendar-off" color="var(--df-warning)" title="請假申請" subtitle={course.name}>
      <SuccessBody
        title="請假申請已送出"
        body="教練或管理員審核後，結果會顯示在「我的請假」清單，並收到系統通知。核准後可預約一次同課程的未來場次補課。"
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
      {#if sessionsPhase === 'loading'}
        <Skeleton w="100%" h={44} r={8} />
      {:else if sessionsPhase === 'error'}
        <ErrorState onRetry={() => course && loadSessions(course.course_id!)} />
      {:else if sessions.length === 0}
        <EmptyState
          icon="calendar-x"
          title="沒有可請假的未來場次"
          body="這堂課近期沒有排定場次，暫時無法申請請假。"
          pad="32px 12px"
        />
      {:else}
        <Select
          label="請假場次"
          required
          placeholder="選擇要請假的場次"
          bind:value={sessionId}
          options={sessionOptions(sessions)}
        />
        <Textarea
          label="請假事由（選填）"
          placeholder="（選填）讓教練了解請假原因…"
          bind:value={reason}
          rows={3}
          maxLength={500}
        />
        <NoteBox icon="info">
          開課前皆可申請請假，教練或管理員審核後會通知你；核准後可在「我的請假」預約一次同課程的未來場次補課。
        </NoteBox>
      {/if}
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid || submitting} on:click={submit}>
          <Icon name="check" size={16} />{submitting ? '送出中…' : '送出申請'}
        </Button>
      </svelte:fragment>
    </FormModal>
  {/if}
{/if}
