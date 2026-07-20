<script lang="ts">
  /* 票券管理 push screen。admin2.jsx TicketsScreen (151)。
   * 營收 hero + 票券卡片：icon 方塊 + 名稱/TICKET_TYPE Badge + 說明 + 售價 +
   * 已售/配額 MiniBar + 銷售明細/編輯。
   *
   * C4：讀取側接真——票券清單改由 getTickets()(桌面 admin seam GET /products 的薄委派)
   * 非同步載入，createLoadGate 三態(模板同 ReportsScreen/AdminSettingsScreen)；`tickets`
   * 是 hero 總額與卡片渲染的來源(totalRevenue/totalSold 改為 payload reactive 推導)。
   * GET /products 固定抓第 1 頁(呼叫端不帶 page，吃後端預設 per_page=20，與「更多」樞紐
   * getMore() 同一口徑)——行動版無 PaginationBar，超過一頁如實只顯示第一頁(P2，同
   * getOpsCollections() 附註)。寫入側維持 demo——「新增方案」「編輯」仍只發 toast(無對應
   * 後端端點)。 */
  import { onMount } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import HeaderIcon from '$lib/components/mobile/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ErrorState, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { fmtNT } from '$lib/format';
  import { soldPct } from '$lib/admin/tickets-util'; // F4：quota 0/null → 0，防 NaN/Infinity（重用桌面 admin 既有 helper）
  import { getTickets } from '$lib/mobile-admin/api';
  import { TICKET_TYPE, type Ticket } from '$lib/mobile-admin/data';

  export let onBack: () => void;

  type BadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  let tickets: Ticket[] = [];
  const gate = createLoadGate({
    fetch: getTickets,
    onData: (d) => {
      tickets = d.tickets;
    }
  });
  onMount(() => {
    gate.load();
  });

  $: totalRevenue = tickets.reduce((s, t) => s + t.price * t.sold, 0);
  $: totalSold = tickets.reduce((s, t) => s + t.sold, 0);
</script>

<PushScreen>
  <ScreenHeader {onBack} title="票券管理" sub="方案與銷售概況">
    <HeaderIcon
      slot="right"
      icon="plus"
      label="新增方案"
      onClick={() => toasts.notify('info', '新增票券', '請至電腦版管理後台建立新票券方案。')}
    />
  </ScreenHeader>
  <LoadGate {gate}>
    <div class="df-scroll" data-testid="tickets-skeleton" style="padding:16px; display:flex; flex-direction:column; gap:14px;" slot="loading">
      <SkelCard padding={18}><Skeleton w="100%" h={64} r={12} /></SkelCard>
      {#each [0, 1, 2] as i (i)}
        <SkelCard padding={16}><Skeleton w="100%" h={120} r={12} /></SkelCard>
      {/each}
    </div>

    <div class="df-scroll" style="padding:16px;" slot="error">
      <ErrorState onRetry={gate.refresh} />
    </div>

    <div class="df-scroll">
      <div style="padding:16px; display:flex; flex-direction:column; gap:14px;">
        <div
          style="background:linear-gradient(135deg, var(--df-ink), var(--df-primary-dark));
            border-radius:16px; padding:18px; color:#fff;"
        >
          <div style="font-size:12.5px; opacity:0.82;">票券銷售總額 · 本季</div>
          <div style="font-size:28px; font-weight:800; font-family:var(--df-font-heading); margin-top:4px;">{fmtNT(totalRevenue)}</div>
          <div style="font-size:12.5px; opacity:0.82; margin-top:4px;">共售出 {totalSold} 張票券</div>
        </div>
        {#each tickets as t (t.id)}
          {@const tone = TICKET_TYPE[t.type][0] as BadgeTone}
          {@const label = TICKET_TYPE[t.type][1]}
          {@const quota = t.quota}
          {@const pct = soldPct(t.sold, quota)}
          <div
            style="background:#fff; border:1px solid var(--df-border); border-radius:16px;
              box-shadow:var(--df-shadow-card); padding:16px;"
          >
            <div style="display:flex; align-items:center; gap:12px;">
              <div
                style="width:44px; height:44px; border-radius:12px; background:{t.color};
                  display:flex; align-items:center; justify-content:center; flex:none;"
              >
                <Icon name={t.icon} size={22} color="#fff" />
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:7px;">
                  <span style="font-size:15px; font-weight:700; color:var(--df-ink);">{t.name}</span>
                  <Badge {tone}>{label}</Badge>
                </div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:2px;">{t.desc}</div>
              </div>
              <div style="font-family:var(--df-font-heading); font-size:16px; font-weight:800; color:var(--df-primary); flex:none;">{fmtNT(t.price)}</div>
            </div>
            <div style="margin-top:13px;">
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <span style="color:var(--df-text-light);">已售 {t.sold} / {quota == null ? '不限' : quota} 張</span>
                <span style="font-weight:700; color:var(--df-text-dark);">{pct}%</span>
              </div>
              <MiniBar value={pct} tone={t.color} height={6} />
            </div>
            <div style="display:flex; gap:8px; margin-top:14px; border-top:1px solid var(--df-border); padding-top:13px;">
              <button
                on:click={() => toasts.notify('info', t.name, '已售 ' + t.sold + ' 張 · 營收 ' + fmtNT(t.sold * t.price) + '。')}
                class="df-tapscale"
                style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border);
                  background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer;
                  display:flex; align-items:center; justify-content:center; gap:6px;"
              >
                <Icon name="bar-chart-3" size={15} color="var(--df-primary)" />銷售明細
              </button>
              <button
                on:click={() => toasts.notify('info', t.name, '編輯票券方案（示範）。')}
                class="df-tapscale"
                style="flex:1; height:38px; border-radius:10px; border:none; background:var(--df-primary);
                  color:#fff; font-size:13px; font-weight:700; cursor:pointer;
                  display:flex; align-items:center; justify-content:center; gap:6px;"
              >
                <Icon name="pencil-line" size={15} color="#fff" />編輯
              </button>
            </div>
          </div>
        {/each}
        <div style="height:8px;"></div>
      </div>
    </div>
  </LoadGate>
</PushScreen>
