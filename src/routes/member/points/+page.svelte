<script lang="ts">
  /* 會員點數 (Points) — points balance hero + ledger on the left, reward
   * redemption on the right. Ported from the prototype's PointsView /
   * PointsSkeleton (client/views2.jsx). Data + primitives come from the shared
   * foundation; the live balance lives in the `points`/`pointsLedger` store,
   * hydrated from the real backend (see stores.ts refreshPoints).
   *
   * Task 14（integration-contract.md §3.23）：兌換品項清單來自 GET /rewards
   * （member/api.ts 的 getPoints()）；兌換動作打 POST /rewards/{id}/redeem
   * （member/stores.ts 的 redeemReward()），成功後整包 hydrate points/
   * pointsLedger（不做本地扣減）。沒有「兌換紀錄」專區——GET /rewards/
   * redemptions/me 未接：本頁的「點數明細」（左側 pointsLedger）本來就會在
   * refreshPoints() 後含入這筆 reason="redeem" 的扣點紀錄，不需要另一張表。 */
  import { onMount } from 'svelte';
  import { Card, Badge, Button, Dialog, Icon, Skeleton, SkelCard, ErrorState, LoadGate } from '$lib/components/ui';
  import { PT_TYPE } from '$lib/member/data';
  import { points, pointsLedger, toasts, redeemReward, redeemRewardErrorMessage } from '$lib/member/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getPoints, type PointsData, type Reward } from '$lib/member/api';

  let confirm: Reward | null = null;
  let redeeming = false;
  let data: PointsData | null = null;

  // 「本月累積」動態取當下月份（與 pointsLedger 的 date 同為補零 YYYY/MM/DD 格式，
  // 見 stores.ts 的 refreshPoints）——寫死月份會讓這個統計在真實資料下永遠是 0。
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  $: earnedThisMonth = $pointsLedger
    .filter((l) => l.date.startsWith(thisMonthPrefix) && l.delta > 0)
    .reduce((s, l) => s + l.delta, 0);

  const gate = createLoadGate({
    fetch: getPoints,
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  function redeem(rw: Reward) {
    if (redeeming || rw.stock === 0) return; // 售罄/兌換中——按鈕本身也停用，這裡是防禦性的雙重把關
    if ($points < rw.pointsCost) {
      toasts.notify('warning', '點數不足', `兌換「${rw.name}」需 ${rw.pointsCost} 點，你目前有 ${$points} 點。`);
      return;
    }
    confirm = rw;
  }

  // 送出兌換——比照 LeaveDialog/MakeupDialog 的 in-flight guard 慣例：submitting
  // 旗標於 await 前同步設定，擋掉重複點擊；失敗時不清空 confirm(對話框留著讓使用
  // 者可重試或手動取消，同 leave/makeup 對話框對錯誤的處理方式)。
  async function doRedeem() {
    if (!confirm || redeeming) return;
    const rw = confirm;
    redeeming = true;
    try {
      await redeemReward(rw.id); // 成功後內部已呼叫 refreshPoints() 整包 hydrate，這裡不做本地扣減
      toasts.notify('success', '兌換成功', `已兌換「${rw.name}」，扣除 ${rw.pointsCost} 點。`);
      confirm = null;
    } catch (err) {
      toasts.notify('error', '兌換失敗', redeemRewardErrorMessage(err));
    } finally {
      redeeming = false;
    }
  }
</script>

<LoadGate {gate}>
  <div class="df-view" data-testid="points-skeleton" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start" slot="loading">
    <div style="display:flex;flex-direction:column;gap:18px">
      <SkelCard>
        <Skeleton w={120} h={14} />
        <Skeleton w={160} h={40} style="margin:14px 0 8px" />
        <Skeleton w="60%" h={11} />
      </SkelCard>
      <SkelCard padding={0}>
        {#each [0, 1, 2, 3] as i (i)}
          <div style="display:flex;justify-content:space-between;padding:15px 22px;{i < 3 ? 'border-bottom:1px solid var(--df-border)' : ''}">
            <Skeleton w="50%" h={12} />
            <Skeleton w={50} h={12} />
          </div>
        {/each}
      </SkelCard>
    </div>
    <SkelCard>
      <Skeleton w={120} h={14} style="margin-bottom:16px" />
      {#each [0, 1, 2] as i (i)}
        <Skeleton w="100%" h={64} r={12} style="margin-bottom:12px" />
      {/each}
    </SkelCard>
  </div>

  {#if data}
  <div class="df-view" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
    <!-- Left: balance hero + ledger -->
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="background:linear-gradient(120deg, var(--df-ink) 0%, #1e293b 100%);border-radius:16px;padding:26px 28px;color:#fff;position:relative;overflow:hidden">
        <Icon name="star" size={120} color="#FFD70022" style="position:absolute;right:-18px;top:-18px" />
        <div style="display:flex;align-items:center;gap:8px;font-size:13.5px;opacity:0.85">
          <Icon name="star" size={16} color="var(--df-accent)" />可用會員點數
        </div>
        <div style="font-family:var(--df-font-heading);font-size:48px;font-weight:800;letter-spacing:-1px;margin:6px 0 2px">
          {$points.toLocaleString()}<span style="font-size:18px;font-weight:600;opacity:0.7;margin-left:6px">點</span>
        </div>
        <div style="display:flex;gap:18px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.15);font-size:12.5px">
          <div>
            <div style="opacity:0.7">本月累積</div>
            <div style="font-size:17px;font-weight:700;font-family:var(--df-font-heading);margin-top:2px">+{earnedThisMonth}</div>
          </div>
          <div>
            <div style="opacity:0.7">即將到期</div>
            <div style="font-size:17px;font-weight:700;font-family:var(--df-font-heading);margin-top:2px;color:var(--df-accent)">{data.expiring}</div>
          </div>
          <div>
            <div style="opacity:0.7">到期日</div>
            <div style="font-size:17px;font-weight:700;font-family:var(--df-font-heading);margin-top:2px">{data.expiryDate}</div>
          </div>
        </div>
      </div>
      <Card padding={0} style="overflow:hidden">
        <div style="padding:16px 22px;border-bottom:1px solid var(--df-border)">
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">點數明細</h3>
        </div>
        <div style="padding:2px 22px 8px">
          {#each $pointsLedger as l, i (l.id)}
            {@const [tone, lab] = PT_TYPE[l.type]}
            <div style="display:flex;align-items:center;gap:12px;padding:14px 0;{i < $pointsLedger.length - 1 ? 'border-bottom:1px solid var(--df-border)' : ''}">
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{l.desc}</div>
                <div style="font-size:12px;color:var(--df-text-muted);margin-top:2px;font-family:var(--df-font-mono)">{l.date}</div>
              </div>
              <Badge {tone}>{lab}</Badge>
              <div style="width:70px;text-align:right;font-family:var(--df-font-mono);font-weight:700;font-size:14.5px;color:{l.delta > 0 ? 'var(--df-success)' : 'var(--df-text-light)'}">{l.delta > 0 ? '+' : ''}{l.delta}</div>
            </div>
          {/each}
        </div>
      </Card>
    </div>

    <!-- Right: reward redemption -->
    <Card padding={0} style="overflow:hidden">
      <div style="padding:16px 22px;border-bottom:1px solid var(--df-border);display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">點數兌換</h3>
        <span style="font-size:12.5px;color:var(--df-text-light)">1 點 = NT$1 折抵</span>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:12px">
        {#each data.rewards as rw (rw.id)}
          {@const soldOut = rw.stock === 0}
          {@const afford = $points >= rw.pointsCost}
          <div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:12px;border:1px solid var(--df-border);background:#fff">
            <div style="width:46px;height:46px;border-radius:12px;background:var(--df-accent-bg, #FFF8DB);display:flex;align-items:center;justify-content:center;flex:none">
              <Icon name="ticket" size={23} color="var(--df-accent-dark)" />
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:7px">
                <span style="font-size:14.5px;font-weight:700;color:var(--df-ink)">{rw.name}</span>
              </div>
              <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px;line-height:1.5">{rw.description ?? ''}</div>
            </div>
            <div style="text-align:right;flex:none">
              <div style="font-family:var(--df-font-heading);font-size:18px;font-weight:800;color:var(--df-ink)">{rw.pointsCost}<span style="font-size:12px;font-weight:600;color:var(--df-text-light);margin-left:2px">點</span></div>
              <Button
                size="sm"
                variant={!soldOut && afford ? 'primary' : 'secondary'}
                disabled={soldOut || !afford || redeeming}
                style="margin-top:7px"
                on:click={() => redeem(rw)}
              >{soldOut ? '已兌換完畢' : afford ? '兌換' : '點數不足'}</Button>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </div>
  {/if}

  <div class="df-view" slot="error"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
</LoadGate>

<Dialog
  open={!!confirm}
  title="確認兌換"
  onClose={() => (confirm = null)}
  primaryAction={{ label: redeeming ? '兌換中…' : '確認兌換', onClick: doRedeem, disabled: redeeming }}
  secondaryAction={{ label: '取消', onClick: () => (confirm = null) }}
>
  {#if confirm}
    <span>確定要使用 <b style="color:var(--df-ink)">{confirm.pointsCost} 點</b> 兌換「{confirm.name}」嗎？兌換後將從會員點數中扣除，餘額為 {($points - confirm.pointsCost).toLocaleString()} 點。</span>
  {/if}
</Dialog>
