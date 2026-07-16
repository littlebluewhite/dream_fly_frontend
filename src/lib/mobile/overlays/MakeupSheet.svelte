<script lang="ts">
  /* 預約補課 sheet。Task 19：改真後端 —— 現在是針對「一張已核准且尚未補課的
   * 請假申請」開啟的動作(同桌面 MakeupDialog 的既有裁決，見 $lib/member/
   * components/MakeupDialog.svelte)——所以吃 leaveRequest prop，不是 course。
   * 開啟時打 GET /courses/{course_id}/sessions 列出同課程的未來場次；選場次 →
   * 送出打 POST /leave-requests/{id}/makeup。舊 mock 版「MAKEUP_SLOTS 課程層級
   * 補課」入口已隨 MyCourseDetail 的動作列移除(同桌面「課程詳情動作列不再有
   * 預約補課按鈕」的既有決定，見 MyCourseDetail.svelte)。
   * 卡 2:表單機制(三態/守衛)與桌面 MakeupDialog 共用 leave-form 雙工廠,工廠經
   * $lib/mobile/stores 的 seam 取用;卡 3:deps(getCourseSessions/bookMakeup)與
   * leaveRequestErrorMessage 也改經同一 seam 的存量 re-export 取用(測試仍
   * vi.mock '$lib/member/stores',佈線證明不變)。
   * 成功 toast body 是 mobile 自己的字面(無 course_name 前綴,與桌面分歧),留元件。 */
  import { onMount } from 'svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { ErrorState, Skeleton, EmptyState } from '$lib/components/ui';
  import {
    toasts,
    createMakeupBookingForm,
    getCourseSessions,
    bookMakeup,
    leaveRequestErrorMessage,
    type CourseSession,
    type LeaveRequest
  } from '$lib/mobile/stores';
  import { sessionOptions, formatSessionDateTime } from '$lib/domain/session-format';

  export let onClose: () => void;
  export let leaveRequest: LeaveRequest | null = null;

  const form = createMakeupBookingForm({ getCourseSessions, bookMakeup });
  // 頂層解構 const —— Svelte legacy store binding(bind:value={$sessionId})的前提。
  const { sessionId } = form;
  let sessionsPhase: 'loading' | 'error' | 'ready' = 'loading';
  let sessions: CourseSession[] = [];
  let submitting = false;
  let valid = false;
  $: ({ sessionsPhase, sessions, submitting, valid } = $form);
  let isDone = false;
  let bookedAt: LeaveRequest | null = null;

  onMount(() => {
    if (leaveRequest) form.load(leaveRequest.course_id);
  });

  async function confirm() {
    if (!leaveRequest) return;
    const outcome = await form.submit(leaveRequest.id); // null = 守衛(未選場次｜送出中)
    if (!outcome) return;
    if (outcome.kind === 'makeupBooked') {
      bookedAt = outcome.updated;
      isDone = true;
      toasts.notify(
        'success',
        '補課已預約',
        formatSessionDateTime(outcome.updated.makeup_session_date ?? '', outcome.updated.makeup_start_time ?? '')
      );
    } else {
      toasts.notify('error', '預約補課失敗', leaveRequestErrorMessage(outcome.error));
    }
  }
</script>

{#if leaveRequest}
  {#if isDone}
    <Sheet open {onClose} title="預約補課" sub={leaveRequest.course_name}>
      <SuccessBody
        icon="calendar-check"
        title="補課預約成功"
        body={bookedAt ? `已預約 ${formatSessionDateTime(bookedAt.makeup_session_date ?? '', bookedAt.makeup_start_time ?? '')}，已加入你的日程表。` : ''}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" fullWidth on:click={onClose}>完成</Button>
      </svelte:fragment>
    </Sheet>
  {:else}
    <Sheet open {onClose} title="預約補課" sub={leaveRequest.course_name + ' · 選擇一個未來場次'} maxHeight="88%">
      {#if sessionsPhase === 'loading'}
        <Skeleton w="100%" h={44} r={8} />
      {:else if sessionsPhase === 'error'}
        <ErrorState onRetry={() => leaveRequest && form.load(leaveRequest.course_id)} />
      {:else if sessions.length === 0}
        <EmptyState icon="calendar-x" title="目前沒有可預約的補課場次" body="新的場次開放時，我們會以通知提醒你，也可聯絡櫃台協助安排。" pad="32px 12px" />
      {:else}
        <Select label="補課場次" required placeholder="選擇要補課的場次" bind:value={$sessionId} options={sessionOptions(sessions)} />
      {/if}
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid || submitting} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={confirm}>
          <Icon name="calendar-check" size={16} />{submitting ? '預約中…' : '確認預約'}
        </Button>
      </svelte:fragment>
    </Sheet>
  {/if}
{/if}
