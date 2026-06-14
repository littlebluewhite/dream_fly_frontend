<script lang="ts">
  import { DF_PROOF } from '$lib/data/homeContent';
</script>

<div class="proof">
  <div class="proof-inner">
    {#each DF_PROOF as [title, subtitle], i (title)}
      <div class="proof-item" class:divider={i < DF_PROOF.length - 1}>
        <div class="proof-title">{title}</div>
        <div class="proof-sub">{subtitle}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .proof {
    background: var(--df-ink);
  }
  .proof-inner {
    max-width: 1240px;
    margin: 0 auto;
    padding: 28px 32px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }
  .proof-item {
    padding: 0 24px;
  }
  .proof-item.divider {
    border-right: 1px solid rgba(255, 255, 255, 0.18);
  }
  .proof-title {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
  }
  .proof-sub {
    font-size: var(--df-text-sm);
    color: rgba(255, 255, 255, 0.7);
    margin-top: 4px;
  }

  @media (max-width: 768px) {
    .proof-inner {
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 24px 20px;
    }
    .proof-item {
      padding: 0;
    }
    .proof-item.divider {
      border-right: none;
    }
  }
</style>
