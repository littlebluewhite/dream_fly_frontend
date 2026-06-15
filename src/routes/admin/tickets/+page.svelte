<script lang="ts">
  /* 票券管理 — faithful port of reports.jsx TicketsView. PageHead + a 3-up KPI
   * row (已售票券 / 票券營收 / 販售方案), then a card grid over TICKETS: an icon
   * chip (tinted with the ticket colour) + name + desc + price + type
   * StatusBadge, the 已售/配額 line with a ProgressBar (warning once ≥80% sold),
   * and the 銷售明細/編輯 actions (mock — they fire a toast). */
  import { Button, Card, Icon, ProgressBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatCard from '$lib/admin/components/StatCard.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import { toasts } from '$lib/admin/stores';
  import { TICKETS } from '$lib/admin/data';
  import { fmtNT } from '$lib/admin/format';
  import { soldPct, ticketTone } from '$lib/admin/tickets-util';

  const notify = toasts.notify;

  const totalSold = TICKETS.reduce((s, t) => s + t.sold, 0);
  const revenue = TICKETS.reduce((s, t) => s + t.sold * t.price, 0);
</script>

<div style="display:flex; flex-direction:column; gap:20px;">
  <PageHead title="票券管理" sub="月票、體驗券與活動票券">
    <svelte:fragment slot="actions">
      <Button
        variant="primary"
        size="sm"
        on:click={() => notify('success', '新增票券', '已開啟票券建立表單。')}
      >
        <Icon name="plus" size={15} style="margin-right:6px;" />新增票券
      </Button>
    </svelte:fragment>
  </PageHead>

  <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px;">
    <StatCard icon="ticket" label="已售票券" value={totalSold + ' 張'} tint="#8B5CF614" color="#8B5CF6" />
    <StatCard
      icon="circle-dollar-sign"
      label="票券營收"
      value={fmtNT(revenue)}
      tint="var(--df-success-bg)"
      color="var(--df-success)"
    />
    <StatCard
      icon="layers"
      label="販售方案"
      value={TICKETS.length + ' 種'}
      tint="var(--df-primary-bg)"
      color="var(--df-primary)"
    />
  </div>

  <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:16px;">
    {#each TICKETS as t (t.id)}
      {@const pct = soldPct(t.sold, t.quota)}
      <Card padding={0} hoverable style="overflow:hidden;">
        <div style="display:flex; align-items:flex-start; gap:14px; padding:18px 20px 16px;">
          <div
            style="width:46px; height:46px; border-radius:11px; background:color-mix(in srgb, {t.color} 10%, transparent); display:flex; align-items:center; justify-content:center; flex:none;"
          >
            <Icon name={t.icon} size={22} color={t.color} />
          </div>
          <div style="flex:1; min-width:0;">
            <h3
              style="margin:0; font-size:16px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);"
            >
              {t.name}
            </h3>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-top:4px;">{t.desc}</div>
          </div>
          <div
            style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:none;"
          >
            <div
              style="font-size:18px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-mono); white-space:nowrap;"
            >
              {fmtNT(t.price)}
            </div>
            <StatusBadge kind="ticket" value={t.type} />
          </div>
        </div>

        <div style="padding:0 20px 16px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:6px;">
            <span style="color:var(--df-text-light);">已售 / 配額</span>
            <span style="font-weight:700; color:var(--df-text-dark); white-space:nowrap;"
              >{t.sold} / {t.quota} 張</span
            >
          </div>
          <ProgressBar value={t.sold} max={t.quota} height={7} tone={ticketTone(pct)} />
        </div>

        <div
          style="display:flex; gap:8px; padding:14px 20px 18px; border-top:1px solid var(--df-border);"
        >
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            on:click={() =>
              notify('info', t.name, '已售 ' + t.sold + ' 張 · 營收 ' + fmtNT(t.sold * t.price) + '。')}
          >
            <Icon name="bar-chart-3" size={14} style="margin-right:6px;" />銷售明細
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            on:click={() => notify('info', t.name, '編輯票券方案（示範）。')}
          >
            <Icon name="pencil-line" size={14} style="margin-right:6px;" />編輯
          </Button>
        </div>
      </Card>
    {/each}
  </div>
</div>
