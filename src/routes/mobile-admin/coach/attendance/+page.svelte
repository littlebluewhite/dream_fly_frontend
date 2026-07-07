<script lang="ts">
  /* 教練 · 課堂點名。port coach.jsx AttendanceScreen (63-162) + Segmented (70-79)。
   * onBell → overlay.sheet('notif')；notify → toasts.notify。備註用 kit Sheet（本地狀態）。
   *
   * 資料改由 getRoster()(mock-API 接縫)非同步載入,三態閘門(loading/error/ready);
   * `roster` 是本頁本地一次性快照,marks 的初始值待載入完成後才依 roster 建立。 */
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import { overlay, coachNotifs, coachUnreadCount, closeNotifAfterReadAll, toasts } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getRoster } from '$lib/mobile-admin/api';
  import type { RosterEntry } from '$lib/mobile-admin/data';

  const ATT_STATES = [
    { key: 'present', label: '出席', color: 'var(--df-primary)' },
    { key: 'late', label: '遲到', color: 'var(--df-warning)' },
    { key: 'absent', label: '缺席', color: 'var(--df-error)' }
  ];
  // The mock only carries ROSTER for this one class, so offer just it. The
  // prototype's second (k6) chip was non-functional — selecting it kept the
  // 進階班 roster on screen, letting a coach mark/save the wrong class.
  const classOpts = [{ key: 'k1', label: '19:00 競技啦啦隊 進階班' }];

  let roster: RosterEntry[] = [];
  let cls = 'k1';
  let marks: Record<string, string> = {};
  let saved = false;
  let noteFor: RosterEntry | null = null;
  let noteText = '';
  let notes: Record<string, string> = {};

  const gate = createLoadGate({
    fetch: getRoster,
    onData: (d) => {
      roster = d.roster;
      marks = Object.fromEntries(roster.map((r) => [r.id, r.default]));
    }
  });
  onMount(() => {
    gate.load();
  });

  const onBell = () => overlay.sheet('notif', { notifs: $coachNotifs, onReadAll: () => closeNotifAfterReadAll(coachNotifs.markAllRead) });
  const setMark = (id: string, v: string) => { marks = { ...marks, [id]: v }; saved = false; };

  $: tally = roster.reduce<Record<string, number>>((a, r) => { a[marks[r.id]] = (a[marks[r.id]] || 0) + 1; return a; }, {});
  $: counts = [
    { label: '出席', color: 'var(--df-primary)', n: tally.present || 0 },
    { label: '遲到', color: 'var(--df-warning)', n: tally.late || 0 },
    { label: '缺席', color: 'var(--df-error)', n: tally.absent || 0 },
    { label: '請假', color: 'var(--df-info)', n: tally.leave || 0 }
  ];

  const markAllPresent = () => { marks = Object.fromEntries(roster.map((r) => [r.id, r.default === 'leave' ? 'leave' : 'present'])); saved = false; };
  const onSave = () => { saved = true; toasts.notify('success', '點名已儲存', '競技啦啦隊 進階班 · ' + roster.length + ' 位學員出勤已記錄。'); };
  const openNote = (r: RosterEntry) => { noteFor = r; noteText = notes[r.id] || ''; };
  const saveNote = () => { if (noteFor) notes = { ...notes, [noteFor.id]: noteText }; noteFor = null; };
</script>

{#if $gate === 'ready'}
<ScreenHeader title="課堂點名" sub="2026/06/10 · 逐一標記出勤">
  <HeaderIcon slot="right" icon="bell" badge={$coachUnreadCount} label="通知" onClick={onBell} />
</ScreenHeader>

<div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border);">
  <FilterChips items={classOpts} value={cls} onChange={(k) => (cls = k)} />
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
    <Panel title="學員出勤" sub={roster.length + ' 位 · 競技啦啦隊 進階班'}>
      {#each roster as r, i (r.id)}
        {@const onLeave = marks[r.id] === 'leave'}
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
                  {@const on = marks[r.id] === s.key}
                  <button
                    on:click={() => setMark(r.id, s.key)}
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
              style="display:inline-flex; align-items:center; gap:5px; border:1px solid var(--df-border); background:{notes[r.id] ? 'var(--df-primary-bg)' : 'var(--df-bg-light)'}; border-radius:8px; padding:5px 11px; font-size:12px; color:{notes[r.id] ? 'var(--df-primary)' : 'var(--df-text-light)'}; cursor:pointer; font-weight:600;"
            ><Icon name="pencil-line" size={13} color={notes[r.id] ? 'var(--df-primary)' : 'var(--df-text-light)'} />{notes[r.id] ? '已備註' : '備註'}</button>
            {#if notes[r.id]}
              <span style="font-size:12px; color:var(--df-text-light); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{notes[r.id]}</span>
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
    class="df-tapscale"
    style="width:100%; height:50px; border-radius:13px; border:none; background:{saved ? 'var(--df-success)' : 'var(--df-primary)'}; color:#fff; font-size:15.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--df-font-body);"
  >
    <Icon name={saved ? 'check-circle' : 'check'} size={19} color="#fff" />{saved ? '點名已儲存' : '儲存點名'}
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
  <Button slot="footer" variant="primary" fullWidth on:click={saveNote}>儲存備註</Button>
</Sheet>
{:else if $gate === 'error'}
  <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
{:else}
  <div class="df-scroll df-view" data-testid="attendance-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;">
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:9px;">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={62} r={13} /></SkelCard>
      {/each}
    </div>
    <Skeleton w="100%" h={42} r={11} />
    <SkelCard padding={0}><Skeleton w="100%" h={260} r={12} /></SkelCard>
  </div>
{/if}
