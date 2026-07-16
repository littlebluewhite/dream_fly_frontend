<script lang="ts">
  /* 我的課程 · 課程詳情 push screen。mine.jsx MyCourseDetail (99) · app.jsx (88)。
   * 課程 hero（出席環）+ 動作（請假 / 聯絡）+ 我的請假 + 成績單入口 + 出席紀錄。
   *
   * Task 19：動作列拿掉舊 mock 版「預約補課」快捷按鈕 —— 真後端的補課預約是
   * 針對「一張已核准且尚未補課的請假申請」的動作(見 MakeupSheet.svelte)，不是
   * 課程層級可以隨時點的按鈕，鏡射桌面 mine 頁的既有決定(同一份 Task 11 註解：
   * 「課程詳情動作列不再有預約補課按鈕」)。改為新增「我的請假」卡片，列出這門
   * 課程的請假紀錄(復用 $lib/member/stores 的 leaveRequests store)：pending 可
   * 取消、approved 且未補課才顯示「預約補課」進 MakeupSheet(帶 leaveRequest)。
   *
   * 舊「技巧熟練度」卡片(REPORTS[c.id]/SKILLS 逐技巧拆解百分比)已移除 —— 真
   * 後端成績單(getReports())完全沒有這個概念(只有 comment/rating/term_label
   * 三個欄位)，改為一個誠實的「成績單與證書」導覽列(同帳戶頁的選單項寫法：
   * 不論資料是否存在都顯示入口，由 ReportScreen 自己處理空狀態)，取代原本
   * 對這門課程假裝有的逐技巧百分比。ReportScreen 現在是列表呈現全部成績單
   * (同桌面 /member/reports 頁)，不再是單一課程 scope，故此處不再傳 course
   * prop 進去。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Skeleton from '$lib/components/ui/Skeleton.svelte';
  import ErrorState from '$lib/components/ui/ErrorState.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import LoadGate from '$lib/components/ui/LoadGate.svelte';
  import { overlay, toasts, createCancelLeave } from '$lib/mobile/stores';
  import {
    leaveRequests,
    refreshLeaveRequests,
    cancelLeaveRequest,
    leaveRequestErrorMessage,
    type LeaveRequest
  } from '$lib/member/stores';
  import { LEAVE_STATUS } from '$lib/member/data';
  import { getEnrolmentAttendance } from '$lib/mobile/api';
  import { formatSessionDateTime } from '$lib/member/session-format';
  import { createLoadGate } from '$lib/load-gate';
  import { ATT_STATE, LEVEL_TONE, type MyCourse, type AttRecord } from '$lib/mobile/data';
  import type { IconName } from '$lib/icon-registry';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  export let onBack: () => void;
  export let course: MyCourse | null = null;

  $: c = course as MyCourse;
  $: levelTone = (c ? LEVEL_TONE[c.level] || 'primary' : 'primary') as Tone;

  /* 出席環 — mine.jsx AttRing (6)。size 92、stroke 9。 */
  const ringSize = 92;
  const ringR = (ringSize - 12) / 2;
  const ringCirc = 2 * Math.PI * ringR;

  $: metaRows = c
    ? ([
        ['calendar-days', c.schedule],
        ['map-pin', c.room],
        ['user-round', c.coach + ' 教練'],
        ['ticket', '本季尚餘 ' + c.remain + ' 堂']
      ] satisfies [IconName, string][])
    : [];

  // 我的請假 —— 復用桌面 mine 頁同一顆 leaveRequests store，範圍收斂到這門課程
  // (course_id 比對；mock 時代 MyCourse.course_id 為 optional，真 getMine() 已
  // 填入真值，比對不到時 courseLeaves 安全落空，不拋錯)。best-effort 水合，
  // 失敗不擋課程詳情本身的顯示(同 mine 頁 load() 對候補/請假清單的處理慣例)。
  //
  // 出席紀錄(Task F7：GET /enrolments/{id}/attendance，§3.12)—— 復用
  // mobile/api.ts 的 getEnrolmentAttendance()(W3 收編：該函式零映射委派桌面
  // member/api.ts 同名函式；收編前本檔案直接 import 桌面 seam，與
  // mobile-admin 零直穿紀律相反，現已收斂對齊)。c.id 是
  // 這筆報名(enrolment)的 uuid(見 EnrolledCourse.id 的既有註解)。overlay push 一律
  // 帶入非 null 的 course(見 OverlayHost.svelte)，僅在有值時才載入。
  let attendance: AttRecord[] | null = null;
  const attGate = createLoadGate({
    fetch: () => getEnrolmentAttendance(c.id),
    onData: (d) => { attendance = d; }
  });
  onMount(() => {
    refreshLeaveRequests().catch((err) => console.error('courseDetail: 我的請假 hydrate 失敗', err));
    if (c) attGate.load();
  });
  $: courseLeaves = c ? $leaveRequests.filter((lr) => lr.course_id === c.course_id) : [];

  // 取消請假（卡 6）：busy 守衛 + outcome 機制經 $lib/mobile/stores 的 re-export
  // 收斂進 $lib/member/cancel-leave（與桌面 mine 頁共用同一份雙生單源）；deps
  // （cancelLeaveRequest）本卡仍直取 $lib/member/stores（存量收編另卡處理）；
  // toast 文案與 leaveRequestErrorMessage 映射留在元件（ADR 0011）。
  const cancelLeave = createCancelLeave({ cancelLeaveRequest });
  $: cancellingId = $cancelLeave.cancellingLeaveId;
  async function doCancelLeave(lr: LeaveRequest) {
    const outcome = await cancelLeave.cancelLeave(lr); // null = busy 守衛（in-flight 早退）
    if (!outcome) return;
    if (outcome.kind === 'leaveCancelled') {
      toasts.notify('success', '已取消請假申請', outcome.courseName + ' 的請假申請已取消。');
    } else {
      toasts.notify('error', '取消請假失敗', leaveRequestErrorMessage(outcome.error));
    }
  }
</script>

<PushScreen>
  <ScreenHeader {onBack} title="課程詳情">
    <svelte:fragment slot="right">
      {#if c}
        <HeaderIcon
          icon="message-circle"
          label="聯絡教練"
          onClick={() => overlay.sheet('contact', { course: c })}
        />
      {/if}
    </svelte:fragment>
  </ScreenHeader>

  <div class="df-scroll">
    {#if c}
      <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
        <!-- hero -->
        <Card padding={16}>
          <div style="display:flex; align-items:center; gap:13px; margin-bottom:14px;">
            <div
              style="width:54px; height:54px; border-radius:14px; background:{c.color}1A; display:flex;
                align-items:center; justify-content:center; flex:none;"
            ><Icon name={c.icon} size={28} color={c.color} /></div>
            <div style="flex:1; min-width:0;">
              <h2
                style="margin:0; font-family:var(--df-font-heading); font-size:19px; font-weight:800; color:var(--df-ink);"
              >{c.name}</h2>
              <div style="display:flex; align-items:center; gap:6px; margin-top:5px;">
                <Badge tone={levelTone}>{c.level}</Badge>
                <span style="font-size:12.5px; color:var(--df-text-light);">{c.term}</span>
              </div>
            </div>
          </div>
          <div
            style="display:flex; align-items:center; gap:16px; padding:12px 0 0; border-top:1px solid var(--df-border);"
          >
            <div style="position:relative; width:{ringSize}px; height:{ringSize}px; flex:none;">
              <svg width={ringSize} height={ringSize} style="transform:rotate(-90deg);">
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="var(--df-border)" stroke-width="9" />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringR}
                  fill="none"
                  stroke="var(--df-primary)"
                  stroke-width="9"
                  stroke-linecap="round"
                  stroke-dasharray={ringCirc}
                  stroke-dashoffset={ringCirc * (1 - c.att / 100)}
                  style="transition:stroke-dashoffset .5s ease;"
                />
              </svg>
              <div
                style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;"
              >
                <span style="font-size:22px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{c.att}%</span>
                <span style="font-size:10.5px; color:var(--df-text-light);">出席率</span>
              </div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:9px; font-size:13px;">
              {#each metaRows as [ic, v]}
                <div style="display:flex; align-items:center; gap:9px; color:var(--df-text-dark);">
                  <Icon name={ic} size={15} color="var(--df-text-muted)" />{v}
                </div>
              {/each}
            </div>
          </div>
        </Card>

        <!-- actions -->
        <div style="display:flex; gap:10px;">
          <button
            on:click={() => overlay.sheet('leave', { course: c })}
            class="df-tapscale"
            style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
              border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer;"
          >
            <div
              style="width:38px; height:38px; border-radius:11px; background:var(--df-warning-bg); display:flex;
                align-items:center; justify-content:center;"
            ><Icon name="calendar-off" size={20} color="var(--df-warning)" /></div>
            <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">請假</span>
          </button>
          <button
            on:click={() => overlay.sheet('contact', { course: c })}
            class="df-tapscale"
            style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
              border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer;"
          >
            <div
              style="width:38px; height:38px; border-radius:11px; background:var(--df-info-bg); display:flex;
                align-items:center; justify-content:center;"
            ><Icon name="message-circle" size={20} color="var(--df-info)" /></div>
            <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">聯絡教練</span>
          </button>
        </div>

        <!-- 我的請假(Task 19：真後端，範圍收斂到這門課程) -->
        <Card padding={16}>
          <h3 style="margin:0 0 12px; font-size:15.5px; font-weight:700; color:var(--df-ink);">我的請假</h3>
          {#if courseLeaves.length === 0}
            <p style="margin:0; font-size:13px; color:var(--df-text-light);">目前沒有這門課程的請假紀錄。</p>
          {:else}
            <div style="display:flex; flex-direction:column;">
              {#each courseLeaves as lr, i (lr.id)}
                {@const [tone, label] = LEAVE_STATUS[lr.status] ?? ['neutral', lr.status]}
                <div
                  style="display:flex; align-items:center; gap:10px; padding:10px 0;
                    border-top:{i ? '1px solid var(--df-border)' : 'none'};"
                >
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; color:var(--df-text-dark); font-family:var(--df-font-mono);">
                      {formatSessionDateTime(lr.session_date, lr.start_time)}
                    </div>
                    {#if lr.status === 'approved' && lr.makeup_session_id}
                      <div style="font-size:12px; color:var(--df-success); margin-top:2px;">
                        已預約補課：{formatSessionDateTime(lr.makeup_session_date ?? '', lr.makeup_start_time ?? '')}
                      </div>
                    {/if}
                  </div>
                  <Badge {tone} dot>{label}</Badge>
                  {#if lr.status === 'pending'}
                    <button
                      disabled={cancellingId === lr.id}
                      on:click={() => doCancelLeave(lr)}
                      class="df-tapscale"
                      style="flex:none; height:30px; padding:0 12px; border-radius:8px; border:1px solid var(--df-border);
                        background:#fff; font-size:12px; font-weight:600; color:var(--df-text-dark); cursor:pointer;"
                    >取消</button>
                  {:else if lr.status === 'approved' && !lr.makeup_session_id}
                    <button
                      on:click={() => overlay.sheet('makeup', { leaveRequest: lr })}
                      class="df-tapscale"
                      style="flex:none; height:30px; padding:0 12px; border-radius:8px; border:1px solid var(--df-primary);
                        background:var(--df-primary-bg); font-size:12px; font-weight:600; color:var(--df-primary); cursor:pointer;"
                    >預約補課</button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </Card>

        <!-- 成績單與證書入口(取代舊「技巧熟練度」逐項百分比卡片) -->
        <button
          on:click={() => overlay.push('report')}
          class="df-tapscale"
          style="display:flex; align-items:center; gap:13px; padding:14px 16px; border-radius:14px;
            border:1px solid var(--df-border); background:#fff; cursor:pointer; width:100%; text-align:left;"
        >
          <div style="width:38px; height:38px; border-radius:11px; background:var(--df-success-bg); display:flex; align-items:center; justify-content:center; flex:none;">
            <Icon name="clipboard-list" size={20} color="var(--df-success)" />
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:14.5px; font-weight:600; color:var(--df-ink);">成績單與證書</div>
            <div style="font-size:12px; color:var(--df-text-light);">查看教練評語、評分與已獲得的證書</div>
          </div>
          <Icon name="chevron-right" size={18} color="var(--df-text-muted)" />
        </button>

        <!-- attendance history(Task F7：真後端 GET /enrolments/{id}/attendance，§3.12) -->
        <Card padding={16}>
          <h3 style="margin:0 0 12px; font-size:15.5px; font-weight:700; color:var(--df-ink);">出席紀錄</h3>
          <LoadGate gate={attGate}>
            <Skeleton slot="loading" w="100%" h={60} r={8} />
            <!-- 卡片內區塊層級的 gate：已在 Card 裡，錯誤畫面覆寫為裸 ErrorState，
                 不用預設 fallback 的 Card 包裝（避免 Card 套 Card）。 -->
            <svelte:fragment slot="error" let:retry>
              <ErrorState onRetry={retry} />
            </svelte:fragment>
            {#if attendance && attendance.length === 0}
              <EmptyState icon="calendar-x" title="尚無出勤紀錄" body="教練完成點名後，出席狀況會顯示在這裡。" pad="12px 0" />
            {:else if attendance}
              <div style="display:flex; flex-direction:column;">
                {#each attendance as a, i (i)}
                  {@const [tone, label] = ATT_STATE[a.state]}
                  <div
                    style="display:flex; align-items:center; gap:12px; padding:10px 0;
                      border-top:{i ? '1px solid var(--df-border)' : 'none'};"
                  >
                    <Icon name="calendar" size={16} color="var(--df-text-muted)" />
                    <span style="flex:1; font-size:13.5px; color:var(--df-text-dark); font-family:var(--df-font-mono);">2026 / {a.date}</span>
                    <Badge tone={tone as Tone} dot>{label}</Badge>
                  </div>
                {/each}
              </div>
            {/if}
          </LoadGate>
        </Card>
        <div style="height:8px;"></div>
      </div>
    {/if}
  </div>
</PushScreen>
