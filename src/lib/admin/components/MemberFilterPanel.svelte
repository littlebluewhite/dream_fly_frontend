<script lang="ts">
  /* 進階篩選 — collapsible filter Card for 學員管理 (admin.jsx MembersView advanced
   * filter). When `open`, shows 報名課程 / 繳費狀態 Selects + an 出席率區間 (最低/最高)
   * numeric pair, then 套用 / 重設. Holds local field state; 套用 commits to the
   * shared `memberFilter` store (folded into MembersTable's filterMembers call),
   * 重設 clears both the local fields and the store back to pass-through. The att
   * bounds are edited as text and parsed on 套用 (blank → undefined = no clamp). */
  import { get } from 'svelte/store';
  import { Button, Card, Input, Select, Icon } from '$lib/components/ui';
  import { CLASSES, PAY_STATUS, type PayStatus } from '$lib/admin/data';
  import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

  export let open = false;

  const courseOptions = [
    { value: '', label: '全部課程' },
    ...CLASSES.map((c) => ({ value: c.name, label: c.name }))
  ];
  const payOptions = [
    { value: '', label: '全部' },
    ...(Object.keys(PAY_STATUS) as PayStatus[]).map((v) => ({ value: v, label: PAY_STATUS[v][1] }))
  ];

  // Local field buffers (committed to the store only on 套用). Hydrate from the
  // persisted store so a filter applied before navigating away stays visible on
  // remount, instead of showing 全部/blank while the table is still narrowed.
  const seed = get(memberFilter);
  let course = seed.course ?? '';
  // store pay is MemberPayFilter ('all' | '' | PayStatus | undefined); the panel only
  // offers '' | PayStatus, so normalise 'all'/undefined back to '' (全部).
  let pay: PayStatus | '' = seed.pay && seed.pay !== 'all' ? seed.pay : '';
  let attMinText = seed.attMin != null ? String(seed.attMin) : '';
  let attMaxText = seed.attMax != null ? String(seed.attMax) : '';

  function parseAtt(s: string): number | undefined {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? undefined : n;
  }

  function apply() {
    memberFilter.set({
      course,
      pay,
      attMin: parseAtt(attMinText),
      attMax: parseAtt(attMaxText)
    });
  }

  function reset() {
    course = '';
    pay = '';
    attMinText = '';
    attMaxText = '';
    memberFilter.set({ ...MEMBER_FILTER_DEFAULT });
  }
</script>

{#if open}
  <Card padding={20}>
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
      <Icon name="filter" size={16} color="var(--df-primary)" />
      <span style="font-size:14px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);">
        進階篩選
      </span>
    </div>

    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
      <Select label="報名課程" bind:value={course} options={courseOptions} />
      <Select label="繳費狀態" bind:value={pay} options={payOptions} />

      <div style="grid-column:span 2;">
        <div style="font-size:13px; font-weight:600; color:var(--df-text-dark); margin-bottom:6px;">
          出席率區間
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <Input label="最低出席率" type="number" bind:value={attMinText} placeholder="0" />
          <span style="color:var(--df-text-light); padding-top:22px;">–</span>
          <Input label="最高出席率" type="number" bind:value={attMaxText} placeholder="100" />
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
      <Button variant="secondary" size="sm" on:click={reset}>重設</Button>
      <Button variant="primary" size="sm" on:click={apply}>套用</Button>
    </div>
  </Card>
{/if}
