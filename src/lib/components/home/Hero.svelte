<script lang="ts">
  import { Button, Icon } from '$lib/components/ui';

  /** Booking callback wired in +page.svelte (shows the toast). */
  export let onBook: () => void = () => {};
</script>

<section id="top" class="hero">
  <div class="hero-photo"></div>
  <div class="hero-overlay"></div>
  <div class="hero-inner">
    <div class="hero-copy">
      <span class="hero-pill">3 歲起・初學到進階・先試上再報名</span>
      <h1 class="hero-title">先試一堂，<br />再決定孩子的體操路線</h1>
      <p class="hero-lede">
        Dream Fly 依年齡、程度與安全需求安排幼兒體操、兒童基礎、競技啦啦隊與成人體操。第一次來館會先評估，再推薦適合班級。
      </p>
      <div class="hero-actions">
        <Button variant="primary" size="lg" on:click={onBook}>預約免費試上</Button>
        <Button
          variant="secondary"
          size="lg"
          href="#courses"
          style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.6)"
        >查看課程與時段</Button>
      </div>
      <div class="hero-stats-inline">
        <span><Icon name="users" size={16} color="var(--df-accent)" />小班制</span>
        <span><Icon name="shield-check" size={16} color="var(--df-accent)" />安全保護</span>
        <span><Icon name="calendar-days" size={16} color="var(--df-accent)" />平日/週末時段</span>
      </div>
    </div>
    <div class="hero-card">
      <div class="hero-card-kicker">試上流程</div>
      <div class="hero-card-headline">15 分鐘評估<br />+ 60 分鐘體驗</div>
      <p class="hero-card-desc">
        教練會確認孩子年齡、柔軟度、力量與是否有基礎動作，體驗後給出適合班級與時段建議。
      </p>
      <div class="hero-card-stats">
        <div><div class="num">3+</div><div class="lbl">歲可試上</div></div>
        <div><div class="num">4</div><div class="lbl">類課程</div></div>
        <div><div class="num">1:6</div><div class="lbl">師生比</div></div>
      </div>
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    height: 560px;
    overflow: hidden;
  }
  .hero-photo {
    position: absolute;
    inset: 0;
    background: #0f172a
      url('https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=70')
      center / cover;
  }
  .hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #0f172af2 0%, #0f172acc 55%, #0f172a55 100%);
  }
  .hero-inner {
    position: relative;
    max-width: 1240px;
    margin: 0 auto;
    height: 100%;
    padding: 0 32px;
    display: flex;
    align-items: center;
    gap: 48px;
  }
  .hero-copy {
    width: 660px;
  }
  .hero-pill {
    display: inline-block;
    padding: 8px 16px;
    border-radius: var(--df-radius-pill);
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    margin-bottom: 22px;
  }
  .hero-title {
    margin: 0;
    font-family: var(--df-font-body);
    font-size: 52px;
    font-weight: 700;
    line-height: 1.25;
    color: #fff;
  }
  .hero-lede {
    margin: 20px 0 28px;
    font-size: 18px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
    max-width: 560px;
  }
  .hero-actions {
    display: flex;
    gap: 16px;
    margin-bottom: 26px;
  }
  .hero-stats-inline {
    display: flex;
    gap: 22px;
    color: rgba(255, 255, 255, 0.85);
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-medium);
  }
  .hero-stats-inline span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  .hero-card {
    width: 340px;
    background: rgba(255, 255, 255, 0.96);
    border-radius: var(--df-radius-lg);
    padding: 28px;
    box-shadow: var(--df-shadow-strong);
  }
  .hero-card-kicker {
    font-size: var(--df-text-sm);
    font-weight: 700;
    color: var(--df-primary);
  }
  .hero-card-headline {
    font-size: 24px;
    font-weight: 700;
    color: var(--df-text-dark);
    margin: 8px 0 10px;
    line-height: 1.3;
  }
  .hero-card-desc {
    margin: 0;
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
    line-height: 1.6;
  }
  .hero-card-stats {
    display: flex;
    gap: 24px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--df-border);
  }
  .hero-card-stats .num {
    font-size: 24px;
    font-weight: 700;
    color: var(--df-primary);
  }
  .hero-card-stats .lbl {
    font-size: var(--df-text-xs);
    color: var(--df-text-light);
  }

  @media (max-width: 768px) {
    .hero {
      height: auto;
    }
    .hero-inner {
      flex-direction: column;
      align-items: stretch;
      gap: 28px;
      padding: 56px 20px;
    }
    .hero-copy,
    .hero-card {
      width: 100%;
    }
    .hero-title {
      font-size: 36px;
    }
    .hero-actions {
      flex-wrap: wrap;
    }
  }
</style>
