<script lang="ts">
  /* 會員點數 push screen。account.jsx PointsScreen (112)。
   * 深色漸層 hero（自帶返回鍵）→ 兌換好禮 / 點數明細 切換 tab。
   *
   * Task 19：改真後端 —— 兌換品項目錄復用桌面 getPoints()(GET /rewards，Task 14
   * rewards seam，見 $lib/mobile/api.ts getPoints());餘額/明細改讀真
   * `$lib/member/stores` 的 points/pointsLedger(getPoints() 內部已呼叫
   * refreshPoints() 側效水合這兩顆 store，見 member/api.ts 的既有慣例)；兌換動作
   * 改真 `$lib/member/stores` 的 redeemReward()(POST /rewards/{id}/redeem)。
   * mobile 本地(mobile/stores.ts)的 points/redeemReward 不再用於這個畫面 —— 那組
   * 只留給 CartSheet 既有的本地端假結帳流程(P2，見 task-19-report.md 的顧慮)。
   * 一鍵兌換不做桌面版的確認對話框(比照本畫面既有的單點互動慣例)，但補上真正
   * 的 in-flight guard + 錯誤 toast(桌面 /member/points 頁的既有裁決同款：
   * stock===0 顯示「已兌換完畢」，與點數不足分開判斷)。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { toasts } from '$lib/mobile/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getPoints, type PointsData, type Reward } from '$lib/mobile/api';
  import { points, pointsLedger, redeemReward, redeemRewardErrorMessage } from '$lib/member/stores';

  export let onBack: () => void;

  let tab: 'rewards' | 'ledger' = 'rewards';
  const TABS: ['rewards' | 'ledger', string][] = [
    ['rewards', '兌換好禮'],
    ['ledger', '點數明細']
  ];

  let data: PointsData | null = null;
  let redeemingId: string | null = null;
  const gate = createLoadGate({
    fetch: getPoints,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  async function redeem(rw: Reward) {
    if (redeemingId || rw.stock === 0) return;
    if ($points < rw.pointsCost) {
      toasts.notify('warning', '點數不足', `兌換「${rw.name}」需 ${rw.pointsCost} 點，你目前有 ${$points} 點。`);
      return;
    }
    redeemingId = rw.id;
    try {
      await redeemReward(rw.id);
      toasts.notify('success', '兌換成功', `已兌換「${rw.name}」，扣除 ${rw.pointsCost} 點。`);
    } catch (err) {
      toasts.notify('error', '兌換失敗', redeemRewardErrorMessage(err));
    } finally {
      redeemingId = null;
    }
  }
</script>

<PushScreen>
  <div class="m-top-inset" style="flex:none; background:linear-gradient(120deg, #1f2937, var(--df-ink)); color:#fff;">
    <div style="padding:0 14px 8px; display:flex; align-items:center; gap:8px;">
      <button
        aria-label="返回"
        on:click={onBack}
        class="df-tapscale"
        style="width:38px; height:38px; border-radius:11px; border:none; background:rgba(255,255,255,0.16);
          display:flex; align-items:center; justify-content:center; cursor:pointer;"
      >
        <Icon name="chevron-left" size={22} color="#fff" />
      </button>
      <h2 style="margin:0; font-family:var(--df-font-heading); font-size:18px; font-weight:700;">會員點數</h2>
    </div>
    <div style="padding:8px 22px 22px; text-align:center;">
      <div style="font-size:12.5px; opacity:0.8; display:flex; align-items:center; justify-content:center; gap:6px;"><Icon name="star" size={15} color="var(--df-accent)" />目前可用點數</div>
      <div style="font-size:46px; font-weight:800; font-family:var(--df-font-heading); line-height:1.1; margin-top:4px;">{$points.toLocaleString()}</div>
      <div style="font-size:12px; opacity:0.7;">1 點 = NT$1{#if data} · {data.expiring}將於 {data.expiryDate} 到期{/if}</div>
    </div>
  </div>

  <div style="flex:none; display:flex; background:#fff; border-bottom:1px solid var(--df-border); padding:0 14px;">
    {#each TABS as [k, l] (k)}
      <button
        on:click={() => (tab = k)}
        style="flex:1; padding:13px 0; border:none;
          border-bottom:2.5px solid {tab === k ? 'var(--df-primary)' : 'transparent'};
          background:transparent; color:{tab === k ? 'var(--df-primary)' : 'var(--df-text-light)'};
          font-size:14px; font-weight:{tab === k ? 700 : 500}; cursor:pointer;"
      >{l}</button>
    {/each}
  </div>

  {#if $gate === 'ready' && data}
  <div class="df-scroll">
    <div style="padding:16px;">
      {#if tab === 'rewards'}
        {#if data.rewards.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">目前沒有可兌換的獎勵。</p>
        {:else}
        <div style="display:flex; flex-direction:column; gap:12px;">
          {#each data.rewards as r (r.id)}
            {@const soldOut = r.stock === 0}
            {@const can = !soldOut && $points >= r.pointsCost}
            <div style="display:flex; align-items:center; gap:13px; background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:14px; box-shadow:var(--df-shadow-card);">
              <div style="width:50px; height:50px; border-radius:13px; background:var(--df-accent-bg, #FFF8DB); display:flex; align-items:center; justify-content:center; flex:none;">
                <Icon name="ticket" size={25} color="var(--df-accent-dark)" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:14.5px; font-weight:700; color:var(--df-ink);">{r.name}</div>
                {#if r.description}<div style="font-size:12px; color:var(--df-text-light); margin-top:3px; line-height:1.5;">{r.description}</div>{/if}
                <div style="font-size:13px; font-weight:800; color:var(--df-accent-dark); margin-top:6px; font-family:var(--df-font-mono); display:flex; align-items:center; gap:4px;"><Icon name="star" size={13} color="var(--df-accent-dark)" />{r.pointsCost} 點</div>
              </div>
              <button
                disabled={!can || redeemingId === r.id}
                on:click={() => redeem(r)}
                class="df-tapscale"
                style="flex:none; height:34px; padding:0 15px; border-radius:9px; border:none;
                  background:{can ? 'var(--df-primary)' : 'var(--df-bg-light)'};
                  color:{can ? '#fff' : 'var(--df-text-muted)'}; font-size:13px; font-weight:700;
                  cursor:{can ? 'pointer' : 'not-allowed'};"
              >{soldOut ? '已兌換完畢' : redeemingId === r.id ? '兌換中…' : can ? '兌換' : '點數不足'}</button>
            </div>
          {/each}
        </div>
        {/if}
      {:else}
        {#if $pointsLedger.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">目前沒有點數異動紀錄。</p>
        {:else}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; overflow:hidden;">
          {#each $pointsLedger as p, i (p.id)}
            {@const pos = p.delta > 0}
            <div style="display:flex; align-items:center; gap:12px; padding:13px 14px; border-top:{i ? '1px solid var(--df-border)' : 'none'};">
              <div style="flex:1; min-width:0;">
                <div style="font-size:13.5px; font-weight:600; color:var(--df-ink);">{p.desc}</div>
                <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:2px; font-family:var(--df-font-mono);">{p.date}</div>
              </div>
              <div style="font-size:15px; font-weight:800; font-family:var(--df-font-mono); color:{pos ? 'var(--df-success)' : 'var(--df-text-light)'}; flex:none;">{pos ? '+' : ''}{p.delta}</div>
            </div>
          {/each}
        </div>
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
    <div class="df-scroll" data-testid="points-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={14}><Skeleton w="100%" h={64} r={12} /></SkelCard>
      {/each}
    </div>
  {/if}
</PushScreen>
