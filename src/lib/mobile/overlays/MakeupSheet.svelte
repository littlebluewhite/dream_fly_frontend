<script lang="ts">
  /* 預約補課 sheet。Task 19：改真後端 —— 現在是針對「一張已核准且尚未補課的
   * 請假申請」開啟的動作(同桌面 MakeupDialog 的既有裁決，見 $lib/member/
   * components/MakeupDialog.svelte)——所以吃 leaveRequest prop，不是 course。
   * 開啟時打 GET /courses/{course_id}/sessions 列出同課程的未來場次；選場次 →
   * 送出打 POST /leave-requests/{id}/makeup。舊 mock 版「MAKEUP_SLOTS 課程層級
   * 補課」入口已隨 MyCourseDetail 的動作列移除(同桌面「課程詳情動作列不再有
   * 預約補課按鈕」的既有決定，見 MyCourseDetail.svelte)。 */
  import { onMount } from 'svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import { ErrorState, Skeleton, EmptyState } from '$lib/components/ui';
  import { toasts } from '$lib/mobile/stores';
  import { sessionOptions, formatSessionDateTime } from '$lib/member/session-format';
  import {
    getCourseSessions,
    bookMakeup,
    leaveRequestErrorMessage,
    type CourseSession,
    type LeaveRequest
  } from '$lib/member/stores';

  export let onClose: () => void;
  export let leaveRequest: LeaveRequest | null = null;

  let sessionsPhase: 'loading' | 'error' | 'ready' = 'loading';
  let sessions: CourseSession[] = [];
  let sessionId = '';
  let submitting = false;
  let isDone = false;
  let bookedAt: LeaveRequest | null = null;

  function loadSessions(courseId: string) {
    sessionsPhase = 'loading';
    getCourseSessions(courseId)
      .then((list) => { sessions = list; sessionsPhase = 'ready'; })
      .catch(() => { sessionsPhase = 'error'; });
  }

  onMount(() => {
    if (leaveRequest) loadSessions(leaveRequest.course_id);
  });

  $: valid = !!sessionId;

  async function confirm() {
    if (!leaveRequest || !valid || submitting) return;
    submitting = true;
    try {
      const updated = await bookMakeup(leaveRequest.id, sessionId);
      bookedAt = updated;
      isDone = true;
      toasts.notify(
        'success',
        '補課已預約',
        formatSessionDateTime(updated.makeup_session_date ?? '', updated.makeup_start_time ?? '')
      );
    } catch (err) {
      toasts.notify('error', '預約補課失敗', leaveRequestErrorMessage(err));
    } finally {
      submitting = false;
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
        <ErrorState onRetry={() => leaveRequest && loadSessions(leaveRequest.course_id)} />
      {:else if sessions.length === 0}
        <EmptyState icon="calendar-x" title="目前沒有可預約的補課場次" body="新的場次開放時，我們會以通知提醒你，也可聯絡櫃台協助安排。" pad="32px 12px" />
      {:else}
        <Select label="補課場次" required placeholder="選擇要補課的場次" bind:value={sessionId} options={sessionOptions(sessions)} />
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
