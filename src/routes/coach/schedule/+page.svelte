<script lang="ts">
  /* 排課管理 — interactive schedule (日 / 週 / 月).
   * Anchor-driven: prev/next shift the anchor by the active view, 今日 resets it,
   * and the two CoachDropdowns filter by category + venue. Filtered courses feed
   * both ScheduleGrid (日/週) and ScheduleMonth (月).
   *
   * Data arrives async via getSchedule()(mock-API seam): onMount loads the course
   * list into a three-state gate (loading/error/ready); `courses` is the local
   * working copy the category/venue filters read from. */
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { CAT_COLOR } from '$lib/coach/data';
  import type { SchedCat, SchedVenue, SchedCourse } from '$lib/coach/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getSchedule } from '$lib/coach/api';
  import ScheduleGrid from '$lib/coach/components/ScheduleGrid.svelte';
  import ScheduleMonth from '$lib/coach/components/ScheduleMonth.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';
  import {
    dayKey,
    weekDays,
    monthMatrix,
    shiftAnchor,
    fmtMonthTitle,
    fmtDayTitle
  } from '$lib/coach/schedule-dates';

  let courses: SchedCourse[] = [];
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  const gate = createLoadGate({
    fetch: getSchedule,
    onData: (d) => { courses = d.courses; },
    onError: (e) => {
      // e.name(非 instanceof CoachNotFoundError)—— 頁面測試把 $lib/coach/api
      // 整支模組換成只有 getSchedule 的假模組，import 進來的 class 會是 undefined。
      if (e instanceof Error && e.name === 'CoachNotFoundError') {
        errorTitle = '此帳號未綁定教練檔案';
        errorBody = '請聯繫系統管理員協助設定教練檔案。';
      } else {
        errorTitle = '載入失敗';
        errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';
      }
    }
  });
  onMount(() => {
    gate.load();
  });

  type View = '日' | '週' | '月';
  const viewOptions: View[] = ['日', '週', '月'];

  // 5/30/2026 is the prototype's "today" (Sat) — fixed for a deterministic demo.
  let view: View = '週';
  let anchor = new Date(2026, 4, 30);
  let catFilter = '全部課程類型';
  let venueFilter = '所有場館';

  $: filteredCourses = courses.filter(
    (c) =>
      (catFilter === '全部課程類型' || c.cat === (catFilter as SchedCat)) &&
      (venueFilter === '所有場館' || c.venue === (venueFilter as SchedVenue))
  );

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
          on:click={() => (anchor = new Date(2026, 4, 30))}
          style="margin-left:4px;padding:7px 14px;border:1px solid var(--df-border);border-radius:8px;background:#fff;font-size:13px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body)"
        >
          今日
        </button>
        {#if title}
          <span style="margin-left:6px;font-size:13.5px;font-weight:700;color:var(--df-ink);font-family:var(--df-font-heading)">{title}</span>
        {/if}
      </div>

      <!-- right: live filters (category + venue) -->
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <CoachDropdown
          icon="layers"
          value={catFilter}
          options={['全部課程類型', '體操', '啦啦隊', '跑酷']}
          onChange={(v) => (catFilter = v)}
        />
        <CoachDropdown
          icon="map-pin"
          value={venueFilter}
          options={['所有場館', '主場館', '競技訓練館', '副館']}
          onChange={(v) => (venueFilter = v)}
        />
      </div>
    </div>
  </Card>

  <!-- calendar grid — 日/週 → ScheduleGrid, 月 → ScheduleMonth -->
  <Card padding={0} style="overflow:hidden">
    {#if view === '月'}
      <ScheduleMonth weeks={monthMatrix(anchor)} courses={filteredCourses} />
    {:else}
      <ScheduleGrid days={gridDays} courses={filteredCourses} />
    {/if}
  </Card>

  <!-- legend + tip — L198-207 -->
  <div
    style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:0 4px"
  >
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="font-size:12.5px;font-weight:600;color:var(--df-text-muted)">課程類別：</span>
      {#each Object.entries(CAT_COLOR) as [cat, col] (cat)}
        <span
          style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--df-text-light)"
        >
          <span style="width:12px;height:12px;border-radius:3px;background:{col.bar}"></span>
          {cat}
        </span>
      {/each}
    </div>
    <span
      style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--df-text-muted)"
    >
      <Icon name="lightbulb" size={14} color="var(--df-accent-dark)" />
      Tip: 點擊空白時段可新增課程
    </span>
  </div>
</div>
</LoadGate>
