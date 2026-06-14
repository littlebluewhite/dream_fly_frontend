<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  // Venues Page - 場館介紹
</script>

<svelte:head>
  <title>場館介紹 - Dream Fly 體操館</title>
</svelte:head>

<div class="venues-page">
  <section class="page-header">
    <div class="container">
      <h1>場館介紹</h1>
      <p>專業體操訓練設施與安全防護配備</p>
    </div>
  </section>

  <section class="venue-details">
    <div class="container">
      <div class="venue-intro card">
        <h2>關於我們的場館</h2>
        <p>
          Dream Fly 體操館擁有完整的專業體操訓練設施，包含12項訓練器材與安全防護設備。
          我們致力於提供最安全、最專業的訓練環境，讓每位學員都能在安全的環境中挑戰自我、突破極限。
        </p>
      </div>

      <div class="facilities-grid">
        <div class="facility-card card">
          <h3><Icon name="activity" size={20} class="facility-icon" /> 訓練設施</h3>
          <ul>
            <li>大跳床 - 專業彈跳訓練，提升空中控制能力</li>
            <li>小跳床 - 基礎彈跳練習，適合初學者使用</li>
            <li>長跳床 - 助跑彈跳訓練，練習連續動作</li>
            <li>9條體操墊 - 翻滾、倒立等基礎動作訓練</li>
            <li>組合墊 - 可調整高度與角度的多功能訓練墊</li>
          </ul>
        </div>

        <div class="facility-card card">
          <h3><Icon name="shield-check" size={20} class="facility-icon" /> 安全設施</h3>
          <ul>
            <li>氣墊 - 高空落下緩衝保護，確保訓練安全</li>
            <li>海綿池 - 大型海綿填充池，提供安全著陸環境</li>
          </ul>
        </div>

        <div class="facility-card card">
          <h3><Icon name="dumbbell" size={20} class="facility-icon" /> 輔助訓練</h3>
          <ul>
            <li>小型健身房 - 體能訓練器材，增強肌力與耐力</li>
            <li>小型攀岩場 - 手腳協調訓練，提升身體控制力</li>
            <li>有鏡子的韻律教室 - 舞蹈韻律訓練，矯正動作姿勢</li>
          </ul>
        </div>

        <div class="facility-card card">
          <h3><Icon name="house" size={20} class="facility-icon" /> 配套設施</h3>
          <ul>
            <li>休息區 - 舒適的休息空間，家長觀課區</li>
            <li>小教室 - 理論課程教學、影片分析使用</li>
            <li>更衣室與淋浴間 - 男女分離，乾淨衛生</li>
            <li>專屬置物櫃 - 會員專用，安全便利</li>
          </ul>
        </div>
      </div>

      <div class="venue-specs card">
        <h2>場地規格</h2>
        <div class="specs-grid">
          <div class="spec-item">
            <strong>訓練設施：</strong>
            <span>12 項專業體操訓練器材</span>
          </div>
          <div class="spec-item">
            <strong>場地面積：</strong>
            <span>約 300 平方公尺 (含訓練區與休息區)</span>
          </div>
          <div class="spec-item">
            <strong>天花板高度：</strong>
            <span>6.5 公尺，適合各種翻騰動作</span>
          </div>
          <div class="spec-item">
            <strong>地板材質：</strong>
            <span>專業體操地墊 + 彈性地板</span>
          </div>
          <div class="spec-item">
            <strong>安全措施：</strong>
            <span>全場監控、AED設備、專業防護墊</span>
          </div>
          <div class="spec-item">
            <strong>空調系統：</strong>
            <span>中央空調，全年恆溫 22-26°C</span>
          </div>
        </div>
      </div>

      <div class="opening-hours card">
        <h2>營業時間</h2>
        <div class="hours-grid">
          <div class="hours-item">
            <strong>週一至週五：</strong>
            <span>06:00 - 23:00</span>
          </div>
          <div class="hours-item">
            <strong>週六至週日：</strong>
            <span>06:00 - 23:00</span>
          </div>
          <div class="hours-item">
            <strong>國定假日：</strong>
            <span>06:00 - 23:00</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary) 0%, var(--df-primary-dark) 100%);
    color: var(--df-text-on-dark);
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-text-on-dark);
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .venue-details {
    padding: var(--spacing-xl) 0;
  }

  .venue-intro {
    margin-bottom: var(--spacing-lg);
  }

  .venue-intro h2 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
  }

  .facilities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .facility-card {
    background: var(--df-surface);
    border: 1px solid var(--df-border);
    border-radius: var(--df-radius-lg);
    box-shadow: var(--df-shadow-card);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .facility-card:hover {
    box-shadow: var(--df-shadow-lifted);
    border-color: var(--df-primary);
  }

  .facility-card h3 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
    font-size: 1.3rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  :global(.facility-icon) {
    flex-shrink: 0;
  }

  .facility-card ul {
    list-style: none;
    padding: 0;
  }

  .facility-card li {
    padding: var(--spacing-xs) 0;
    padding-left: var(--spacing-md);
    position: relative;
    color: var(--df-text-dark);
  }

  .facility-card li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--df-accent);
    font-weight: bold;
  }

  .venue-specs {
    margin-bottom: var(--spacing-lg);
  }

  .venue-specs h2,
  .opening-hours h2 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
  }

  .specs-grid,
  .hours-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-md);
  }

  .spec-item,
  .hours-item {
    padding: var(--spacing-sm);
    background-color: var(--df-bg-light);
    border-radius: var(--df-radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .spec-item strong,
  .hours-item strong {
    color: var(--df-primary);
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .facilities-grid {
      grid-template-columns: 1fr;
    }

    .specs-grid,
    .hours-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
