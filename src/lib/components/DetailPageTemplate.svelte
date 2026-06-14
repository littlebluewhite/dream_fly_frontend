<script lang="ts">
  import type { NavLink } from '$lib/data/navigationConfig';

  export let title: string;
  export let subtitle: string = '';
  export let heroImage: string;
  export let description: string;
  export let gallery: string[] = [];
  export let specs: { label: string; value: string }[] = [];
  export let relatedItems: NavLink[] = [];
  export let ctaText: string = '立即預約';
  export let ctaAction: () => void = () => {
    alert('預約功能即將推出');
  };
</script>

<div class="detail-page">
  <!-- Hero Section -->
  <section class="hero">
    <img src={heroImage} alt={title} class="hero-image" />
    <div class="hero-overlay">
      <div class="container">
        <h1 class="hero-title">{title}</h1>
        {#if subtitle}
          <p class="hero-subtitle">{subtitle}</p>
        {/if}
      </div>
    </div>
  </section>

  <!-- Description Section -->
  <section class="description-section">
    <div class="container content-container">
      <div class="description">
        {@html description}
      </div>
    </div>
  </section>

  <!-- Specifications Section -->
  {#if specs.length > 0}
    <section class="specs-section">
      <div class="container content-container">
        <h2 class="section-title">詳細資訊</h2>
        <div class="specs-grid">
          {#each specs as spec}
            <div class="spec-item">
              <div class="spec-label">{spec.label}</div>
              <div class="spec-value">{spec.value}</div>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- Gallery Section -->
  {#if gallery.length > 0}
    <section class="gallery-section">
      <div class="container content-container">
        <h2 class="section-title">圖片集</h2>
        <div class="gallery-grid">
          {#each gallery as image, index}
            <div class="gallery-item">
              <img src={image} alt="{title} - 圖片 {index + 1}" loading="lazy" />
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- Related Items Section -->
  {#if relatedItems.length > 0}
    <section class="related-section">
      <div class="container content-container">
        <h2 class="section-title">相關內容</h2>
        <div class="related-grid">
          {#each relatedItems as item}
            <a href={item.href} class="related-item">
              <div class="related-content">
                <h3>{item.label}</h3>
                <span class="related-arrow">→</span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  <!-- CTA Section -->
  <section class="cta-section">
    <div class="container content-container">
      <button class="cta-button" on:click={ctaAction}>
        {ctaText}
      </button>
    </div>
  </section>
</div>

<style>
  .detail-page {
    min-height: 100vh;
  }

  .container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-md);
  }

  .content-container {
    max-width: 900px;
  }

  /* Hero Section */
  .hero {
    position: relative;
    width: 100%;
    height: 400px;
    overflow: hidden;
  }

  .hero-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
    padding: 3rem 0 2rem;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-white);
    margin: 0;
  }

  .hero-subtitle {
    font-size: 1.25rem;
    color: var(--color-white);
    margin: 0.5rem 0 0;
    opacity: 0.9;
  }

  /* Description Section */
  .description-section {
    padding: 3rem 0;
    background-color: var(--color-white);
  }

  .description {
    font-size: 1.125rem;
    line-height: 1.8;
    color: var(--color-text);
  }

  .description :global(p) {
    margin-bottom: 1.5rem;
  }

  /* Section Titles */
  .section-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary);
    margin: 0 0 2rem;
    padding-bottom: 1rem;
    border-bottom: 3px solid var(--color-accent);
  }

  /* Specifications Section */
  .specs-section {
    padding: 3rem 0;
    background-color: #f8f9fa;
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .spec-item {
    background-color: var(--color-white);
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid var(--color-primary);
  }

  .spec-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #666;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spec-value {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-text);
  }

  /* Gallery Section */
  .gallery-section {
    padding: 3rem 0;
    background-color: var(--color-white);
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .gallery-item {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform var(--transition-fast);
  }

  .gallery-item:hover {
    transform: scale(1.05);
  }

  .gallery-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Related Items Section */
  .related-section {
    padding: 3rem 0;
    background-color: #f8f9fa;
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .related-item {
    background-color: var(--color-white);
    padding: 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    color: var(--color-text);
    transition: all var(--transition-fast);
    border: 2px solid transparent;
  }

  .related-item:hover {
    border-color: var(--color-primary);
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.2);
  }

  .related-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .related-content h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text);
  }

  .related-arrow {
    font-size: 1.5rem;
    color: var(--color-primary);
    transition: transform var(--transition-fast);
  }

  .related-item:hover .related-arrow {
    transform: translateX(4px);
  }

  /* CTA Section */
  .cta-section {
    padding: 3rem 0;
    background-color: var(--color-white);
    text-align: center;
  }

  .cta-button {
    background-color: var(--color-primary);
    color: var(--color-white);
    font-size: 1.125rem;
    font-weight: 600;
    padding: 1rem 3rem;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }

  .cta-button:hover {
    background-color: var(--color-accent);
    color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 102, 204, 0.4);
  }

  .cta-button:active {
    transform: translateY(0);
  }

  /* Tablet */
  @media (max-width: 1024px) {
    .hero {
      height: 350px;
    }

    .hero-title {
      font-size: 2rem;
    }

    .gallery-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .related-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Mobile */
  @media (max-width: 767px) {
    .hero {
      height: 300px;
    }

    .hero-title {
      font-size: 1.75rem;
    }

    .hero-subtitle {
      font-size: 1rem;
    }

    .description-section {
      padding: 2rem 0;
    }

    .description {
      font-size: 1rem;
    }

    .section-title {
      font-size: 1.5rem;
    }

    .specs-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .gallery-grid {
      grid-template-columns: 1fr;
    }

    .related-grid {
      grid-template-columns: 1fr;
    }

    .cta-button {
      width: 100%;
      max-width: 400px;
    }
  }
</style>
