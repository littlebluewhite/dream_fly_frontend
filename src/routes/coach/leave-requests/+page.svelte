<script lang="ts">
  /* 請假審核 — 教練待審清單（Task 11；GET /leave-requests?status=pending +
   * PATCH /leave-requests/{id}，見 integration-contract.md §3.20）。全新 UI 流
   * （比照 Round 1 打卡 UI 先例：新寫頁面，非既有 prototype 移植），三態閘門
   * （loading/error/ready）+ 逐筆核准/婉拒同 coach/students 頁的 getStudents()
   * 接縫慣例。核准/婉拒後從清單移除（同 member/mine 頁「取消候補」後從候補清單
   * 移除的慣例——決定完成的假單不再屬於「待審核」）。 */
  import { onMount } from 'svelte';
  import { createLoadGate } from '$lib/load-gate';
  import { getPendingLeaveRequests, decideLeaveRequest } from '$lib/coach/api';
  import type { CoachLeaveRequest } from '$lib/coach/api';
  import { toasts } from '$lib/coach/stores';
  import { apiErrorMessage } from '$lib/api/error-text';
  import { EmptyState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let requests: CoachLeaveRequest[] = [];
  // 伺服器端 pending 總數（單頁上限 100，可能大於 requests.length）——計數與空狀態
  // 一律以 total 為準：以截斷後陣列長度計數會低報、審完可見清單後的「目前沒有待
  // 審核」會說謊。total > requests.length 時清單底部另有截斷提示。
  let total = 0;
  let decidingId: string | null = null;

  const gate = createLoadGate({
    fetch: getPendingLeaveRequests,
    onData: (d) => {
      requests = d.requests;
      total = d.total;
    }
  });
  onMount(() => {
    gate.load();
  });

  async function decide(r: CoachLeaveRequest, status: 'approved' | 'rejected') {
    if (decidingId) return;
    decidingId = r.id;
    try {
      await decideLeaveRequest(r.id, status);
      requests = requests.filter((x) => x.id !== r.id);
      total = Math.max(0, total - 1); // 決定完成的假單不再 pending——計數同步遞減
      toasts.notify(
        'success',
        status === 'approved' ? '已核准請假申請' : '已婉拒請假申請',
        r.user_name + ' · ' + r.course_name
      );
    } catch (err) {
      // PATCH /leave-requests/{id} 的錯誤分支(§3.20：404/403/409/422)——這個後端模組
      // (dream_fly_backend/src/modules/leave/service.rs)的錯誤字串本身就是繁中，
      // 直接透傳即可(apiErrorMessage，同 member/stores.ts 的 leaveRequestErrorMessage
      // 慣例，不需要另外的英文子字串對照表)。
      toasts.notify('error', '審核失敗', apiErrorMessage(err));
    } finally {
      decidingId = null;
    }
  }
</script>

<LoadGate {gate}>
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="leave-requests-skeleton" slot="loading">
    <div><Skeleton w={140} h={26} r={6} /></div>
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
  </div>

<!-- root: flex col gap 16 — no df-view (layout already provides it) -->
<div style="display:flex;flex-direction:column;gap:16px">

  <!-- 1. Heading -->
  <div>
    <h1 style="font-size:22px;font-weight:800;color:var(--df-ink);margin:0 0 4px 0;font-family:var(--df-font-body)">請假審核</h1>
    <p style="font-size:13.5px;color:var(--df-text-light);margin:0">共 {total} 筆待審核</p>
  </div>

  {#if total === 0}
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
        {#if total > requests.length}
          <!-- 分頁截斷提示：單頁上限 100，total 超出時清單不完整——計數已用 total
               誠實呈現，這裡補充「還有沒載入的」與取得方式（重新整理即重新載入）。 -->
          <div style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--df-border);background:var(--df-bg-light);font-size:12.5px;color:var(--df-text-light)">
            <Icon name="info" size={14} color="var(--df-text-muted)" />
            {#if requests.length > 0}
              僅顯示前 {requests.length} 筆，審核後請重新整理載入其餘 {total - requests.length} 筆。
            {:else}
              尚有 {total} 筆待審核尚未載入，請重新整理。
            {/if}
          </div>
        {/if}
      </div>
    </Card>
  {/if}

</div>
</LoadGate>
