<script lang="ts">
  /* 教練 · 課堂點名。port coach.jsx AttendanceScreen (63-162) + Segmented (70-79)。
   * onBell → openCoachNotif()；notify → toasts.notify。備註用 kit Sheet（本地狀態）。
   *
   * Task 20：改讀真 getAttendance()(coach/api.ts，Task 2：GET /sessions/today ×
   * 各場次 GET /sessions/{id}/roster)，取代舊 mock 只有單一硬編班級(k1)的限制——
   * 「切換班級」FilterChips 原本就設計成可切換多堂課，只是 mock 只給一筆資料而形同
   * 虛設(見舊版註解)；接上真資料後如實列出「今日全部場次」，切換班級恢復多選功能。
   *
   * R10(雙生收斂，ADR 0014 §2)：改接桌面 coach/attendance 頁同一套
   * $lib/coach/attendance-controller，取代原本內聯自管的點名狀態——mobile-admin/api.ts
   * 的 mapAttRow/MAttendanceClass/MAttendanceData 映射層已退役(getAttendance/
   * saveAttendance 改由本頁直取 $lib/coach/api)，本頁退化為薄 adapter：解構 controller 單一
   * 快照 store、切班/點名/全部標記出席/備註/儲存全轉呼 controller 方法；tally 改直取
   * $lib/coach/attendance-tally(最後一處點名邏輯雙生收斂)。白拿桌面既有行為，含原
   * 行動版沒有的：切班保留未存草稿(byClass 暫存)、儲存中切班被擋(info toast)、儲存中
   * 再編輯後遲到回應被丟棄(stale 不理會)。「切換班級」FilterChips 的 label(時間+課名)
   * 合成公式(R3 K9)已提進 $lib/coach/attendance-controller 的 sessionChipLabel 共用
   * (供桌面 dropdown 同步消歧義同名場次，ADR 0014 :224-226 銷帳)，取代原映射層算好的
   * 字串；「儲存點名」成功 toast 文案沿用行動版既有措辭(不採桌面「已同步至雲端」)。
   * R15(候選 點名文案，bug #5 文案對齊)：失敗 toast 標題照舊「儲存失敗」，內文改依
   * 狀態碼分流(同桌面 attendanceErrorMessage，見下方 ATTENDANCE_ERROR_TEXT)。「備註」
   * 改經 ctrl.applyNote 記入 controller(僅存本機、不計入未存變更，同桌面；Sheet 內明示)。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { openCoachNotif, coachUnreadCount, toasts } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getAttendance, saveAttendance } from '$lib/coach/api';
  import { coachLoadErrorCopy, GENERIC_LOAD_ERROR } from '$lib/coach/load-error-copy';
  import { apiErrorText } from '$lib/api/error-text';
  import type { AttClassFull, AttRow, AttDefault } from '$lib/coach/data';
  import { createAttendanceController, sessionChipLabel } from '$lib/coach/attendance-controller';
  import { tally } from '$lib/coach/attendance-tally';

  const ATT_STATES = [
    { key: 'present', label: '出席', color: 'var(--df-primary)' },
    { key: 'late', label: '遲到', color: 'var(--df-warning)' },
    { key: 'absent', label: '缺席', color: 'var(--df-error)' }
  ] as const;

  /* 本地牆鐘日期(YYYY/MM/DD)，非 toISOString()——後者取 UTC 日期，在 Asia/Taipei
   * (UTC+8)的凌晨會早報一天(同 CertificateDialog.svelte 的 today() 慣例)。 */
  function todayLabel(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}/${mm}/${dd}`;
  }

  const ctrl = createAttendanceController({ saveAttendance });

  // ── 單一快照 store 解構鏡射(同桌面 coach/attendance/+page.svelte 慣例；canUndo/
  // dirtyCount/savedAt 本頁 UI 未使用，不解構)。
  let classesToday: AttClassFull[] = [];
  let curClassId = '';
  let marks: Record<string, AttDefault> = {};
  let notes: Record<string, string> = {};
  let state: 'dirty' | 'saving' | 'saved' = 'dirty';
  $: ({ classes: classesToday, curClassId, marks, notes, state } = $ctrl);

  let noteFor: AttRow | null = null;
  let noteText = '';

  let { errorTitle, errorBody } = GENERIC_LOAD_ERROR;

  const gate = createLoadGate({
    fetch: getAttendance,
    onData: (d) => {
      ctrl.init(d.classes);
      if (d.failedClasses.length) {
        toasts.notify('warning', '部分場次名冊載入失敗', d.failedClasses.join('、') + ' 暫時無法點名，請稍後重試。');
      }
    },
    onError: (e) => {
      ({ errorTitle, errorBody } = coachLoadErrorCopy(e));
    }
  });
  onMount(() => {
    gate.load();
  });


  $: current = classesToday.find((c) => c.id === curClassId) ?? null;
  $: roster = current?.roster ?? [];
  $: classOpts = classesToday.map((c) => ({ key: c.id, label: sessionChipLabel(c) }));

  // FilterChips echoes the id，controller selectClass 也認 session id(0014 限制撤銷
  // 後桌面 CoachDropdown 同款)——直傳，同日兩場同課名各自可選(byClass 切班暫存已在
  // controller 內)。blocked(儲存中不可切班)由 controller 回報，本頁據此發提示 toast。
  function selectClass(id: string) {
    if (ctrl.selectClass(id) === 'blocked') {
      toasts.notify('info', '儲存中', '請待目前點名儲存完成後再切換班級。');
    }
  }

  function setMark(mid: string, v: AttDefault) {
    ctrl.setMark(mid, v);
  }

  $: tallyCounts = tally(marks, roster);
  $: counts = [
    { label: '出席', color: 'var(--df-primary)', n: tallyCounts.present || 0 },
    { label: '遲到', color: 'var(--df-warning)', n: tallyCounts.late || 0 },
    { label: '缺席', color: 'var(--df-error)', n: tallyCounts.absent || 0 },
    { label: '請假', color: 'var(--df-info)', n: tallyCounts.leave || 0 }
  ];

  function markAllPresent() {
    ctrl.markAllPresent();
  }

  /** PUT /sessions/{id}/attendance 的錯誤分支(§3.19：404/403/422，此端點無 409)對應
   *  繁中錯誤提示，逐字同桌面 coach/attendance/+page.svelte 的 attendanceErrorMessage；
   *  其餘(連線問題等)給通用訊息。 */
  const ATTENDANCE_ERROR_TEXT: Record<number, string> = {
    403: '沒有權限為此堂課點名。',
    404: '找不到此場次，請重新整理頁面後再試。',
    422: '點名資料有誤，本次變更未儲存，請重新整理後再試。'
  };

  async function onSave() {
    // 存檔前先快照目前班級：儲存中不可切班(見 selectClass 的 blocked 分支)，await
    // 後仍是同一班，這裡只是避免依賴這個不變量、明確表達「文案用的是送出當下的班級」。
    const target = current;
    const outcome = await ctrl.save();
    if (outcome.kind === 'saved') {
      // 文案保真：舊版帶時間前綴，如「19:00 測試班甲 · N 位學員出勤已記錄。」，
      // `SaveOutcome.className` 只有課名沒有時間，故不能直接拿來拼字串。
      const label = target ? sessionChipLabel(target) : outcome.className;
      toasts.notify('success', '點名已儲存', label + ' · ' + outcome.rosterCount + ' 位學員出勤已記錄。');
    } else if (outcome.kind === 'failed') {
      toasts.notify('error', '儲存失敗', apiErrorText(outcome.error, ATTENDANCE_ERROR_TEXT));
    }
    // stale：儲存中又被編輯過，回應已過期被丟棄——同現行 guard，頁面不做任何事。
  }
  function openNote(r: AttRow) {
    noteFor = r;
    noteText = notes[r.mid] || '';
  }
  function saveNote() {
    if (!noteFor) return;
    ctrl.applyNote(noteFor.mid, noteText);
    noteFor = null;
  }
</script>

<LoadGate {gate} errorTitle={errorTitle} errorBody={errorBody}>
  <div class="df-scroll df-view" data-testid="attendance-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;" slot="loading">
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:9px;">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={62} r={13} /></SkelCard>
      {/each}
    </div>
    <Skeleton w="100%" h={42} r={11} />
    <SkelCard padding={0}><Skeleton w="100%" h={260} r={12} /></SkelCard>
  </div>

  <ScreenHeader title="課堂點名" sub={todayLabel() + ' · 逐一標記出勤'}>
    <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={openCoachNotif} />
  </ScreenHeader>

  {#if classesToday.length === 0}
    <MEmpty icon="calendar-x" title="今日尚無場次" body="今天沒有排定的課程，暫時不需要點名。" />
  {:else}
  <div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
    <FilterChips items={classOpts} value={curClassId} onChange={selectClass} />
  </div>

  <div class="df-scroll df-view">
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      <!-- summary -->
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:9px;">
        {#each counts as c (c.label)}
          <div style="background:#fff; border:1px solid var(--df-border); border-radius:13px; padding:11px 4px; text-align:center; box-shadow:var(--df-shadow-card);">
            <div style="font-size:23px; font-weight:800; color:{c.color}; font-family:var(--df-font-heading);">{c.n}</div>
            <div style="font-size:11px; color:var(--df-text-light); margin-top:2px;">{c.label}</div>
          </div>
        {/each}
      </div>

      <button
        on:click={markAllPresent}
        class="df-tapscale"
        style="display:flex; align-items:center; justify-content:center; gap:7px; height:42px; border-radius:11px; border:1.5px solid var(--df-border); background:#fff; color:var(--df-text-dark); font-size:13.5px; font-weight:600; cursor:pointer;"
      ><Icon name="check-check" size={16} color="var(--df-primary)" />全部標記出席</button>

      <!-- roster -->
      <Panel title="學員出勤" sub={roster.length + ' 位 · ' + (current ? sessionChipLabel(current) : '')}>
        {#each roster as r, i (r.mid)}
          {@const onLeave = marks[r.mid] === 'leave'}
          <div style="padding:11px 14px; border-bottom:{i < roster.length - 1 ? '1px solid var(--df-border)' : 'none'};">
            <div style="display:flex; align-items:center; gap:11px;">
              <span style="font-family:var(--df-font-mono); font-size:12.5px; font-weight:600; color:var(--df-text-muted); width:20px; flex:none; text-align:center;">{String(i + 1).padStart(2, '0')}</span>
              <Avatar name={r.initial} size="sm" color={r.color} />
              <div style="flex:1; min-width:0;">
                <div style="font-size:14.5px; font-weight:600; color:var(--df-text-dark);">{r.name}</div>
                <div style="font-size:11px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{r.mid}</div>
              </div>
              {#if onLeave}
                <span style="display:inline-flex; align-items:center; gap:5px; background:#DBEAFE; color:var(--df-primary-dark); border-radius:7px; padding:6px 11px; font-size:12.5px; font-weight:700;"><Icon name="calendar-off" size={13} color="var(--df-primary-dark)" />已請假</span>
              {:else}
                <div style="display:inline-flex; background:var(--df-bg-light); border:1px solid var(--df-border); border-radius:9px; padding:3px;">
                  {#each ATT_STATES as s (s.key)}
                    {@const on = marks[r.mid] === s.key}
                    <button
                      on:click={() => setMark(r.mid, s.key)}
                      style="padding:6px 12px; border-radius:6px; border:none; cursor:pointer; font-size:12.5px; font-weight:700; font-family:var(--df-font-body); background:{on ? s.color : 'transparent'}; color:{on ? '#fff' : 'var(--df-text-light)'}; transition:background .14s ease, color .14s ease;"
                    >{s.label}</button>
                  {/each}
                </div>
              {/if}
            </div>
            <div style="display:flex; align-items:center; gap:9px; margin-top:9px; padding-left:31px;">
              <button
                on:click={() => openNote(r)}
                class="df-tapscale"
                style="display:inline-flex; align-items:center; gap:5px; border:1px solid var(--df-border); background:{notes[r.mid] ? 'var(--df-primary-bg)' : 'var(--df-bg-light)'}; border-radius:8px; padding:5px 11px; font-size:12px; color:{notes[r.mid] ? 'var(--df-primary)' : 'var(--df-text-light)'}; cursor:pointer; font-weight:600;"
              ><Icon name="pencil-line" size={13} color={notes[r.mid] ? 'var(--df-primary)' : 'var(--df-text-light)'} />{notes[r.mid] ? '已備註' : '備註'}</button>
              {#if notes[r.mid]}
                <span style="font-size:12px; color:var(--df-text-light); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{notes[r.mid]}</span>
              {/if}
            </div>
          </div>
        {/each}
      </Panel>
      <div style="height:8px;"></div>
    </div>
  </div>

  <!-- save bar (sits above the tab bar in normal flow) -->
  <div style="flex:none; padding:12px 16px; background:rgba(255,255,255,0.96); backdrop-filter:blur(10px); border-top:1px solid var(--df-border); z-index:45;">
    <button
      on:click={onSave}
      disabled={state === 'saving'}
      class="df-tapscale"
      style="width:100%; height:50px; border-radius:13px; border:none; background:{state === 'saved' ? 'var(--df-success)' : 'var(--df-primary)'}; color:#fff; font-size:15.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--df-font-body);"
    >
      <Icon name={state === 'saved' ? 'check-circle' : 'check'} size={19} color="#fff" />{state === 'saving' ? '儲存中…' : state === 'saved' ? '點名已儲存' : '儲存點名'}
    </button>
  </div>

  <!-- note sheet -->
  <Sheet open={!!noteFor} onClose={() => (noteFor = null)} title={noteFor ? noteFor.name + ' · 課堂備註' : ''}>
    <textarea
      bind:value={noteText}
      placeholder="例如：後手翻保護需加強、家長提醒早退…"
      rows={4}
      style="width:100%; padding:11px 13px; border:1.5px solid var(--df-border-strong); border-radius:10px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); outline:none; resize:vertical; box-sizing:border-box; line-height:1.6;"
    ></textarea>
    <div style="margin-top:6px; font-size:12px; color:var(--df-text-muted);">僅存本機，重新整理後會消失</div>
    <Button slot="footer" variant="primary" fullWidth on:click={saveNote}>儲存備註</Button>
  </Sheet>
  {/if}
</LoadGate>
