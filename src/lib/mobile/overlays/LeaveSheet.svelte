<script lang="ts">
  /* 請假 sheet。Task 19：改真後端 —— 開啟時打 GET /courses/{course_id}/sessions
   * 列出未來場次；選場次 + 選填事由 → 送出打 POST /leave-requests(同桌面
   * LeaveDialog 的邏輯，見 $lib/member/components/LeaveDialog.svelte)。移除舊
   * mock 版「同時保留補課額度」開關 —— 這個概念在真後端已不存在(核准後才能
   * 另外預約補課，是獨立動作，見 member/stores.ts 的請假模組註解)，鏡射桌面
   * Task 11 的既有決定。
   * 卡 2:表單機制(三態/守衛/trim)與桌面 LeaveDialog 共用 leave-form 雙工廠,
   * 工廠經 $lib/mobile/stores 的 seam 取用;deps 仍直取 $lib/member/stores(存量
   * 收編另卡)。sheet 每次 overlay.sheet() 重掛 → 新工廠實例 + onMount load,
   * 不需要 dialog 的 lastOpen 重置守衛。 */
  import { onMount } from 'svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import NoteBox from '$lib/components/mobile/NoteBox.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import { ErrorState, Skeleton, EmptyState } from '$lib/components/ui';
  import { toasts, createLeaveRequestForm } from '$lib/mobile/stores';
  import { sessionOptions } from '$lib/domain/session-format';
  import { getCourseSessions, createLeaveRequest, leaveRequestErrorMessage, type CourseSession } from '$lib/member/stores';
  import type { MyCourse } from '$lib/mobile/data';

  export let onClose: () => void;
  export let course: MyCourse | null = null;

  const form = createLeaveRequestForm({ getCourseSessions, createLeaveRequest });
  // 頂層解構 const —— Svelte legacy store binding(bind:value={$sessionId})的前提。
  const { sessionId, reason } = form;
  let sessionsPhase: 'loading' | 'error' | 'ready' = 'loading';
  let sessions: CourseSession[] = [];
  let submitting = false;
  let valid = false;
  $: ({ sessionsPhase, sessions, submitting, valid } = $form);
  let isDone = false;

  // course_id 在 MyCourse 型別上因 mobile mock 時代未提供而標為 optional；
  // 這個 sheet 只會被已接真 getMine() 的 mine 頁掛載(overlay.sheet('leave',
  // {course}))，course_id 保證存在(同桌面 LeaveDialog 的既有斷言慣例)。
  onMount(() => {
    if (course) form.load(course.course_id!);
  });

  async function submit() {
    if (!course) return;
    const outcome = await form.submit(); // null = 守衛(未選場次｜送出中)
    if (!outcome) return;
    if (outcome.kind === 'leaveRequested') {
      isDone = true;
      toasts.notify('success', '請假申請已送出', course.name + '，請等候教練或管理員審核。');
    } else {
      toasts.notify('error', '請假申請失敗', leaveRequestErrorMessage(outcome.error));
    }
  }
</script>

{#if course}
  {#if isDone}
    <Sheet open {onClose} title="請假申請" sub={course.name}>
      <SuccessBody
        icon="calendar-check"
        title="請假申請已送出"
        body="教練或管理員審核後，結果會顯示在「我的請假」清單，並收到系統通知。核准後可預約一次同課程的未來場次補課。"
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" fullWidth on:click={onClose}>完成</Button>
      </svelte:fragment>
    </Sheet>
  {:else}
    <Sheet open {onClose} title="請假申請" sub={course.name + ' · ' + course.coach + ' 教練'} maxHeight="90%">
      {#if sessionsPhase === 'loading'}
        <Skeleton w="100%" h={44} r={8} />
      {:else if sessionsPhase === 'error'}
        <ErrorState onRetry={() => course && form.load(course.course_id!)} />
      {:else if sessions.length === 0}
        <EmptyState icon="calendar-x" title="沒有可請假的未來場次" body="這堂課近期沒有排定場次，暫時無法申請請假。" pad="32px 12px" />
      {:else}
        <div style="display:flex; flex-direction:column; gap:15px;">
          <Select label="請假場次" required placeholder="選擇要請假的場次" bind:value={$sessionId} options={sessionOptions(sessions)} />
          <Textarea label="補充說明" placeholder="（選填）補充更多資訊…" rows={3} maxLength={120} bind:value={$reason} />
          <NoteBox icon="clock">開課前皆可申請請假，教練或管理員審核後會通知你；核准後可在「我的請假」預約一次同課程的未來場次補課。</NoteBox>
        </div>
      {/if}
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!valid || submitting} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={submit}>
          <Icon name="check" size={16} />{submitting ? '送出中…' : '送出申請'}
        </Button>
      </svelte:fragment>
    </Sheet>
  {/if}
{/if}
