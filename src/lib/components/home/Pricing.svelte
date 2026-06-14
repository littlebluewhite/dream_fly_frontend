<script lang="ts">
  import { Card, Button, Kicker, Icon } from '$lib/components/ui';
  import { DF_PLANS } from '$lib/data/homeContent';

  /** Booking callback wired in +page.svelte (shows the toast). */
  export let onBook: () => void = () => {};
</script>

<section id="pricing" class="pricing">
  <div class="pricing-inner">
    <div class="pricing-head">
      <Kicker>PRICING · 收費方案</Kicker>
      <h2 class="pricing-title">先試上，再選方案</h2>
    </div>
    <div class="pricing-grid">
      {#each DF_PLANS as p (p.name)}
        <Card
          padding={32}
          style={'position:relative;border:' +
            (p.popular ? '2px solid var(--df-primary)' : '1px solid var(--df-border)') +
            ';box-shadow:' +
            (p.popular ? 'var(--df-shadow-lifted)' : 'var(--df-shadow-card)')}
        >
          {#if p.popular}
            <span class="pricing-popular">最受歡迎</span>
          {/if}
          <h3 class="plan-name">{p.name}</h3>
          <div class="plan-price">
            <span class="plan-currency">NT$</span>
            <span class="plan-amount">{p.price}</span>
            <span class="plan-unit">{p.unit}</span>
          </div>
          <div class="plan-feats">
            {#each p.feats as f (f)}
              <div class="plan-feat">
                <Icon name="check" size={17} color="var(--df-success)" />{f}
              </div>
            {/each}
          </div>
          <Button variant={p.popular ? 'primary' : 'secondary'} fullWidth on:click={onBook}>
            {p.cta}
          </Button>
        </Card>
      {/each}
    </div>
  </div>
</section>

<style>
  .pricing {
    background: var(--df-bg-light);
    border-top: 1px solid var(--df-border);
    border-bottom: 1px solid var(--df-border);
  }
  .pricing-inner {
    max-width: 1240px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .pricing-head {
    text-align: center;
    margin-bottom: 48px;
  }
  .pricing-title {
    margin: 10px 0 0;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    align-items: start;
  }
  .pricing-popular {
    position: absolute;
    top: -13px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--df-accent);
    color: var(--df-primary-dark);
    font-size: var(--df-text-xs);
    font-weight: 700;
    padding: 5px 14px;
    border-radius: var(--df-radius-pill);
  }
  .plan-name {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .plan-price {
    margin: 14px 0 20px;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .plan-currency {
    font-size: 16px;
    color: var(--df-text-light);
  }
  .plan-amount {
    font-family: var(--df-font-heading);
    font-size: 40px;
    font-weight: 800;
    color: var(--df-ink);
  }
  .plan-unit {
    font-size: 15px;
    color: var(--df-text-light);
  }
  .plan-feats {
    display: flex;
    flex-direction: column;
    gap: 11px;
    margin-bottom: 24px;
  }
  .plan-feat {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--df-text-sm);
    color: var(--df-text-dark);
  }

  @media (max-width: 768px) {
    .pricing-inner {
      padding: 56px 20px;
    }
    .pricing-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
