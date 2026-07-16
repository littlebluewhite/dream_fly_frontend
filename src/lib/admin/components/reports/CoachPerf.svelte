<script lang="ts">
  /* 教練表現排行 — restored from the archived reports.jsx port (689769a^),
   * re-plumbed for real data (Round 4 P4-F2). `rows` is now GET /reports/admin's
   * coaches[] (AdminReportCoachRow — P4-F1 added revenueCents12m 課程毛額歸因/
   * attendanceRate 全期出席率): the component sorts a copy by 12-month revenue
   * (排行), derives the avatar initial from the name and a cycling palette colour
   * by rank (the archived per-coach colour/initial fields had no data source),
   * formats revenue via fmtNT(ntd()) and 出席率 via fmtPct (null → 「—」). Bar
   * widths go through normalizeBars (相對最大值 0–100) — all-zero revenue renders
   * zero-width bars, never NaN. */
  import { Card } from '$lib/components/ui';
  import type { AdminReportCoachRow } from '$lib/admin/api';
  import { ntd } from '$lib/public/adapters';
  import { fmtNT } from '$lib/format';
  import { fmtPct } from '$lib/admin/format';
  import { coachPerfVM } from '$lib/admin/report-math';

  let { rows }: { rows: AdminReportCoachRow[] } = $props();

  /* 開放集合(教練人數不定)的循環色盤 — 純呈現層,沿用歸檔 mock 的既定色系。 */
  const PALETTE = ['var(--df-primary)', '#0EA5E9', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];

  const vm = $derived(coachPerfVM(rows));
  const ranked = $derived(vm.ranked);
  const widths = $derived(vm.widths);
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      教練表現排行
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">近 12 個月課程營收 · 學員數 · 出席率</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:13px;">
    {#each ranked as c, i (c.id)}
      <div style="display:flex; align-items:center; gap:13px;">
        <div class="avatar" style="background:{PALETTE[i % PALETTE.length]};">
          {c.name.charAt(0) || '?'}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark);">
              {c.name}
              <span style="font-size:11.5px; color:var(--df-text-muted);">
                · {c.studentCount} 位 · 出席 {fmtPct(c.attendanceRate)}
              </span>
            </span>
            <span
              style="font-size:13px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-mono);"
            >
              {fmtNT(ntd(c.revenueCents12m))}
            </span>
          </div>
          <div class="track">
            <div
              style="height:100%; width:{widths[i]}%; border-radius:4px; background:{PALETTE[
                i % PALETTE.length
              ]};"
            ></div>
          </div>
        </div>
      </div>
    {/each}
    {#if rows.length === 0}
      <div class="empty">尚無教練資料</div>
    {/if}
  </div>
</Card>

<style>
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    font-family: var(--df-font-heading);
    flex: none;
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: #eef2f6;
    overflow: hidden;
  }
  .empty {
    padding: 24px 0;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 13px;
  }
</style>
