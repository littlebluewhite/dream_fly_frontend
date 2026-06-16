<script lang="ts">
  import type { NavLink } from '$lib/data/navigationConfig';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import BrandedPlaceholder from '$lib/components/BrandedPlaceholder.svelte';

  export let title: string;
  export let subtitle: string = '';
  export let heroImage: string;
  export let description: string;
  export let gallery: string[] = [];
  export let specs: { label: string; value: string }[] = [];
  export let relatedItems: NavLink[] = [];
  export let ctaText: string = '立即預約';
  export let ctaAction: () => void = () => {
    goto('/contact');
  };
</script>

<div class="detail-page">
  <!-- Hero Section -->
  <section class="hero">
    <BrandedPlaceholder src={heroImage} alt={title} variant="hero" showCaption={false} />
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
              <BrandedPlaceholder src={image} alt={title + ' - 圖片 ' + (index + 1)} />
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
                <span class="related-arrow">
                  <Icon name="arrow-right" size={20} color="var(--df-primary)" />
                </span>
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

  .hero-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(15, 23, 42, 0.75), transparent);
    padding: 3rem 0 2rem;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--df-white);
    margin: 0;
  }

  .hero-subtitle {
    font-size: 1.25rem;
    color: var(--df-white);
    margin: 0.5rem 0 0;
    opacity: 0.9;
  }

  /* Description Section */
  .description-section {
    padding: 3rem 0;
    background-color: var(--df-surface);
  }

  .description {
    font-size: 1.125rem;
    line-height: 1.8;
    color: var(--df-text-dark);
  }

  .description :global(p) {
    margin-bottom: 1.5rem;
  }

  /* Section Titles */
  .section-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--df-primary);
    margin: 0 0 2rem;
    padding-bottom: 1rem;
    border-bottom: 3px solid var(--df-accent);
  }

  /* Specifications Section */
  .specs-section {
    padding: 3rem 0;
    background-color: var(--df-bg-light);
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .spec-item {
    background-color: var(--df-surface);
    padding: 1.5rem;
    border-radius: var(--df-radius-lg);
    border-left: 4px solid var(--df-primary);
    box-shadow: var(--df-shadow-soft);
  }

  .spec-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--df-text-light);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spec-value {
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--df-text-dark);
  }

  /* Gallery Section */
  .gallery-section {
    padding: 3rem 0;
    background-color: var(--df-surface);
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
    border-radius: var(--df-radius-lg);
    box-shadow: var(--df-shadow-card);
    transition: transform var(--transition-fast);
  }

  .gallery-item:hover {
    transform: scale(1.05);
  }

  /* Related Items Section */
  .related-section {
    padding: 3rem 0;
    background-color: var(--df-bg-light);
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .related-item {
    background-color: var(--df-surface);
    padding: 1.5rem;
    border-radius: var(--df-radius-lg);
    text-decoration: none;
    color: var(--df-text-dark);
    transition: all var(--transition-fast);
    border: 2px solid transparent;
    box-shadow: var(--df-shadow-soft);
  }

  .related-item:hover {
    border-color: var(--df-primary);
    transform: translateY(-4px);
    box-shadow: var(--df-shadow-lifted);
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
    color: var(--df-text-dark);
  }

  .related-arrow {
    display: flex;
    align-items: center;
    transition: transform var(--transition-fast);
  }

  .related-item:hover .related-arrow {
    transform: translateX(4px);
  }

  /* CTA Section */
  .cta-section {
    padding: 3rem 0;
    background-color: var(--df-surface);
    text-align: center;
  }

  .cta-button {
    background-color: var(--df-primary);
    color: var(--df-white);
    font-size: 1.125rem;
    font-weight: 600;
    padding: 1rem 3rem;
    border: none;
    border-radius: var(--df-radius-pill);
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: var(--df-shadow-card);
  }

  .cta-button:hover {
    background-color: var(--df-accent);
    color: var(--df-primary);
    transform: translateY(-2px);
    box-shadow: var(--df-shadow-lifted);
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
