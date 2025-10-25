<script lang="ts">
  // Home Page
</script>

<svelte:head>
  <title>Dream Fly 體操館 - 專業體操訓練中心</title>
</svelte:head>

<div class="home-page">
  <!-- Hero Section -->
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <h1>歡迎來到 Dream Fly 體操館</h1>
        <p class="hero-subtitle">台灣專業的體操訓練中心，提供幼兒體操、競技啦啦隊、成人體操與跑酷訓練</p>
        <p class="hero-description">
          專業教練團隊、完善訓練設施、系統化課程規劃<br/>
          從幼兒啟蒙到成人訓練，讓您的體操技能全面提升
        </p>
        <div class="hero-buttons">
          <a href="/courses" class="btn btn-primary">查看課程</a>
          <a href="/schedule" class="btn btn-accent">預約場地</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="features">
    <div class="container">
      <h2 class="text-center mb-lg">為什麼選擇 Dream Fly？</h2>

      <div class="features-grid">
        <div class="feature-card card">
          <div class="feature-icon">🤸</div>
          <h3>專業訓練設施</h3>
          <p>12項專業體操設施，包含大跳床、海綿池、攀岩場等完整訓練器材</p>
        </div>

        <div class="feature-card card">
          <div class="feature-icon">👨‍🏫</div>
          <h3>專業教練團隊</h3>
          <p>體操A級教練、競技啦啦隊總監，提供專業且安全的訓練指導</p>
        </div>

        <div class="feature-card card">
          <div class="feature-icon">👶</div>
          <h3>全年齡課程</h3>
          <p>3歲幼兒到成人，幼兒體操、競技啦啦隊、跑酷等多元課程選擇</p>
        </div>

        <div class="feature-card card">
          <div class="feature-icon">🏆</div>
          <h3>比賽與表演</h3>
          <p>定期參加全國賽事，培養團隊精神與競技能力，展現訓練成果</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta">
    <div class="container">
      <div class="cta-content">
        <h2>準備好開始您的體操訓練了嗎？</h2>
        <p>立即預約體驗課程，感受專業的體操訓練環境</p>
        <a href="/contact" class="btn btn-primary">立即聯絡我們</a>
      </div>
    </div>
  </section>
</div>

<style>
  .home-page {
    width: 100%;
  }

  /* Hero Section */
  .hero {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    color: var(--color-white);
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .hero h1 {
    color: var(--color-white);
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }

  .hero-subtitle {
    font-size: 1.5rem;
    color: var(--color-accent);
    margin-bottom: var(--spacing-sm);
  }

  .hero-description {
    font-size: 1.1rem;
    line-height: 1.8;
    margin-bottom: var(--spacing-lg);
    color: rgba(255, 255, 255, 0.95);
  }

  .hero-buttons {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    flex-wrap: wrap;
  }

  /* Features Section */
  .features {
    padding: var(--spacing-xl) 0;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
  }

  .feature-card {
    text-align: center;
    padding: var(--spacing-lg);
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
  }

  .feature-card h3 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-sm);
  }

  /* CTA Section */
  .cta {
    background-color: var(--color-bg);
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .cta-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .cta h2 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-md);
  }

  .cta p {
    font-size: 1.1rem;
    margin-bottom: var(--spacing-lg);
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .hero h1 {
      font-size: 2rem;
    }

    .hero-subtitle {
      font-size: 1.25rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }

    .hero-buttons {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
