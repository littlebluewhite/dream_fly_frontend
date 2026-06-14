<script lang="ts">
  import { Card, Kicker, Icon } from '$lib/components/ui';
  import { DF_VOICES } from '$lib/data/homeContent';
</script>

<section id="voices" class="voices">
  <div class="voices-head">
    <Kicker>VOICES · 學員回饋</Kicker>
    <h2 class="voices-title">家長與學員怎麼說</h2>
  </div>
  <div class="voices-grid">
    {#each DF_VOICES as v (v.name)}
      <Card padding={28} class="voice-card">
        <div class="voice-stars">
          {#each Array(5) as _, i (i)}
            <Icon name="star" size={16} color="var(--df-accent)" />
          {/each}
        </div>
        <p class="voice-quote">「{v.quote}」</p>
        <div class="voice-author">
          <div class="voice-avatar">{v.name[0]}</div>
          <div>
            <div class="voice-name">{v.name}</div>
            <div class="voice-meta">{v.meta}</div>
          </div>
        </div>
      </Card>
    {/each}
  </div>
</section>

<style>
  .voices {
    max-width: 1240px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .voices-head {
    text-align: center;
    margin-bottom: 48px;
  }
  .voices-title {
    margin: 10px 0 0;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .voices-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .voices-grid :global(.voice-card) {
    display: flex;
    flex-direction: column;
  }
  .voice-stars {
    display: flex;
    gap: 3px;
    margin-bottom: 16px;
  }
  .voice-quote {
    margin: 0 0 20px;
    font-size: 16px;
    color: var(--df-text-dark);
    line-height: 1.7;
  }
  .voice-author {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .voice-avatar {
    width: 44px;
    height: 44px;
    border-radius: var(--df-radius-pill);
    background: var(--df-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .voice-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .voice-meta {
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
  }

  @media (max-width: 768px) {
    .voices {
      padding: 56px 20px;
    }
    .voices-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
