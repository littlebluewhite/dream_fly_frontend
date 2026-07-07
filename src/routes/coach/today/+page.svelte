<script lang="ts">
  /* 今日課程頁 — reconstructed from views_dashboard.jsx:141-231 (spec + plan).
   * Legacy Svelte, no runes. No df-view on root.
   *
   * Data arrives async via getToday()(mock-API seam): onMount loads todayLabel/
   * todayClasses into a three-state gate (loading/error/ready). CLASS_STATUS 查表
   * 留直接 import;reminders 為頁內硬編 UI 提示文案,留在頁內。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CLASS_STATUS } from '$lib/coach/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getToday, type TodayData } from '$lib/coach/api';
  import { coachPath } from '$lib/coach/nav';
  import { ErrorState, EmptyState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import KpiCard from '$lib/coach/components/KpiCard.svelte';
  import PanelCard from '$lib/coach/components/PanelCard.svelte';
  import TodayClassCard from '$lib/coach/components/TodayClassCard.svelte';

  let data: TodayData | null = null;
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  const gate = createLoadGate({
    fetch: getToday,
    onData: (d) => { data = d; },
    onError: (e) => {
      // e.name(非 instanceof CoachNotFoundError)—— 頁面測試把 $lib/coach/api
      // 整支模組換成只有 getToday 的假模組，import 進來的 class 會是 undefined。
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

  /* ── 課堂提醒 reminders (reconstructed per spec) ── */
  const reminders: { icon: string; text: string }[] = [
    { icon: 'clock',          text: '競技選手班需提前 15 分鐘開放熱身區，請確認場地已清場。' },
    { icon: 'triangle-alert', text: '幼兒啟蒙班家長接送高峰期在 12:40–13:00，請提前告知助理。' },
    { icon: 'sparkles',       text: '今日成人班為月末體能測評日，請準備評量表格。' }
  ];

  $: todayClasses = data?.todayClasses ?? [];

  /* ── derived KPIs ── */
  $: liveClass   = todayClasses.find(c => c.status === 'live');
  $: doneCount   = todayClasses.filter(c => c.status === 'done').length;
  $: totalCount  = todayClasses.reduce((sum, c) => sum + c.count, 0);
  // 零課程防護:真資料下教練可能沒有任何課程,除以 0 會讓 KPI 顯示 NaN%。
  $: donePct     = todayClasses.length ? Math.round((doneCount / todayClasses.length) * 100) : 0;

  /* ── attendance progress ── */
  $: attendedCount = todayClasses.filter(c => c.status === 'done' || c.status === 'live').length;
  $: attendancePct = todayClasses.length ? Math.round((attendedCount / todayClasses.length) * 100) : 0;
</script>

{#if $gate === 'ready' && data}
<!-- root: flex col gap 16 (no df-view per convention) -->
<div style="display:flex;flex-direction:column;gap:16px">

  <!-- ① page head -->
  <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <h1 style="margin:0;font-size:22px;font-weight:800;color:var(--df-text-dark);font-family:var(--df-font-body)">今日課程</h1>
    <span style="background:var(--df-primary-bg);color:var(--df-primary-dark);font-size:13px;font-weight:600;padding:4px 12px;border-radius:999px;font-family:var(--df-font-body)">{data.todayLabel}</span>
  </div>

  <!-- ② live-class highlight banner -->
  {#if liveClass}
    <div style="display:flex;align-items:center;gap:10px;background:var(--df-success-bg);border:1px solid var(--df-success);border-radius:10px;padding:12px 16px">
      <span style="width:10px;height:10px;border-radius:5px;background:var(--df-success);flex:none;animation:df-pulse 1.4s ease-in-out infinite"></span>
      <span style="font-size:14px;font-weight:600;color:var(--df-success-strong)">上課中：{liveClass.name}</span>
      <span style="font-size:13px;color:var(--df-success-strong);opacity:0.8">{liveClass.start}–{liveClass.end} · {liveClass.room}</span>
      <button
        on:click={() => goto(coachPath('attendance'))}
        style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:var(--df-success);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--df-font-body)"
      >前往點名</button>
    </div>
  {/if}

  <!-- ③ KPI grid (3 col) -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    <KpiCard label="今日課程" value="{todayClasses.length} 堂" icon="calendar" iconColor="var(--df-primary)" />
    <KpiCard label="已完成" value="{doneCount} 堂" icon="circle-check" iconColor="var(--df-success)" subTone="var(--df-success)" sub="今日進度 {donePct}%" />
    <KpiCard label="學員總數" value="{totalCount} 位" icon="users" iconColor="var(--df-accent-dark)" />
  </div>

  <!-- ④ two-column layout -->
  <div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start">

    <!-- LEFT: 今日課表 -->
    <PanelCard title="今日課表">
      {#if todayClasses.length === 0}
        <EmptyState icon="calendar-x" title="今日尚無場次" body="今天沒有排定課程，好好休息一下吧。" pad="32px 0" />
      {:else}
        <div style="display:flex;flex-direction:column;gap:10px">
          {#each todayClasses as c (c.id)}
            <TodayClassCard {c} />
          {/each}
        </div>
      {/if}
    </PanelCard>

    <!-- RIGHT: 3 stacked panels -->
    <div style="display:flex;flex-direction:column;gap:18px">

      <!-- 出勤進度 -->
      <PanelCard title="出勤進度">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--df-text-light)">已到堂 / 今日總堂數</span>
            <span style="font-size:18px;font-weight:800;color:var(--df-text-dark);font-family:var(--df-font-body)">{attendedCount} / {todayClasses.length}</span>
          </div>
          <!-- local borderless progress bar -->
          <div style="height:8px;background:var(--df-bg-light);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:{attendancePct}%;background:var(--df-primary);border-radius:999px;transition:width 0.4s"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            {#each todayClasses as c (c.id)}
              {@const st = CLASS_STATUS[c.status]}
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">
                <span style="color:var(--df-text-dark);font-weight:500">{c.name}</span>
                <span style="background:{st.bg};color:{st.fg};font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">{st.label}</span>
              </div>
            {/each}
          </div>
        </div>
      </PanelCard>

      <!-- 今日待辦 -->
      <PanelCard title="今日待辦">
        <div style="display:flex;flex-direction:column;gap:10px">
          {#each [
            { done: doneCount > 0, text: '完成兒童初級班點名記錄' },
            { done: false,         text: '更新競技選手班技能評量' },
            { done: false,         text: '回覆家長訊息（3 則待回）' }
          ] as item}
            <div style="display:flex;align-items:center;gap:10px">
              <span style="width:20px;height:20px;border-radius:50%;border:2px solid {item.done ? 'var(--df-success)' : 'var(--df-border)'};background:{item.done ? 'var(--df-success)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex:none">
                {#if item.done}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {/if}
              </span>
              <span style="font-size:13px;color:{item.done ? 'var(--df-text-light)' : 'var(--df-text-dark)'};text-decoration:{item.done ? 'line-through' : 'none'}">{item.text}</span>
            </div>
          {/each}
        </div>
      </PanelCard>

      <!-- 課堂提醒 (L217-226) -->
      <PanelCard title="課堂提醒">
        <div style="display:flex;flex-direction:column;gap:12px">
          {#each reminders as r}
            <div style="display:flex;gap:10px">
              <span style="width:30px;height:30px;border-radius:8px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none">
                <Icon name={r.icon} size={15} color="var(--df-primary)" />
              </span>
              <span style="font-size:12.5px;color:var(--df-text-light);line-height:1.5">{r.text}</span>
            </div>
          {/each}
        </div>
      </PanelCard>

    </div>
  </div>
</div>
{:else if $gate === 'error'}
  <Card padding={0}><ErrorState title={errorTitle} body={errorBody} onRetry={gate.refresh} /></Card>
{:else}
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="today-skeleton">
    <Skeleton w={220} h={30} r={8} />
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
      {/each}
    </div>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:18px">
      <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
      <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
    </div>
  </div>
{/if}
