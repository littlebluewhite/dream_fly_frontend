<script lang="ts">
  /* 日程表 (Schedule) — member's weekly class calendar. A CSS-grid week view
   * with a time-label column, day headers, and positioned class blocks. Ported
   * from the prototype's Schedule (client/views.jsx). The prev/next week buttons
   * are visual-only; clicking a class block raises an info toast. Data +
   * primitives come from the shared foundation. */
  import { onMount } from 'svelte';
  import { Card, IconButton, Icon } from '$lib/components/ui';
  import { WEEK, TIME_ROWS, type ScheduleBlock } from '$lib/member/data';
  import { toasts } from '$lib/member/stores';
  import Skeleton from '$lib/member/components/Skeleton.svelte';
  import SkelCard from '$lib/member/components/SkelCard.svelte';
  import ErrorState from '$lib/member/components/ErrorState.svelte';
  import { getSchedule, type ScheduleData } from '$lib/member/api';

  const rowOf = (t: string) => TIME_ROWS.indexOf(t);
  const span = (s: string, e: string) => {
    const h = (x: string) =>
      parseInt(x.split(':')[0], 10) + (parseInt(x.split(':')[1], 10) >= 30 ? 0.5 : 0);
    return Math.max(1, Math.ceil(h(e) - h(s)));
  };
  // SCHEDULE.day is 0-indexed (0=Mon … 6=Sun); the grid's column 1 is the time
  // gutter and columns 2–8 are Mon–Sun, so a class sits in column day + 2.
  const colOf = (day: number) => day + 2;

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: ScheduleData | null = null;

  function load() {
    phase = 'loading';
    getSchedule()
      .then((d) => { data = d; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);
</script>

{#if phase === 'ready' && data}
  <div class="df-view">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:12px">
        <IconButton aria-label="上一週" variant="outline"><Icon name="chevron-left" size={18} /></IconButton>
        <div style="font-size:16px;font-weight:700;color:var(--df-ink)">2026 年 6 月 8 – 14 日</div>
        <IconButton aria-label="下一週" variant="outline"><Icon name="chevron-right" size={18} /></IconButton>
      </div>
      <div style="display:flex;gap:10px;align-items:center;font-size:13px;color:var(--df-text-light)">
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:#0066CC"></span>正課</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:3px;background:#0EA5E9"></span>補課</span>
      </div>
    </div>
    <Card padding={0} style="overflow:hidden">
      <div style="display:grid;grid-template-columns:62px repeat(7, minmax(0,1fr));grid-template-rows:46px repeat({TIME_ROWS.length}, 60px)">
        <!-- header -->
        <div style="border-bottom:1px solid var(--df-border);border-right:1px solid var(--df-border);background:var(--df-bg-light)"></div>
        {#each WEEK as d, i (d)}
          <div style="display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--df-border);border-right:{i < 6 ? '1px solid var(--df-border)' : 'none'};background:var(--df-bg-light);font-size:13.5px;font-weight:700;color:{i >= 5 ? 'var(--df-primary)' : 'var(--df-text-dark)'}">週{d}</div>
        {/each}
        <!-- time labels + grid cells -->
        {#each TIME_ROWS as t, ri (t)}
          <div style="display:flex;align-items:flex-start;justify-content:flex-end;padding:4px 8px;border-right:1px solid var(--df-border);border-bottom:{ri < TIME_ROWS.length - 1 ? '1px solid var(--df-border)' : 'none'};font-size:12px;color:var(--df-text-muted);font-family:var(--df-font-mono)">{t}</div>
          {#each WEEK as d, di (d)}
            <div style="border-right:{di < 6 ? '1px solid var(--df-border)' : 'none'};border-bottom:{ri < TIME_ROWS.length - 1 ? '1px solid var(--df-border)' : 'none'}"></div>
          {/each}
        {/each}
        <!-- class blocks -->
        {#each data.schedule as s, i (i)}
          {@const r = rowOf(s.start)}
          {#if r >= 0}
            <button
              type="button"
              class="block"
              on:click={() => toasts.notify('info', s.name, s.start + '–' + s.end + ' · ' + s.room + ' · ' + s.coach + ' 教練')}
              style="grid-column:{colOf(s.day)};grid-row:{r + 2} / span {span(s.start, s.end)};margin:4px;border-radius:9px;background:{s.color};color:#fff;padding:8px 10px;box-shadow:var(--df-shadow-soft)"
            >
              <div style="font-size:12.5px;font-weight:700;line-height:1.3">{s.name}</div>
              <div style="font-size:11px;opacity:0.9;font-family:var(--df-font-mono)">{s.start}–{s.end}</div>
              <div style="font-size:11px;opacity:0.9;display:flex;align-items:center;gap:4px;margin-top:auto"><Icon name="map-pin" size={11} color="#fff" />{s.room}</div>
            </button>
          {/if}
        {/each}
      </div>
    </Card>
  </div>
{:else if phase === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={load} /></Card></div>
{:else}
  <div class="df-view" data-testid="schedule-skeleton">
    <Skeleton w="100%" h={46} r={9} style="margin-bottom:18px" />
    <SkelCard padding={0}>
      {#each [0, 1, 2, 3, 4] as i (i)}
        <Skeleton w="100%" h={60} r={0} style="border-bottom:1px solid var(--df-border)" />
      {/each}
    </SkelCard>
  </div>
{/if}

<style>
  .block {
    border: none;
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
</style>
