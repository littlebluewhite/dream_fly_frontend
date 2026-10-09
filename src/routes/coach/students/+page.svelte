<script lang="ts">
  /* 我的學員 — students view.
   * Reconstructed from views_students.jsx L1-59 (gap, per RECOVERY-STATUS) +
   * per-view spec in the task prompt. Legacy Svelte (no runes).
   *
   * Data arrives async via getStudents()(真實 API 接縫，Task 10：GET /coaches/me/
   * students): onMount loads the roster into a three-state gate (loading/error/
   * ready); `students` is the local working copy the filters read from.
   * R16 Task 2a：程度篩選、平均出席率/待加強 KPI 隨後端沒有的 level/skill/att 欄位
   * 拿掉(待加強原本把每位學員都算成出席率 0%)；列表 key 改用 user_id(同名學員不撞)。 */
  import type { Student } from '$lib/coach/data';
  import { createLoadGate } from '$lib/load-gate';
  import { getStudents } from '$lib/coach/api';
  import { search } from '$lib/coach/stores';
  import { LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import KpiCard from '$lib/coach/components/KpiCard.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';
  import StudentCard from '$lib/coach/components/StudentCard.svelte';
  import CertificateDialog from '$lib/coach/components/CertificateDialog.svelte';
  import ReportCardDialog from '$lib/coach/components/ReportCardDialog.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let students: Student[] = [];

  const gate = createLoadGate({
    fetch: getStudents,
    onData: (d) => { students = d.students; }
  });

  /* 發證書 dialog（Task 13；POST /certificates，見 integration-contract.md §3.22）。 */
  let certOpen = false;
  let certStudent: Student | null = null;
  function openCertificate(s: Student) {
    certStudent = s;
    certOpen = true;
  }
  function closeCertificate() {
    certOpen = false;
  }

  /* 寫評語 dialog（Task 13 續；POST /report-cards，§3.22——enrolment_id 來自
   * getStudents() 的 Student.courses，後端 97668d2 起提供）。 */
  let rcOpen = false;
  let rcStudent: Student | null = null;
  function openReportCard(s: Student) {
    rcStudent = s;
    rcOpen = true;
  }
  function closeReportCard() {
    rcOpen = false;
  }

  /* ---- filter state ---- */
  let cls = '全部班級';

  /* ---- dropdown options ---- */
  $: distinctCls = ['全部班級', ...Array.from(new Set(students.map((s) => s.cls)))];

  /* ---- filtered list ---- */
  $: filtered = students.filter((s) => {
    if (cls !== '全部班級' && s.cls !== cls) return false;
    const q = $search.trim().toLowerCase();
    if (q && !s.name.toLowerCase().includes(q)) return false;
    return true;
  });
</script>

<LoadGate {gate}>
  <div style="display:flex;flex-direction:column;gap:16px" data-testid="students-skeleton" slot="loading">
    <div><Skeleton w={140} h={26} r={6} /></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <Skeleton w={160} h={38} r={8} />
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <SkelCard><Skeleton w="100%" h={80} r={10} /></SkelCard>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={140} r={12} /></SkelCard>
      {/each}
    </div>
  </div>

<!-- root: flex col gap 16 — no df-view (layout already provides it) -->
<div style="display:flex;flex-direction:column;gap:16px">

  <!-- 1. Heading -->
  <div>
    <h1 style="font-size:22px;font-weight:800;color:var(--df-ink);margin:0 0 4px 0;font-family:var(--df-font-body)">我的學員</h1>
    <p style="font-size:13.5px;color:var(--df-text-light);margin:0">共 {students.length} 位學員</p>
  </div>

  <!-- 2. Filter bar -->
  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <CoachDropdown
      icon="graduation-cap"
      value={cls}
      options={distinctCls.map((s) => ({ key: s, label: s }))}
      onChange={(v) => (cls = v)}
    />
  </div>

  <!-- 3. KPI grid -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    <KpiCard label="學員總數" value={students.length} icon="users" iconColor="var(--df-primary)" />
  </div>

  <!-- 4. Student card grid -->
  {#if filtered.length > 0}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      {#each filtered as s (s.user_id)}
        <StudentCard {s} onReportCard={openReportCard} onCertificate={openCertificate} />
      {/each}
    </div>
  {:else}
    <!-- 5. Empty state -->
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:64px 0;color:var(--df-text-muted)">
      <Icon name="search-x" size={40} color="var(--df-text-muted)" />
      <span style="font-size:15px;font-weight:500">找不到符合的學員</span>
    </div>
  {/if}

</div>
<CertificateDialog open={certOpen} student={certStudent} onClose={closeCertificate} />
<ReportCardDialog open={rcOpen} student={rcStudent} onClose={closeReportCard} />
</LoadGate>
