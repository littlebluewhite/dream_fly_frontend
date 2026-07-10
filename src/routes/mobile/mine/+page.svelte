<script lang="ts">
  /* 我的課程 tab。mine.jsx MineScreen (23) · app.jsx (80)。
   * 摘要統計 + 本週日程 + 報名課程卡（出席進度 / 下次上課）。
   *
   * 資料改由 getMine()(mock-API 接縫)非同步取得:onMount 進三態閘門
   * (loading/error/ready)。摘要統計三卡改接真後端(GET /reports/me,§3.24):
   * 出席率為 null(無出勤資料,裁決 3)時顯示「—」,不是 0%——由本頁(顯示層)判斷,
   * api.ts 只原樣透傳 attendanceRate。原「連續到課」/「已掌握技巧」兩卡後端無
   * 對應概念,換成後端真有的「7 日內場次」/「累計出席」。「本季報名 N 門 · 季別」
   * 的季別原重複硬編 '2026 春季',改由 courses[0].term 衍生(與課程卡本身同一
   * 欄位同源,不留雙來源)。報名課程為空陣列時走 MEmpty,不留白。 */
  import { onMount } from 'svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import SectionTitle from '$lib/components/mobile/SectionTitle.svelte';
  import StatTile from '$lib/mobile/components/StatTile.svelte';
  import Divider from '$lib/mobile/components/Divider.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import { overlay } from '$lib/mobile/stores';
  import { WEEK, type MyCourse } from '$lib/mobile/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getMine, type MineData } from '$lib/mobile/api';

  const today = new Date().getDay() === 0 ? 7 : new Date().getDay();

  const openCourse = (course: MyCourse) => overlay.push('courseDetail', { course });

  let data: MineData | null = null;
  const gate = createLoadGate({
    fetch: getMine,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: courses = data?.courses ?? [];
  $: schedule = data?.schedule ?? [];
  // 出席率 null(無出勤資料,裁決 3)顯示「—」,不是 0%(0% 會誤導成「有資料、
  // 出席率為零」)——api.ts 只原樣透傳 attendanceRate,null 語意在此顯示層判斷。
  $: attendanceRateLabel = !data || data.attendanceRate == null ? '—' : `${Math.round(data.attendanceRate * 100)}%`;
</script>

<LoadGate {gate}>
  <div class="m-top-inset df-scroll df-view" data-testid="mine-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:18px;" slot="loading">
    <Skeleton w={200} h={22} r={6} />
    <SkelCard padding={16}>
      <div style="display:flex; align-items:center; gap:16px;">
        {#each [0, 1, 2] as i (i)}<Skeleton w="100%" h={40} r={8} />{/each}
      </div>
    </SkelCard>
    <div style="display:flex; flex-direction:column; gap:9px;">
      {#each [0, 1, 2] as i (i)}<Skeleton w="100%" h={54} r={12} />{/each}
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      {#each [0, 1] as i (i)}<SkelCard padding={14}><Skeleton w="100%" h={90} r={10} /></SkelCard>{/each}
    </div>
  </div>

  <div class="m-top-inset df-scroll df-view" style="padding:16px;" slot="error">
    <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
  </div>

  {#if data}
  <div class="df-scroll df-view">
    <ScreenHeader title="我的課程" sub={`本季報名 ${courses.length} 門${courses[0] ? ' · ' + courses[0].term : ''}`} />

    <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
      <!-- summary -->
      <Card padding={16}>
        <div style="display:flex; align-items:center;">
          <StatTile value={attendanceRateLabel} label="本月出席率" />
          <Divider />
          <StatTile value={data.upcomingSessions7d} label="7 日內場次" color="var(--df-accent-dark)" />
          <Divider />
          <StatTile value={data.attendedTotal} label="累計出席" color="var(--df-success)" />
        </div>
      </Card>

      <!-- this week schedule -->
      <div>
        <SectionTitle action="完整日程" onAction={() => overlay.push('schedule')}>本週日程</SectionTitle>
        <div style="display:flex; flex-direction:column; gap:9px;">
          {#each schedule as s (s.day)}
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
        {#if courses.length === 0}
          <MEmpty icon="calendar-x" title="尚未報名任何課程" body="瀏覽課程介紹，選一門喜歡的課程開始練習吧。" />
        {:else}
          <div style="display:flex; flex-direction:column; gap:12px;">
            {#each courses as c (c.id)}
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
        {/if}
      </div>
      <div style="height:8px;"></div>
    </div>
  </div>
  {/if}
</LoadGate>
