<script lang="ts">
  /* 成績單 / 證書 (Reports) — term report cards with coach assessment on one
   * tab, earned certificates on the other. Ported from the prototype's Reports
   * (client/views2.jsx). The BarRow + ReportCard sub-views are kept as inline
   * markup here. Data + primitives come from the shared foundation. */
  import { onMount } from 'svelte';
  import { Tabs, Card, Badge, Button, Avatar, ProgressBar, Icon } from '$lib/components/ui';
  import Skeleton from '$lib/member/components/Skeleton.svelte';
  import SkelCard from '$lib/member/components/SkelCard.svelte';
  import ErrorState from '$lib/member/components/ErrorState.svelte';
  import EmptyState from '$lib/member/components/EmptyState.svelte';
  import { getReports, type ReportsData } from '$lib/member/api';
  import { toasts } from '$lib/member/stores';

  let tab = 'report';
  let active: string | null = null;
  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: ReportsData | null = null;

  function load() {
    phase = 'loading';
    getReports()
      .then((d) => { data = d; active = d.courses[0]?.id ?? null; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  $: cur = data && active != null ? (data.courses.find((c) => c.id === active) ?? data.courses[0]) : null;
  $: rpt = data && active != null ? data.reports[active] : undefined;
</script>

{#if phase === 'ready' && data}
  <div class="df-view">
    <Tabs
      bind:value={tab}
      tabs={[
        { value: 'report', label: '本季成績單' },
        { value: 'cert', label: '我的證書', count: data.certs.length }
      ]}
      style="margin-bottom:20px"
    />

    {#if tab === 'report'}
      {#if data.courses.length === 0}
        <Card>
          <EmptyState
            icon="book-open"
            title="尚未報名任何課程"
            body="完成報名後，你的本季成績單與教練評語將會在這裡顯示。"
          />
        </Card>
      {:else}
      <div style="display:grid;grid-template-columns:260px 1fr;gap:18px;align-items:start">
        <!-- Left: course picker -->
        <div style="display:flex;flex-direction:column;gap:10px">
          {#each data.courses as c (c.id)}
            {@const on = active === c.id}
            {@const has = !!data.reports[c.id]}
            <button
              type="button"
              class="picker"
              class:on
              on:click={() => (active = c.id)}
            >
              <div
                style="width:40px;height:40px;border-radius:11px;background:{c.color}1A;display:flex;align-items:center;justify-content:center;flex:none"
              >
                <Icon name={c.icon} size={20} color={c.color} />
              </div>
              <div style="flex:1;min-width:0">
                <div
                  style="font-size:14px;font-weight:700;color:var(--df-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                >
                  {c.name}
                </div>
                <div style="font-size:12px;color:var(--df-text-light);margin-top:2px">
                  {has ? c.term : '尚未評定'}
                </div>
              </div>
            </button>
          {/each}
        </div>

        <!-- Right: report card or empty state -->
        {#if rpt && cur}
          <Card padding={0} style="overflow:hidden">
            <div
              style="padding:22px 26px;display:flex;align-items:center;gap:16px;background:linear-gradient(115deg, var(--df-primary) 0%, var(--df-primary-dark) 100%);color:#fff"
            >
              <div
                style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.16);display:flex;align-items:center;justify-content:center;flex:none"
              >
                <span style="font-family:var(--df-font-heading);font-size:32px;font-weight:800">{rpt.grade}</span>
              </div>
              <div style="flex:1">
                <div style="font-size:13px;opacity:0.85">{rpt.term} 學習成績</div>
                <div style="font-family:var(--df-font-heading);font-size:22px;font-weight:800;margin:2px 0 4px">{cur.name}</div>
                <div style="font-size:13px;opacity:0.9">總評：{rpt.gradeLabel} · {rpt.coach} 教練</div>
              </div>
            </div>
            <div style="padding:26px;display:flex;flex-direction:column;gap:24px">
              <!-- 技巧評量 -->
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:16px">技巧評量</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 28px">
                  {#each rpt.skills as [l, v], i (i)}
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                        <span style="color:var(--df-text-dark);font-weight:500">{l}</span>
                        <span style="font-weight:700;color:var(--df-ink);font-family:var(--df-font-mono)">{v}</span>
                      </div>
                      <ProgressBar value={v} height={7} tone={v >= 85 ? 'success' : 'primary'} />
                    </div>
                  {/each}
                </div>
              </div>
              <!-- 學習表現 -->
              <div style="border-top:1px solid var(--df-border);padding-top:22px">
                <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:16px">學習表現</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 28px">
                  {#each rpt.attrs as [l, v], i (i)}
                    <div>
                      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
                        <span style="color:var(--df-text-dark);font-weight:500">{l}</span>
                        <span style="font-weight:700;color:var(--df-ink);font-family:var(--df-font-mono)">{v}</span>
                      </div>
                      <ProgressBar value={v} height={7} tone="primary" />
                    </div>
                  {/each}
                </div>
              </div>
              <!-- 教練評語 -->
              <div style="border-top:1px solid var(--df-border);padding-top:22px">
                <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:12px">教練評語</div>
                <div style="display:flex;gap:13px;background:var(--df-bg-light);border-radius:12px;padding:18px">
                  <Avatar name={rpt.coach} size="md" color={cur.color} />
                  <div style="flex:1">
                    <div style="font-size:13.5px;font-weight:700;color:var(--df-ink);margin-bottom:6px">{rpt.coach} 教練</div>
                    <p style="margin:0;font-size:14px;color:var(--df-text-dark);line-height:1.75">{rpt.comment}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        {:else if cur}
          <Card>
            <EmptyState
              icon="clipboard-list"
              title="本季成績單尚未產生"
              body={`「${cur.name}」課程結束後，教練會完成技巧評量與評語，屆時將在此顯示並通知你。`}
            >
              <Badge slot="action" tone="info" dot>評量中</Badge>
            </EmptyState>
          </Card>
        {/if}
      </div>
      {/if}
    {:else}
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px,1fr));gap:18px">
        {#each data.certs as ct (ct.id)}
          <Card padding={0} hoverable style="overflow:hidden;display:flex;flex-direction:column">
            <div
              style="height:120px;background:linear-gradient(135deg, {ct.color} 0%, {ct.color}cc 100%);display:flex;align-items:center;justify-content:center;position:relative"
            >
              <div
                style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center"
              >
                <Icon name={ct.icon} size={30} color={ct.color} />
              </div>
              <span style="position:absolute;top:12px;right:12px"><Badge tone="neutral" solid>{ct.level}</Badge></span>
            </div>
            <div style="padding:18px;flex:1;display:flex;flex-direction:column">
              <div style="font-size:15.5px;font-weight:700;color:var(--df-ink);line-height:1.4">{ct.title}</div>
              <div style="font-size:12.5px;color:var(--df-text-light);margin-top:6px">{ct.issuer}</div>
              <div style="font-size:12px;color:var(--df-text-muted);margin-top:3px;font-family:var(--df-font-mono)">核發日 {ct.date}</div>
              <div style="margin-top:auto;display:flex;gap:8px;padding-top:16px">
                <Button size="sm" variant="secondary" fullWidth on:click={() => toasts.notify('info', '預覽證書', ct.title)}>
                  <Icon name="eye" size={15} />檢視
                </Button>
                <Button size="sm" variant="primary" fullWidth on:click={() => toasts.notify('success', '下載證書', ct.title + ' PDF 已開始下載。')}>
                  <Icon name="download" size={15} />下載
                </Button>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </div>
{:else if phase === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={load} /></Card></div>
{:else}
  <div class="df-view" data-testid="reports-skeleton">
    <Skeleton w={200} h={36} r={9} style="margin-bottom:20px" />
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
  </div>
{/if}

<style>
  .picker {
    text-align: left;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 12px;
    cursor: pointer;
    width: 100%;
    background: #fff;
    border: 1.5px solid var(--df-border);
    font-family: var(--df-font-body);
  }
  .picker.on {
    background: var(--df-primary-bg);
    border-color: var(--df-primary);
  }
</style>
