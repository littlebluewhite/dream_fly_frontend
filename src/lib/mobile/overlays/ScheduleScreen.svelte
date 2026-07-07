<script lang="ts">
  /* 每週課表 push screen。mine.jsx ScheduleScreen (177) · app.jsx (89)。
   * 依星期分組固定課表。
   *
   * Task 19：改真後端 —— 復用桌面 getSchedule()(GET /schedule/me，Task 9 週課表
   * seam，見 $lib/mobile/api.ts getSchedule())，取代 mock SCHEDULE 常數。onMount
   * 進三態閘門(loading/error/ready)，同其餘 route 頁的既有慣例。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { WEEK } from '$lib/mobile/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getSchedule, type ScheduleData } from '$lib/mobile/api';

  export let onBack: () => void;

  let data: ScheduleData | null = null;
  const gate = createLoadGate({
    fetch: getSchedule,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: schedule = data?.schedule ?? [];
  $: byDay = schedule.reduce<Record<number, typeof schedule>>((acc, s) => {
    (acc[s.day] = acc[s.day] || []).push(s);
    return acc;
  }, {});
  $: days = [1, 2, 3, 4, 5, 6, 7].filter((d) => byDay[d]);
</script>

<PushScreen>
  <ScreenHeader {onBack} title="日程表" sub="每週固定課表" />
  {#if $gate === 'ready'}
    <div class="df-scroll">
      <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
        {#each days as d}
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:9px;">
              <span style="font-size:14px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">週{WEEK[d - 1]}</span>
              <div style="flex:1; height:1px; background:var(--df-border);"></div>
            </div>
            <div style="display:flex; flex-direction:column; gap:9px;">
              {#each byDay[d] as s}
                <div
                  style="display:flex; align-items:stretch; gap:12px; background:#fff; border:1px solid var(--df-border);
                    border-radius:13px; padding:13px 14px; box-shadow:var(--df-shadow-card);"
                >
                  <div style="width:4px; border-radius:999px; background:{s.color}; flex:none;"></div>
                  <div style="flex:1;">
                    <div style="font-size:14.5px; font-weight:700; color:var(--df-ink);">{s.name}</div>
                    <div
                      style="font-size:12.5px; color:var(--df-text-light); margin-top:3px; display:flex;
                        align-items:center; gap:7px; flex-wrap:wrap;"
                    >
                      <span style="display:flex; align-items:center; gap:4px;"><Icon name="clock" size={13} color="var(--df-text-muted)" />{s.start}–{s.end}</span>
                      {#if s.room}<span style="display:flex; align-items:center; gap:4px;"><Icon name="map-pin" size={13} color="var(--df-text-muted)" />{s.room}</span>{/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
        {#if days.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">目前沒有排定的每週課表。</p>
        {/if}
        <div style="height:8px;"></div>
      </div>
    </div>
  {:else if $gate === 'error'}
    <div class="df-scroll" style="padding:16px;">
      <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
    </div>
  {:else}
    <div class="df-scroll" data-testid="schedule-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      {#each [0, 1, 2] as i (i)}
        <Skeleton w={80} h={16} r={6} />
        <SkelCard padding={14}><Skeleton w="100%" h={54} r={10} /></SkelCard>
      {/each}
    </div>
  {/if}
</PushScreen>
