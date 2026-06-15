<script lang="ts">
  /* 我的課程 (My Courses) — enrolled-course list on the left, active-course
   * detail on the right (stats, attendance history, and 請假 / 預約補課 /
   * 聯絡教練 actions). Ported from the prototype's MyCourses (client/views.jsx).
   * Data + primitives come from the shared foundation. */
  import { Card, Badge, Button, ProgressBar, Icon } from '$lib/components/ui';
  import LeaveDialog from '$lib/member/components/LeaveDialog.svelte';
  import MakeupDialog from '$lib/member/components/MakeupDialog.svelte';
  import ContactDialog from '$lib/member/components/ContactDialog.svelte';
  import { MY_COURSES, ATT_HISTORY, ATT_STATE, LEVEL_TONE } from '$lib/member/data';
  import { toasts } from '$lib/member/stores';

  let active = MY_COURSES[0].id;
  let dialog: 'leave' | 'makeup' | 'contact' | null = null;

  $: cur = MY_COURSES.find((c) => c.id === active) ?? MY_COURSES[0];

  $: stats = [
    { icon: 'calendar-check', value: cur.att + '%', label: '出席率' },
    { icon: 'calendar-clock', value: cur.next, label: '下一堂' },
    { icon: 'hourglass', value: cur.remain + ' 堂', label: '剩餘堂數' }
  ];
</script>

<div class="df-view" style="display:grid;grid-template-columns:1fr 1.2fr;gap:18px;align-items:start">
  <!-- Left: enrolled course list -->
  <div style="display:flex;flex-direction:column;gap:14px">
    {#each MY_COURSES as c (c.id)}
      {@const on = active === c.id}
      <button type="button" class="course-btn" on:click={() => (active = c.id)}>
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

      <!-- Attendance history -->
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:12px">出席紀錄</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          {#each ATT_HISTORY as h, i (i)}
            {@const [tone, label] = ATT_STATE[h.state]}
            <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
              <Badge {tone} dot>{label}</Badge>
              <span style="font-size:11px;color:var(--df-text-muted);font-family:var(--df-font-mono)">{h.date}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;border-top:1px solid var(--df-border);padding-top:18px">
        <Button variant="secondary" fullWidth on:click={() => (dialog = 'leave')}>
          <Icon name="calendar-off" size={16} />請假
        </Button>
        <Button variant="secondary" fullWidth on:click={() => (dialog = 'makeup')}>
          <Icon name="rotate-cw" size={16} />預約補課
        </Button>
        <Button variant="primary" fullWidth on:click={() => (dialog = 'contact')}>
          <Icon name="message-circle" size={16} />聯絡教練
        </Button>
      </div>
    </div>
  </Card>
</div>

<LeaveDialog
  open={dialog === 'leave'}
  course={cur}
  onClose={() => (dialog = null)}
  onSubmit={({ session, makeup }) =>
    toasts.notify(
      'warning',
      '已送出請假申請',
      cur.name + ' · ' + session + (makeup ? ' — 已保留補課額度。' : '。')
    )}
/>
<MakeupDialog
  open={dialog === 'makeup'}
  course={cur}
  onClose={() => (dialog = null)}
  onSubmit={(slot) =>
    slot && toasts.notify('success', '補課預約成功', slot.date + ' ' + slot.time + ' · 已加入日程表。')}
/>
<ContactDialog open={dialog === 'contact'} course={cur} onClose={() => (dialog = null)} />

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
