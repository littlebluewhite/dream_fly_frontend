<script lang="ts">
  import { cartStore } from '$lib/stores/cartStore';

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

  // Color mapping for different levels
  const levelColors: Record<string, string> = {
    '初級': 'green',
    '中級': 'blue',
    '高級': 'purple',
    '青少年': 'orange',
    '客製化': 'gold',
    '體驗': 'teal',
    '幼兒': 'pink',      // pink for children's gymnastics
    '競技': 'crimson',   // crimson red for competitive cheer
    '成人': 'navy',      // navy blue for adult gymnastics
    '進階': 'magenta'    // dark magenta for parkour
  };

  $: levelColor = levelColors[course.level] || 'blue';
</script>

<div class="course-card card">
  <div class="course-header">
    <span class="level-badge" data-level={levelColor}>{course.level}</span>
    <h3>{course.name}</h3>
  </div>

  <div class="course-body">
    <p class="course-description">{course.description}</p>

    <div class="course-details">
      <div class="detail-item">
        <span class="detail-icon">⏱️</span>
        <span class="detail-text">{course.duration}</span>
      </div>
      <div class="detail-item">
        <span class="detail-icon">💰</span>
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

  .level-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: var(--spacing-sm);
    color: white;
  }

  .level-badge[data-level="green"] {
    background-color: #28a745;
  }

  .level-badge[data-level="blue"] {
    background-color: var(--color-primary);
  }

  .level-badge[data-level="purple"] {
    background-color: #6f42c1;
  }

  .level-badge[data-level="orange"] {
    background-color: #fd7e14;
  }

  .level-badge[data-level="gold"] {
    background-color: var(--color-accent-dark);
    color: var(--color-text);
  }

  .level-badge[data-level="teal"] {
    background-color: #20c997;
  }

  .level-badge[data-level="pink"] {
    background-color: #ff69b4;
  }

  .level-badge[data-level="crimson"] {
    background-color: #dc143c;
  }

  .level-badge[data-level="navy"] {
    background-color: #000080;
  }

  .level-badge[data-level="magenta"] {
    background-color: #8b008b;
  }

  .course-header h3 {
    color: var(--color-primary);
    font-size: 1.3rem;
    margin-bottom: 0;
  }

  .course-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .course-description {
    color: var(--color-text-light);
    line-height: 1.6;
  }

  .course-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background-color: var(--color-bg);
    border-radius: 4px;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .detail-icon {
    font-size: 1.2rem;
  }

  .detail-text {
    color: var(--color-text);
    font-weight: 500;
  }

  .detail-text.price {
    color: var(--color-primary);
    font-weight: 700;
    font-size: 1.1rem;
  }

  .course-includes h4 {
    color: var(--color-primary);
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
    color: var(--color-text-light);
    font-size: 0.95rem;
  }

  .course-includes li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--color-accent);
    font-weight: bold;
  }

  .course-footer {
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid #eee;
  }

  .course-footer .btn {
    width: 100%;
  }
</style>
