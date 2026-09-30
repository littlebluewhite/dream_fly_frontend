<script lang="ts">
  /* 學員卡片 — port of views_students.jsx L60-89 (StudentCard body).
   * R16 Task 2a：程度徽章、技能評量條、出席率與「查看詳情」示範 toast 隨後端沒有的
   * level/skill/pct/att 欄位一起拿掉，只留姓名/課程與教練發放入口。 */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { Student } from '$lib/coach/data';

  export let s: Student;
  /** 教練發放入口（Task 13；integration-contract.md §3.22）：寫評語 POST
   *  /report-cards（enrolment_id 由 Student.courses 提供，後端 97668d2 起）、
   *  發證書 POST /certificates。 */
  export let onReportCard: (s: Student) => void = () => {};
  export let onCertificate: (s: Student) => void = () => {};
</script>

<Card padding={20} hoverable>
  <!-- header row: avatar + name/cls -->
  <div style="display:flex;align-items:center;gap:12px">
    <span style="width:44px;height:44px;border-radius:50%;background:{s.color};color:#fff;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;flex:none">{s.initial}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:700;color:var(--df-ink)">{s.name}</div>
      <div style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--df-text-light);margin-top:2px">
        <Icon name="graduation-cap" size={13} color="var(--df-text-muted)" />{s.cls}
      </div>
    </div>
  </div>

  <!-- 教練發放：寫評語 + 發證書（Task 13，POST /report-cards + /certificates §3.22） -->
  <div style="border-top:1px solid var(--df-border);margin-top:14px;padding-top:12px;display:flex;gap:8px">
    <button
      type="button"
      on:click={() => onReportCard(s)}
      style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;color:var(--df-primary);cursor:pointer;font-family:var(--df-font-body)"
    ><Icon name="clipboard-list" size={14} color="var(--df-primary)" />寫評語</button>
    <button
      type="button"
      on:click={() => onCertificate(s)}
      style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;color:var(--df-primary);cursor:pointer;font-family:var(--df-font-body)"
    ><Icon name="award" size={14} color="var(--df-primary)" />發證書</button>
  </div>
</Card>
