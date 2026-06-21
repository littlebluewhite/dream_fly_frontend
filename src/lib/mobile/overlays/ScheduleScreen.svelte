<script lang="ts">
  /* 每週課表 push screen。mine.jsx ScheduleScreen (177) · app.jsx (89)。
   * 依星期分組固定課表。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile/components/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { SCHEDULE, WEEK, type ScheduleBlock } from '$lib/mobile/data';

  export let onBack: () => void;

  const byDay: Record<number, ScheduleBlock[]> = {};
  for (const s of SCHEDULE) (byDay[s.day] = byDay[s.day] || []).push(s);
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => byDay[d]);
</script>

<PushScreen>
  <ScreenHeader {onBack} title="日程表" sub="2026 春季 · 每週固定課表" />
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
                    <span style="display:flex; align-items:center; gap:4px;"><Icon name="map-pin" size={13} color="var(--df-text-muted)" />{s.room}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
