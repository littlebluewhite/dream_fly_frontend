<script lang="ts">
  const venueLinks = [
    { label: '場館介紹', href: '/venues' },
    { label: '教練介紹', href: '/coaches' },
    { label: '課程介紹', href: '/courses' },
    { label: '日程表', href: '/schedule' }
  ];

  const contactLinks = [
    { label: '聯絡資訊', href: '/contact' },
    { label: '購票資訊', href: '/tickets' },
    { label: '常見問題', href: '/#faq' },
    { label: '交通方式', href: '/contact' }
  ];

  const socials = [
    { label: 'FB', href: 'https://facebook.com' },
    { label: 'IG', href: 'https://instagram.com' },
    { label: 'Line', href: 'https://line.me' }
  ];
</script>

<footer class="footer">
  <div class="container">
    <div class="footer-content">
      <div class="footer-brand">
        <div class="brand-row">
          <img src="/logo-df-monogram.png" alt="Dream Fly" class="brand-logo" height="32" />
          <span class="brand-name">Dream Fly 體操館</span>
        </div>
        <p class="brand-tagline">
          專業體操訓練中心，提供幼兒體操、競技啦啦隊、成人體操與跑酷課程。
        </p>
      </div>

      <div class="footer-col">
        <div class="col-title">場館資訊</div>
        <ul class="footer-links">
          {#each venueLinks as link}
            <li><a href={link.href}>{link.label}</a></li>
          {/each}
        </ul>
      </div>

      <div class="footer-col">
        <div class="col-title">聯絡我們</div>
        <ul class="footer-links">
          {#each contactLinks as link}
            <li><a href={link.href}>{link.label}</a></li>
          {/each}
        </ul>
      </div>

      <div class="footer-col">
        <div class="col-title">追蹤我們</div>
        <div class="social-links">
          {#each socials as s}
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              class="social-link"
              aria-label={s.label}>{s.label}</a>
          {/each}
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>© 2026 Dream Fly 夢飛體操館. All rights reserved.</p>
    </div>
  </div>
</footer>

<style>
  .footer {
    background: var(--df-ink);
    color: #fff;
  }

  .footer-content {
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
    gap: 40px;
    padding-top: 56px;
    padding-bottom: var(--df-space-6);
  }

  .footer-brand {
    max-width: 280px;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: var(--df-space-3);
    margin-bottom: var(--df-space-4);
  }

  .brand-logo {
    height: 32px;
    width: auto;
    display: block;
  }

  .brand-name {
    font-family: var(--df-font-heading);
    font-weight: 800;
    font-size: 20px;
    color: #fff;
  }

  .brand-tagline {
    margin: 0;
    font-size: var(--df-text-sm);
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.7;
  }

  .col-title {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    margin-bottom: var(--df-space-4);
  }

  .footer-links {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .footer-links li {
    margin-bottom: var(--df-space-3);
  }

  .footer-links a {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: var(--df-text-sm);
    transition: color var(--transition-fast);
  }

  .footer-links a:hover {
    color: #fff;
  }

  .social-links {
    display: flex;
    gap: var(--df-space-3);
  }

  .social-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    border-radius: var(--df-radius-pill);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: background-color var(--transition-fast);
  }

  .social-link:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .footer-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    text-align: center;
    padding: 20px 0;
  }

  .footer-bottom p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Mobile */
  @media (max-width: 767px) {
    .footer-content {
      grid-template-columns: 1fr 1fr;
      gap: var(--df-space-6);
      padding-top: var(--df-space-8);
    }

    .footer-brand {
      grid-column: 1 / -1;
      max-width: none;
    }
  }
</style>
