<script lang="ts">
  /* 我的課程 (My Courses) — enrolled-course list on the left, active-course
   * detail on the right (stats, attendance history, and 請假 / 聯絡教練 actions).
   * Ported from the prototype's MyCourses (client/views.jsx). Data + primitives
   * come from the shared foundation.
   *
   * Task 11：「我的請假」清單（GET /leave-requests/me）+ 候補中課程並列在課程
   * 清單下方——pending 可取消、approved 且未補課可逐筆「預約補課」（MakeupDialog
   * 現在吃 leaveRequest，不是課程層級動作，所以課程詳情動作列不再有「預約補課」
   * 按鈕）。 */
  import { onMount } from 'svelte';
  import { Card, Badge, Button, ProgressBar, Icon, Skeleton, SkelCard, ErrorState, EmptyState, LoadGate } from '$lib/components/ui';
  import LeaveDialog from '$lib/member/components/LeaveDialog.svelte';
  import MakeupDialog from '$lib/member/components/MakeupDialog.svelte';
  import ContactDialog from '$lib/member/components/ContactDialog.svelte';
  import { ATT_STATE, LEVEL_TONE, LEAVE_STATUS } from '$lib/member/data';
  import type { AttRecord } from '$lib/member/data';
  import { formatSessionDateTime } from '$lib/member/session-format';
  import {
    toasts,
    waitlist,
    cancelWaitlist,
    leaveRequests,
    cancelLeaveRequest,
    leaveRequestErrorMessage,
    type WaitlistEntry,
    type LeaveRequest
  } from '$lib/member/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { createCancelLeave } from '$lib/member/cancel-leave';
  import { getMine, getEnrolmentAttendance, type MineData } from '$lib/member/api';
  import type { IconName } from '$lib/icon-registry';

  let active: string | null = null;
  let dialog: 'leave' | 'contact' | null = null;
  let makeupFor: LeaveRequest | null = null;
  let data: MineData | null = null;
  let cancellingId: string | null = null;

  // 候補清單/我的請假的 best-effort 旁路 hydrate 已收進 getMine() 接縫本身
  // （卡 6，見 member/api.ts 的 getMine 註解與 hydrateSessionStores 檔頭）——
  // 失敗只記錄、不擋主要的「我的課程」資料流程，頁面只剩單一 fetch 接縫。
  const gate = createLoadGate({
    fetch: getMine,
    onData: (d) => {
      data = d;
      const first = d.courses[0]?.id ?? null;
      active = first;
      if (first) loadAttendance(first);
    }
  });
  onMount(() => {
    gate.load();
  });

  // 出席明細(Task F7：GET /enrolments/{id}/attendance，§3.12)——獨立於課程清單本身
  // 的載入閘門，選取的報名切換時才重抓(進頁不會替全部報名各打一次端點)。attGate.fetch
  // 讀取 `active`，呼叫前一律先寫入新值再觸發(見 loadAttendance())，讀寫都在同一個
  // 同步呼叫序列內完成，不會有競態。
  let attendance: AttRecord[] | null = null;
  const attGate = createLoadGate({
    fetch: () => getEnrolmentAttendance(active as string),
    onData: (d) => { attendance = d; }
  });
  function loadAttendance(id: string): void {
    active = id;
    attGate.load();
  }
  function selectCourse(id: string): void {
    if (id === active) return;
    loadAttendance(id);
  }

  async function doCancelWaitlist(w: WaitlistEntry) {
    if (cancellingId) return;
    cancellingId = w.id;
    try {
      await cancelWaitlist(w.id);
      toasts.notify('success', '已取消候補', w.course_name + ' 已從候補名單移除。');
    } catch {
      toasts.notify('error', '取消候補失敗', '請稍後再試。');
    } finally {
      cancellingId = null;
    }
  }

  // 取消請假（卡 6）：busy 守衛 + outcome 機制收斂進 $lib/member/cancel-leave
  // （與 mobile MyCourseDetail 共用同一份雙生單源）；toast 文案與
  // leaveRequestErrorMessage 映射留在頁面（ADR 0011）。
  const cancelLeave = createCancelLeave({ cancelLeaveRequest });
  $: ({ cancellingLeaveId } = $cancelLeave);
  async function doCancelLeave(lr: LeaveRequest) {
    const outcome = await cancelLeave.cancelLeave(lr); // null = busy 守衛（in-flight 早退）
    if (!outcome) return;
    if (outcome.kind === 'leaveCancelled') {
      toasts.notify('success', '已取消請假申請', outcome.courseName + ' 的請假申請已取消。');
    } else {
      toasts.notify('error', '取消請假失敗', leaveRequestErrorMessage(outcome.error));
    }
  }

  $: cur = data && active != null ? (data.courses.find((c) => c.id === active) ?? data.courses[0]) : null;

  $: stats = cur ? ([
    { icon: 'calendar-check', value: cur.att + '%', label: '出席率' },
    { icon: 'calendar-clock', value: cur.next, label: '下一堂' },
    { icon: 'hourglass', value: cur.remain + ' 堂', label: '剩餘堂數' }
  ] satisfies { icon: IconName; value: string; label: string }[]) : [];
</script>

<LoadGate {gate}>
  <div data-testid="mine-skeleton" class="df-view" style="display:grid;grid-template-columns:1fr 1.2fr;gap:18px;align-items:start" slot="loading">
    <div style="display:flex;flex-direction:column;gap:14px">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={96} r={12} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={340} r={12} /></SkelCard>
  </div>

  {#if data}
  {#if data.courses.length === 0}
    <div class="df-view">
      <EmptyState
        icon="book-open"
        title="尚未報名任何課程"
        body="完成報名後，你的課程詳情、出席紀錄與教練資訊將會在這裡顯示。"
      />
    </div>
  {:else}
  <div class="df-view" style="display:grid;grid-template-columns:1fr 1.2fr;gap:18px;align-items:start">
    <!-- Left: enrolled course list -->
    <div style="display:flex;flex-direction:column;gap:14px">
      {#each data.courses as c (c.id)}
        {@const on = active === c.id}
        <button type="button" class="course-btn" on:click={() => selectCourse(c.id)}>
          <Card padding={18} hoverable style={on ? 'border:2px solid var(--df-primary)' : ''}>
            <div style="display:flex;gap:13px;align-items:center">
              <div
                style="width:46px;height:46px;border-radius:12px;background:{c.color}1A;display:flex;align-items:center;justify-content:center;flex:none"
              >
                <Icon name={c.icon} size={23} color={c.color} />
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:15.5px;font-weight:700;color:var(--df-ink)">{c.name}</div>
                <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">{c.coach} 教練 · {c.term}</div>
              </div>
              <Icon name="chevron-right" size={18} color={on ? 'var(--df-primary)' : 'var(--df-border-strong)'} />
            </div>
            <div style="margin-top:14px">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px">
                <span style="color:var(--df-text-light)">出席率</span>
                <span style="font-weight:700;color:var(--df-text-dark)">{c.att}% · {c.attended}/{c.total} 堂</span>
              </div>
              <ProgressBar value={c.att} height={6} tone={c.att >= 90 ? 'success' : 'primary'} />
            </div>
          </Card>
        </button>
      {/each}
    </div>

    <!-- Right: active course detail -->
    {#if cur}
      <Card padding={0} style="overflow:hidden">
        <div
          style="padding:20px 24px;border-bottom:1px solid var(--df-border);display:flex;align-items:center;gap:14px"
        >
          <div
            style="width:52px;height:52px;border-radius:13px;background:{cur.color}1A;display:flex;align-items:center;justify-content:center;flex:none"
          >
            <Icon name={cur.icon} size={26} color={cur.color} />
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px">
              <h3 style="margin:0;font-size:19px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading)">{cur.name}</h3>
              <Badge tone={LEVEL_TONE[cur.level]}>{cur.level}</Badge>
            </div>
            <div style="font-size:13px;color:var(--df-text-light);margin-top:4px">{cur.schedule} · {cur.room}</div>
          </div>
        </div>
        <div style="padding:24px;display:flex;flex-direction:column;gap:20px">
          <!-- Stat tiles -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            {#each stats as s (s.label)}
              <div style="background:var(--df-bg-light);border-radius:12px;padding:14px 16px">
                <Icon name={s.icon} size={18} color="var(--df-primary)" />
                <div style="font-size:18px;font-weight:800;color:var(--df-ink);margin-top:8px;font-family:var(--df-font-heading)">{s.value}</div>
                <div style="font-size:12px;color:var(--df-text-light);margin-top:1px">{s.label}</div>
              </div>
            {/each}
          </div>

          <!-- Attendance history(Task F7：真後端 GET /enrolments/{id}/attendance，§3.12) -->
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:12px">出席紀錄</div>
            <LoadGate gate={attGate}>
              <Skeleton slot="loading" w="100%" h={56} r={8} />
              <!-- 卡片內區塊層級的 gate：已在 Card 裡，錯誤畫面覆寫為裸 ErrorState，
                   不用預設 fallback 的 Card 包裝（避免 Card 套 Card）。 -->
              <svelte:fragment slot="error" let:retry>
                <ErrorState onRetry={retry} />
              </svelte:fragment>
              {#if attendance && attendance.length === 0}
                <EmptyState icon="calendar-x" title="尚無出勤紀錄" body="教練完成點名後，出席狀況會顯示在這裡。" pad="12px 0" />
              {:else if attendance}
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                  {#each attendance as h, i (i)}
                    {@const [tone, label] = ATT_STATE[h.state]}
                    <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
                      <Badge {tone} dot>{label}</Badge>
                      <span style="font-size:11px;color:var(--df-text-muted);font-family:var(--df-font-mono)">{h.date}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </LoadGate>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:10px;border-top:1px solid var(--df-border);padding-top:18px">
            <Button variant="secondary" fullWidth on:click={() => (dialog = 'leave')}>
              <Icon name="calendar-off" size={16} />請假
            </Button>
            <Button variant="primary" fullWidth on:click={() => (dialog = 'contact')}>
              <Icon name="message-circle" size={16} />聯絡教練
            </Button>
          </div>
        </div>
      </Card>
    {/if}
  </div>
  {#if cur}
    <LeaveDialog open={dialog === 'leave'} course={cur} onClose={() => (dialog = null)} />
    <ContactDialog open={dialog === 'contact'} course={cur} onClose={() => (dialog = null)} />
  {/if}
  {/if}

  <!-- 我的請假（Task 11：GET /leave-requests/me 水合；pending 可取消、approved 且
       未補課可預約補課）—— 同候補中課程,不論上面是空狀態或兩欄式課程清單都要顯示,
       放在 courses.length 的 if/else 外面(退選課程後歷史請假紀錄仍可能存在)。 -->
  <div class="df-view" style="margin-top:18px">
    <Card padding={0} style="overflow:hidden">
      <div style="padding:16px 22px;border-bottom:1px solid var(--df-border)">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">我的請假</h3>
      </div>
      {#if $leaveRequests.length === 0}
        <EmptyState
          icon="calendar-off"
          title="目前沒有請假紀錄"
          body="申請請假後，審核進度與補課狀態會顯示在這裡。"
          pad="20px 0"
        />
      {:else}
        <div style="padding:2px 22px 8px">
          {#each $leaveRequests as lr, i (lr.id)}
            {@const [tone, label] = LEAVE_STATUS[lr.status] ?? ['neutral', lr.status]}
            <div
              style="display:flex;align-items:center;gap:12px;padding:14px 0;{i < $leaveRequests.length - 1
                ? 'border-bottom:1px solid var(--df-border)'
                : ''}"
            >
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{lr.course_name}</div>
                <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">
                  {formatSessionDateTime(lr.session_date, lr.start_time)}{#if lr.reason} · {lr.reason}{/if}
                </div>
                {#if lr.status === 'approved' && lr.makeup_session_id}
                  <div style="font-size:12.5px;color:var(--df-success);margin-top:2px">
                    已預約補課：{formatSessionDateTime(lr.makeup_session_date ?? '', lr.makeup_start_time ?? '')}
                  </div>
                {/if}
              </div>
              <Badge {tone} dot>{label}</Badge>
              {#if lr.status === 'pending'}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cancellingLeaveId === lr.id}
                  on:click={() => doCancelLeave(lr)}
                >
                  取消
                </Button>
              {:else if lr.status === 'approved' && !lr.makeup_session_id}
                <Button variant="secondary" size="sm" on:click={() => (makeupFor = lr)}>預約補課</Button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  </div>
  <MakeupDialog open={makeupFor !== null} leaveRequest={makeupFor} onClose={() => (makeupFor = null)} />

  <!-- 候補中課程（Task 3：GET /waitlist/me 水合 + DELETE 取消）—— 不論上面是空
       狀態或兩欄式課程清單都要顯示，所以放在 courses.length 的 if/else 外面。 -->
  <div class="df-view" style="margin-top:18px">
    <Card padding={0} style="overflow:hidden">
      <div style="padding:16px 22px;border-bottom:1px solid var(--df-border)">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">候補中課程</h3>
      </div>
      {#if $waitlist.length === 0}
        <EmptyState
          icon="clock"
          title="目前沒有候補中的課程"
          body="課程額滿時可加入候補，有名額釋出時將會通知你。"
          pad="20px 0"
        />
      {:else}
        <div style="padding:2px 22px 8px">
          {#each $waitlist as w, i (w.id)}
            <div
              style="display:flex;align-items:center;gap:12px;padding:14px 0;{i < $waitlist.length - 1
                ? 'border-bottom:1px solid var(--df-border)'
                : ''}"
            >
              <div style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--df-text-dark)">
                {w.course_name}
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={cancellingId === w.id}
                on:click={() => doCancelWaitlist(w)}
              >
                取消候補
              </Button>
            </div>
          {/each}
        </div>
      {/if}
    </Card>
  </div>
  {/if}

  <div class="df-view" slot="error"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
</LoadGate>

<style>
  .course-btn {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    display: block;
    width: 100%;
  }
</style>
