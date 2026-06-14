<script lang="ts">
  import { Card, Kicker, Icon } from '$lib/components/ui';
  import { DF_WHY } from '$lib/data/homeContent';
</script>

<section id="why" class="why">
  <div class="why-grid">
    <div class="why-intro">
      <Kicker>WHY DREAM FLY · 為什麼選我們</Kicker>
      <h2 class="why-title">讓家長放心，<br />讓孩子有自信</h2>
      <p class="why-lede">
        我們相信好的體操訓練是循序漸進、以安全為前提的。從第一次到館的評估，到每一堂課的進度紀錄，每一步都讓你看得見孩子的成長。
      </p>
    </div>
    <div class="why-cards">
      {#each DF_WHY as w (w.title)}
        <Card padding={24}>
          <div class="why-icon">
            <Icon name={w.icon} size={26} color="var(--df-primary)" />
          </div>
          <h3 class="why-card-title">{w.title}</h3>
          <p class="why-card-desc">{w.desc}</p>
        </Card>
      {/each}
    </div>
  </div>
</section>

<style>
  .why {
    max-width: 1240px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .why-grid {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 56px;
    align-items: start;
  }
  .why-title {
    margin: 12px 0 16px;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
    line-height: 1.3;
  }
  .why-lede {
    margin: 0;
    font-size: 16px;
    color: var(--df-text-light);
    line-height: 1.7;
  }
  .why-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .why-icon {
    width: 52px;
    height: 52px;
    border-radius: var(--df-radius-lg);
    background: var(--df-primary-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .why-card-title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .why-card-desc {
    margin: 0;
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
    line-height: 1.65;
  }

  @media (max-width: 768px) {
    .why {
      padding: 56px 20px;
    }
    .why-grid {
      grid-template-columns: 1fr;
      gap: 32px;
    }
    .why-cards {
      grid-template-columns: 1fr;
    }
  }
</style>
