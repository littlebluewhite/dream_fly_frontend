<script lang="ts">
  /* 我的訂單 push screen。account.jsx OrdersScreen (179)。
   * ScreenHeader（自帶返回）→ 訂單清單，狀態 Badge（status[0] tone / status[1] 標籤）。
   *
   * Task 19：改真後端 —— 復用桌面 getAccount().orders(GET /orders/me，見
   * $lib/mobile/api.ts getAccount())，取代 mock ORDERS 常數。帳戶頁的「我的
   * 訂單 N 筆」摘要也是同一支接縫的結果，兩處不會再各自顯示不同的訂單資料。
   * onMount 進三態閘門(loading/error/ready)，同其餘 route 頁的既有慣例。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { ErrorState, Skeleton, SkelCard } from '$lib/components/ui';
  import { fmtNT } from '$lib/mobile/data';
  import { getAccount, type MobileAccountData } from '$lib/mobile/api';
  import type { ComponentProps } from 'svelte';

  export let onBack: () => void;

  type BadgeTone = ComponentProps<Badge>['tone'];

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let data: MobileAccountData | null = null;

  function load() {
    phase = 'loading';
    getAccount()
      .then((d) => { data = d; phase = 'ready'; })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  $: orders = data?.orders ?? [];
</script>

<PushScreen>
  <ScreenHeader {onBack} title="我的訂單" sub={phase === 'ready' ? orders.length + ' 筆報名紀錄' : ''} />
  {#if phase === 'ready'}
    <div class="df-scroll">
      <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
        {#if orders.length === 0}
          <p style="text-align:center; font-size:13px; color:var(--df-text-light); padding:24px 0;">目前沒有任何訂單紀錄。</p>
        {:else}
          {#each orders as o (o.id)}
            <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:15px; box-shadow:var(--df-shadow-card);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <span style="font-size:12.5px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{o.id}</span>
                <Badge tone={o.status[0] as BadgeTone} dot>{o.status[1]}</Badge>
              </div>
              <div style="font-size:14.5px; font-weight:600; color:var(--df-ink); margin-bottom:10px;">{o.item}</div>
              <div style="display:flex; align-items:center; justify-content:space-between; padding-top:11px; border-top:1px solid var(--df-border);">
                <span style="font-size:12px; color:var(--df-text-light); display:flex; align-items:center; gap:5px;"><Icon name="calendar" size={13} color="var(--df-text-muted)" />{o.date}</span>
                <span style="font-size:16px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{fmtNT(o.amount)}</span>
              </div>
            </div>
          {/each}
        {/if}
        <div style="height:8px;"></div>
      </div>
    </div>
  {:else if phase === 'error'}
    <div class="df-scroll" style="padding:16px;">
      <Card padding={0}><ErrorState onRetry={load} /></Card>
    </div>
  {:else}
    <div class="df-scroll" data-testid="orders-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={15}><Skeleton w="100%" h={80} r={10} /></SkelCard>
      {/each}
    </div>
  {/if}
</PushScreen>
