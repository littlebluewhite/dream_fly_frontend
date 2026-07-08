<script lang="ts">
  /* 成績單 / 證書 (Reports) — Task 13：GET /report-cards/me + GET /certificates/me
   * (integration-contract.md §3.22)。v1 為純 metadata、無 PDF/檔案——證書卡片不再有
   * 檢視/下載按鈕（契約明文：兩者皆無檔案儲存）。舊 mock 版本以「單一課程 + 技巧評量/
   * 學習表現」呈現一份學期成績單（REPORTS record，keyed by course id）；後端只提供
   * term_label/comment/rating(1–5|null) 三個欄位、且同一課程可能橫跨多期別各有一筆
   * 成績單，故改為列表呈現每一筆成績單（新到舊，同後端排序），不再有「課程picker」。 */
  import { onMount } from 'svelte';
  import { Tabs, Card, Badge, Icon, Skeleton, SkelCard, ErrorState, EmptyState, LoadGate } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import { getReports, type ReportsData } from '$lib/member/api';
  import { fmtRate } from '$lib/member/format';

  let tab = 'report';
  let data: ReportsData | null = null;

  const gate = createLoadGate({
    fetch: getReports,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  const STARS = [1, 2, 3, 4, 5];
</script>

<LoadGate {gate}>
  <div class="df-view" data-testid="reports-skeleton" slot="loading">
    <Skeleton w={200} h={36} r={9} style="margin-bottom:20px" />
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
  </div>

  <div class="df-view">
    <div class="stats-row">
      <Card padding={16}>
        <div class="stat-label">累計出席</div>
        <div class="stat-value">{data.stats.attendedTotal}</div>
      </Card>
      <Card padding={16}>
        <div class="stat-label">出席率</div>
        <div class="stat-value">{fmtRate(data.stats.attendanceRate)}</div>
      </Card>
      <Card padding={16}>
        <div class="stat-label">點數餘額</div>
        <div class="stat-value">{data.stats.pointsBalance}</div>
      </Card>
      <Card padding={16}>
        <div class="stat-label">有效報名</div>
        <div class="stat-value">{data.stats.activeEnrolments}</div>
      </Card>
      <Card padding={16}>
        <div class="stat-label">未來 7 天課程</div>
        <div class="stat-value">{data.stats.upcomingSessions7d}</div>
      </Card>
    </div>

    <Tabs
      bind:value={tab}
      tabs={[
        { value: 'report', label: '成績單', count: data.reportCards.length },
        { value: 'cert', label: '我的證書', count: data.certificates.length }
      ]}
      style="margin-bottom:20px"
    />

    {#if tab === 'report'}
      {#if data.reportCards.length === 0}
        <Card>
          <EmptyState
            icon="clipboard-list"
            title="尚無成績單"
            body="教練完成本期評量後，成績單會顯示在這裡並通知你。"
          />
        </Card>
      {:else}
        <div style="display:flex;flex-direction:column;gap:14px">
          {#each data.reportCards as r (r.id)}
            <Card padding={0} style="overflow:hidden">
              <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                  <div>
                    <div style="font-size:15.5px;font-weight:700;color:var(--df-ink)">{r.courseName}</div>
                    <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">{r.termLabel}</div>
                  </div>
                  {#if r.rating != null}
                    {@const rating = r.rating}
                    <div style="display:flex;gap:2px;flex:none" aria-label={`評分 ${rating} / 5`}>
                      {#each STARS as i (i)}
                        <Icon name="star" size={16} color={i <= rating ? 'var(--df-warning)' : 'var(--df-border)'} />
                      {/each}
                    </div>
                  {:else}
                    <Badge tone="neutral">尚未評分</Badge>
                  {/if}
                </div>
                <p style="margin:0;font-size:14px;color:var(--df-text-dark);line-height:1.75">
                  {r.comment ?? '教練尚未留下評語。'}
                </p>
                <div style="font-size:12px;color:var(--df-text-muted);font-family:var(--df-font-mono);border-top:1px solid var(--df-border);padding-top:10px">
                  {r.issuerName} 教練 · {r.createdAt.slice(0, 10)}
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    {:else}
      {#if data.certificates.length === 0}
        <Card>
          <EmptyState
            icon="award"
            title="尚無證書"
            body="完成課程或參賽獲獎後，你的證書會顯示在這裡。"
          />
        </Card>
      {:else}
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px,1fr));gap:18px">
          {#each data.certificates as c (c.id)}
            <Card padding={0} hoverable style="overflow:hidden;display:flex;flex-direction:column">
              <div
                style="height:96px;background:linear-gradient(135deg, var(--df-primary) 0%, var(--df-primary-dark) 100%);display:flex;align-items:center;justify-content:center;position:relative"
              >
                <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.92);display:flex;align-items:center;justify-content:center">
                  <Icon name="award" size={26} color="var(--df-primary)" />
                </div>
                {#if c.level}
                  <span style="position:absolute;top:12px;right:12px"><Badge tone="neutral" solid>{c.level}</Badge></span>
                {/if}
              </div>
              <div style="padding:16px;flex:1;display:flex;flex-direction:column;gap:6px">
                <div style="font-size:15px;font-weight:700;color:var(--df-ink);line-height:1.4">{c.title}</div>
                {#if c.courseName}
                  <div style="font-size:12.5px;color:var(--df-text-light)">{c.courseName}</div>
                {/if}
                <div style="font-size:12px;color:var(--df-text-muted);font-family:var(--df-font-mono)">核發日 {c.issuedOn}</div>
                {#if c.note}
                  <p style="margin:4px 0 0;font-size:13px;color:var(--df-text-dark);line-height:1.6">{c.note}</p>
                {/if}
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="df-view" slot="error"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
</LoadGate>

<style>
  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .stat-label {
    font-size: 12px;
    color: var(--df-text-light);
  }
  .stat-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--df-ink);
    margin-top: 4px;
  }
</style>
