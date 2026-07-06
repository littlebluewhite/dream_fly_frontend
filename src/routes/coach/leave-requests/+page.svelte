<script lang="ts">
  /* 請假審核 — 教練待審清單（Task 11；GET /leave-requests?status=pending +
   * PATCH /leave-requests/{id}，見 integration-contract.md §3.20）。全新 UI 流
   * （比照 Round 1 打卡 UI 先例：新寫頁面，非既有 prototype 移植），三態閘門
   * （loading/error/ready）+ 逐筆核准/婉拒同 coach/students 頁的 getStudents()
   * 接縫慣例。核准/婉拒後從清單移除（同 member/mine 頁「取消候補」後從候補清單
   * 移除的慣例——決定完成的假單不再屬於「待審核」）。 */
  import { onMount } from 'svelte';
  import { getPendingLeaveRequests, decideLeaveRequest } from '$lib/coach/api';
  import type { CoachLeaveRequest } from '$lib/coach/api';
  import { toasts } from '$lib/coach/stores';
  import { ApiError } from '$lib/api/client';
  import { ErrorState, EmptyState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let requests: CoachLeaveRequest[] = [];
  let decidingId: string | null = null;

  function load() {
    phase = 'loading';
    getPendingLeaveRequests()
      .then((d) => {
        requests = d.requests;
        phase = 'ready';
      })
      .catch(() => {
        phase = 'error';
      });
  }
  onMount(load);

  /** PATCH /leave-requests/{id} 的錯誤分支(§3.20：404/403/409/422)——這個後端模組
   *  (dream_fly_backend/src/modules/leave/service.rs)的錯誤字串本身就是繁中，
   *  直接透傳即可(同 member/stores.ts 的 leaveRequestErrorMessage 慣例，不需要
   *  另外的英文子字串對照表)。 */
  function decisionErrorMessage(e: unknown): string {
    if (e instanceof ApiError) return e.message;
    return '連線發生問題，請稍後再試。';
  }

  async function decide(r: CoachLeaveRequest, status: 'approved' | 'rejected') {
    if (decidingId) return;
    decidingId = r.id;
    try {
      await decideLeaveRequest(r.id, status);
      requests = requests.filter((x) => x.id !== r.id);
      toasts.notify(
        'success',
        status === 'approved' ? '已核准請假申請' : '已婉拒請假申請',
        r.user_name + ' · ' + r.course_name
      );
    } catch (err) {
      toasts.notify('error', '審核失敗', decisionErrorMessage(err));
    } finally {
      decidingId = null;
    }
  }
</script>

{#if phase === 'ready'}
<!-- root: flex col gap 16 — no df-view (layout already provides it) -->
<div style="display:flex;flex-direction:column;gap:16px">

  <!-- 1. Heading -->
  <div>
    <h1 style="font-size:22px;font-weight:800;color:var(--df-ink);margin:0 0 4px 0;font-family:var(--df-font-body)">請假審核</h1>
    <p style="font-size:13.5px;color:var(--df-text-light);margin:0">共 {requests.length} 筆待審核</p>
  </div>

  {#if requests.length === 0}
    <Card padding={0}>
      <EmptyState icon="calendar-check" title="目前沒有待審核的請假申請" body="有新的請假申請時會顯示在這裡。" />
    </Card>
  {:else}
    <Card padding={0} style="overflow:hidden">
      <div>
        {#each requests as r, i (r.id)}
          <div
            class="df-rowhover"
            style="display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:{i < requests.length - 1 ? '1px solid var(--df-border)' : 'none'}"
          >
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:600;color:var(--df-text-dark)">{r.user_name} · {r.course_name}</div>
              <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">
                {r.session_date} {r.start_time.slice(0, 5)}{#if r.reason} · {r.reason}{/if}
              </div>
            </div>
            <button
              type="button"
              disabled={decidingId === r.id}
              on:click={() => decide(r, 'rejected')}
              style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--df-text-light);cursor:{decidingId === r.id ? 'default' : 'pointer'};opacity:{decidingId === r.id ? 0.6 : 1};font-family:var(--df-font-body);"
            ><Icon name="x" size={14} />婉拒</button>
            <button
              type="button"
              disabled={decidingId === r.id}
              on:click={() => decide(r, 'approved')}
              style="display:inline-flex;align-items:center;gap:6px;border:none;background:var(--df-primary);color:#fff;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:{decidingId === r.id ? 'default' : 'pointer'};opacity:{decidingId === r.id ? 0.7 : 1};font-family:var(--df-font-body);"
            ><Icon name="check" size={14} />核准</button>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

</div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState onRetry={load} /></Card>
{:else}
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="leave-requests-skeleton">
    <div><Skeleton w={140} h={26} r={6} /></div>
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
  </div>
{/if}
