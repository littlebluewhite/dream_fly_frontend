<script lang="ts">
  /* 票券管理 push screen。admin2.jsx TicketsScreen (151)。
   * 營收 hero + TICKETS 卡片：icon 方塊 + 名稱/TICKET_TYPE Badge + 說明 + 售價 +
   * 已售/配額 MiniBar + 銷售明細/編輯。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile-admin/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile-admin/components/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { TICKETS, TICKET_TYPE, fmtNT } from '$lib/mobile-admin/data';

  export let onBack: () => void;

  type BadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  const totalRevenue = TICKETS.reduce((s, t) => s + t.price * t.sold, 0);
  const totalSold = TICKETS.reduce((s, t) => s + t.sold, 0);
</script>

<PushScreen>
  <ScreenHeader {onBack} title="票券管理" sub="方案與銷售概況">
    <HeaderIcon
      slot="right"
      icon="plus"
      label="新增方案"
      onClick={() => toasts.notify('success', '新增票券', '已開啟票券方案建立表單。')}
    />
  </ScreenHeader>
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
      {#each TICKETS as t (t.id)}
        {@const tone = TICKET_TYPE[t.type][0] as BadgeTone}
        {@const label = TICKET_TYPE[t.type][1]}
        {@const pct = Math.round((t.sold / t.quota) * 100)}
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
              <span style="color:var(--df-text-light);">已售 {t.sold} / {t.quota} 張</span>
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
</PushScreen>
