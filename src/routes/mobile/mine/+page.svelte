<script lang="ts">
  /* 我的課程 tab。mine.jsx MineScreen (23) · app.jsx (80)。
   * 摘要統計 + 本週日程 + 報名課程卡（出席進度 / 下次上課）。 */
  import ScreenHeader from '$lib/mobile/components/ScreenHeader.svelte';
  import SectionTitle from '$lib/components/mobile/SectionTitle.svelte';
  import StatTile from '$lib/mobile/components/StatTile.svelte';
  import Divider from '$lib/mobile/components/Divider.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { overlay } from '$lib/mobile/stores';
  import { MY_COURSES, SCHEDULE, WEEK, type MyCourse } from '$lib/mobile/data';

  const today = new Date().getDay() === 0 ? 7 : new Date().getDay();

  const openCourse = (course: MyCourse) => overlay.push('courseDetail', { course });
</script>

<div class="df-scroll df-view">
  <ScreenHeader title="我的課程" sub={`本季報名 ${MY_COURSES.length} 門 · 2026 春季`} />

  <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
    <!-- summary -->
    <Card padding={16}>
      <div style="display:flex; align-items:center;">
        <StatTile value="95%" label="本月出席率" />
        <Divider />
        <StatTile value="14" label="連續到課" color="var(--df-accent-dark)" />
        <Divider />
        <StatTile value="8" label="已掌握技巧" color="var(--df-success)" />
      </div>
    </Card>

    <!-- this week schedule -->
    <div>
      <SectionTitle action="完整日程" onAction={() => overlay.push('schedule')}>本週日程</SectionTitle>
      <div style="display:flex; flex-direction:column; gap:9px;">
        {#each SCHEDULE as s}
          {@const isToday = s.day === today}
          <div
            style="display:flex; align-items:center; gap:12px; background:#fff; border:1px solid var(--df-border);
              border-left:4px solid {s.color}; border-radius:12px; padding:11px 14px;"
          >
            <div style="text-align:center; flex:none; width:36px;">
              <div style="font-size:11px; color:var(--df-text-muted);">週{WEEK[s.day - 1]}</div>
              <div
                style="font-size:14px; font-weight:800; color:{isToday
                  ? 'var(--df-primary)'
                  : 'var(--df-ink)'}; font-family:var(--df-font-mono);"
              >{s.start}</div>
            </div>
            <div style="flex:1; min-width:0;">
              <div
                style="font-size:14px; font-weight:600; color:var(--df-ink); white-space:nowrap;
                  overflow:hidden; text-overflow:ellipsis;"
              >{s.name}</div>
              <div style="font-size:12px; color:var(--df-text-light);">{s.room} · {s.coach} 教練</div>
            </div>
            {#if isToday}<Badge tone="primary" dot>今天</Badge>{/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- enrolled courses -->
    <div>
      <SectionTitle>報名課程</SectionTitle>
      <div style="display:flex; flex-direction:column; gap:12px;">
        {#each MY_COURSES as c}
          <button
            on:click={() => openCourse(c)}
            class="df-tapscale"
            style="text-align:left; border:1px solid var(--df-border); background:#fff; border-radius:14px;
              padding:14px; cursor:pointer; box-shadow:var(--df-shadow-card);"
          >
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <div
                style="width:46px; height:46px; border-radius:12px; background:{c.color}1A; display:flex;
                  align-items:center; justify-content:center; flex:none;"
              ><Icon name={c.icon} size={24} color={c.color} /></div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:15px; font-weight:700; color:var(--df-ink);">{c.name}</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">{c.schedule}</div>
              </div>
              <Icon name="chevron-right" size={19} color="var(--df-text-muted)" />
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="flex:1;">
                <div
                  style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--df-text-light);
                    margin-bottom:5px;"
                >
                  <span>出席 {c.attended}/{c.total} 堂</span>
                  <span style="font-weight:700; color:var(--df-primary);">{c.att}%</span>
                </div>
                <div style="height:7px; border-radius:999px; background:var(--df-border); overflow:hidden;">
                  <div style="width:{c.att}%; height:100%; background:{c.color}; border-radius:999px;"></div>
                </div>
              </div>
              <div
                style="flex:none; display:flex; align-items:center; gap:5px; font-size:12px; color:var(--df-text-light);
                  background:var(--df-bg-light); border-radius:999px; padding:5px 11px;"
              ><Icon name="calendar-clock" size={13} color="var(--df-primary)" />{c.next}</div>
            </div>
          </button>
        {/each}
      </div>
    </div>
    <div style="height:8px;"></div>
  </div>
</div>
