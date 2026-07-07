<script lang="ts">
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { CatalogCourse } from '$lib/public/adapters';

  export let course: CatalogCourse;
  export let showCartButton = false;
  export let onAdd: (course: CatalogCourse) => void = () => {};

  // Map level to Badge tone
  const levelTones: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral'> = {
    '青少年': 'warning',
    '客製化': 'accent',
    '體驗': 'info',
    '幼兒': 'success',
    '競技': 'error',
    '成人': 'primary',
    // FE#17 補完：5 級課程分級（$lib/domain/course-level 共用常數）色階對齊
    // admin/member/mobile 既有的 LEVEL_TONE，避免 foundation/elite 落回預設 primary。
    '啟蒙': 'info',
    '入門': 'info',
    '基礎': 'primary',
    '選手': 'accent',
    '進階': 'neutral'
  };

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
