<script lang="ts">
  /* 試上洽詢 → 報名 轉換漏斗 — restored from the archived reports.jsx port
   * (689769a^), re-plumbed for real data (Round 4 P4-F2). The archived 4 段
   * (預約體驗/完成體驗/正式報名/季末續報) shrinks to the HONEST 2 段 the backend
   * can attest (契約 §3.24 funnel, 近 90 studio 天): trial_inquiries
   * (inquiry_type='trial' 洽詢) → new_enrolments (created 報名,不含 cancelled) —
   * the middle stages had no data source and are dropped, so the prop is the
   * AdminFunnel pair, not a stage array. 轉化率 = newEnrolments/trialInquiries via
   * fmtPct (洽詢 0 → null → 「—」; 報名可能非全來自試上,>100% 如實顯示). Bar
   * widths go through normalizeBars (相對較大段 0–100; 全 0 → 全 0, never NaN). */
  import { Card } from '$lib/components/ui';
  import type { AdminFunnel } from '$lib/admin/api';
  import { fmtPct } from '$lib/admin/format';
  import { normalizeBars } from '$lib/admin/report-math';

  let { funnel }: { funnel: AdminFunnel } = $props();

  const widths = $derived(normalizeBars([funnel.trialInquiries, funnel.newEnrolments]));
  const conversion = $derived(
    funnel.trialInquiries > 0 ? funnel.newEnrolments / funnel.trialInquiries : null
  );
</script>

<Card padding={18} style="flex:1; min-width:0;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <div
      style="font-size:15px; font-weight:800; color:var(--df-text-dark); font-family:var(--df-font-heading);"
    >
      試上洽詢 → 報名 轉換
    </div>
    <span style="font-size:12px; color:var(--df-text-light);">近 90 天</span>
  </div>
  <div style="display:flex; flex-direction:column; gap:11px;">
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
        <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">試上洽詢</span>
        <span style="font-size:12.5px; color:var(--df-text-light);">
          <b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">
            {funnel.trialInquiries}
          </b> 筆
        </span>
      </div>
      <div class="track">
        <div
          style="height:100%; width:{widths[0]}%; border-radius:7px; background:var(--df-primary);"
        ></div>
      </div>
    </div>
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
        <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">完成報名</span>
        <span style="font-size:12.5px; color:var(--df-text-light);">
          <b style="color:var(--df-text-dark); font-family:var(--df-font-mono);">
            {funnel.newEnrolments}
          </b> 筆
          <span style="color:var(--df-text-muted);"> · 轉化 {fmtPct(conversion)}</span>
        </span>
      </div>
      <div class="track">
        <div style="height:100%; width:{widths[1]}%; border-radius:7px; background:#10B981;"></div>
      </div>
    </div>
  </div>
</Card>

<style>
  .track {
    height: 24px;
    border-radius: 7px;
    background: #eef2f6;
    overflow: hidden;
  }
</style>
