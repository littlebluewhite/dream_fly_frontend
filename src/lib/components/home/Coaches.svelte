<script lang="ts">
  import { Card, Badge, Tag, Button, Kicker, Icon } from '$lib/components/ui';
  import { featuredCoaches } from '$lib/data/coaches';
</script>

<section id="coaches" class="coaches">
  <div class="coaches-head">
    <div>
      <Kicker>COACHES · 教練團隊</Kicker>
      <h2 class="coaches-title">陪孩子安全成長的人</h2>
    </div>
    <Button variant="secondary" href="/coaches">看所有教練</Button>
  </div>
  <div class="coaches-grid">
    {#each featuredCoaches as c (c.slug)}
      <Card href={'/coaches/' + c.slug} hoverable padding={0} class="coach-card">
        <div class="coach-photo" style="background:#E5E7EB url('{c.photo}') center/cover"></div>
        <div class="coach-body">
          <div class="coach-name-row">
            <h3 class="coach-name">{c.name}</h3>
            <Badge tone="primary">資歷 {c.years}</Badge>
          </div>
          <div class="coach-role">{c.title}</div>
          <div class="coach-stars">
            {#each Array(5) as _, i (i)}
              <Icon name="star" size={16} color="var(--df-accent)" />
            {/each}
          </div>
          <div class="coach-tags">
            {#each c.tags as t (t)}
              <Tag>{t}</Tag>
            {/each}
          </div>
        </div>
      </Card>
    {/each}
  </div>
</section>

<style>
  .coaches {
    max-width: 1240px;
    margin: 0 auto;
    padding: 84px 32px;
  }
  .coaches-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 44px;
    gap: 24px;
  }
  .coaches-title {
    margin: 10px 0 0;
    font-family: var(--df-font-heading);
    font-size: 36px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .coaches-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .coaches-grid :global(.coach-card) {
    overflow: hidden;
  }
  .coach-photo {
    height: 240px;
  }
  .coach-body {
    padding: 22px;
  }
  .coach-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .coach-name {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .coach-role {
    font-size: var(--df-text-sm);
    color: var(--df-text-light);
    margin: 5px 0 12px;
  }
  .coach-stars {
    display: flex;
    gap: 3px;
    margin-bottom: 14px;
  }
  .coach-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .coaches {
      padding: 56px 20px;
    }
    .coaches-head {
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;
    }
    .coaches-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
