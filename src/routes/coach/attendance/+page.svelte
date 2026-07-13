<script lang="ts">
  /* 出勤記錄 / 點名 — 教練端點名頁面
   * Ported from docs/design/coach/views_attendance.jsx (L25–153).
   * Legacy Svelte (no runes).
   *
   * Now: class/roster are stateful (切換班級 via CoachDropdown) and every unsaved
   * edit snapshots the WHOLE save-bar state so 復原 restores marks + dirtyCount +
   * state, not just marks.
   *
   * Data arrives async via getAttendance()(真實 API 接縫，Task 10：今日場次 ×
   * 各自名冊，見 $lib/coach/api)：onMount loads the班級清單 into a three-state gate
   * (loading/error/ready)。`curClass` keeps its non-null assertion (safe once
   * ready 且 classes 非空 — curClassId 一律指向已載入的班級；`classes.length === 0`
   * 時改走獨立的空狀態分支，不會走到用到 curClass 的樣板)；`roster` 是衍生獨立、帶
   * optional-chain guard 的(pre-load reactive tick、classes 仍為 [] 不會 throw)。
   *
   * 儲存(doSave)呼叫真實 saveAttendance(sessionId, marks) → PUT /sessions/{id}/
   * attendance；成功以伺服器回傳的最新名冊同步 marks/classes(而非樂觀本地值 ——
   * 'late'(遲到)沒有對應後端狀態、送出時併入 'present'，若不用伺服器回應同步，畫面會
   * 持續顯示「遲到」但後端其實已存成「出席」)；失敗依 ApiError.status 顯示對應繁中
   * 錯誤 toast，state 退回 'dirty' 讓教練可以重試。
   *
   * SaveBar(草稿狀態機)的純轉移在 $lib/coach/attendance-draft.ts(Round 2 C5);其上的
   * 編排(鏡射、snapshot/undo、byClass 切班暫存、save 生命週期與 state 回應同步 guard)已
   * 收進 $lib/coach/attendance-controller.ts(Round 3 K1)。本頁退化為薄 adapter:解構
   * controller 的單一快照 store、事件轉呼 controller 方法、把 save 的 SaveOutcome 翻成
   * toast 文案,並保留 noteFor/noteText 編輯暫存、failedClasses 提示與五條顯示衍生。 */
  import { onMount } from 'svelte';
  import { createLoadGate } from '$lib/load-gate';
  import { getAttendance, saveAttendance } from '$lib/coach/api';
  import type { AttRow, AttDefault, AttClassFull } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import { tally } from '$lib/coach/attendance-tally';
  import { createAttendanceController } from '$lib/coach/attendance-controller';
  import { apiErrorText } from '$lib/api/error-text';
  import { EmptyState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import AttSegment from '$lib/coach/components/AttSegment.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  const ctrl = createAttendanceController({ saveAttendance, now: nowHHMM });

  // ── 單一快照 store 解構鏡射(原五條鏡射變數 + classes/curClassId + canUndo 衍生) ──
  let classes: AttClassFull[] = [];
  let curClassId = '';
  let marks: Record<string, AttDefault> = {};
  let notes: Record<string, string> = {};
  let state: 'dirty' | 'saving' | 'saved' = 'dirty';
  let savedAt: string | null = null;
  let dirtyCount = 0;
  let canUndo = false;
  $: ({ classes, curClassId, marks, notes, state, savedAt, dirtyCount, canUndo } = $ctrl);

  // ── 當前班級 / 名冊 ────────────────────────────────────────────────────
  $: curClass = classes.find((c) => c.id === curClassId)!;
  $: roster = classes.find((c) => c.id === curClassId)?.roster ?? [];
  // 班級卡片的三顆 icon meta rows(時段/教室/教練)——原模板內聯 each 陣列 hoist 至此並標型別。
  // classes.length 守衛鏡射模板既有的 {#if classes.length === 0}…{:else} 分支——
  // curClass 的 `!` 斷言只在 classes 非空時成立，這裡不能無條件先算(見上方 curClass 附註)。
  $: curClassMeta =
    classes.length > 0
      ? ([
          ['clock', curClass.time],
          ['map-pin', curClass.room],
          ['user', '授課教練：' + curClass.coach]
        ] as [IconName, string][])
      : [];

  // ── 備註編輯暫存(留頁面,非 controller 收編範圍) ──────────────────────────
  let noteFor: AttRow | null = null;
  let noteText = '';

  const gate = createLoadGate({
    fetch: getAttendance,
    onData: (d) => {
      ctrl.init(d.classes);
      // 部分名冊載入失敗(seam 已做 allSettled 隔離)：成功班級照常可點名，
      // 失敗班級以 toast 提示，不整頁打成 error。
      if (d.failedClasses.length > 0) {
        toasts.notify(
          'warning',
          '部分名冊載入失敗',
          d.failedClasses.join('、') + ' 的名冊暫時無法載入，其他班級可正常點名，請稍後重新整理再試。'
        );
      }
    }
  });
  onMount(() => {
    gate.load();
  });

  // ── 動作(轉呼 controller 方法;snapshot/undo 副作用已在 controller 內) ────────
  // canUndo(= controller 舊 `prev != null`)驅動樣板的「復原」控制項顯示。
  function undo() {
    ctrl.undo();
  }

  function setMark(mid: string, v: AttDefault) {
    ctrl.setMark(mid, v);
  }

  function openNote(r: AttRow) {
    noteFor = r;
    noteText = notes[r.mid] || '';
  }

  function saveNote() {
    if (!noteFor) return;
    ctrl.applyNote(noteFor.mid, noteText); // codex r1 (P2)：備註編輯也算未存變更,見 draft applyNote 註解
    noteFor = null;
  }

  function closeNote() {
    noteFor = null;
  }

  function markAll() {
    ctrl.markAllPresent(); // codex r2 (P2)：changed 計數規則見 draft markAllPresent 註解
  }

  // CoachDropdown echoes the NAME; selectClass maps name→id via the controller (byClass
  // 切班暫存已在 controller 內)。blocked(儲存中不可切班：in-flight save 回呼只認得 live
  // 狀態,切走會卡在 儲存中,成功 toast 也可能落錯班)由 controller 回報,頁面據此發提示
  // toast。(codex round 3 P1)
  function selectClass(name: string) {
    if (ctrl.selectClass(name) === 'blocked') {
      toasts.notify('info', '儲存中', '請待目前點名儲存完成後再切換班級。');
    }
  }

  /** 目前時間 "HH:MM"，供儲存成功後的「已同步至雲端」時間戳使用(真實存檔時間，取代
   *  舊 mock 版本的硬編 '14:32')。 */
  function nowHHMM(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  /** PUT /sessions/{id}/attendance 的錯誤分支(§3.19：404/403/422，此端點無 409) —
   *  對應繁中錯誤提示；其餘(連線問題等)給通用訊息，同 coach/+page.svelte 的 ApiError
   *  判斷慣例。 */
  function attendanceErrorMessage(e: unknown): string {
    return apiErrorText(e, {
      403: '沒有權限為此堂課點名。',
      404: '找不到此場次，請重新整理頁面後再試。',
      422: '點名資料有誤，本次變更未儲存，請重新整理後再試。'
    });
  }

  async function doSave() {
    const outcome = await ctrl.save();
    if (outcome.kind === 'saved') {
      // 成功 toast 據 await 前的 hadLate 快照追加一句折疊說明,避免教練誤以為點選沒存到。
      toasts.notify(
        'success',
        '點名已儲存',
        outcome.className + ' · ' + outcome.rosterCount + ' 位學員出勤已同步至雲端。' +
          (outcome.hadLate ? '遲到已以出席紀錄（系統不區分遲到）。' : '')
      );
    } else if (outcome.kind === 'failed') {
      toasts.notify('error', '點名儲存失敗', attendanceErrorMessage(outcome.error));
    }
    // stale：in-flight 期間又編輯過,回應被丟棄——頁面不做任何事(同現行 state guard 的 return)。
  }

  // ── 衍生 ──────────────────────────────────────────────────────────────
  $: tallyCounts = tally(marks, roster);

  $: chips = [
    { key: 'present', label: '出席',               color: 'var(--df-success)',      n: tallyCounts.present || 0 },
    { key: 'late',    label: '遲到',               color: 'var(--df-warning)',      n: tallyCounts.late    || 0 },
    { key: 'leave',   label: '請假',               color: 'var(--df-info)',         n: tallyCounts.leave   || 0 },
    { key: 'absent',  label: '缺席',               color: 'var(--df-error)',        n: tallyCounts.absent  || 0 },
    { key: 'total',   label: '共 ' + roster.length + ' 人', color: 'var(--df-text-muted)', n: roster.length },
  ];

  // 儲存狀態卡片設定 (circle-check-big → circle-check per icon naming guide)
  $: SS = ({
    dirty:  { icon: 'circle-alert', tone: 'var(--df-warning)',  bg: 'var(--df-warning-bg)',  title: '尚未儲存', desc: dirtyCount + ' 筆出席變更尚未儲存，離開前請記得儲存' },
    saving: { icon: 'loader',       tone: 'var(--df-primary)',  bg: 'var(--df-primary-bg)', title: '儲存中…',  desc: '正在同步至雲端，請勿關閉頁面' },
    saved:  { icon: 'circle-check', tone: 'var(--df-success)',  bg: 'var(--df-success-bg)', title: '已儲存',   desc: (savedAt || nowHHMM()) + ' 已同步至雲端 · 全部 ' + roster.length + ' 位學員' },
  } satisfies Record<'dirty' | 'saving' | 'saved', { icon: IconName; tone: string; bg: string; title: string; desc: string }>)[state];
</script>

<LoadGate {gate}>
  <div style="display:flex;flex-direction:column;gap:16px;padding-bottom:80px;" data-testid="attendance-skeleton" slot="loading">
    <SkelCard><Skeleton w="100%" h={64} r={12} /></SkelCard>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <SkelCard><Skeleton w="100%" h={56} r={12} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>

{#if classes.length === 0}
  <!-- ── 今日無場次：空狀態(同 coach/today 頁「今日尚無場次」用詞慣例) ──────── -->
  <Card padding={0}><EmptyState icon="calendar-x" title="今日尚無場次" body="今天沒有排定課程，無需點名。" pad="56px 24px" /></Card>
{:else}
<!-- 根容器：不加 df-view（layout 已包） -->
<div style="display:flex;flex-direction:column;gap:16px;padding-bottom:80px;">

  <!-- ── 班級選擇卡片 ──────────────────────────────────────── -->
  <Card padding={20}>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none;">
          <Icon name="dumbbell" size={24} color="var(--df-primary)" />
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading);">{curClass.name}</div>
          <div style="display:flex;gap:14px;margin-top:5px;flex-wrap:wrap;">
            {#each curClassMeta as [ic, t]}
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--df-text-light);">
                <Icon name={ic} size={13} color="var(--df-text-muted)" />{t}
              </span>
            {/each}
          </div>
        </div>
      </div>
      <!-- 切換班級 — CoachDropdown echoes the NAME; selectClass maps name→id. -->
      <CoachDropdown
        icon="dumbbell"
        value={curClass.name}
        options={classes.map((c) => c.name)}
        onChange={selectClass}
      />
    </div>
  </Card>

  <!-- ── 統計摘要列 ─────────────────────────────────────────── -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    {#each chips as c (c.key)}
      <div style="flex:1 1 120px;background:#fff;border:1px solid var(--df-border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;">
        <span style="width:10px;height:10px;border-radius:999px;background:{c.color};flex:none;"></span>
        <span style="font-size:13px;color:var(--df-text-light);flex:1;">{c.label}</span>
        <span style="font-size:24px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading);">{c.n}</span>
      </div>
    {/each}
  </div>

  <!-- ── 學員名單 ──────────────────────────────────────────── -->
  <Card padding={0} style="overflow:hidden;">
    <!-- 名單標頭 -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--df-border);">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink);">學員名單</h3>
        <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px;">點選狀態以記錄出席</div>
      </div>
      <button
        type="button"
        on:click={markAll}
        style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;color:var(--df-text-light);cursor:pointer;font-family:var(--df-font-body);"
      ><Icon name="check-check" size={15} />全部標記出席</button>
    </div>

    <!-- 學員列 -->
    <div>
      {#each roster as r, i (r.mid)}
        {@const onLeave = r.def === 'leave'}
        <div
          class="df-rowhover"
          style="display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:{i < roster.length - 1 ? '1px solid var(--df-border)' : 'none'};"
        >
          <!-- 序號 -->
          <span style="font-family:var(--df-font-mono);font-size:14px;font-weight:600;color:var(--df-text-muted);width:24px;">{r.n}</span>
          <!-- 頭像 -->
          <span style="width:38px;height:38px;border-radius:50%;background:{r.color};color:#fff;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex:none;">{r.initial}</span>
          <!-- 姓名 + 會員編號 -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:600;color:var(--df-text-dark);">{r.name}</div>
            <div style="font-size:12px;color:var(--df-text-muted);font-family:var(--df-font-mono);">會員編號：{r.mid}</div>
          </div>
          <!-- 備註預覽 chip -->
          {#if notes[r.mid]}
            <span
              title={notes[r.mid]}
              style="display:inline-flex;align-items:center;gap:5px;background:var(--df-bg-light);border:1px solid var(--df-border);border-radius:6px;padding:4px 9px;font-size:12px;color:var(--df-text-light);max-width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;"
            ><Icon name="sticky-note" size={13} color="var(--df-text-muted)" />{notes[r.mid]}</span>
          {/if}
          <!-- 狀態：已請假靜態 badge；其餘 AttSegment -->
          {#if onLeave}
            <span style="display:inline-flex;align-items:center;gap:6px;background:#E0F2FE;color:#075985;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;">
              <Icon name="calendar-off" size={14} color="#075985" />已請假
            </span>
          {:else}
            <AttSegment value={marks[r.mid]} onChange={(v) => setMark(r.mid, v)} />
          {/if}
          <!-- 備註按鈕 -->
          <button
            type="button"
            aria-label="備註"
            on:click={() => openNote(r)}
            style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--df-border);background:{notes[r.mid] ? 'var(--df-primary-bg)' : 'var(--df-bg-light)'};border-radius:8px;padding:7px 12px;font-size:13px;color:{notes[r.mid] ? 'var(--df-primary)' : 'var(--df-text-light)'};cursor:pointer;font-family:var(--df-font-body);font-weight:500;"
          ><Icon name="pencil-line" size={15} />備註</button>
        </div>
      {/each}
    </div>
  </Card>

  <!-- ── 出席保存狀態卡 ──────────────────────────────────────── -->
  <Card padding={20}>
    <h3 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--df-ink);">出席保存狀態</h3>
    <p style="margin:0 0 14px;font-size:13px;color:var(--df-text-light);line-height:1.5;">即時顯示儲存進度，支援離線暫存與多裝置衝突處理，資料不遺失。</p>
    <div style="display:flex;align-items:center;gap:14px;background:{SS.bg};border-radius:12px;padding:16px;">
      <span style="width:40px;height:40px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none;">
        <span style="display:inline-flex;animation:{state === 'saving' ? 'df-spin 1s linear infinite' : 'none'};">
          <Icon name={SS.icon} size={20} color={SS.tone} />
        </span>
      </span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14.5px;font-weight:700;color:var(--df-text-dark);">{SS.title}</div>
        <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px;">{SS.desc}</div>
      </div>
      {#if canUndo}
        <button
          type="button"
          on:click={undo}
          style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--df-text-light);cursor:pointer;font-family:var(--df-font-body);"
        ><Icon name="rotate-ccw" size={15} />復原</button>
      {/if}
    </div>
  </Card>

</div>

<!-- ── 固定底部操作列 ──────────────────────────────────────────── -->
<div style="position:fixed;left:240px;right:0;bottom:0;background:rgba(255,255,255,0.96);backdrop-filter:blur(8px);border-top:1px solid var(--df-border);padding:12px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px;z-index:30;flex-wrap:wrap;">
  <span style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--df-text-light);">
    <Icon
      name={state === 'saved' ? 'cloud-check' : 'cloud'}
      size={16}
      color={state === 'saved' ? 'var(--df-success)' : 'var(--df-text-muted)'}
    />
    {#if state === 'saved'}
      {(savedAt || nowHHMM())} 已同步至雲端 · 全部 {roster.length} 位學員
    {:else}
      尚未儲存 · {dirtyCount} 筆變更 · 已自動暫存於本機 14:30
    {/if}
  </span>
  <div style="display:flex;gap:10px;">
    <button
      type="button"
      on:click={markAll}
      style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body);"
    ><Icon name="check-check" size={16} />全部標記出席</button>
    <button
      type="button"
      on:click={doSave}
      disabled={state === 'saving'}
      style="display:inline-flex;align-items:center;gap:6px;border:none;background:var(--df-primary);color:#fff;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:{state === 'saving' ? 'default' : 'pointer'};opacity:{state === 'saving' ? 0.7 : 1};font-family:var(--df-font-body);"
    >
      <Icon name="save" size={16} color="#fff" />
      {#if state === 'saving'}儲存中…{:else if state === 'saved'}已儲存 ✓{:else}儲存點名{/if}
    </button>
  </div>
</div>

<!-- ── 備註 Dialog ─────────────────────────────────────────────── -->
<Dialog
  open={noteFor !== null}
  title={noteFor ? '備註 — ' + noteFor.name : '備註'}
  onClose={closeNote}
  primaryAction={{ label: '儲存備註', onClick: saveNote }}
  secondaryAction={{ label: '取消', onClick: closeNote }}
>
  {#if noteFor}
    <textarea
      rows={4}
      placeholder="輸入對此學員的備註…"
      bind:value={noteText}
      style="width:100%;padding:11px 14px;font-size:14px;font-family:var(--df-font-body);color:var(--df-text-dark);background:#fff;border:1.5px solid var(--df-border-strong);border-radius:8px;outline:none;resize:vertical;line-height:1.6;box-sizing:border-box;"
    ></textarea>
  {/if}
</Dialog>
{/if}
</LoadGate>
