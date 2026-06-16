<script lang="ts">
  import ContactForm from '$lib/components/ContactForm.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  // Contact Page - 聯絡資訊
  const mapAddress = '台北市信義區信義路五段 168 號 3 樓';
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&output=embed`;
  const mapLinkUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`;
</script>

<svelte:head>
  <title>聯絡資訊 - Dream Fly 體操館</title>
</svelte:head>

<div class="contact-page">
  <section class="page-header">
    <div class="container">
      <h1>聯絡資訊</h1>
      <p>歡迎與我們聯繫，我們將竭誠為您服務</p>
    </div>
  </section>

  <section class="contact-content">
    <div class="container">
      <div class="contact-grid">
        <!-- Contact Information -->
        <div class="contact-info">
          <div class="info-card card">
            <h2>聯絡方式</h2>

            <div class="info-item">
              <div class="info-icon"><Icon name="map-pin" size={28} color="var(--df-primary)" /></div>
              <div class="info-details">
                <h3>場館地址</h3>
                <p>台北市信義區信義路五段 168 號 3 樓</p>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon"><Icon name="phone" size={28} color="var(--df-primary)" /></div>
              <div class="info-details">
                <h3>聯絡電話</h3>
                <p>(02) 2345-6789</p>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon"><Icon name="phone" size={28} color="var(--df-primary)" /></div>
              <div class="info-details">
                <h3>手機號碼</h3>
                <p>0912-345-678</p>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon"><Icon name="mail" size={28} color="var(--df-primary)" /></div>
              <div class="info-details">
                <h3>電子郵件</h3>
                <p>info@dreamfly.com.tw</p>
              </div>
            </div>

            <div class="info-item">
              <div class="info-icon"><Icon name="send" size={28} color="var(--df-primary)" /></div>
              <div class="info-details">
                <h3>Line 官方帳號</h3>
                <p>@dreamfly</p>
              </div>
            </div>
          </div>

          <div class="hours-card card">
            <h2>營業時間</h2>
            <div class="hours-list">
              <div class="hours-item">
                <span class="day">週一至週五</span>
                <span class="time">06:00 - 23:00</span>
              </div>
              <div class="hours-item">
                <span class="day">週六至週日</span>
                <span class="time">06:00 - 23:00</span>
              </div>
              <div class="hours-item">
                <span class="day">國定假日</span>
                <span class="time">06:00 - 23:00</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact Form -->
        <div class="contact-form-wrapper">
          <div class="form-card card">
            <h2>線上諮詢</h2>
            <p class="form-description">
              有任何問題或需求嗎？請填寫以下表單，我們將盡快回覆您。
            </p>
            <ContactForm />
          </div>
        </div>
      </div>

      <!-- Map Section -->
      <div class="map-section card">
        <h2>場館位置</h2>
        <div class="map-embed">
          <iframe
            title={'Dream Fly 體操館位置 — ' + mapAddress}
            src={mapEmbedUrl}
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
          ></iframe>
        </div>
        <a class="map-link" href={mapLinkUrl} target="_blank" rel="noopener noreferrer">
          <Icon name="external-link" size={18} color="var(--df-primary)" />
          在 Google 地圖開啟
        </a>
        <div class="directions">
          <h3>交通方式</h3>
          <ul>
            <li><strong>捷運：</strong>市政府站 2 號出口，步行約 5 分鐘</li>
            <li><strong>公車：</strong>多線公車可達，信義行政中心站下車</li>
            <li><strong>停車：</strong>附設地下停車場，憑證可折抵停車費</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary), var(--df-primary-dark));
    color: var(--df-white);
    padding: var(--df-space-8) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-white);
    font-size: 2.5rem;
    margin-bottom: var(--df-space-4);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .contact-content {
    padding: var(--df-space-8) 0;
  }

  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--df-space-6);
    margin-bottom: var(--df-space-8);
  }

  .contact-info {
    display: flex;
    flex-direction: column;
    gap: var(--df-space-6);
  }

  .info-card h2,
  .hours-card h2,
  .form-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: var(--df-space-5);
    padding: var(--df-space-5) 0;
    border-bottom: 1px solid var(--df-border);
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .info-details h3 {
    color: var(--df-text-dark);
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .info-details p {
    color: var(--df-text-light);
    margin-bottom: 0;
  }

  .hours-list {
    display: flex;
    flex-direction: column;
    gap: var(--df-space-4);
  }

  .hours-item {
    display: flex;
    justify-content: space-between;
    padding: var(--df-space-4);
    background-color: var(--df-bg-light);
    border-radius: var(--df-radius-md);
  }

  .hours-item .day {
    font-weight: 600;
    color: var(--df-text-dark);
  }

  .hours-item .time {
    color: var(--df-primary);
    font-weight: 600;
  }

  .form-description {
    color: var(--df-text-light);
    margin-bottom: var(--df-space-5);
  }

  .map-section h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .map-embed {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: var(--df-radius-md);
    border: 1px solid var(--df-border);
    box-shadow: var(--df-shadow-soft);
    margin-bottom: var(--df-space-4);
  }

  .map-embed iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .map-link {
    display: inline-flex;
    align-items: center;
    gap: var(--df-space-2);
    color: var(--df-primary);
    font-weight: 600;
    text-decoration: none;
    margin-bottom: var(--df-space-5);
  }

  .map-link:hover {
    text-decoration: underline;
  }

  .directions h3 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-4);
  }

  .directions ul {
    list-style: none;
    padding: 0;
  }

  .directions li {
    padding: var(--df-space-4) 0;
    padding-left: var(--df-space-5);
    position: relative;
  }

  .directions li::before {
    content: '➜';
    position: absolute;
    left: 0;
    color: var(--df-accent);
  }

  @media (max-width: 1023px) {
    .contact-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .info-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--df-space-4);
    }
  }
</style>
