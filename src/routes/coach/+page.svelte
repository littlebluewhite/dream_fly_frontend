<script lang="ts">
  /* 儀表板 (Dashboard) — 教練端首頁
   * Source: docs/design/coach/views_dashboard.jsx (partial, gaps L1-54, L95-109, L142-215)
   * Recovered sections used verbatim: L55-56, L62-114.
   * Gaps reconstructed from the per-view spec in the build prompt.
   *
   * Data arrives async via getDashboard()(mock-API seam): onMount loads coach /
   * today's schedule / conversations / KPI 數字 into a three-state gate
   * (loading/error/ready)。KPI 卡「待點名/學員出席率/待回覆訊息」原為頁面硬編字串,
   * 一併移入 getDashboard() payload(換後端只改 api.ts 這一層)。 */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getDashboard, type CoachDashboardData } from '$lib/coach/api';
  import { clockIn, clockOut } from '$lib/coach/clock';
  import { toasts } from '$lib/coach/stores';
  import { ApiError } from '$lib/api/client';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Card from '$lib/components/ui/Card.svelte';
  import KpiCard from '$lib/coach/components/KpiCard.svelte';
  import PanelCard from '$lib/coach/components/PanelCard.svelte';
  import ClassRow from '$lib/coach/components/ClassRow.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Checkbox from '$lib/components/ui/Checkbox.svelte';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: CoachDashboardData | null = null;
  let errorTitle = '載入失敗';
  let errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';

  function load() {
    phase = 'loading';
    getDashboard()
      .then((d) => { data = d; phase = 'ready'; })
      .catch((e) => {
        // 用 e.name 而非 instanceof CoachNotFoundError —— 頁面測試把 $lib/coach/api
        // 整支模組換成只有 getDashboard 的假模組，import 進來的 class 會是
        // undefined，instanceof undefined 會直接拋錯。
        if (e?.name === 'CoachNotFoundError') {
          errorTitle = '此帳號未綁定教練檔案';
          errorBody = '請聯繫系統管理員協助設定教練檔案。';
        } else {
          errorTitle = '載入失敗';
          errorBody = '連線發生問題，無法取得最新資料，請稍後再試。';
        }
        phase = 'error';
      });
  }
  onMount(load);

  /* ── 上班/下班打卡 —— 本地樂觀狀態(無對應的「目前打卡狀態」讀取端點在本次範圍
   * 內，見 P2)：clockIn 409(已在上班中)/clockOut 404(尚未上班)時，用回應校正回
   * 正確的本地狀態，不只是顯示錯誤。 ── */
  let clockedIn = false;
  let clocking = false;

  async function onClockIn() {
    if (!data) return;
    clocking = true;
    try {
      await clockIn(data.coach.id);
      clockedIn = true;
      toasts.notify('success', '上班打卡成功', '祝你有美好的一天！');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        clockedIn = true;
        toasts.notify('error', '已在上班中', '你目前已有進行中的打卡紀錄，無需重複打卡。');
      } else {
        toasts.notify('error', '打卡失敗', '連線發生問題，請稍後再試。');
      }
    } finally {
      clocking = false;
    }
  }

  async function onClockOut() {
    if (!data) return;
    clocking = true;
    try {
      await clockOut(data.coach.id);
      clockedIn = false;
      toasts.notify('success', '下班打卡成功', '辛苦了，路上小心！');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        clockedIn = false;
        toasts.notify('error', '尚未上班', '目前沒有進行中的打卡紀錄。');
      } else {
        toasts.notify('error', '打卡失敗', '連線發生問題，請稍後再試。');
      }
    } finally {
      clocking = false;
    }
  }

  $: todayClasses = data?.todayClasses ?? [];
  $: conversations = data?.conversations ?? [];

  /* ── next class: the `live` one, else first non-`done` ─────────────── */
  $: nextClass =
    todayClasses.find((c) => c.status === 'live') ??
    todayClasses.find((c) => c.status !== 'done') ??
    null;

  /* ── KPI data (今日課程 由 todayClasses 衍生;其餘 3 欄原為頁面硬編字串,現讀
   * getDashboard() payload) ──────────────────────────────────────────── */
  $: kpis = data
    ? [
        {
          label: '今日課程',
          value: `${todayClasses.length} 堂`,
          sub: '今日全部課程',
          subTone: 'var(--df-primary)',
          icon: 'calendar-clock',
          iconColor: 'var(--df-primary)'
        },
        {
          label: '待點名',
          value: data.pendingClasses,
          sub: '需盡快完成點名',
          subTone: 'var(--df-warning)',
          icon: 'clipboard-check',
          iconColor: 'var(--df-warning)'
        },
        {
          label: '學員出席率',
          value: data.attendanceRate,
          sub: '本週平均',
          subTone: 'var(--df-success)',
          icon: 'calendar-check',
          iconColor: 'var(--df-success)'
        },
        {
          label: '待回覆訊息',
          value: data.pendingReplies,
          sub: '含 1 則逾時訊息',
          subTone: 'var(--df-error)',
          icon: 'message-circle',
          iconColor: 'var(--df-error)'
        }
      ]
    : [];

  /* ── todo checklist ───────────────────────────────────────────────── */
  let done: Record<string, boolean> = {
    eval: false,
    reply: false,
    venue: false,
    report: false
  };

  const todos = [
    { key: 'eval', label: '更新競技選手班評量' },
    { key: 'reply', label: '回覆黃媽媽訊息' },
    { key: 'venue', label: '確認週六加課場地' },
    { key: 'report', label: '提交月度出勤報表' }
  ];

  /* ── pre-class check tiles ────────────────────────────────────────── */
  const checkTiles = ['場地確認', '器材檢查', '學員名單'];

  /* ── message rows: first 3 conversations ────────────────────────────── */
  $: messages = conversations.slice(0, 3);
</script>

{#if phase === 'ready' && data}
<div style="display:flex;flex-direction:column;gap:18px">

  <!-- ① Gradient welcome hero -->
  <div
    style="background:linear-gradient(135deg, var(--df-primary), var(--df-primary-dark));border-radius:14px;padding:26px 28px;color:#fff"
  >
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.3px">早安，{data.coach.display}（李教練）</div>
    <div style="font-size:14px;opacity:0.85;margin-top:6px">{data.todayLabel}</div>
    <div style="font-size:13.5px;opacity:0.78;margin-top:4px">
      今天有 {todayClasses.length} 堂課，{data.pendingClasses}待點名
    </div>
  </div>

  <!-- ①.5 上班/下班打卡 -->
  <div
    style="background:#fff;border-radius:14px;padding:18px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border:1px solid var(--df-border);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"
  >
    <div style="display:flex;align-items:center;gap:12px">
      <span
        style="width:40px;height:40px;border-radius:10px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none"
      >
        <Icon name="clock" size={18} color="var(--df-primary)" />
      </span>
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--df-text-dark)">{clockedIn ? '目前上班中' : '尚未打卡'}</div>
        <div style="font-size:12px;color:var(--df-text-light);margin-top:2px">
          {clockedIn ? '別忘了下班前完成打卡' : '請於上班時完成打卡'}
        </div>
      </div>
    </div>
    <Button
      variant={clockedIn ? 'secondary' : 'primary'}
      size="md"
      disabled={clocking}
      on:click={clockedIn ? onClockOut : onClockIn}
    >
      {clocking ? '處理中…' : clockedIn ? '下班打卡' : '上班打卡'}
    </Button>
  </div>

  <!-- ② Next-class command bar -->
  {#if nextClass}
    <div
      style="background:#fff;border-radius:14px;padding:20px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border:1px solid var(--df-border)"
    >
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <!-- Time block -->
        <div
          style="background:var(--df-primary);border-radius:10px;padding:12px 18px;display:flex;flex-direction:column;align-items:center;flex:none;min-width:90px"
        >
          <span
            style="font-size:22px;font-weight:800;color:#fff;font-family:var(--df-font-mono);line-height:1.1"
          >{nextClass.start}</span>
          <span style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:2px">{nextClass.level}</span>
        </div>

        <!-- Class info + pre-check tiles -->
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:700;color:var(--df-text-dark)">{nextClass.name}</div>
          <div
            style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--df-text-light);margin-top:4px"
          >
            <Icon name="map-pin" size={13} color="var(--df-text-light)" />{nextClass.room}
          </div>
          <!-- Pre-check tiles -->
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            {#each checkTiles as tile}
              <span
                style="display:inline-flex;align-items:center;gap:5px;background:var(--df-bg-light);border:1px solid var(--df-border);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:500;color:var(--df-text-light)"
              >
                <Icon name="circle-check" size={13} color="var(--df-primary)" />
                {tile}
              </span>
            {/each}
          </div>
        </div>

        <!-- CTA -->
        <div style="display:flex;flex-direction:column;align-items:stretch;gap:6px;flex:none;min-width:160px">
          <!-- L55-56 (recovered verbatim, React→Svelte) -->
          <Button variant="primary" fullWidth on:click={() => goto('/coach/attendance')}>開始課前檢查</Button>
          <div style="font-size:12px;color:var(--df-text-light);text-align:center">完成後進入點名頁</div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ③ 4-col KpiCard grid (L62-64) -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
    {#each kpis as k (k.label)}
      <KpiCard
        label={k.label}
        value={k.value}
        sub={k.sub}
        subTone={k.subTone}
        icon={k.icon}
        iconColor={k.iconColor}
      />
    {/each}
  </div>

  <!-- ④ Two-column layout (L67-114) -->
  <div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start">

    <!-- LEFT: 今日課程表 panel -->
    <PanelCard title="今日課程表" viewAll="查看全部" onViewAll={() => goto('/coach/today')}>
      <!-- Priority strip (L70-79) -->
      <div
        style="display:flex;align-items:center;gap:8px;background:var(--df-bg-light);border-radius:8px;padding:9px 12px;margin-bottom:12px;flex-wrap:wrap"
      >
        <Icon name="arrow-up-down" size={14} color="var(--df-text-light)" />
        <span style="font-size:12px;font-weight:600;color:var(--df-text-light)">依優先排序</span>
        {#each [
          ['var(--df-primary-bg)', 'var(--df-primary)', '下一堂課 14:00 競技體操'],
          ['var(--df-warning-bg)', 'var(--df-warning)', '待點名 ' + data.pendingClasses],
          ['var(--df-error-bg)', 'var(--df-error)', '待回覆 ' + data.pendingReplies]
        ] as [bg, dot, t] (t)}
          <span
            style="display:inline-flex;align-items:center;gap:6px;background:{bg};border-radius:999px;padding:5px 10px"
          >
            <span style="width:7px;height:7px;border-radius:4px;background:{dot}"></span>
            <span style="font-size:11px;font-weight:500;color:var(--df-text-dark)">{t}</span>
          </span>
        {/each}
      </div>
      <!-- ClassRow list (L80-82) -->
      <div style="display:flex;flex-direction:column;gap:10px">
        {#each todayClasses as c (c.id)}
          <ClassRow {c} onClick={() => goto('/coach/today')} />
        {/each}
      </div>
    </PanelCard>

    <!-- RIGHT column -->
    <div style="display:flex;flex-direction:column;gap:18px">

      <!-- 最新訊息 (L86-94 + gap L95-109 reconstructed) -->
      <PanelCard title="最新訊息" viewAll="查看全部" onViewAll={() => goto('/coach/messages')}>
        <div style="display:flex;flex-direction:column;gap:14px">
          {#each messages as m, i (m.id)}
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
              on:click={() => goto('/coach/messages')}
              class="df-rowhover"
              style="display:flex;gap:12px;border:none;background:transparent;cursor:pointer;text-align:left;padding:0;font-family:var(--df-font-body);width:100%"
            >
              <!-- Avatar (L90) -->
              <span
                style="width:32px;height:32px;border-radius:50%;background:{m.color};color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none"
              >{m.initial}</span>
              <span style="flex:1;min-width:0">
                <!-- Name + time row (L92-94) -->
                <span
                  style="display:flex;justify-content:space-between;gap:8px;align-items:center"
                >
                  <span style="font-size:13px;font-weight:600;color:var(--df-text-dark)">{m.name}</span>
                  <span style="font-size:11px;color:var(--df-text-light)">{m.time}</span>
                </span>
                <!-- Preview (reconstructed from gap L95-109) -->
                <span
                  style="display:block;font-size:12px;color:var(--df-text-light);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                >{m.preview}</span>
              </span>
            </button>
          {/each}
        </div>
      </PanelCard>

      <!-- 本週待辦 (reconstructed from spec) -->
      <PanelCard title="本週待辦">
        <div style="display:flex;flex-direction:column;gap:12px">
          {#each todos as todo (todo.key)}
            <div style="display:flex;align-items:center;gap:8px">
              <Checkbox
                bind:checked={done[todo.key]}
                label={todo.label}
                style="font-size:13.5px;color:{done[todo.key] ? 'var(--df-text-light)' : 'var(--df-text-dark)'}"
              />
            </div>
          {/each}
        </div>
      </PanelCard>

    </div>
  </div>

</div>
{:else if phase === 'error'}
  <Card padding={0}><ErrorState title={errorTitle} body={errorBody} onRetry={load} /></Card>
{:else}
  <div style="display:flex;flex-direction:column;gap:18px" data-testid="coach-home-skeleton">
    <SkelCard><Skeleton w="100%" h={110} r={14} /></SkelCard>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
      {#each [0, 1, 2, 3] as i (i)}
        <SkelCard><Skeleton w="100%" h={90} r={12} /></SkelCard>
      {/each}
    </div>
    <div style="display:grid;grid-template-columns:1fr 360px;gap:18px">
      <SkelCard><Skeleton w="100%" h={320} r={14} /></SkelCard>
      <SkelCard><Skeleton w="100%" h={320} r={14} /></SkelCard>
    </div>
  </div>
{/if}
