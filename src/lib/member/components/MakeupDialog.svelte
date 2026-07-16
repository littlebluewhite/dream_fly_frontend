<script lang="ts">
  /* 預約補課 (Makeup booking) — Task 11：integration-contract.md §3.20 + §3.18。
   * 現在是針對「一張已核准且尚未補課的請假申請」開啟的動作（「我的請假」清單裡
   * 逐筆的「預約補課」按鈕），不再是課程層級的一般動作——所以吃 leaveRequest
   * prop，不是 course。開啟時打 GET /courses/{course_id}/sessions 列出同課程的
   * 未來場次；選場次 → 送出打 POST /leave-requests/{id}/makeup。
   * 卡 2：表單機制（場次三態/valid與in-flight守衛）收斂進 $lib/member/leave-form 的
   * createMakeupBookingForm（與 mobile MakeupSheet 共用）；錯誤文案映射與 toast 字面
   * 留在這裡（ADR 0011）——成功 toast body 桌面/mobile 本有分歧，兩面各自釘各的。 */
  import { Button, Select, Icon, Skeleton, ErrorState, EmptyState } from '$lib/components/ui';
  import FormModal from './FormModal.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import { sessionOptions, formatSessionDateTime } from '$lib/member/session-format';
  import { createMakeupBookingForm } from '$lib/member/leave-form';
  import {
    getCourseSessions,
    bookMakeup,
    leaveRequestErrorMessage,
    toasts,
    type CourseSession,
    type LeaveRequest
  } from '$lib/member/stores';

  export let open = false;
  export let leaveRequest: LeaveRequest | null = null;
  export let onClose: () => void = () => {};

  const form = createMakeupBookingForm({ getCourseSessions, bookMakeup });
  // 頂層解構 const —— Svelte legacy store binding（bind:value={$sessionId}）的前提。
  const { sessionId } = form;
  let sessionsPhase: 'loading' | 'error' | 'ready' = 'loading';
  let sessions: CourseSession[] = [];
  let submitting = false;
  let valid = false;
  $: ({ sessionsPhase, sessions, submitting, valid } = $form);
  let done = false;
  let bookedAt: LeaveRequest | null = null;

  // Reset state each time the dialog transitions to open, and kick off the
  // sessions fetch. Check-and-update lives in ONE reactive statement (the
  // CouponCreateDialog idiom) — see LeaveDialog for why the split two-statement
  // (PasswordDialog) form is unreliable here.
  let lastOpen = false;
  $: {
    if (open && !lastOpen && leaveRequest) {
      done = false;
      bookedAt = null;
      form.reset();
      form.load(leaveRequest.course_id);
    }
    lastOpen = open;
  }

  async function confirm() {
    if (!leaveRequest) return;
    const outcome = await form.submit(leaveRequest.id); // null = 守衛（未選場次｜送出中）
    if (!outcome) return;
    if (outcome.kind === 'makeupBooked') {
      bookedAt = outcome.updated;
      done = true;
      toasts.notify(
        'success',
        '補課預約成功',
        leaveRequest.course_name + ' · ' + formatSessionDateTime(outcome.updated.makeup_session_date ?? '', outcome.updated.makeup_start_time ?? '') + '，已加入你的日程表。'
      );
    } else {
      toasts.notify('error', '預約補課失敗', leaveRequestErrorMessage(outcome.error));
    }
  }
</script>

{#if open && leaveRequest}
  {#if done}
    <FormModal open {onClose} icon="rotate-cw" title="預約補課" subtitle={leaveRequest.course_name}>
      <SuccessBody
        title="補課預約成功"
        body={bookedAt
          ? `已預約 ${formatSessionDateTime(bookedAt.makeup_session_date ?? '', bookedAt.makeup_start_time ?? '')}，已加入你的日程表。`
          : ''}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" on:click={onClose}>完成</Button>
      </svelte:fragment>
    </FormModal>
  {:else}
    <FormModal open {onClose} icon="rotate-cw" title="預約補課" subtitle={leaveRequest.course_name + ' · 選擇一個未來場次'}>
      {#if sessionsPhase === 'loading'}
        <Skeleton w="100%" h={44} r={8} />
      {:else if sessionsPhase === 'error'}
        <ErrorState onRetry={() => leaveRequest && form.load(leaveRequest.course_id)} />
      {:else if sessions.length === 0}
        <EmptyState
          icon="calendar-x"
          title="目前沒有可預約的補課場次"
          body="新的場次開放時，我們會以通知提醒你，也可聯絡櫃台協助安排。"
          pad="32px 12px"
        />
      {:else}
        <Select
          label="補課場次"
          required
          placeholder="選擇要補課的場次"
          bind:value={$sessionId}
          options={sessionOptions(sessions)}
        />
      {/if}
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid || submitting} on:click={confirm}>
          <Icon name="calendar-check" size={16} />{submitting ? '預約中…' : '確認預約'}
        </Button>
      </svelte:fragment>
    </FormModal>
  {/if}
{/if}
