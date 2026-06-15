<script lang="ts">
  /* 教練卡片 — faithful port of the card rendered inside admin.jsx CoachesView.
   * Header: Avatar (代表色 + online/busy/offline status dot) + 姓名 (＋教練 suffix
   * and a small status label from coach-status) + 職稱 (primary colour) + 專長
   * tag chips, with an edit pencil IconButton. Middle: a 4-up stat grid
   * (年資 / 學員 / 班級 / 獲獎 — source order). Footer: 聯絡 + 課表 buttons.
   *
   * The pencil fires onEdit(coach); 聯絡 / 課表 emit the same info toasts the
   * source does. The status label/colour come from the pure coach-status helper
   * so the inline dot matches the Avatar status dot. */
  import { Avatar, Card, Button, IconButton, Icon, Tag } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';
  import type { Coach } from '$lib/admin/data';
  import { coachStatus } from './coach-status';

  export let coach: Coach;
  export let onEdit: (coach: Coach) => void = () => {};

  $: [statusLabel, statusColor] = coachStatus(coach.status);
  // 年資 / 學員 / 班級 / 獲獎 — matches the source stat-grid order.
  $: stats = [
    [coach.years, '年資'],
    [coach.students, '學員'],
    [coach.classes, '班級'],
    [coach.awards, '獲獎']
  ] as const;

  function contact() {
    toasts.notify('info', coach.name + ' 教練', coach.phone);
  }
  function schedule() {
    toasts.notify('info', '課表', '顯示 ' + coach.name + ' 教練的授課時段。');
  }
</script>

<Card padding={0} hoverable style="overflow:hidden">
  <div class="head">
    <Avatar name={coach.initial} size="lg" color={coach.color} status={coach.status} />
    <div class="meta">
      <div class="name">
        {coach.name} <span class="suffix">教練</span>
        <span class="status">
          <span class="dot" style="background:{statusColor}"></span>{statusLabel}
        </span>
      </div>
      <div class="title">{coach.title}</div>
      <div class="tags">
        {#each coach.tags as t}
          <Tag>{t}</Tag>
        {/each}
      </div>
    </div>
    <IconButton aria-label="編輯教練" variant="ghost" on:click={() => onEdit(coach)}>
      <Icon name="pencil-line" size={17} color="var(--df-text-light)" />
    </IconButton>
  </div>

  <div class="stats">
    {#each stats as [value, label], i}
      <div class="stat" class:divider={i > 0}>
        <div class="stat-value">{value}</div>
        <div class="stat-label">{label}</div>
      </div>
    {/each}
  </div>

  <div class="foot">
    <Button variant="secondary" size="sm" fullWidth on:click={contact}>
      <Icon name="phone" size={14} />聯絡
    </Button>
    <Button variant="secondary" size="sm" fullWidth on:click={schedule}>
      <Icon name="calendar-days" size={14} />課表
    </Button>
  </div>
</Card>

<style>
  .head {
    display: flex;
    gap: 14px;
    padding: 20px 20px 16px;
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 17px;
    font-weight: 700;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .suffix {
    font-size: 13px;
    font-weight: 500;
    color: var(--df-text-muted);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--df-text-light);
  }
  .status .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .title {
    font-size: 12.5px;
    color: var(--df-primary);
    margin-top: 3px;
    line-height: 1.4;
  }
  .tags {
    display: flex;
    gap: 6px;
    margin-top: 9px;
    flex-wrap: wrap;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid var(--df-border);
  }
  .stat {
    padding: 14px 0;
    text-align: center;
  }
  .stat.divider {
    border-left: 1px solid var(--df-border);
  }
  .stat-value {
    font-size: 20px;
    font-weight: 800;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
  }
  .stat-label {
    font-size: 11.5px;
    color: var(--df-text-light);
    margin-top: 1px;
  }
  .foot {
    display: flex;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--df-border);
  }
  /* match the source's button icon+label inline layout */
  .foot :global(button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
</style>
