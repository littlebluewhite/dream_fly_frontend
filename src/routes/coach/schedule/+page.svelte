<script lang="ts">
  /* 排課管理 — weekly schedule view.
   * Filter-bar header (L90-144 gap) reconstructed from task spec.
   * Filter-bar tail (L145-151) faithfully ported from recovered jsx. */
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { CAT_COLOR } from '$lib/coach/data';
  import { toasts } from '$lib/coach/stores';
  import ScheduleGrid from '$lib/coach/components/ScheduleGrid.svelte';
  import CoachDropdown from '$lib/coach/components/CoachDropdown.svelte';

  const viewOptions = ['日', '週', '月'];

  const navArrow: string =
    'display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--df-border);border-radius:8px;background:#fff;padding:7px 10px;cursor:pointer';
</script>

<div style="display:flex;flex-direction:column;gap:16px">
  <!-- filter bar -->
  <Card>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <!-- left: view toggle + prev/next/今日 -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <!-- 日/週/月 toggle -->
        <div
          style="display:inline-flex;border:1px solid var(--df-border);border-radius:8px;overflow:hidden"
        >
          {#each viewOptions as v (v)}
            <button
              type="button"
              on:click={() => toasts.notify('info', v + ' 檢視', '切換至' + v + '檢視（示範）。')}
              style="padding:7px 16px;border:none;background:{v === '週'
                ? 'var(--df-primary-bg)'
                : '#fff'};font-size:13px;font-weight:{v === '週'
                ? 700
                : 500};color:{v === '週'
                ? 'var(--df-primary)'
                : 'var(--df-text-dark)'};cursor:pointer;font-family:var(--df-font-body)"
            >
              {v}
            </button>
          {/each}
        </div>

        <!-- prev / next / 今日 — L145-146 -->
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
          on:click={() => toasts.notify('info', '上一週', '顯示 5/18 – 5/24 課表（示範）。')}
          aria-label="上一週"
          style={navArrow}
        >
          <Icon name="chevron-left" size={16} color="var(--df-text-light)" />
        </button>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
          on:click={() => toasts.notify('info', '下一週', '顯示 6/1 – 6/7 課表（示範）。')}
          aria-label="下一週"
          style={navArrow}
        >
          <Icon name="chevron-right" size={16} color="var(--df-text-light)" />
        </button>
        <button
          type="button"
          on:click={() => toasts.notify('info', '今日', '已回到本週。')}
          style="margin-left:4px;padding:7px 14px;border:1px solid var(--df-border);border-radius:8px;background:#fff;font-size:13px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body)"
        >
          今日
        </button>
      </div>

      <!-- right: decorative dropdowns — L150-151 -->
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <CoachDropdown
          icon="layers"
          value="全部課程類型"
          options={['全部課程類型', '體操', '啦啦隊', '跑酷']}
          onChange={() => {}}
        />
        <CoachDropdown
          icon="map-pin"
          value="所有場館"
          options={['所有場館', '主場館', '競技訓練館', '副館']}
          onChange={() => {}}
        />
      </div>
    </div>
  </Card>

  <!-- calendar grid — L156-196 -->
  <Card padding={0} style="overflow:hidden">
    <ScheduleGrid />
  </Card>

  <!-- legend + tip — L198-207 -->
  <div
    style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:0 4px"
  >
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="font-size:12.5px;font-weight:600;color:var(--df-text-muted)">課程類別：</span>
      {#each Object.entries(CAT_COLOR) as [cat, col] (cat)}
        <span
          style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--df-text-light)"
        >
          <span style="width:12px;height:12px;border-radius:3px;background:{col.bar}"></span>
          {cat}
        </span>
      {/each}
    </div>
    <span
      style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--df-text-muted)"
    >
      <Icon name="lightbulb" size={14} color="var(--df-accent-dark)" />
      Tip: 點擊空白時段可新增課程
    </span>
  </div>
</div>
