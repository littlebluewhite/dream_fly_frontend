<script lang="ts">
  /* 排課管理 — calendar grid (day or week view).
   * Faithful port of docs/design/coach/views_students.jsx L156-196, now
   * prop-driven: `days` drives the columns (1 for 日 view, 7 for 週), `courses`
   * is the live filtered list. `hours` defaults to SCHED_HOURS so the page need
   * not pass it. */
  import { SCHED_HOURS, CAT_COLOR } from '$lib/coach/data';
  import type { SchedDay, SchedCourse } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import { toY, dur, ROW_H } from '$lib/coach/schedule-grid';

  export let days: SchedDay[];
  export let courses: SchedCourse[];
  export let hours: string[] = SCHED_HOURS;
</script>

<!-- day header -->
<div
  style="display:grid;grid-template-columns:60px repeat({days.length},1fr);border-bottom:1px solid var(--df-border)"
>
  <div style="border-right:1px solid var(--df-border)"></div>
  {#each days as d (d.key)}
    <div
      style="padding:12px 8px;text-align:center;border-right:1px solid var(--df-border);background:{d.today
        ? 'var(--df-primary-bg)'
        : '#fff'}"
    >
      <div
        style="font-size:13px;font-weight:700;color:{d.today
          ? 'var(--df-primary)'
          : 'var(--df-text-light)'}"
      >
        {d.zh}
      </div>
      <div
        style="font-size:12px;color:{d.today
          ? 'var(--df-primary)'
          : 'var(--df-text-muted)'};margin-top:3px;font-family:var(--df-font-mono);font-weight:{d.today
          ? 700
          : 400}"
      >
        {d.date}{d.today ? ' 今日' : ''}
      </div>
    </div>
  {/each}
</div>

<!-- body -->
<div style="display:grid;grid-template-columns:60px repeat({days.length},1fr);position:relative">
  <!-- time column -->
  <div style="border-right:1px solid var(--df-border)">
    {#each hours as h (h)}
      <div
        style="height:{ROW_H}px;border-bottom:1px solid var(--df-border);display:flex;justify-content:center;padding-top:6px;font-size:11.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)"
      >
        {h}
      </div>
    {/each}
  </div>

  <!-- day columns -->
  {#each days as d (d.key)}
    {@const dayCourses = courses.filter((c) => c.day === d.key)}
    <div
      style="position:relative;border-right:1px solid var(--df-border);background:{d.today
        ? 'rgba(234,243,251,0.4)'
        : '#fff'}"
    >
      {#each hours as h (h)}
        <div style="height:{ROW_H}px;border-bottom:1px solid var(--df-border)"></div>
      {/each}

      {#each dayCourses as c, i (i)}
        {@const col = CAT_COLOR[c.cat]}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          on:click={() => toasts.notify('info', c.name, c.start + '–' + c.end + ' · ' + c.count + ' 位學員')}
          style="position:absolute;top:{toY(c.start) + 2}px;left:4px;right:4px;height:{dur(c.start, c.end) - 4}px;background:{col.bg};border-left:3px solid {col.bar};border-radius:7px;padding:6px 8px;cursor:pointer;overflow:hidden"
        >
          <div style="font-size:12px;font-weight:700;color:{col.fg};line-height:1.25">{c.name}</div>
          <div
            style="font-size:10.5px;color:{col.fg};opacity:0.85;margin-top:2px;font-family:var(--df-font-mono)"
          >
            {c.start}-{c.end}
          </div>
          <div style="font-size:10.5px;color:{col.fg};opacity:0.85;margin-top:1px">
            {c.count} 位學員
          </div>
        </div>
      {/each}
    </div>
  {/each}
</div>
