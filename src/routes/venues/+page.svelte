<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { Skeleton, SkelCard, ErrorState, LoadGate } from '$lib/components/ui';
  import { createLoadGate } from '$lib/load-gate';
  import { listVenues, type ApiVenue } from '$lib/public/api';
  // Venues Page - 場館介紹（僅列表接真 API；12 個詳頁保留在地文案，不在本任務範圍）

  let venues: ApiVenue[] = [];

  const gate = createLoadGate({
    fetch: listVenues,
    onData: (v) => {
      venues = v;
    }
  });
  onMount(() => {
    gate.load();
  });
</script>

<svelte:head>
  <title>場館介紹 - Dream Fly 體操館</title>
</svelte:head>

<div class="venues-page">
  <section class="page-header">
    <div class="container">
      <h1>場館介紹</h1>
      <p>專業體操訓練設施與安全防護配備</p>
    </div>
  </section>

  <section class="venue-details">
    <div class="container">
      <div class="venue-intro card">
        <h2>關於我們的場館</h2>
        <p>
          Dream Fly 體操館擁有完整的專業體操訓練設施，包含12項訓練器材與安全防護設備。
          我們致力於提供最安全、最專業的訓練環境，讓每位學員都能在安全的環境中挑戰自我、突破極限。
        </p>
      </div>

      <LoadGate {gate}>
        <div class="facilities-grid" data-testid="venues-skeleton" slot="loading">
          {#each [0, 1, 2, 3] as i (i)}
            <SkelCard>
              <Skeleton w="60%" h={22} r={6} style="margin-bottom:12px" />
              <Skeleton w="100%" h={60} r={8} />
            </SkelCard>
          {/each}
        </div>

        <div class="facilities-grid">
          {#each venues as v (v.id)}
            <div class="facility-card card">
              {#if v.image_url}
                <img class="venue-image" src={v.image_url} alt={v.name} />
              {/if}
              <h3><Icon name="dumbbell" size={20} class="facility-icon" /> {v.name}</h3>
              {#if v.description}<p>{v.description}</p>{/if}
              {#if v.features.length}
                <ul>
                  {#each v.features as feature}
                    <li>{feature}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
        </div>

        <div class="card" style="padding:0; margin-bottom: var(--spacing-lg)" slot="error">
          <ErrorState onRetry={gate.refresh} />
        </div>
      </LoadGate>

      <div class="venue-specs card">
        <h2>場地規格</h2>
        <div class="specs-grid">
          <div class="spec-item">
            <strong>訓練設施：</strong>
            <span>12 項專業體操訓練器材</span>
          </div>
          <div class="spec-item">
            <strong>場地面積：</strong>
            <span>約 300 平方公尺 (含訓練區與休息區)</span>
          </div>
          <div class="spec-item">
            <strong>天花板高度：</strong>
            <span>6.5 公尺，適合各種翻騰動作</span>
          </div>
          <div class="spec-item">
            <strong>地板材質：</strong>
            <span>專業體操地墊 + 彈性地板</span>
          </div>
          <div class="spec-item">
            <strong>安全措施：</strong>
            <span>全場監控、AED設備、專業防護墊</span>
          </div>
          <div class="spec-item">
            <strong>空調系統：</strong>
            <span>中央空調，全年恆溫 22-26°C</span>
          </div>
        </div>
      </div>

      <div class="opening-hours card">
        <h2>營業時間</h2>
        <div class="hours-grid">
          <div class="hours-item">
            <strong>週一至週五：</strong>
            <span>06:00 - 23:00</span>
          </div>
          <div class="hours-item">
            <strong>週六至週日：</strong>
            <span>06:00 - 23:00</span>
          </div>
          <div class="hours-item">
            <strong>國定假日：</strong>
            <span>06:00 - 23:00</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary) 0%, var(--df-primary-dark) 100%);
    color: var(--df-text-on-dark);
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-text-on-dark);
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .venue-details {
    padding: var(--spacing-xl) 0;
  }

  .venue-intro {
    margin-bottom: var(--spacing-lg);
  }

  .venue-intro h2 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
  }

  .facilities-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  .facility-card {
    background: var(--df-surface);
    border: 1px solid var(--df-border);
    border-radius: var(--df-radius-lg);
    box-shadow: var(--df-shadow-card);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .facility-card:hover {
    box-shadow: var(--df-shadow-lifted);
    border-color: var(--df-primary);
  }

  .venue-image {
    width: 100%;
    height: 160px;
    object-fit: cover;
    border-radius: var(--df-radius-md);
    margin-bottom: var(--spacing-md);
  }

  .facility-card h3 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
    font-size: 1.3rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  :global(.facility-icon) {
    flex-shrink: 0;
  }

  .facility-card p {
    color: var(--df-text-light);
    margin-bottom: var(--spacing-sm);
  }

  .facility-card ul {
    list-style: none;
    padding: 0;
  }

  .facility-card li {
    padding: var(--spacing-xs) 0;
    padding-left: var(--spacing-md);
    position: relative;
    color: var(--df-text-dark);
  }

  .facility-card li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--df-accent);
    font-weight: bold;
  }

  .venue-specs {
    margin-bottom: var(--spacing-lg);
  }

  .venue-specs h2,
  .opening-hours h2 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
  }

  .specs-grid,
  .hours-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-md);
  }

  .spec-item,
  .hours-item {
    padding: var(--spacing-sm);
    background-color: var(--df-bg-light);
    border-radius: var(--df-radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .spec-item strong,
  .hours-item strong {
    color: var(--df-primary);
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .facilities-grid {
      grid-template-columns: 1fr;
    }

    .specs-grid,
    .hours-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
