<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { CatalogCourse } from '$lib/public/adapters';
  import { LEVEL_TONE } from '$lib/domain/course-level';

  export let course: CatalogCourse;
  export let showCartButton = false;
  export let onAdd: (course: CatalogCourse) => void = () => {};

  type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';

  // Map level to Badge tone — legacy 公開頁分類 keys（不屬於 $lib/domain/course-level 的 5 級課程分級），字面保留。
  const legacyLevelTones: Record<string, BadgeTone> = {
    '青少年': 'warning',
    '客製化': 'accent',
    '體驗': 'info',
    '幼兒': 'success',
    '競技': 'error',
    '成人': 'primary'
  };

  // FE#17 引入時色階對齊 admin/member/mobile/mobile-admin 既有 LEVEL_TONE（啟蒙/入門
  // info、基礎 primary、進階 warning、選手 accent），避免 foundation/elite 落回預設
  // primary。批次 1 W2a 單源收斂後，改直接展開 $lib/domain/course-level 的 LEVEL_TONE
  // （wire Tone 與本地 BadgeTone 七值同集，結構相容），不再本檔另存一份複本。
  const levelTones: Record<string, BadgeTone> = { ...legacyLevelTones, ...LEVEL_TONE };

  $: levelTone = levelTones[course.level] || 'primary';
</script>

<div class="course-card card">
  <div class="course-header">
    <div class="course-badges">
      <Badge tone={levelTone}>{course.level}</Badge>
      {#if course.hot}<Badge tone="error">熱門</Badge>{/if}
    </div>
    <h3>{course.name}</h3>
  </div>

  <div class="course-body">
    <p class="course-description">{course.desc}</p>

    <div class="course-details">
      <div class="detail-item">
        <Icon name="users" size={18} color="var(--df-text-muted)" />
        <span class="detail-text">{course.cat}{course.age ? ` · ${course.age}` : ''}</span>
      </div>
      <div class="detail-item">
        <Icon name="calendar-days" size={18} color="var(--df-text-muted)" />
        <span class="detail-text">{course.days}</span>
      </div>
      {#if course.coach}
        <div class="detail-item">
          <Icon name="user" size={18} color="var(--df-text-muted)" />
          <span class="detail-text">{course.coach} 教練</span>
        </div>
      {/if}
      <div class="detail-item">
        <Icon name="credit-card" size={18} color="var(--df-primary)" />
        <span class="detail-text price">NT$ {course.price.toLocaleString()}</span>
      </div>
    </div>

    <p class="course-spots">
      {course.spots > 0 ? `尚有 ${course.spots} 個名額` : '目前額滿'}
    </p>
  </div>

  <div class="course-footer">
    {#if showCartButton}
      <button class="btn btn-secondary" on:click={() => onAdd(course)}>加入購物車</button>
    {:else}
      <a href="/contact" class="btn btn-primary">立即報名</a>
    {/if}
  </div>
</div>

<style>
  .course-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    transition: transform var(--transition-normal);
  }

  .course-card:hover {
    transform: translateY(-4px);
  }

  .course-header {
    margin-bottom: var(--spacing-md);
  }

  .course-badges {
    display: flex;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
  }

  .course-header h3 {
    color: var(--df-primary);
    font-size: 1.3rem;
    margin-bottom: 0;
    margin-top: var(--spacing-sm);
  }

  .course-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .course-description {
    color: var(--df-text-light);
    line-height: 1.6;
  }

  .course-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background-color: var(--df-bg-light);
    border-radius: var(--df-radius-md);
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .detail-text {
    color: var(--df-text-dark);
    font-weight: 500;
  }

  .detail-text.price {
    color: var(--df-primary);
    font-weight: 700;
    font-size: 1.1rem;
    font-family: var(--df-font-mono);
  }

  .course-spots {
    color: var(--df-text-light);
    font-size: 0.9rem;
    margin: 0;
  }

  .course-footer {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--df-border);
  }

  .course-footer .btn {
    width: 100%;
  }
</style>
