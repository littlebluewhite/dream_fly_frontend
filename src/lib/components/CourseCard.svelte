<script lang="ts">
  import { cartStore } from '$lib/stores/cartStore';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let course: {
    id: number;
    name: string;
    level: string;
    duration: string;
    price: string;
    description: string;
    includes: string[];
  };

  export let onAddToCart: (() => void) | undefined = undefined;
  export let showCartButton = false;

  $: cart = $cartStore;
  $: isInCart = cart.some((item) => item.id === `course-${course.id}`);

  // Map level to Badge tone
  const levelTones: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral'> = {
    '初級': 'success',
    '中級': 'primary',
    '高級': 'info',
    '青少年': 'warning',
    '客製化': 'accent',
    '體驗': 'info',
    '幼兒': 'success',
    '競技': 'error',
    '成人': 'primary',
    '進階': 'neutral'
  };

  $: levelTone = levelTones[course.level] || 'primary';
</script>

<div class="course-card card">
  <div class="course-header">
    <Badge tone={levelTone}>{course.level}</Badge>
    <h3>{course.name}</h3>
  </div>

  <div class="course-body">
    <p class="course-description">{course.description}</p>

    <div class="course-details">
      <div class="detail-item">
        <Icon name="clock" size={18} color="var(--df-text-muted)" />
        <span class="detail-text">{course.duration}</span>
      </div>
      <div class="detail-item">
        <Icon name="credit-card" size={18} color="var(--df-primary)" />
        <span class="detail-text price">{course.price}</span>
      </div>
    </div>

    <div class="course-includes">
      <h4>課程內容</h4>
      <ul>
        {#each course.includes as item}
          <li>{item}</li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="course-footer">
    {#if showCartButton && onAddToCart}
      {#if isInCart}
        <button class="btn btn-secondary" disabled>已在購物車</button>
      {:else}
        <button class="btn btn-primary" on:click={onAddToCart}>加入購物車</button>
      {/if}
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

  .course-header :global(.badge) {
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

  .course-includes h4 {
    color: var(--df-primary);
    font-size: 1rem;
    margin-bottom: var(--spacing-sm);
  }

  .course-includes ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .course-includes li {
    padding: 0.3rem 0;
    padding-left: var(--spacing-md);
    position: relative;
    color: var(--df-text-light);
    font-size: 0.95rem;
  }

  .course-includes li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--df-accent-dark);
    font-weight: bold;
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
