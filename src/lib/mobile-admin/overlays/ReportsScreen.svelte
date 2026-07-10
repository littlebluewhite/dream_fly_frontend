<script lang="ts">
  /* 報表分析 push screen。admin2.jsx ReportsScreen (196)。
   * KPI grid + 各圖表 Panel（本月營收來源拆解、營收趨勢、營收類別占比、熱門課程、
   * 收入來源、教練表現、場館使用時數、出席率分布、新生 vs 回訪、年齡層、
   * 付款方式占比 conic 圓餅、試上洽詢轉換、星期別出席負載、會員分級）。
   *
   * Task P4-F3：接真 GET /reports/admin(復用桌面 admin/api.ts 的 getReports()，見
   * $lib/mobile-admin/api 零映射 re-export，與桌面 admin/reports/+page.svelte
   * (P4-F2)消費同一份 ReportsData)。三態載入用 createLoadGate(同 AdminSettingsScreen.
   * svelte 既有慣例)。分校 Panel 依裁決移除(單一場館，campusRevenue 無資料源)；
   * 「本月營收來源拆解」拿掉舊 mock 的假下鑽按鈕(r.drill 為示範用死連結，真資料無
   * 下鑽目的地，同桌面 RevenueBreakdown.svelte 的裁決)；副標改用 client 本地時間動態
   * 年月(顯示性質，非後端算)；顯示格式/查表沿用桌面 report-math.ts 與 admin/format.ts，
   * 幾個面板標題/說明文字對齊真實資料口徑同步桌面 P4-F2 的措辭(「場館使用率」→
   * 「場館使用時數」、「新生 vs 續報」→「新生 vs 回訪」、「體驗 → 報名 轉換漏斗」
   * (4 段)→「試上洽詢 → 報名 轉換」(誠實 2 段))。開放集合面板(熱門課程/收入來源/
   * 教練/場館/付款方式)空清單顯示提示文字；固定桶面板(出席/年齡/分級/星期/留存/
   * 類別占比)靠 normalizeBars/pctShares 防除以零即可，不需要提示文字——同桌面 13
   * 面板的既有分野(這些桶由後端零填、契約上不會真的是空陣列)。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import KpiCard from '$lib/mobile-admin/components/KpiCard.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getReports, type ReportsData } from '$lib/mobile-admin/api';
  import { ntd } from '$lib/public/adapters';
  import { fmtNT, fmtPct } from '$lib/admin/format';
  import {
    deltaPct,
    pctShares,
    normalizeBars,
    topCoursesFrom,
    groupIncomeSources,
    fmtHours,
    TIER_LABEL,
    REVENUE_SOURCE_LABEL,
    revenueSourceLabel,
    paymentMethodLabel,
    WEEKDAY_LABEL,
    AGE_BUCKET_LABEL,
    ATTENDANCE_BUCKET_LABEL
  } from '$lib/admin/report-math';

  export let onBack: () => void;

  let data: ReportsData | null = null;
  const gate = createLoadGate({
    fetch: getReports,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  // 副標動態年月(裁決：直接用 client 本地時間即可，顯示性質，非後端算)。
  const now = new Date();
  const monthSub = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 · 營運數據`;

  /** 環比 delta → KpiCard 用的顯示字串 + 顏色方向。null(分母不成立/無資料)→ 回傳空
   *  字串——KpiCard 既有「delta 空字串則不渲染 chip」的契約(桌面 ReportKpi 對 null
   *  顯示「—」中性 pill，行動版沿用 KpiCard 既有的省略慣例，不新增中性態)。 */
  function deltaDisplay(current: number | null, last: number | null): { delta: string; up: boolean } {
    const pct = deltaPct(current, last);
    if (pct == null) return { delta: '', up: false };
    return { delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 };
  }

  /* 開放集合(教練/場館/付款方式人數或種類不定)的循環色盤——沿用桌面 CoachPerf/
   * VenueUsage/PaymentSplit 的既定色系(呈現層，無資料源可依附)。 */
  const COACH_PALETTE = ['var(--df-primary)', '#0EA5E9', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];
  const VENUE_PALETTE = ['var(--df-primary)', '#0EA5E9', '#10B981', '#8B5CF6', '#EC4899', 'var(--df-warning)'];
  const PAYMENT_PALETTE = ['var(--df-primary)', '#10B981', '#0EA5E9', '#8B5CF6', 'var(--df-warning)', '#EC4899'];
  /* 固定桶(年齡/出席)的桶色——沿用桌面 AgeDist/AttDist 的既定色序(呈現層，component-local)。 */
  const AGE_BUCKET_COLOR: Record<'0-6' | '7-12' | '13-17' | '18-25' | '26-40' | '41+', string> = {
    '0-6': '#10B981', '7-12': 'var(--df-primary)', '13-17': '#0EA5E9', '18-25': '#8B5CF6', '26-40': '#F59E0B', '41+': '#EC4899'
  };
  const ATT_BUCKET_COLOR: Record<'gte_95' | '85_94' | '75_84' | 'lt_75', string> = {
    gte_95: 'var(--df-success)', '85_94': 'var(--df-primary)', '75_84': '#0EA5E9', lt_75: 'var(--df-warning)'
  };

  /** conic-gradient 累計色標(同桌面 admin/components/reports/donut.ts 的
   *  donutStops())——本檔唯一一處圓餅圖用，就地實作，不跨 surface 引入該檔。 */
  function donutStops(slices: { pct: number; color: string }[]): string {
    let acc = 0;
    return slices
      .map((s) => {
        const start = acc;
        acc += s.pct;
        return `${s.color} ${start}% ${acc}%`;
      })
      .join(', ');
  }

  $: kpiRevenue = deltaDisplay(data?.revenue.thisMonth ?? null, data?.revenue.lastMonth ?? null);
  $: kpiNewMembers = deltaDisplay(data?.kpis.newMembers.thisMonth ?? null, data?.kpis.newMembers.lastMonth ?? null);
  $: kpiNewEnrolments = deltaDisplay(data?.kpis.newEnrolments.thisMonth ?? null, data?.kpis.newEnrolments.lastMonth ?? null);
  $: kpiOrders = deltaDisplay(data?.kpis.paidOrdersCount.thisMonth ?? null, data?.kpis.paidOrdersCount.lastMonth ?? null);
  $: kpiAttendance = deltaDisplay(data?.kpis.attendanceRate.thisMonth ?? null, data?.kpis.attendanceRate.lastMonth ?? null);

  $: trend = data?.revenue.trend ?? [];
  $: trendHeights = normalizeBars(trend.map((d) => d.h), 108);
  $: trendTotal = trend.reduce((sum, d) => sum + d.h, 0);

  $: revenueBreakdownTotalCents = (data?.revenueBreakdown ?? []).reduce((sum, r) => sum + r.grossCents, 0);

  $: ageShares = pctShares((data?.ageDistribution ?? []).map((a) => a.count));

  $: topCourses = topCoursesFrom(data?.courses ?? []);

  $: incomeTotals = groupIncomeSources(data?.incomeSources12m ?? []).map((s) => ({
    source: s.source,
    totalCents: s.points.reduce((sum, p) => sum + p.grossCents, 0)
  }));
  $: incomeShares = pctShares(incomeTotals.map((t) => t.totalCents));

  $: sortedCoaches = [...(data?.coaches ?? [])].sort((a, b) => b.revenueCents12m - a.revenueCents12m);
  $: coachWidths = normalizeBars(sortedCoaches.map((c) => c.revenueCents12m));
  $: coachRows = sortedCoaches.map((c, i) => ({
    id: c.id,
    name: c.name,
    students: c.studentCount,
    attLabel: fmtPct(c.attendanceRate),
    revenueLabel: fmtNT(ntd(c.revenueCents12m)),
    color: COACH_PALETTE[i % COACH_PALETTE.length],
    widthPct: coachWidths[i]
  }));

  $: venueWidths = normalizeBars((data?.venueUsage ?? []).map((v) => v.minutes));
  $: venueRows = (data?.venueUsage ?? []).map((v, i) => ({
    venue: v.venue,
    hoursLabel: fmtHours(v.minutes),
    color: VENUE_PALETTE[i % VENUE_PALETTE.length],
    widthPct: venueWidths[i]
  }));

  $: attHeights = normalizeBars((data?.attendanceDistribution ?? []).map((d) => d.count), 84);

  $: retentionHeights = normalizeBars((data?.retention ?? []).map((d) => d.newCount + d.returningCount), 104);
  $: retentionLastRate = data?.retention.at(-1)?.rate ?? null;

  $: tierHeights = normalizeBars((data?.tierDistribution ?? []).map((d) => d.count), 84);

  $: weekdayHeights = normalizeBars((data?.weekdayLoad ?? []).map((d) => d.presentCount), 92);
  $: weekdayMax = Math.max(...(data?.weekdayLoad ?? []).map((d) => d.presentCount), 0);

  $: funnelWidths = normalizeBars([data?.funnel.trialInquiries ?? 0, data?.funnel.newEnrolments ?? 0]);
  $: funnelConversion =
    data && data.funnel.trialInquiries > 0 ? data.funnel.newEnrolments / data.funnel.trialInquiries : null;

  $: paymentShares = pctShares((data?.paymentSplit ?? []).map((p) => p.count));
  $: paymentHasData = (data?.paymentSplit ?? []).some((p) => p.count > 0);
  $: paymentStops = donutStops(
    (data?.paymentSplit ?? []).map((p, i) => ({
      pct: paymentShares[i] * 100,
      color: PAYMENT_PALETTE[i % PAYMENT_PALETTE.length]
    }))
  );
</script>

<PushScreen>
  <ScreenHeader {onBack} title="報表分析" sub={monthSub}>
    <HeaderIcon
      slot="right"
      icon="download"
      label="匯出"
      onClick={() => toasts.notify('info', '報表匯出中', '完整報表將寄送至您的信箱。')}
    />
  </ScreenHeader>
  {#if $gate === 'ready' && data}
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
      <!-- KPI grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
        <KpiCard icon="dollar-sign" label="本月營收" value={fmtNT(data.revenue.thisMonth)} delta={kpiRevenue.delta} up={kpiRevenue.up} tint="#0066CC14" color="var(--df-primary)" />
        <KpiCard icon="user-plus" label="本月新會員" value="{data.kpis.newMembers.thisMonth} 位" delta={kpiNewMembers.delta} up={kpiNewMembers.up} tint="#F59E0B14" color="#F59E0B" />
        <KpiCard icon="book-open" label="本月新報名" value="{data.kpis.newEnrolments.thisMonth} 筆" delta={kpiNewEnrolments.delta} up={kpiNewEnrolments.up} tint="#10B98114" color="#10B981" />
        <KpiCard icon="receipt" label="本月訂單數" value="{data.kpis.paidOrdersCount.thisMonth} 筆" delta={kpiOrders.delta} up={kpiOrders.up} tint="#8B5CF614" color="#8B5CF6" />
        <KpiCard icon="calendar-check" label="本月出席率" value={fmtPct(data.kpis.attendanceRate.thisMonth)} delta={kpiAttendance.delta} up={kpiAttendance.up} tint="#10B98114" color="#10B981" />
        <KpiCard icon="repeat" label="會員留存率" value={fmtPct(data.retention.at(-1)?.rate ?? null)} delta="" up={false} tint="#0EA5E914" color="#0EA5E9" />
      </div>

      <!-- revenue-source breakdown -->
      <Panel title={'本月營收 ' + fmtNT(ntd(revenueBreakdownTotalCents))} sub="依訂單品項毛額（折扣前）分列，含場地租借" pad={0}>
        {#each data.revenueBreakdown as r, i (r.source)}
          <div
            style="display:flex; align-items:center; gap:11px; padding:12px 16px; width:100%;
              border-bottom:{i < data.revenueBreakdown.length - 1 ? '1px solid var(--df-border)' : 'none'};"
          >
            <span style="width:9px; height:9px; border-radius:999px; background:{REVENUE_SOURCE_LABEL[r.source].color}; flex:none;"></span>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">{REVENUE_SOURCE_LABEL[r.source].label}</div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">訂單 {r.ordersCount} 筆 · 數量 {r.units}</div>
            </div>
            <div style="text-align:right; flex:none; font-size:13.5px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);">
              {fmtNT(ntd(r.grossCents))}
            </div>
          </div>
        {/each}
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--df-bg-light);">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">合計（本月毛額）</span>
          <span style="font-size:15.5px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);">{fmtNT(ntd(revenueBreakdownTotalCents))}</span>
        </div>
      </Panel>

      <!-- revenue trend -->
      <Panel title="營收趨勢" sub="近 12 個月 · 單位：新台幣元" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:5px; height:130px;">
          {#each trend as d, i (d.m)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
              <div
                style="width:100%; height:{trendHeights[i]}px; border-radius:5px 5px 2px 2px;
                  background:var(--df-primary); transform-origin:bottom; animation:df-grow .5s ease both;"
              ></div>
              <span style="font-size:9.5px; color:var(--df-text-muted);">{d.m}</span>
            </div>
          {/each}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:12px; font-size:12px; font-weight:700; color:var(--df-primary);">
          總計 {fmtNT(trendTotal)}
        </div>
      </Panel>

      <!-- category split -->
      <Panel title="營收類別占比" sub="本月訂單品項毛額 · 不含場租" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each data.categorySplit as c (c.source)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{REVENUE_SOURCE_LABEL[c.source].label}</span>
                <span style="font-weight:700; color:var(--df-text-dark);">{fmtPct(c.ratio)}</span>
              </div>
              <MiniBar value={(c.ratio ?? 0) * 100} tone={REVENUE_SOURCE_LABEL[c.source].color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- top courses -->
      <Panel title="熱門課程排行" sub="依報名人數">
        {#each topCourses as c, i (c.rank)}
          <div
            style="display:flex; align-items:center; gap:12px; padding:12px 16px;
              border-bottom:{i < topCourses.length - 1 ? '1px solid var(--df-border)' : 'none'};"
          >
            <div
              style="width:26px; height:26px; border-radius:8px;
                background:{c.rank <= 3 ? 'var(--df-primary)' : 'var(--df-bg-light)'};
                color:{c.rank <= 3 ? '#fff' : 'var(--df-text-light)'};
                display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800;
                font-family:var(--df-font-heading); flex:none;"
            >{c.rank}</div>
            <div style="flex:1; font-size:14px; font-weight:600; color:var(--df-text-dark);">{c.name}</div>
            <div style="font-size:13.5px; font-weight:700; color:var(--df-primary); font-family:var(--df-font-mono);">{c.count} 人</div>
          </div>
        {/each}
        {#if topCourses.length === 0}
          <div style="padding:24px 16px; text-align:center; color:var(--df-text-muted); font-size:13px;">尚無課程報名資料</div>
        {/if}
      </Panel>

      <!-- income sources -->
      <Panel title="收入來源分析" sub="近 12 個月毛額" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each incomeTotals as s, i (s.source)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{revenueSourceLabel(s.source).label}</span>
                <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{fmtNT(ntd(s.totalCents))}</b> · {fmtPct(incomeShares[i])}</span>
              </div>
              <MiniBar value={incomeShares[i] * 100} tone={revenueSourceLabel(s.source).color} height={7} />
            </div>
          {/each}
          {#if incomeTotals.length === 0}
            <div style="padding:16px 0; text-align:center; color:var(--df-text-muted); font-size:13px;">尚無收入資料</div>
          {/if}
        </div>
      </Panel>

      <!-- coach performance -->
      <Panel title="教練表現排行" sub="近 12 個月課程營收 · 學員數 · 出席率">
        {#each coachRows as c, i (c.id)}
          <div
            style="display:flex; align-items:center; gap:11px; padding:11px 16px;
              border-bottom:{i < coachRows.length - 1 ? '1px solid var(--df-border)' : 'none'};"
          >
            <Avatar name={c.name} size="sm" color={c.color} />
            <div style="flex:1; min-width:0;">
              <div style="font-size:13.5px; font-weight:700; color:var(--df-ink);">{c.name} <span style="font-size:11px; font-weight:500; color:var(--df-text-muted);">教練</span></div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{c.students} 位學員 · 出席 {c.attLabel}</div>
            </div>
            <div style="text-align:right; flex:none; min-width:76px;">
              <div style="font-size:13.5px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-mono);">{c.revenueLabel}</div>
              <div style="width:72px; height:5px; border-radius:3px; background:var(--df-bg-light); overflow:hidden; margin-top:4px; margin-left:auto;">
                <div style="height:100%; width:{c.widthPct}%; border-radius:3px; background:{c.color};"></div>
              </div>
            </div>
          </div>
        {/each}
        {#if coachRows.length === 0}
          <div style="padding:24px 16px; text-align:center; color:var(--df-text-muted); font-size:13px;">尚無教練資料</div>
        {/if}
      </Panel>

      <!-- venue utilisation -->
      <Panel title="場館使用時數" sub="本月排課場次時數" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each venueRows as v (v.venue)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{v.venue}</span>
                <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark);">{v.hoursLabel}</b></span>
              </div>
              <MiniBar value={v.widthPct} tone={v.color} height={7} />
            </div>
          {/each}
          {#if venueRows.length === 0}
            <div style="padding:16px 0; text-align:center; color:var(--df-text-muted); font-size:13px;">本月尚無場地使用資料</div>
          {/if}
        </div>
      </Panel>

      <!-- attendance distribution -->
      <Panel title="出席率分布" sub="依個人出席率分桶 · 學員人數" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:12px; height:130px;">
          {#each data.attendanceDistribution as d, i (d.bucket)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
              <span style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);">{d.count}</span>
              <div style="width:100%; max-width:42px; height:{attHeights[i]}px; border-radius:6px 6px 2px 2px; background:{ATT_BUCKET_COLOR[d.bucket]};"></div>
              <span style="font-size:10.5px; color:var(--df-text-light); text-align:center;">{ATTENDANCE_BUCKET_LABEL[d.bucket]}</span>
            </div>
          {/each}
        </div>
      </Panel>

      <!-- new vs returning retention -->
      <Panel title="新生 vs 回訪" sub="近 6 個月 · 出席活躍會員數" pad={16}>
        <div style="display:flex; justify-content:flex-end; margin-bottom:8px; font-size:12px; font-weight:700; color:#0EA5E9;">
          留存 {fmtPct(retentionLastRate)}
        </div>
        <div style="display:flex; align-items:flex-end; gap:8px; height:132px;">
          {#each data.retention as d, i (d.month)}
            {@const total = d.newCount + d.returningCount}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
              <div
                style="width:100%; max-width:30px; height:{retentionHeights[i]}px;
                  border-radius:5px 5px 2px 2px; overflow:hidden; display:flex; flex-direction:column;"
              >
                <div style="height:{total > 0 ? (d.newCount / total) * 100 : 0}%; background:var(--df-accent);"></div>
                <div style="flex:1; background:var(--df-primary);"></div>
              </div>
              <span style="font-size:10px; color:var(--df-text-muted);">{d.month}</span>
            </div>
          {/each}
        </div>
        <div style="display:flex; gap:16px; margin-top:12px; font-size:12px; color:var(--df-text-light);">
          <span style="display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:var(--df-accent);"></span>新生（首次活躍）</span>
          <span style="display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:var(--df-primary);"></span>回訪學員</span>
        </div>
      </Panel>

      <!-- age-band distribution -->
      <Panel title="年齡層分布" sub="依生日推算足歲 · 未填生日不計" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each data.ageDistribution as a, i (a.bucket)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{AGE_BUCKET_LABEL[a.bucket]}</span>
                <span style="font-weight:700; color:var(--df-text-dark);">{fmtPct(ageShares[i])}</span>
              </div>
              <MiniBar value={ageShares[i] * 100} tone={AGE_BUCKET_COLOR[a.bucket]} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- payment-method split -->
      <Panel title="付款方式占比" sub="本月付款訂單筆數" pad={16}>
        <div style="display:flex; align-items:center; gap:16px;">
          <div
            style="width:104px; height:104px; border-radius:50%; background:{paymentHasData ? `conic-gradient(${paymentStops})` : 'var(--df-bg-light)'};
              flex:none; display:flex; align-items:center; justify-content:center;"
          >
            <div style="width:62px; height:62px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-size:18px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;">{data.paymentSplit.length}</div>
              <div style="font-size:10px; color:var(--df-text-light); margin-top:2px;">種管道</div>
            </div>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            {#each data.paymentSplit as p, i (p.method)}
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:10px; height:10px; border-radius:5px; background:{PAYMENT_PALETTE[i % PAYMENT_PALETTE.length]}; flex:none;"></span>
                <span style="flex:1; font-size:12.5px; color:var(--df-text-dark);">{paymentMethodLabel(p.method)}</span>
                <span style="font-size:12.5px; font-weight:700; color:var(--df-text-dark);">{fmtPct(paymentShares[i])}</span>
              </div>
            {/each}
            {#if data.paymentSplit.length === 0}
              <div style="font-size:12.5px; color:var(--df-text-muted);">本月尚無付款訂單</div>
            {/if}
          </div>
        </div>
      </Panel>

      <!-- conversion funnel -->
      <Panel title="試上洽詢 → 報名 轉換" sub="近 90 天" pad={16}>
        <div style="display:flex; flex-direction:column; gap:11px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
              <span style="color:var(--df-text-dark); font-weight:600;">試上洽詢</span>
              <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{data.funnel.trialInquiries}</b> 筆</span>
            </div>
            <div style="height:22px; border-radius:7px; background:var(--df-bg-light); overflow:hidden;">
              <div style="height:100%; width:{funnelWidths[0]}%; border-radius:7px; background:var(--df-primary);"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
              <span style="color:var(--df-text-dark); font-weight:600;">完成報名</span>
              <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{data.funnel.newEnrolments}</b> 筆 <span style="color:var(--df-text-muted);">· 轉化 {fmtPct(funnelConversion)}</span></span>
            </div>
            <div style="height:22px; border-radius:7px; background:var(--df-bg-light); overflow:hidden;">
              <div style="height:100%; width:{funnelWidths[1]}%; border-radius:7px; background:#10B981;"></div>
            </div>
          </div>
        </div>
      </Panel>

      <!-- weekday class load -->
      <Panel title="星期別出席負載" sub="近 30 天出席人次 · 依星期分桶" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:7px; height:140px;">
          {#each data.weekdayLoad as d, i (d.weekday)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; height:100%; justify-content:flex-end;">
              <span style="font-size:10px; font-weight:700; color:var(--df-primary);">{d.presentCount}</span>
              <div style="width:100%; max-width:26px; height:{weekdayHeights[i]}px; border-radius:5px 5px 2px 2px; background:{weekdayMax > 0 && d.presentCount === weekdayMax ? 'var(--df-accent)' : 'var(--df-primary)'};"></div>
              <span style="font-size:11px; color:var(--df-text-light);">{WEEKDAY_LABEL[d.weekday]}</span>
            </div>
          {/each}
        </div>
      </Panel>

      <!-- membership-tier distribution -->
      <Panel title="會員分級分布" sub="依點數餘額分級 · 人數" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:12px; height:130px;">
          {#each data.tierDistribution as d, i (d.bucket)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
              <span style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);">{d.count}</span>
              <div style="width:100%; max-width:40px; height:{tierHeights[i]}px; border-radius:6px 6px 2px 2px; background:{TIER_LABEL[d.bucket].color};"></div>
              <span style="font-size:11px; color:var(--df-text-light);">{TIER_LABEL[d.bucket].label}</span>
            </div>
          {/each}
        </div>
      </Panel>
      <div style="height:8px;"></div>
    </div>
  </div>
  {:else if $gate === 'error'}
    <div class="df-scroll" style="padding:16px;">
      <ErrorState onRetry={gate.refresh} />
    </div>
  {:else}
    <div class="df-scroll" data-testid="reports-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:16px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
        {#each [0, 1, 2, 3, 4, 5] as i (i)}
          <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
        {/each}
      </div>
      <SkelCard padding={16}><Skeleton w="100%" h={200} r={12} /></SkelCard>
    </div>
  {/if}
</PushScreen>
