<script lang="ts">
  /* 出勤狀態分段選擇器 — 4 個小藥丸按鈕；active 填色 + 白字，其餘白底 + 細邊框。
   * Props:
   *   value    — 目前選中的狀態 (AttDefault)
   *   onChange — 點擊時回傳新值 */
  import type { AttDefault } from '$lib/coach/data';

  export let value: AttDefault;
  export let onChange: (v: AttDefault) => void;

  const SEG: Array<{ key: AttDefault; label: string; color: string }> = [
    { key: 'present', label: '出席', color: 'var(--df-success)' },
    { key: 'late',    label: '遲到', color: 'var(--df-warning)' },
    { key: 'leave',   label: '請假', color: 'var(--df-info)' },
    { key: 'absent',  label: '缺席', color: 'var(--df-error)' },
  ];
</script>

<div style="display:inline-flex;gap:4px;flex-wrap:nowrap;">
  {#each SEG as seg}
    <button
      type="button"
      on:click={() => onChange(seg.key)}
      style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 11px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 600;
        font-family: var(--df-font-body);
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
        border: 1.5px solid {value === seg.key ? seg.color : 'var(--df-border)'};
        background: {value === seg.key ? seg.color : '#fff'};
        color: {value === seg.key ? '#fff' : 'var(--df-text-light)'};
        white-space: nowrap;
      "
    >{seg.label}</button>
  {/each}
</div>
