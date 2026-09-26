<script lang="ts">
  /* 管理員 · 訂單與金流。admin.jsx OrdersScreen (287)。
   * 清單由 $orders store 提供;tap → sheet('order',{o})。
   *
   * 資料改由 hydrateOps()(mock-API 接縫)非同步水合 $orders store,三態閘門
   * (loading/error/ready);hydrated 守衛防止第二次進頁的 fetch 覆寫 markOrderPaid
   * 等 mutation,refreshOps() 供 ErrorState 重試(不受守衛短路)。
   *
   * Round 2 C3:計數/已收/篩選改共用桌面 orders-filter.ts 純函式(countByStatus/
   * filterOrders)——OrderRow 結構同桌面 Order,structural typing 直接相容;本頁
   * chips 只消費 7 桶計數中的 4 桶。R13 Task 5(C4):已收改用 order-status.ts 的
   * revenueTotal(按 isRevenueStatus 加總),文案「本月已收」改「本頁已收」——本頁
   * 只抓第 1 頁,數字只反映已載入的這一頁。
   *
   * R12:header 顯示後端 total(只抓第 1 頁)，超過一頁時搜尋區提示搜尋範圍。 */
  import { onMount } from 'svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import SearchField from '$lib/mobile-admin/components/SearchField.svelte';
  import FilterChips from '$lib/mobile-admin/components/FilterChips.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import { overlay, adminUnreadCount, orders, hydrateOps, refreshOps, openAdminNotif, opsPages, searchCapHint } from '$lib/mobile-admin/stores';
  import { fmtNT } from '$lib/format';
  import { orderStatusBadge } from '$lib/api/wire';
  import { createLoadGate } from '$lib/load-gate';
  import { countByStatus, filterOrders, type OrderStatusFilter } from '$lib/admin/components/orders-filter';
  import { revenueTotal } from '$lib/admin/components/order-status';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  const gate = createLoadGate({
    fetch: hydrateOps,
    refresh: refreshOps
  });
  onMount(() => {
    gate.load();
  });

  let tab: OrderStatusFilter = 'all';
  let q = '';

  $: counts = countByStatus($orders);
  $: revenue = revenueTotal($orders);
  $: chips = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'paid', label: '已付款', count: counts.paid },
    { key: 'pending', label: '待付款', count: counts.pending },
    { key: 'refunded', label: '已退款', count: counts.refunded }
  ];

  $: rows = filterOrders($orders, { status: tab, query: q });
  $: capHint = searchCapHint($opsPages.orders);
</script>

<LoadGate {gate}>
  <div class="df-scroll df-view" data-testid="orders-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;" slot="loading">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
      <SkelCard><Skeleton w="100%" h={70} r={14} /></SkelCard>
      <SkelCard><Skeleton w="100%" h={70} r={14} /></SkelCard>
    </div>
    {#each [0, 1, 2] as i (i)}
      <SkelCard><Skeleton w="100%" h={80} r={14} /></SkelCard>
    {/each}
  </div>

  <ScreenHeader title="訂單與金流" sub={'共 ' + $opsPages.orders.total + ' 筆報名繳費紀錄'}>
    <div slot="right">
      <HeaderIcon icon="bell" badge={$adminUnreadCount} label="通知" onClick={openAdminNotif} />
    </div>
  </ScreenHeader>

  <div style="flex:none; background:#fff; padding:0 14px 12px; border-bottom:1px solid var(--df-border); display:flex; flex-direction:column; gap:11px;">
    <SearchField value={q} onChange={(v) => (q = v)} placeholder="搜尋訂單編號、學員…" />
    {#if capHint}<div style="font-size:11.5px; color:var(--df-text-muted); margin-top:-4px;">{capHint}</div>{/if}
    <FilterChips items={chips} value={tab} onChange={(k) => (tab = k as OrderStatusFilter)} />
  </div>

  <div class="df-scroll df-view">
    <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:11px;">
        <div style="background:linear-gradient(135deg, var(--df-success-bg), #fff); border:1px solid var(--df-success); border-radius:14px; padding:14px;">
          <div style="font-size:12px; color:var(--df-text-light);">本頁已收</div>
          <div style="font-size:22px; font-weight:800; color:var(--df-success); font-family:var(--df-font-heading); margin-top:4px;">{fmtNT(revenue)}</div>
        </div>
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:14px; box-shadow:var(--df-shadow-card);">
          <div style="font-size:12px; color:var(--df-text-light);">待付款</div>
          <div style="font-size:22px; font-weight:800; color:var(--df-warning); font-family:var(--df-font-heading); margin-top:4px;">{counts.pending} 筆</div>
        </div>
      </div>

      {#if rows.length === 0}
        <MEmpty icon="search-x" title="找不到符合的訂單" />
      {:else}
        <div style="display:flex; flex-direction:column; gap:10px;">
          {#each rows as o (o.id)}
            {@const st = orderStatusBadge(o.status)}
            <button
              on:click={() => overlay.sheet('order', { o })}
              class="df-tapscale"
              style="display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; border:1px solid var(--df-border);
                background:#fff; box-shadow:var(--df-shadow-card); cursor:pointer; text-align:left; width:100%;"
            >
              <Avatar name={o.initial} size="sm" color={o.color} />
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:7px;">
                  <span style="font-family:var(--df-font-mono); font-size:12.5px; font-weight:700; color:var(--df-primary);">{o.id}</span>
                  <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">{o.member}</span>
                </div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{o.item}</div>
              </div>
              <div style="text-align:right; flex:none;">
                <div style="font-family:var(--df-font-mono); font-size:14px; font-weight:800; color:var(--df-text-dark);">{fmtNT(o.amount)}</div>
                <div style="margin-top:5px;"><Badge tone={st[0] as Tone} dot>{st[1]}</Badge></div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>
</LoadGate>
