<script lang="ts">
  import { Button } from '$lib/components/ui';

  /** Booking callback wired in +page.svelte (shows the toast). */
  export let onBook: () => void = () => {};
</script>

<section class="cta">
  <div class="cta-overlay"></div>
  <div class="cta-inner">
    <div class="cta-copy">
      <h2 class="cta-title">先試一堂，再決定孩子的體操路線</h2>
      <p class="cta-lede">
        免費預約 15 分鐘評估與 60 分鐘體驗，教練會給出最適合的班級與時段建議。
      </p>
    </div>
    <div class="cta-actions">
      <Button variant="accent" size="lg" on:click={onBook}>預約免費試上</Button>
      <Button
        variant="secondary"
        size="lg"
        href="/contact"
        style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.6)"
      >聯絡我們</Button>
    </div>
  </div>
</section>

<style>
  .cta {
    position: relative;
    overflow: hidden;
    background: var(--df-ink);
  }
  .cta-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, #004d99 0%, #0066cc 60%, #0f172a 100%);
    opacity: 0.96;
  }
  .cta-inner {
    position: relative;
    max-width: 1240px;
    margin: 0 auto;
    padding: 72px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    flex-wrap: wrap;
  }
  .cta-title {
    margin: 0 0 12px;
    font-family: var(--df-font-heading);
    font-size: 38px;
    font-weight: 700;
    color: #fff;
    line-height: 1.3;
  }
  .cta-lede {
    margin: 0;
    font-size: 17px;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.6;
    max-width: 560px;
  }
  .cta-actions {
    display: flex;
    gap: 14px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .cta-inner {
      padding: 56px 20px;
    }
    .cta-actions {
      flex-wrap: wrap;
    }
  }
</style>
