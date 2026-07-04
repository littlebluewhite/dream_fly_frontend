<script lang="ts">
  /* 會員點數 (Points) — points balance hero + ledger on the left, reward
   * redemption on the right. Ported from the prototype's PointsView /
   * PointsSkeleton (client/views2.jsx). Data + primitives come from the shared
   * foundation; the live balance lives in the `points` store so redemptions
   * persist across routes (mock-only, resets on reload). */
  import { onMount } from 'svelte';
  import { Card, Badge, Button, Dialog, Icon, Skeleton, SkelCard, ErrorState } from '$lib/components/ui';
  import { PT_TYPE, type Reward } from '$lib/member/data';
  import { points, pointsLedger, toasts } from '$lib/member/stores';
  import { getPoints, type PointsData } from '$lib/member/api';

  let confirm: Reward | null = null;
  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: PointsData | null = null;

  // 「本月累積」動態取當下月份（與 pointsLedger 的 date 同為補零 YYYY/MM/DD 格式，
  // 見 stores.ts 的 refreshPoints）——寫死月份會讓這個統計在真實資料下永遠是 0。
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  $: earnedThisMonth = $pointsLedger
    .filter((l) => l.date.startsWith(thisMonthPrefix) && l.delta > 0)
    .reduce((s, l) => s + l.delta, 0);

  function load() {
    phase = 'loading';
    getPoints()
      .then((d) => { data = d; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  function redeem(rw: Reward) {
    if ($points < rw.cost) {
      toasts.notify('warning', '點數不足', `兌換「${rw.name}」需 ${rw.cost} 點，你目前有 ${$points} 點。`);
      return;
    }
    confirm = rw;
  }
  function doRedeem() {
    if (!confirm) return;
    const rw = confirm;
    points.update((p) => p - rw.cost);
    pointsLedger.update((p) => [
      { id: 'rw' + p.length + '-' + rw.id, date: '2026/06/10', desc: '兌換 · ' + rw.name, type: 'redeem', delta: -rw.cost },
      ...p
    ]);
    toasts.notify('success', '兌換成功', `已兌換「${rw.name}」，扣除 ${rw.cost} 點。`);
    confirm = null;
  }
</script>

{#if phase === 'ready' && data}
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
          {@const afford = $points >= rw.cost}
          <div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:12px;border:1px solid var(--df-border);background:#fff">
            <div style="width:46px;height:46px;border-radius:12px;background:var(--df-accent-bg, #FFF8DB);display:flex;align-items:center;justify-content:center;flex:none">
              <Icon name={rw.icon} size={23} color="var(--df-accent-dark)" />
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:7px">
                <span style="font-size:14.5px;font-weight:700;color:var(--df-ink)">{rw.name}</span>
                {#if rw.tag}<Badge tone="accent" solid>{rw.tag}</Badge>{/if}
              </div>
              <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px;line-height:1.5">{rw.desc}</div>
            </div>
            <div style="text-align:right;flex:none">
              <div style="font-family:var(--df-font-heading);font-size:18px;font-weight:800;color:var(--df-ink)">{rw.cost}<span style="font-size:12px;font-weight:600;color:var(--df-text-light);margin-left:2px">點</span></div>
              <Button size="sm" variant={afford ? 'primary' : 'secondary'} disabled={!afford} style="margin-top:7px" on:click={() => redeem(rw)}>{afford ? '兌換' : '點數不足'}</Button>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </div>
{:else if phase === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={load} /></Card></div>
{:else}
  <div class="df-view" data-testid="points-skeleton" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
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
{/if}

<Dialog
  open={!!confirm}
  title="確認兌換"
  onClose={() => (confirm = null)}
  primaryAction={{ label: '確認兌換', onClick: doRedeem }}
  secondaryAction={{ label: '取消', onClick: () => (confirm = null) }}
>
  {#if confirm}
    <span>確定要使用 <b style="color:var(--df-ink)">{confirm.cost} 點</b> 兌換「{confirm.name}」嗎？兌換後將從會員點數中扣除，餘額為 {($points - confirm.cost).toLocaleString()} 點。</span>
  {/if}
</Dialog>
