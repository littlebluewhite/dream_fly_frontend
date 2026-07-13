<script lang="ts">
  /* 班級卡片 — one class card. Faithful port of admin.jsx ClassCard: a header
   * block (分級 + 招生狀態 badges via StatusBadge, then the班級 name, with a
   * more-horizontal detail button), a body with 教練 / 上課日·時段 / 教室·年齡 rows
   * and an 報名人數 fill bar, then a 季費 / 候補 line, and a footer (學員 secondary +
   * 編輯 primary). Built on the shared Card (matches the source's ACard). The
   * header/body open the detail (onOpen); 學員 fires a roster toast; 編輯 fires
   * onEdit. */
  import { Card, Button, IconButton, Icon, ProgressBar } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtNT } from '$lib/admin/format';
  import { toasts as toastStore } from '$lib/admin/stores';
  import type { ClassRow } from '$lib/admin/data';
  import type { IconName } from '$lib/icon-registry';

  export let k: ClassRow;
  export let onEdit: () => void = () => {};
  export let onOpen: () => void = () => {};

  $: full = k.enrolled >= k.cap;
  $: pct = Math.round((k.enrolled / k.cap) * 100);

  // 教練 / 上課日·時段 / 教室·年齡 — mirrors the source's three icon rows.
  $: rows = [
    ['user', k.coach + ' 教練'],
    ['calendar-days', k.day + ' · ' + k.time],
    ['map-pin', k.room + ' · ' + k.age]
  ] satisfies [IconName, string][];

  function roster() {
    toastStore.notify('info', k.name, '顯示班級學員名單（' + k.enrolled + ' 人）。');
  }
</script>

<Card padding={0} hoverable style="overflow:hidden">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="head">
    <div class="head-main" on:click={onOpen}>
      <div class="badges">
        <StatusBadge kind="classLevel" value={k.level} />
        <StatusBadge kind="classStatus" value={k.status} />
      </div>
      <h3>{k.name}</h3>
    </div>
    <IconButton aria-label="詳情" variant="ghost" on:click={onOpen}>
      <Icon name="more-horizontal" size={18} color="var(--df-text-light)" />
    </IconButton>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="body" on:click={onOpen}>
    {#each rows as [ic, txt]}
      <div class="row"><Icon name={ic} size={15} color="var(--df-text-muted)" />{txt}</div>
    {/each}

    <div style="margin-top:4px">
      <div class="enroll-head">
        <span style="color:var(--df-text-light)">報名人數</span>
        <span style="font-weight:700;color:{full ? 'var(--df-warning)' : 'var(--df-text-dark)'}"
          >{k.enrolled} / {k.cap} 人</span
        >
      </div>
      <ProgressBar value={pct} height={7} tone={full ? 'warning' : 'primary'} />
    </div>

    <div class="meta">
      <span class="price">{fmtNT(k.price)}<span class="per"> / 季</span></span>
      {#if k.wait > 0}<span class="wait">候補 {k.wait} 人</span>{/if}
    </div>
  </div>

  <div class="foot">
    <Button variant="secondary" size="sm" fullWidth on:click={roster}>
      <Icon name="users" size={14} />學員
    </Button>
    <Button variant="primary" size="sm" fullWidth on:click={onEdit}>
      <Icon name="pencil-line" size={14} />編輯
    </Button>
  </div>
</Card>

<style>
  .head {
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--df-border);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .head-main {
    cursor: pointer;
    min-width: 0;
  }
  .badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }
  .head h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
  }
  .body {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 11px;
    cursor: pointer;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 13.5px;
    color: var(--df-text-light);
  }
  .enroll-head {
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    margin-bottom: 6px;
  }
  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-top: 2px;
  }
  .price {
    font-size: 15px;
    font-weight: 800;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
  }
  .per {
    font-size: 12px;
    font-weight: 600;
    color: var(--df-text-muted);
  }
  .wait {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--df-warning);
  }
  .foot {
    display: flex;
    gap: 8px;
    padding: 0 20px 18px;
  }
  /* leading icon beside each footer button label (matches admin.jsx iconLeft) */
  .foot :global(.btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
</style>
