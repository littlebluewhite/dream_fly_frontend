<script lang="ts">
  /* 學員卡片 — faithful port of views_students.jsx L60-89 (StudentCard body).
   * Uses `Card` (hoverable, padding 20) + local bar div instead of ProgressBar
   * (per primitive contract: ProgressBar draws a 1px border+static tone,
   * so the threshold-coloured borderless bar is built locally). */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { LEVEL_TINT } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import type { Student } from '$lib/coach/data';

  export let s: Student;

  $: tint = LEVEL_TINT[s.level];
  $: lowAtt = s.att < 75;
</script>

<Card padding={20} hoverable>
  <!-- header row: avatar + name/cls + level badge -->
  <div style="display:flex;align-items:center;gap:12px">
    <span style="width:44px;height:44px;border-radius:50%;background:{s.color};color:#fff;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;flex:none">{s.initial}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:700;color:var(--df-ink)">{s.name}</div>
      <div style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--df-text-light);margin-top:2px">
        <Icon name="graduation-cap" size={13} color="var(--df-text-muted)" />{s.cls}
      </div>
    </div>
    <span style="background:{tint.bg};color:{tint.fg};font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;flex:none">{s.level}</span>
  </div>

  <!-- skill section: label + pct + local bar -->
  <div style="margin-top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--df-text-dark);font-weight:500">
        <Icon name="target" size={14} color="var(--df-primary)" />{s.skill}
      </span>
      <span style="font-size:13px;font-weight:700;color:var(--df-text-dark)">{s.pct}%</span>
    </div>
    <!-- local borderless threshold-coloured bar (NOT ProgressBar primitive) -->
    <div style="height:8px;border-radius:999px;background:var(--df-bg-light);overflow:hidden">
      <div style="width:{s.pct}%;height:100%;background:{s.pct >= 85 ? 'var(--df-success)' : 'var(--df-primary)'};transition:width .4s ease"></div>
    </div>
  </div>

  <!-- footer: attendance + 查看詳情 -->
  <div style="border-top:1px solid var(--df-border);margin-top:16px;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
    <span style="display:inline-flex;align-items:center;gap:7px">
      <Icon name="calendar-check" size={16} color={lowAtt ? 'var(--df-error)' : 'var(--df-success)'} />
      <span style="font-size:12px;color:var(--df-text-light)">出席率</span>
      <span style="font-size:14px;font-weight:700;color:{lowAtt ? 'var(--df-error-strong)' : 'var(--df-text-dark)'}">{s.att}%</span>
    </span>
    <button
      type="button"
      on:click={() => toasts.notify('info', s.name + ' · 學員檔案', '顯示完整技能評量與出勤紀錄（示範）。')}
      style="display:inline-flex;align-items:center;gap:4px;border:none;background:transparent;color:var(--df-primary);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--df-font-body)"
    >查看詳情 <Icon name="chevron-right" size={14} color="var(--df-primary)" /></button>
  </div>
</Card>
