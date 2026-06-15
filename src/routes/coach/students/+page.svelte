<script lang="ts">
  /* 我的學員 — students view.
   * Reconstructed from views_students.jsx L1-59 (gap, per RECOVERY-STATUS) +
   * per-view spec in the task prompt. Legacy Svelte (no runes). */
  import { STUDENTS, LEVEL_TINT } from '$lib/coach/data';
  import { search } from '$lib/coach/stores';
  import KpiCard from '$lib/coach/components/KpiCard.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';
  import StudentCard from '$lib/coach/components/StudentCard.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  /* ---- filter state ---- */
  let cls = '全部班級';
  let lvl = '全部程度';

  /* ---- dropdown options ---- */
  $: distinctCls = ['全部班級', ...Array.from(new Set(STUDENTS.map((s) => s.cls)))];
  const lvlOptions = ['全部程度', '啟蒙', '初階', '中階', '選手'];

  /* ---- filtered list ---- */
  $: filtered = STUDENTS.filter((s) => {
    if (cls !== '全部班級' && s.cls !== cls) return false;
    if (lvl !== '全部程度' && s.level !== lvl) return false;
    const q = $search.trim().toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !s.skill.toLowerCase().includes(q)) return false;
    return true;
  });

  /* ---- KPI values ---- */
  $: avgAtt = STUDENTS.length
    ? Math.round(STUDENTS.reduce((sum, s) => sum + s.att, 0) / STUDENTS.length)
    : 0;
  $: lowAttCount = STUDENTS.filter((s) => s.att < 75).length;
</script>

<!-- root: flex col gap 16 — no df-view (layout already provides it) -->
<div style="display:flex;flex-direction:column;gap:16px">

  <!-- 1. Heading -->
  <div>
    <h1 style="font-size:22px;font-weight:800;color:var(--df-ink);margin:0 0 4px 0;font-family:var(--df-font-body)">我的學員</h1>
    <p style="font-size:13.5px;color:var(--df-text-light);margin:0">共 {STUDENTS.length} 位學員</p>
  </div>

  <!-- 2. Filter bar -->
  <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <CoachDropdown
      icon="graduation-cap"
      value={cls}
      options={distinctCls}
      onChange={(v) => (cls = v)}
    />
    <CoachDropdown
      icon="target"
      value={lvl}
      options={lvlOptions}
      onChange={(v) => (lvl = v)}
    />
  </div>

  <!-- 3. KPI grid (3 columns) -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    <KpiCard label="學員總數" value={STUDENTS.length} icon="users" iconColor="var(--df-primary)" />
    <KpiCard label="平均出席率" value="{avgAtt}%" icon="calendar-check" iconColor="var(--df-success)" />
    <KpiCard
      label="待加強"
      value={lowAttCount}
      icon="triangle-alert"
      iconColor="var(--df-error)"
      sub={lowAttCount > 0 ? '出席率低於 75%' : '無需關注'}
      subTone={lowAttCount > 0 ? 'var(--df-error)' : 'var(--df-success)'}
    />
  </div>

  <!-- 4. Student card grid -->
  {#if filtered.length > 0}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
      {#each filtered as s (s.name)}
        <StudentCard {s} />
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
