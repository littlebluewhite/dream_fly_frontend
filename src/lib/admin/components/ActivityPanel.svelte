<script lang="ts">
  /* 最新動態 — activity feed panel (admin.jsx ActivityPanel). Sits in a padding-0
   * Card: PanelHead (activity icon on the right) over the activity items. Each item
   * is an icon chip (background = item.bg, icon colour = item.tone — both are raw
   * CSS colour strings, NOT Tones) beside the text + time.
   *
   * Task F11: data now arrives via props — the page fetches admin/api.ts's
   * getRecentActivity() (GET /reports/admin/activity, integration-contract.md
   * §3.24) and passes the mapped Activity[] in as `activity`; this component no
   * longer imports the (now-retired) admin/data.ts ACTIVITY mock. */
  import { Card, Icon } from '$lib/components/ui';
  import PanelHead from './PanelHead.svelte';
  import type { Activity } from '$lib/admin/data';

  let { activity }: { activity: Activity[] } = $props();
</script>

<Card padding={0} style="overflow:hidden">
  <PanelHead title="最新動態">
    <Icon slot="right" name="activity" size={18} color="var(--df-text-muted)" />
  </PanelHead>
  <div style="padding:8px 22px 16px">
    {#each activity as a, i}
      <div class="row" class:last={i === activity.length - 1}>
        <div class="chip" style="background:{a.bg}">
          <Icon name={a.icon} size={16} color={a.tone} />
        </div>
        <div style="flex:1">
          <div style="font-size:13px;color:var(--df-text-dark);line-height:1.5">{a.text}</div>
          <div style="font-size:11.5px;color:var(--df-text-muted);margin-top:2px">{a.time}</div>
        </div>
      </div>
    {/each}
  </div>
</Card>

<style>
  .row {
    display: flex;
    gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid var(--df-border);
  }
  .row.last {
    border-bottom: none;
  }
  .chip {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
</style>
