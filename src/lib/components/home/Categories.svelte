<script lang="ts">
  import { Card, Badge, Kicker, Icon } from '$lib/components/ui';
  import { DF_CATS } from '$lib/data/homeContent';
</script>

<section id="courses" class="cats">
  <div class="cats-inner">
    <div class="cats-head">
      <Kicker>COURSES · 課程分類</Kicker>
      <h2 class="cats-title">找到適合的起點</h2>
    </div>
    <div class="cats-grid">
      {#each DF_CATS as c (c.name)}
        <Card href={c.href} hoverable padding={28} class="cat-card">
          <div class="cat-icon">
            <Icon name={c.icon} size={28} color="var(--df-primary)" />
          </div>
          <div class="cat-name-row">
            <h3 class="cat-name">{c.name}</h3>
            <Badge tone="primary">{c.age}</Badge>
          </div>
          <p class="cat-desc">{c.desc}</p>
          <div class="cat-points">
            {#each c.points as p (p)}
              <div class="cat-point">
                <Icon name="check" size={15} color="var(--df-success)" />{p}
              </div>
            {/each}
          </div>
          <span class="cat-cta">了解課程 <Icon name="arrow-right" size={15} /></span>
        </Card>
      {/each}
    </div>
  </div>
</section>

<style>
  .cats {
    background: var(--df-bg-light);
    border-top: 1px solid var(--df-border);
    border-bottom: 1px solid var(--df-border);
  }
  .cats-inner {
    max-width: 1240px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .cats-head {
    text-align: center;
    margin-bottom: 48px;
  }
  .cats-title {
    margin: 10px 0 0;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .cats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }
  .cats-grid :global(.cat-card) {
    display: flex;
    flex-direction: column;
  }
  .cat-icon {
    width: 56px;
    height: 56px;
    border-radius: var(--df-radius-lg);
    background: var(--df-primary-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }
  .cat-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .cat-name {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .cat-desc {
    margin: 0 0 16px;
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
    line-height: 1.6;
  }
  .cat-points {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-bottom: 18px;
  }
  .cat-point {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--df-text-sm);
    color: var(--df-text-dark);
  }
  .cat-cta {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--df-text-sm);
    font-weight: var(--df-weight-semibold);
    color: var(--df-primary);
  }

  @media (max-width: 768px) {
    .cats-inner {
      padding: 56px 20px;
    }
    .cats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
