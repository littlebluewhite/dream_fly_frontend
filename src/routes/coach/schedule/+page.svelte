<script lang="ts">
  /* 排課管理 — interactive schedule (日 / 週 / 月).
   * Anchor-driven: prev/next shift the anchor by the active view, 今日 resets it.
   * courses feed both ScheduleGrid (日/週) and ScheduleMonth (月).
   *
   * Data arrives async via getSchedule(): onMount loads the course list into a
   * three-state gate (loading/error/ready). R16 Task 2a：courses 是教練「可授課時段」
   * (只有 day/start/end)，分類/場館篩選、分類圖例與「點擊空白時段可新增課程」提示
   * 隨假欄位與不存在的功能一起拿掉。 */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import type { SchedCourse } from '$lib/coach/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getSchedule } from '$lib/coach/api';
  import { coachLoadErrorCopy, GENERIC_LOAD_ERROR } from '$lib/coach/load-error-copy';
  import ScheduleGrid from '$lib/coach/components/ScheduleGrid.svelte';
  import ScheduleMonth from '$lib/coach/components/ScheduleMonth.svelte';
  import {
    dayKey,
    weekDays,
    monthMatrix,
    shiftAnchor,
    fmtMonthTitle,
    fmtDayTitle
  } from '$lib/coach/schedule-dates';

  let courses: SchedCourse[] = [];
  let { errorTitle, errorBody } = GENERIC_LOAD_ERROR;

  const gate = createLoadGate({
    fetch: getSchedule,
    onData: (d) => { courses = d.courses; },
    onError: (e) => {
      ({ errorTitle, errorBody } = coachLoadErrorCopy(e));
    }
  });

  type View = '日' | '週' | '月';
  const viewOptions: View[] = ['日', '週', '月'];

  let view: View = '週';
  let anchor = new Date();

  // 日 view → a 1-element days array for the anchor's weekday.
  $: gridDays = view === '日' ? [weekDays(anchor).find((d) => d.key === dayKey(anchor))!] : weekDays(anchor);

  $: title = view === '月' ? fmtMonthTitle(anchor) : view === '日' ? fmtDayTitle(anchor) : '';

  const navArrow: string =
    'display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--df-border);border-radius:8px;background:#fff;padding:7px 10px;cursor:pointer';
</script>

<LoadGate {gate} errorTitle={errorTitle} errorBody={errorBody}>
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="schedule-skeleton" slot="loading">
    <SkelCard><Skeleton w="100%" h={54} r={10} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={420} r={12} /></SkelCard>
  </div>

<div style="display:flex;flex-direction:column;gap:16px">
  <!-- filter bar -->
  <Card>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <!-- left: view toggle + prev/next/今日 -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <!-- 日/週/月 toggle -->
        <div
          style="display:inline-flex;border:1px solid var(--df-border);border-radius:8px;overflow:hidden"
        >
          {#each viewOptions as v (v)}
            <button
              type="button"
              on:click={() => (view = v)}
              style="padding:7px 16px;border:none;background:{v === view
                ? 'var(--df-primary-bg)'
                : '#fff'};font-size:13px;font-weight:{v === view
                ? 700
                : 500};color:{v === view
                ? 'var(--df-primary)'
                : 'var(--df-text-dark)'};cursor:pointer;font-family:var(--df-font-body)"
            >
              {v}
            </button>
          {/each}
        </div>

        <!-- prev / next / 今日 — shift the anchor by the active view -->
        <button
          on:click={() => (anchor = shiftAnchor(anchor, view, -1))}
          aria-label="上一個"
          style={navArrow}
        >
          <Icon name="chevron-left" size={16} color="var(--df-text-light)" />
        </button>
        <button
          on:click={() => (anchor = shiftAnchor(anchor, view, 1))}
          aria-label="下一個"
          style={navArrow}
        >
          <Icon name="chevron-right" size={16} color="var(--df-text-light)" />
        </button>
        <button
          type="button"
          on:click={() => (anchor = new Date())}
          style="margin-left:4px;padding:7px 14px;border:1px solid var(--df-border);border-radius:8px;background:#fff;font-size:13px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body)"
        >
          今日
        </button>
        {#if title}
          <span style="margin-left:6px;font-size:13.5px;font-weight:700;color:var(--df-ink);font-family:var(--df-font-heading)">{title}</span>
        {/if}
      </div>
    </div>
  </Card>

  <!-- calendar grid — 日/週 → ScheduleGrid, 月 → ScheduleMonth -->
  <Card padding={0} style="overflow:hidden">
    {#if view === '月'}
      <ScheduleMonth weeks={monthMatrix(anchor)} courses={courses} />
    {:else}
      <ScheduleGrid days={gridDays} courses={courses} />
    {/if}
  </Card>
</div>
</LoadGate>
