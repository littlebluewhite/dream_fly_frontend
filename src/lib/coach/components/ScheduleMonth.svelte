<script lang="ts">
  /* 排課管理 — month view (月).
   * Consumes monthMatrix() output (`weeks`: 42 Monday-leading cells) + the live
   * filtered `courses`. Each cell shows the day-of-month (muted when !inMonth,
   * ring when today) and that weekday's courses as compact chips. Chip click →
   * the SAME info toast as ScheduleGrid's course block. */
  import { CAT_COLOR } from '$lib/coach/data';
  import type { SchedCourse } from '$lib/coach/data';
  import { dayKey } from '$lib/coach/schedule-dates';
  import type { MonthCell } from '$lib/coach/schedule-dates';
  import { toasts } from '$lib/coach/stores';

  export let weeks: MonthCell[];
  export let courses: SchedCourse[];

  const HEAD = ['一', '二', '三', '四', '五', '六', '日'];
</script>

<!-- weekday header -->
<div style="display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--df-border)">
  {#each HEAD as z (z)}
    <div
      style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:var(--df-text-light);border-right:1px solid var(--df-border)"
    >
      {z}
    </div>
  {/each}
</div>

<!-- 6×7 cells -->
<div style="display:grid;grid-template-columns:repeat(7,1fr)">
  {#each weeks as cell (cell.key)}
    {@const cellCourses = cell.inMonth ? courses.filter((c) => c.day === dayKey(cell.date)) : []}
    <div
      style="min-height:96px;border-right:1px solid var(--df-border);border-bottom:1px solid var(--df-border);padding:6px;display:flex;flex-direction:column;gap:4px;background:{cell.inMonth
        ? '#fff'
        : 'var(--df-bg-light)'}"
    >
      <!-- day-of-month -->
      <div style="display:flex;justify-content:flex-end">
        <span
          style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;font-size:12.5px;font-weight:{cell.today
            ? 700
            : 500};color:{cell.today
            ? 'var(--df-primary)'
            : cell.inMonth
              ? 'var(--df-text-dark)'
              : 'var(--df-text-muted)'};box-shadow:{cell.today ? '0 0 0 1.5px var(--df-primary)' : 'none'};font-family:var(--df-font-mono)"
        >
          {cell.date.getDate()}
        </span>
      </div>

      <!-- course chips (max 2, then +N) -->
      {#each cellCourses.slice(0, 2) as c, i (i)}
        {@const col = CAT_COLOR[c.cat]}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          on:click={() => toasts.notify('info', c.name, c.start + '–' + c.end + ' · ' + c.count + ' 位學員')}
          style="display:flex;align-items:center;gap:5px;background:{col.bg};border-radius:5px;padding:3px 6px;cursor:pointer;overflow:hidden"
        >
          <span style="width:6px;height:6px;border-radius:999px;background:{col.bar};flex:none"></span>
          <span
            style="font-size:11px;font-weight:600;color:{col.fg};overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
            >{c.name}</span
          >
        </div>
      {/each}
      {#if cellCourses.length > 2}
        <span style="font-size:11px;color:var(--df-text-muted);padding:0 6px">+{cellCourses.length - 2}</span>
      {/if}
    </div>
  {/each}
</div>
