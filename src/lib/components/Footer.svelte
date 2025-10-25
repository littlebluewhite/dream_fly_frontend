<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="footer">
  <div class="container">
    <div class="footer-content">
      <div class="footer-section">
        <h3>Dream Fly 體操館</h3>
        <p>專業體操訓練中心，提供幼兒體操、競技啦啦隊、成人體操與跑酷課程</p>
      </div>

      <div class="footer-section">
        <h4>快速連結</h4>
        <ul class="footer-links">
          <li><a href="/venues">場館介紹</a></li>
          <li><a href="/coaches">教練介紹</a></li>
          <li><a href="/courses">課程介紹</a></li>
          <li><a href="/schedule">日程表</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>聯絡我們</h4>
        <ul class="footer-links">
          <li><a href="/contact">聯絡資訊</a></li>
          <li><a href="/tickets">購票資訊</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>追蹤我們</h4>
        <div class="social-links">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Facebook">FB</a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Instagram">IG</a>
          <a href="https://line.me" target="_blank" rel="noopener noreferrer" class="social-link" aria-label="Line">Line</a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; {currentYear} Dream Fly 體操館. All rights reserved.</p>
    </div>
  </div>
</footer>

<style>
  .footer {
    background-color: var(--color-primary);
    color: var(--color-white);
    padding: var(--spacing-xl) 0 var(--spacing-md);
    margin-top: var(--spacing-xl);
  }

  .footer-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .footer-section h3 {
    color: var(--color-accent);
    margin-bottom: var(--spacing-sm);
    font-size: 1.25rem;
  }

  .footer-section h4 {
    color: var(--color-white);
    margin-bottom: var(--spacing-sm);
    font-size: 1rem;
  }

  .footer-section p {
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.6;
  }

  .footer-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .footer-links li {
    margin-bottom: var(--spacing-xs);
  }

  .footer-links a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .footer-links a:hover {
    color: var(--color-accent);
  }

  .social-links {
    display: flex;
    gap: var(--spacing-sm);
  }

  .social-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--color-white);
    border-radius: 50%;
    text-decoration: none;
    font-weight: 600;
    transition: all var(--transition-fast);
  }

  .social-link:hover {
    background-color: var(--color-accent);
    color: var(--color-primary);
    transform: translateY(-2px);
  }

  .footer-bottom {
    text-align: center;
    padding-top: var(--spacing-md);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .footer-bottom p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
  }

  /* Mobile */
  @media (max-width: 767px) {
    .footer-content {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }

    .footer {
      padding: var(--spacing-lg) 0 var(--spacing-sm);
    }
  }
</style>
