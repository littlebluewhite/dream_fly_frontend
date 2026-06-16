<script lang="ts">
  /* 出勤記錄 / 點名 — 教練端點名頁面
   * Ported from docs/design/coach/views_attendance.jsx (L25–153).
   * Legacy Svelte (no runes).
   *
   * Now: class/roster are stateful (切換班級 via CoachDropdown) and every unsaved
   * edit snapshots the WHOLE save-bar state so 復原 restores marks + dirtyCount +
   * state, not just marks. */
  import { ATT_TODAY_CLASSES } from '$lib/coach/data';
  import type { AttRow, AttDefault } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import { tally } from '$lib/coach/attendance-tally';
  import AttSegment from '$lib/coach/components/AttSegment.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  // ── 當前班級 / 名冊 ────────────────────────────────────────────────────
  let curClassId = 'ac1';
  $: curClass = ATT_TODAY_CLASSES.find((c) => c.id === curClassId)!;
  $: roster = curClass.roster;

  // ── 狀態 ──────────────────────────────────────────────────────────────
  let marks: Record<string, AttDefault> = Object.fromEntries(
    ATT_TODAY_CLASSES[0].roster.map((r) => [r.mid, r.def] as [string, AttDefault])
  );
  let notes: Record<string, string> = {};
  let noteFor: AttRow | null = null;
  let noteText = '';
  let state: 'dirty' | 'saving' | 'saved' = 'dirty';
  let savedAt: string | null = null;
  let dirtyCount = 3;

  // ── 復原快照 ───────────────────────────────────────────────────────────
  // The save bar is driven by state/savedAt/dirtyCount, not just marks — so a
  // single-step undo must capture all of them. `prev != null` drives the 復原
  // control's visibility.
  type SaveBar = {
    marks: Record<string, AttDefault>;
    notes: Record<string, string>;
    state: 'dirty' | 'saving' | 'saved';
    savedAt: string | null;
    dirtyCount: number;
  };
  let prev: SaveBar | null = null;
  function snapshot() {
    prev = { marks, notes, state, savedAt, dirtyCount };
  }
  function undo() {
    if (!prev) return;
    ({ marks, notes, state, savedAt, dirtyCount } = prev);
    prev = null;
  }

  // ── 動作 ──────────────────────────────────────────────────────────────
  function setMark(mid: string, v: AttDefault) {
    snapshot();
    marks = { ...marks, [mid]: v };
    state = 'dirty';
    dirtyCount += 1;
  }

  function openNote(r: AttRow) {
    noteFor = r;
    noteText = notes[r.mid] || '';
  }

  function saveNote() {
    if (!noteFor) return;
    snapshot();
    notes = { ...notes, [noteFor.mid]: noteText };
    noteFor = null;
    // codex r1 (P2): a note edit is an unsaved change too — re-dirty the save bar
    // so a coach who annotates after syncing isn't told everything is uploaded.
    state = 'dirty';
    dirtyCount += 1;
  }

  function closeNote() {
    noteFor = null;
  }

  function markAll() {
    snapshot();
    // codex r2 (P2): bump dirtyCount by the rows this bulk action actually changes,
    // so the save bar / status card don't claim "0 筆變更" after a sync.
    const changed = roster.filter((r) => r.def !== 'leave' && marks[r.mid] !== 'present').length;
    marks = Object.fromEntries(
      roster.map((r) => [r.mid, r.def === 'leave' ? 'leave' : 'present'] as [string, AttDefault])
    );
    state = 'dirty';
    dirtyCount += changed;
  }

  // Per-class drafts: switching stashes the current class's whole save-bar state and
  // restores the target's (or inits it), so an unsaved edit survives a round-trip
  // switch instead of silently resetting to defaults. (codex round 2 P2)
  let byClass: Record<string, SaveBar> = {};
  function buildMarks(rows: AttRow[]): Record<string, AttDefault> {
    return Object.fromEntries(rows.map((r) => [r.mid, r.def] as [string, AttDefault]));
  }
  function selectClass(name: string) {
    const next = ATT_TODAY_CLASSES.find((c) => c.name === name);
    if (!next || next.id === curClassId) return;
    // Don't switch mid-save: the in-flight doSave() callback completes against the
    // live state, so stashing a 'saving' class would leave it stuck on 儲存中 forever
    // (and the success toast could land on the wrong class). (codex round 3 P1)
    if (state === 'saving') {
      toasts.notify('info', '儲存中', '請待目前點名儲存完成後再切換班級。');
      return;
    }
    // stash the current class's draft, then restore the target's (or build a fresh one).
    // Read `next` DIRECTLY — the legacy `$: roster` doesn't update mid-handler.
    byClass[curClassId] = { marks, notes, state, savedAt, dirtyCount };
    const saved = byClass[next.id];
    if (saved) {
      ({ marks, notes, state, savedAt, dirtyCount } = saved);
    } else {
      marks = buildMarks(next.roster);
      notes = {};
      state = 'dirty';
      savedAt = null;
      dirtyCount = next.roster.filter((r) => r.def !== 'present').length;
    }
    prev = null;
    curClassId = next.id;
  }

  function doSave() {
    state = 'saving';
    setTimeout(() => {
      // codex r3 (P2): if an edit re-dirtied the page during the in-flight save,
      // don't clobber it with 'saved' — leave the new change pending.
      if (state !== 'saving') return;
      state = 'saved';
      savedAt = '14:32';
      dirtyCount = 0;
      toasts.notify('success', '點名已儲存', curClass.name + ' · ' + roster.length + ' 位學員出勤已同步至雲端。');
    }, 1100);
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
  $: SS = {
    dirty:  { icon: 'circle-alert', tone: 'var(--df-warning)',  bg: 'var(--df-warning-bg)',  title: '尚未儲存', desc: dirtyCount + ' 筆出席變更尚未儲存，離開前請記得儲存' },
    saving: { icon: 'loader',       tone: 'var(--df-primary)',  bg: 'var(--df-primary-bg)', title: '儲存中…',  desc: '正在同步至雲端，請勿關閉頁面' },
    saved:  { icon: 'circle-check', tone: 'var(--df-success)',  bg: 'var(--df-success-bg)', title: '已儲存',   desc: (savedAt || '14:32') + ' 已同步至雲端 · 全部 ' + roster.length + ' 位學員' },
  }[state];
</script>

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
            {#each [['clock', curClass.time], ['map-pin', curClass.room], ['user', '授課教練：' + curClass.coach]] as [ic, t]}
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
        options={ATT_TODAY_CLASSES.map((c) => c.name)}
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
      {#if prev != null}
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
      {(savedAt || '14:32')} 已同步至雲端 · 全部 {roster.length} 位學員
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
