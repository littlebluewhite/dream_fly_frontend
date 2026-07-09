<script lang="ts">
  /* 今日課表 — today's schedule panel (admin.jsx TodayPanel). Sits in a padding-0
   * Card: PanelHead (calendar icon on the right) over the today session rows. Each
   * row is time (mono) · name + coach·room·count meta · a status Badge carrying the
   * row's own tone+label. `sub` is overridable (the dashboard passes "全館 N 堂課").
   *
   * Task F11: data now arrives via props — the page fetches admin/api.ts's
   * getTodaySessions() (GET /sessions/today admin 分支, integration-contract.md
   * §3.18) and passes the mapped TodayClass[] in as `sessions`; this component no
   * longer imports the (now-retired) admin/data.ts TODAY mock. */
  import { Card, Badge, Icon } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import type { TodayClass } from '$lib/admin/data';

  let { sub = '全館 5 堂課', sessions }: { sub?: string; sessions: TodayClass[] } = $props();
</script>

<Card padding={0} style="overflow:hidden">
  <PanelHead title="今日課表" {sub}>
    <Icon slot="right" name="calendar-days" size={18} color="var(--df-text-muted)" />
  </PanelHead>
  <div style="padding:6px 22px 14px">
    {#each sessions as t, i}
      <div class="df-rowhover row" class:last={i === sessions.length - 1}>
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
