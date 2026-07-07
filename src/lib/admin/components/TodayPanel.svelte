<script lang="ts">
  /* 今日課表 — today's schedule panel (admin.jsx TodayPanel). Sits in a padding-0
   * Card: PanelHead (calendar icon on the right) over the TODAY rows. Each row is
   * time (mono) · name + coach·room·count meta · a status Badge carrying the row's
   * own tone+label. Reads the shared TODAY directly; `sub` is overridable (the
   * dashboard passes "全館 5 堂課").
   *
   * P2: TODAY is still a live mock seed (admin/data.ts) — no backend today-schedule
   * endpoint exists yet, see docs/adr/0006. */
  import { Card, Badge, Icon } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import { TODAY } from '$lib/admin/data';

  export let sub = '全館 5 堂課';
</script>

<Card padding={0} style="overflow:hidden">
  <PanelHead title="今日課表" {sub}>
    <Icon slot="right" name="calendar-days" size={18} color="var(--df-text-muted)" />
  </PanelHead>
  <div style="padding:6px 22px 14px">
    {#each TODAY as t, i}
      <div class="df-rowhover row" class:last={i === TODAY.length - 1}>
        <div class="time">{t.time}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{t.name}</div>
          <div style="font-size:12px;color:var(--df-text-light)">
            {t.coach} 教練 · {t.room} · {t.count} 人
          </div>
        </div>
        <Badge tone={t.tone} dot>{t.label}</Badge>
      </div>
    {/each}
  </div>
</Card>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 12px 0;
    border-bottom: 1px solid var(--df-border);
  }
  .row.last {
    border-bottom: none;
  }
  .time {
    font-family: var(--df-font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--df-ink);
    width: 46px;
  }
</style>
