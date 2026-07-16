<script lang="ts">
  /* 課程資料 — read-only class detail modal. Faithful port of admin.jsx
   * ClassDialog: 分級 + 招生狀態 badges (via StatusBadge) + the mono班級 id, the
   * class name, an 報名人數 progress bar, then a 2-col icon field grid covering
   * 上課時段 / 授課教練 / 教室 / 適合年齡 / 課程類別 / 本期期別 / 開課日期 / 本期堂數 /
   * 平均到課率 / 候補人數 / 補課名額 / 季費. Built on the shared Dialog (matches the
   * source's ADialog, width 480) with a 編輯課程 primary that calls onEdit and a
   * 關閉 secondary that calls onClose. */
  import { Dialog, Icon, ProgressBar } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtNT } from '$lib/format';
  import type { ClassRow } from '$lib/admin/data';
  import type { IconName } from '$lib/icon-registry';

  export let klass: ClassRow | null = null;
  export let onClose: () => void = () => {};
  export let onEdit: (k: ClassRow) => void = () => {};

  $: full = klass ? klass.enrolled >= klass.cap : false;
  $: pct = klass ? Math.round((klass.enrolled / klass.cap) * 100) : 0;

  // [icon, label, value] field grid — mirrors the source row list order + icons.
  $: rows = klass
    ? ([
        ['clock', '上課時段', klass.day + ' · ' + klass.time],
        ['user-round', '授課教練', klass.coach + ' 教練'],
        ['map-pin', '教室 / 場地', klass.room],
        ['cake', '適合年齡', klass.age],
        ['layers', '課程類別', klass.cat],
        ['calendar-range', '本期期別', klass.term],
        ['calendar-plus', '開課日期', klass.startDate],
        ['repeat-2', '本期堂數', klass.sessions + ' 堂'],
        ['percent', '平均到課率', klass.checkinRate + '%'],
        ['user-plus', '候補人數', klass.wait + ' 人'],
        ['history', '補課名額', klass.makeup + ' 位'],
        ['circle-dollar-sign', '季費', fmtNT(klass.price)]
      ] satisfies [IconName, string, string][])
    : [];
</script>

<Dialog
  open={!!klass}
  title="課程資料"
  width={480}
  {onClose}
  primaryAction={klass ? { label: '編輯課程', onClick: () => onEdit(klass) } : null}
  secondaryAction={{ label: '關閉', onClick: onClose }}
>
  {#if klass}
    <div class="badge-row">
      <StatusBadge kind="classLevel" value={klass.level} />
      <StatusBadge kind="classStatus" value={klass.status} />
      <span class="id">{klass.id}</span>
    </div>

    <h3 class="name">{klass.name}</h3>

    <div style="margin-bottom:16px">
      <div class="enroll-head">
        <span style="color:var(--df-text-light)">報名人數</span>
        <span style="font-weight:700;color:{full ? 'var(--df-warning)' : 'var(--df-text-dark)'}"
          >{klass.enrolled} / {klass.cap} 人</span
        >
      </div>
      <ProgressBar value={pct} height={7} tone={full ? 'warning' : 'primary'} />
    </div>

    <div class="grid">
      {#each rows as [ic, label, value]}
        <div class="cell">
          <Icon name={ic} size={16} color="var(--df-primary)" />
          <div>
            <div class="cell-label">{label}</div>
            <div class="cell-value">{value}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Dialog>

<style>
  .badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 0 8px;
  }
  .id {
    font-size: 12px;
    color: var(--df-text-muted);
    font-family: var(--df-font-mono);
  }
  .name {
    margin: 0 0 14px;
    font-family: var(--df-font-heading);
    font-size: 21px;
    font-weight: 800;
    color: var(--df-ink);
  }
  .enroll-head {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 18px;
    border-top: 1px solid var(--df-border);
    padding-top: 16px;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .cell-label {
    font-size: 11.5px;
    color: var(--df-text-muted);
  }
  .cell-value {
    font-size: 14px;
    color: var(--df-text-dark);
    font-weight: 500;
  }
</style>
