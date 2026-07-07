<script lang="ts">
  /* 成績單與證書 push screen。account.jsx ReportScreen (208) · app.jsx (90)。
   *
   * Task 19：改真後端 —— 復用桌面 getReports()(GET /report-cards/me + GET
   * /certificates/me + GET /reports/me，Task 13 seam，見 $lib/mobile/api.ts
   * getReports())。真後端成績單只有 comment/rating/term_label 三個欄位，沒有
   * mock 舊版的「評等字母(grade)/技巧熟練度百分比(skills)/學習表現雷達圖
   * (attrs)」——這些欄位後端完全沒有對應資料，改為列表呈現每一筆成績單(同桌面
   * /member/reports 頁的呈現方式，見該頁註解：「改為列表呈現每一筆成績單，不再
   * 有課程 picker」)，不再假裝有這些數字。舊版「course」prop(單一課程 scope)
   * 一併移除——真後端資料本來就沒有「只看某一門課成績單」的篩選概念。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import { getReports, type ReportsData } from '$lib/mobile/api';

  export let onBack: () => void;

  let tab: 'report' | 'certs' = 'report';
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

<PushScreen>
  <ScreenHeader {onBack} title="成績單與證書" />

  <div style="flex:none; display:flex; background:#fff; border-bottom:1px solid var(--df-border); padding:0 14px;">
    {#each [['report', '成績單'], ['certs', '證書 / 獎狀']] as [k, l]}
      {@const on = tab === k}
      <button
        on:click={() => (tab = k as 'report' | 'certs')}
        style="flex:1; padding:13px 0; border:none; border-bottom:2.5px solid {on
          ? 'var(--df-primary)'
          : 'transparent'}; background:transparent; color:{on
          ? 'var(--df-primary)'
          : 'var(--df-text-light)'}; font-size:14px; font-weight:{on ? 700 : 500}; cursor:pointer;"
      >{l}</button>
    {/each}
  </div>

  {#if $gate === 'ready' && data}
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      {#if tab === 'report'}
        {#if data.reportCards.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">教練完成本期評量後，成績單會顯示在這裡。</p>
        {:else}
          {#each data.reportCards as r (r.id)}
            <Card padding={16}>
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:10px;">
                <div>
                  <div style="font-size:15px; font-weight:700; color:var(--df-ink);">{r.courseName}</div>
                  <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">{r.termLabel}</div>
                </div>
                {#if r.rating != null}
                  {@const rating = r.rating}
                  <div style="display:flex; gap:2px; flex:none;" aria-label={`評分 ${rating} / 5`}>
                    {#each STARS as i (i)}
                      <Icon name="star" size={14} color={i <= rating ? 'var(--df-warning)' : 'var(--df-border)'} />
                    {/each}
                  </div>
                {:else}
                  <Badge tone="neutral">尚未評分</Badge>
                {/if}
              </div>
              <p style="margin:0 0 10px; font-size:13.5px; color:var(--df-text-dark); line-height:1.65;">{r.comment ?? '教練尚未留下評語。'}</p>
              <div style="font-size:11.5px; color:var(--df-text-muted); font-family:var(--df-font-mono); border-top:1px solid var(--df-border); padding-top:9px;">
                {r.issuerName} 教練 · {r.createdAt.slice(0, 10)}
              </div>
            </Card>
          {/each}
        {/if}
      {:else}
        {#if data.certificates.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">完成課程或參賽獲獎後，你的證書會顯示在這裡。</p>
        {:else}
          {#each data.certificates as ct (ct.id)}
            <div style="position:relative; background:#fff; border:1px solid var(--df-border); border-radius:16px; padding:16px; box-shadow:var(--df-shadow-card); overflow:hidden;">
              <div style="display:flex; align-items:center; gap:13px;">
                <div style="width:48px; height:48px; border-radius:13px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none;">
                  <Icon name="award" size={24} color="var(--df-primary)" />
                </div>
                <div style="flex:1; min-width:0;">
                  {#if ct.level}<Badge tone="neutral" solid>{ct.level}</Badge>{/if}
                  <div style="font-size:14.5px; font-weight:700; color:var(--df-ink); line-height:1.4; margin-top:4px;">{ct.title}</div>
                  {#if ct.courseName}<div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">{ct.courseName}</div>{/if}
                  <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:4px;">核發日 {ct.issuedOn}</div>
                </div>
              </div>
              {#if ct.note}<p style="margin:10px 0 0; font-size:12.5px; color:var(--df-text-dark); line-height:1.6;">{ct.note}</p>{/if}
            </div>
          {/each}
        {/if}
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>
  {:else if $gate === 'error'}
    <div class="df-scroll" style="padding:16px;">
      <Card padding={0}><ErrorState onRetry={gate.refresh} /></Card>
    </div>
  {:else}
    <div class="df-scroll" data-testid="report-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={16}><Skeleton w="100%" h={90} r={10} /></SkelCard>
      {/each}
    </div>
  {/if}
</PushScreen>
