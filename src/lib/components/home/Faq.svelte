<script lang="ts">
  import { Card, Kicker, Icon } from '$lib/components/ui';
  import { DF_FAQ } from '$lib/data/homeContent';

  let open = 0;

  function toggle(i: number) {
    open = open === i ? -1 : i;
  }
</script>

<section id="faq" class="faq">
  <div class="faq-inner">
    <div class="faq-head">
      <Kicker>FAQ · 常見問題</Kicker>
      <h2 class="faq-title">報名前想知道的事</h2>
    </div>
    <div class="faq-list">
      {#each DF_FAQ as f, i (f.q)}
        {@const isOpen = open === i}
        <Card
          padding={0}
          class="faq-card"
          style={'overflow:hidden;border:1px solid ' +
            (isOpen ? 'var(--df-border-strong)' : 'var(--df-border)')}
        >
          <button class="faq-q" on:click={() => toggle(i)} aria-expanded={isOpen}>
            <span class="faq-q-text">{f.q}</span>
            <span class="faq-chevron" class:open={isOpen}>
              <Icon name="chevron-down" size={20} color="var(--df-primary)" />
            </span>
          </button>
          {#if isOpen}
            <div class="faq-a">{f.a}</div>
          {/if}
        </Card>
      {/each}
    </div>
  </div>
</section>

<style>
  .faq {
    background: var(--df-bg-light);
    border-top: 1px solid var(--df-border);
    border-bottom: 1px solid var(--df-border);
  }
  .faq-inner {
    max-width: 880px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .faq-head {
    text-align: center;
    margin-bottom: 48px;
  }
  .faq-title {
    margin: 10px 0 0;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .faq-q {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--df-font-body);
  }
  .faq-q-text {
    font-size: 16px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .faq-chevron {
    flex-shrink: 0;
    display: inline-flex;
    transition: transform 0.18s ease;
  }
  .faq-chevron.open {
    transform: rotate(180deg);
  }
  .faq-a {
    padding: 0 24px 22px;
    font-size: 15px;
    color: var(--df-text-light);
    line-height: 1.7;
  }

  @media (max-width: 768px) {
    .faq-inner {
      padding: 56px 20px;
    }
  }
</style>
