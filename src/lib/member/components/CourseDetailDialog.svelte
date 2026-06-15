<script lang="ts">
  /* Course-detail modal (課程詳情) — opened from a catalog card. Shows the
   * course's badges, description, a 2-col detail grid and price, with an
   * add-to-cart / waitlist primary action. Ported from the prototype's
   * CourseDetail (client/views.jsx). */
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { LEVEL_TONE, type CatalogCourse } from '$lib/member/data';

  export let course: CatalogCourse | null = null;
  export let onClose: () => void = () => {};
  export let onAdd: (c: CatalogCourse) => void = () => {};

  $: full = course?.spots === 0;
  $: rows = course
    ? ([
        ['授課教練', course.coach + ' 教練'],
        ['上課時段', course.days],
        ['適合年齡', course.age],
        ['剩餘名額', full ? '已額滿' : course.spots + ' 位']
      ] as const)
    : [];
</script>

<Dialog
  open={!!course}
  title={course?.name}
  width={520}
  {onClose}
  primaryAction={{
    label: full ? '加入候補' : '加入購物車',
    onClick: () => {
      if (course) onAdd(course);
      onClose();
    }
  }}
  secondaryAction={{ label: '關閉', onClick: onClose }}
>
  {#if course}
    <div style="display:flex; gap:8px; margin:2px 0 14px">
      <Badge tone={LEVEL_TONE[course.level]}>{course.level}</Badge>
      <Badge tone="neutral">{course.age}</Badge>
      {#if course.hot}<Badge tone="accent" solid>熱門</Badge>{/if}
      {#if full}<Badge tone="warning">候補中</Badge>{/if}
    </div>
    <p
      style="margin:0 0 16px; font-size:14.5px; color:var(--df-text-dark); line-height:1.7"
    >
      {course.desc}
    </p>
    <div
      style="display:grid; grid-template-columns:1fr 1fr; gap:12px 18px; border-top:1px solid var(--df-border); padding-top:16px"
    >
      {#each rows as [k, v] (k)}
        <div>
          <div style="font-size:12px; color:var(--df-text-muted); margin-bottom:3px">{k}</div>
          <div style="font-size:14px; color:var(--df-text-dark); font-weight:500">{v}</div>
        </div>
      {/each}
    </div>
    <div
      style="margin-top:16px; padding-top:14px; border-top:1px solid var(--df-border); display:flex; align-items:baseline; gap:4px"
    >
      <span style="font-size:14px; color:var(--df-text-light)">NT$</span>
      <span
        style="font-family:var(--df-font-heading); font-size:26px; font-weight:800; color:var(--df-ink)"
        >{course.price.toLocaleString()}</span
      >
      <span style="font-size:14px; color:var(--df-text-light)">/ 季</span>
    </div>
  {/if}
</Dialog>
