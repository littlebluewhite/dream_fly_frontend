<script lang="ts">
  /* 報表分析 push screen。admin2.jsx ReportsScreen (196)。
   * KPI grid + 各圖表 Panel（營收來源下鑽、營收趨勢、類別占比、熱門課程、
   * 收入來源、教練表現、場館使用率、出席分布、新生vs續報、年齡層、分校營收、
   * 付款占比 conic 圓餅、轉換漏斗、星期負載、會員分級）。 */
  import PushScreen from '$lib/mobile-admin/components/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile-admin/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile-admin/components/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Panel from '$lib/mobile-admin/components/Panel.svelte';
  import KpiCard from '$lib/mobile-admin/components/KpiCard.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import {
    REPORT_KPIS,
    REVENUE_TOTAL,
    REVENUE_BREAKDOWN,
    REVENUE_TREND,
    CATEGORY_SPLIT,
    TOP_COURSES,
    INCOME_SOURCES,
    COACH_PERF,
    VENUE_USAGE,
    ATT_DIST,
    RETENTION,
    AGE_DIST,
    CAMPUS_REVENUE,
    PAYMENT_SPLIT,
    FUNNEL,
    WEEKDAY_LOAD,
    TIER_DIST
  } from '$lib/mobile-admin/data';

  export let onBack: () => void;

  const maxH = Math.max(...REVENUE_TREND.map((d) => d.h));
  const maxAtt = Math.max(...ATT_DIST.map((d) => d.count));
  const maxR = Math.max(...RETENTION.map((d) => d.nu + d.re));
  const maxLoad = Math.max(...WEEKDAY_LOAD.map((d) => d.classes));
  const maxTier = Math.max(...TIER_DIST.map((d) => d.count));

  let payAcc = 0;
  const payStops = PAYMENT_SPLIT.map((p) => {
    const s = payAcc;
    payAcc += p.pct;
    return `${p.color} ${s}% ${payAcc}%`;
  }).join(', ');
</script>

<PushScreen>
  <ScreenHeader {onBack} title="報表分析" sub="2026 年 6 月 · 營運數據">
    <HeaderIcon
      slot="right"
      icon="download"
      label="匯出"
      onClick={() => toasts.notify('info', '報表匯出中', '完整報表將寄送至您的信箱。')}
    />
  </ScreenHeader>
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
      <!-- KPI grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
        {#each REPORT_KPIS as k (k.label)}
          <KpiCard icon={k.icon} label={k.label} value={k.value} delta={k.delta} up={k.up} tint={k.tint} color={k.color} />
        {/each}
      </div>

      <!-- revenue-source breakdown -->
      <Panel title={'本月營收 ' + REVENUE_TOTAL} sub="點任一來源可下鑽原始資料" pad={0}>
        {#each REVENUE_BREAKDOWN as r, i (r.name)}
          <button
            on:click={() => toasts.notify('info', r.name, '下鑽至原始資料：' + r.drill + '（示範）。')}
            class="df-rowhover df-tapscale"
            style="display:flex; align-items:center; gap:11px; padding:12px 16px; width:100%; border:none;
              border-bottom:{i < REVENUE_BREAKDOWN.length - 1 ? '1px solid var(--df-border)' : 'none'};
              background:#fff; cursor:pointer; text-align:left;"
          >
            <span style="width:9px; height:9px; border-radius:999px; background:{r.dot}; flex:none;"></span>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">{r.name}</div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{r.meta}</div>
            </div>
            <div style="text-align:right; flex:none;">
              <div style="font-size:13.5px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);">{r.amount}</div>
              <div style="display:inline-flex; align-items:center; gap:2px; font-size:11.5px; font-weight:600; color:var(--df-primary); margin-top:2px;">{r.drill}<Icon name="chevron-right" size={13} color="var(--df-primary)" /></div>
            </div>
          </button>
        {/each}
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--df-bg-light);">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">合計（本月）</span>
          <span style="font-size:15.5px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);">{REVENUE_TOTAL}</span>
        </div>
      </Panel>

      <!-- revenue trend -->
      <Panel title="營收趨勢" sub="近 12 個月 (NT 千元)" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:5px; height:130px;">
          {#each REVENUE_TREND as d (d.m)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
              <div
                style="width:100%; height:{(d.h / maxH) * 108}px; border-radius:5px 5px 2px 2px;
                  background:{d.peak ? 'var(--df-accent)' : 'var(--df-primary)'}; transform-origin:bottom;
                  animation:df-grow .5s ease both; opacity:{d.peak ? 1 : 0.85};"
              ></div>
              <span style="font-size:9.5px; color:var(--df-text-muted);">{d.m}</span>
            </div>
          {/each}
        </div>
        <div style="display:flex; align-items:center; gap:6px; margin-top:12px; font-size:12px; color:var(--df-text-light);">
          <span style="width:9px; height:9px; border-radius:2px; background:var(--df-accent);"></span>10 月為年度高峰 · NT$160K
        </div>
      </Panel>

      <!-- category split -->
      <Panel title="課程類別占比" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each CATEGORY_SPLIT as c (c.label)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{c.label}</span>
                <span style="font-weight:700; color:var(--df-text-dark);">{c.pct}%</span>
              </div>
              <MiniBar value={c.pct} tone={c.color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- top courses -->
      <Panel title="熱門課程排行" sub="依報名人數">
        {#each TOP_COURSES as c, i (c.rank)}
          <div
            style="display:flex; align-items:center; gap:12px; padding:12px 16px;
              border-bottom:{i < TOP_COURSES.length - 1 ? '1px solid var(--df-border)' : 'none'};"
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
      </Panel>

      <!-- income sources -->
      <Panel title="收入來源分析" sub="年度累計" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each INCOME_SOURCES as s (s.label)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{s.label}</span>
                <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{s.amount}</b> · {s.pct}%</span>
              </div>
              <MiniBar value={s.pct} tone={s.color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- coach performance -->
      <Panel title="教練表現排行" sub="依營收與學員數">
        {#each COACH_PERF as c, i (c.name)}
          <div
            style="display:flex; align-items:center; gap:11px; padding:11px 16px;
              border-bottom:{i < COACH_PERF.length - 1 ? '1px solid var(--df-border)' : 'none'};"
          >
            <Avatar name={c.initial} size="sm" color={c.color} />
            <div style="flex:1; min-width:0;">
              <div style="font-size:13.5px; font-weight:700; color:var(--df-ink);">{c.name} <span style="font-size:11px; font-weight:500; color:var(--df-text-muted);">教練</span></div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{c.students} 位學員 · 出席 {c.att}%</div>
            </div>
            <div style="text-align:right; flex:none; min-width:76px;">
              <div style="font-size:13.5px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-mono);">{c.revenue}</div>
              <div style="width:72px; height:5px; border-radius:3px; background:var(--df-bg-light); overflow:hidden; margin-top:4px; margin-left:auto;">
                <div style="height:100%; width:{c.revPct}%; border-radius:3px; background:{c.color};"></div>
              </div>
            </div>
          </div>
        {/each}
      </Panel>

      <!-- venue utilisation -->
      <Panel title="場館使用率" sub="本月排課時數" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each VENUE_USAGE as v (v.name)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{v.name}</span>
                <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark);">{v.pct}%</b> · {v.hours}</span>
              </div>
              <MiniBar value={v.pct} tone={v.color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- attendance distribution -->
      <Panel title="出席率分布" sub="全館學員人數" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:12px; height:130px;">
          {#each ATT_DIST as d (d.label)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
              <span style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);">{d.count}</span>
              <div style="width:100%; max-width:42px; height:{(d.count / maxAtt) * 84}px; border-radius:6px 6px 2px 2px; background:{d.color};"></div>
              <span style="font-size:10.5px; color:var(--df-text-light); text-align:center;">{d.label}</span>
            </div>
          {/each}
        </div>
      </Panel>

      <!-- new vs returning retention -->
      <Panel title="新生 vs 續報" sub="近 6 個月·人數" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:8px; height:132px;">
          {#each RETENTION as d (d.m)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px;">
              <div
                style="width:100%; max-width:30px; height:{((d.nu + d.re) / maxR) * 104}px;
                  border-radius:5px 5px 2px 2px; overflow:hidden; display:flex; flex-direction:column;"
              >
                <div style="height:{(d.nu / (d.nu + d.re)) * 100}%; background:var(--df-accent);"></div>
                <div style="flex:1; background:var(--df-primary);"></div>
              </div>
              <span style="font-size:10px; color:var(--df-text-muted);">{d.m}</span>
            </div>
          {/each}
        </div>
        <div style="display:flex; gap:16px; margin-top:12px; font-size:12px; color:var(--df-text-light);">
          <span style="display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:var(--df-accent);"></span>新生學員</span>
          <span style="display:flex; align-items:center; gap:6px;"><span style="width:9px; height:9px; border-radius:2px; background:var(--df-primary);"></span>續報學員</span>
        </div>
      </Panel>

      <!-- age-band distribution -->
      <Panel title="年齡層分布" sub="全館學員占比" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each AGE_DIST as a (a.label)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{a.label}</span>
                <span style="font-weight:700; color:var(--df-text-dark);">{a.pct}%</span>
              </div>
              <MiniBar value={a.pct} tone={a.color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- per-campus revenue -->
      <Panel title="分校別營收" sub="本月 · 含在學人數" pad={16}>
        <div style="display:flex; flex-direction:column; gap:13px;">
          {#each CAMPUS_REVENUE as c (c.name)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{c.name} <span style="font-weight:400; color:var(--df-text-muted); font-size:11.5px;">· {c.students} 位</span></span>
                <span style="font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);">{c.amount}</span>
              </div>
              <MiniBar value={c.pct} tone={c.color} height={7} />
            </div>
          {/each}
        </div>
      </Panel>

      <!-- payment-method split -->
      <Panel title="付款方式占比" sub="本月交易筆數" pad={16}>
        <div style="display:flex; align-items:center; gap:16px;">
          <div
            style="width:104px; height:104px; border-radius:50%; background:conic-gradient({payStops});
              flex:none; display:flex; align-items:center; justify-content:center;"
          >
            <div style="width:62px; height:62px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-size:18px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading); line-height:1;">{PAYMENT_SPLIT.length}</div>
              <div style="font-size:10px; color:var(--df-text-light); margin-top:2px;">種管道</div>
            </div>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            {#each PAYMENT_SPLIT as p (p.label)}
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="width:10px; height:10px; border-radius:5px; background:{p.color}; flex:none;"></span>
                <span style="flex:1; font-size:12.5px; color:var(--df-text-dark);">{p.label}</span>
                <span style="font-size:12.5px; font-weight:700; color:var(--df-text-dark);">{p.pct}%</span>
              </div>
            {/each}
          </div>
        </div>
      </Panel>

      <!-- conversion funnel -->
      <Panel title="體驗 → 報名 轉換漏斗" sub="本季" pad={16}>
        <div style="display:flex; flex-direction:column; gap:11px;">
          {#each FUNNEL as f (f.label)}
            <div>
              <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:5px;">
                <span style="color:var(--df-text-dark); font-weight:600;">{f.label}</span>
                <span style="color:var(--df-text-light);"><b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">{f.count}</b> 人 · {f.pct}%</span>
              </div>
              <div style="height:22px; border-radius:7px; background:var(--df-bg-light); overflow:hidden;">
                <div style="height:100%; width:{f.pct}%; border-radius:7px; background:{f.color};"></div>
              </div>
            </div>
          {/each}
        </div>
      </Panel>

      <!-- weekday class load -->
      <Panel title="星期別課堂負載" sub="長條＝課堂數 · 數字＝出席率" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:7px; height:140px;">
          {#each WEEKDAY_LOAD as d (d.d)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; height:100%; justify-content:flex-end;">
              <span style="font-size:10px; font-weight:700; color:var(--df-primary);">{d.rate}</span>
              <div style="width:100%; max-width:26px; height:{(d.classes / maxLoad) * 92}px; border-radius:5px 5px 2px 2px; background:{d.classes === maxLoad ? 'var(--df-accent)' : 'var(--df-primary)'};"></div>
              <span style="font-size:11px; color:var(--df-text-light);">{d.d}</span>
            </div>
          {/each}
        </div>
      </Panel>

      <!-- membership-tier distribution -->
      <Panel title="會員分級分布" sub="依累積點數 · 人數" pad={16}>
        <div style="display:flex; align-items:flex-end; gap:12px; height:130px;">
          {#each TIER_DIST as d (d.label)}
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px;">
              <span style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);">{d.count}</span>
              <div style="width:100%; max-width:40px; height:{(d.count / maxTier) * 84}px; border-radius:6px 6px 2px 2px; background:{d.color};"></div>
              <span style="font-size:11px; color:var(--df-text-light);">{d.label}</span>
            </div>
          {/each}
        </div>
      </Panel>
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
