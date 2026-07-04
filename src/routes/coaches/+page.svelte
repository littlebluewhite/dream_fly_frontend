<script lang="ts">
  import { onMount } from 'svelte';
  import CoachCard from '$lib/components/CoachCard.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { Skeleton, SkelCard, ErrorState } from '$lib/components/ui';
  import { listCoaches } from '$lib/public/api';
  import { toMarketingCoach } from '$lib/public/adapters';
  import type { Coach } from '$lib/data/coaches';

  // Coaches Page - 教練介紹（seam 接真 API）

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let coaches: Coach[] = [];

  function load() {
    phase = 'loading';
    listCoaches()
      .then((apiCoaches) => {
        coaches = apiCoaches.map(toMarketingCoach);
        phase = 'ready';
      })
      .catch(() => {
        phase = 'error';
      });
  }
  onMount(load);
</script>

<svelte:head>
  <title>教練介紹 - Dream Fly 體操館</title>
</svelte:head>

<div class="coaches-page">
  <section class="page-header">
    <div class="container">
      <h1>教練介紹</h1>
      <p>專業認證的教練團隊，為您提供最優質的訓練指導</p>
    </div>
  </section>

  <section class="coaches-intro">
    <div class="container">
      <div class="intro-card card">
        <h2>我們的教練團隊</h2>
        <p>
          Dream Fly 擁有經驗豐富的專業體操教練團隊，每位教練都持有專業體操教練證照，
          並具備多年的教學與競賽經驗。從幼兒啟蒙到競技培訓，從基礎體操到跑酷訓練，
          我們提供安全、專業且個人化的指導，讓每位學員都能在適合的環境中成長。
        </p>
      </div>
    </div>
  </section>

  <section class="coaches-list">
    <div class="container">
      {#if phase === 'ready'}
        <div class="coaches-grid">
          {#each coaches as coach (coach.id)}
            <CoachCard {coach} />
          {/each}
        </div>
      {:else if phase === 'error'}
        <div class="card" style="padding:0"><ErrorState onRetry={load} /></div>
      {:else}
        <div class="coaches-grid" data-testid="coaches-skeleton">
          {#each [0, 1, 2, 3] as i (i)}
            <SkelCard>
              <Skeleton w={80} h={80} r={40} style="margin-bottom:14px" />
              <Skeleton w="60%" h={22} r={6} style="margin-bottom:10px" />
              <Skeleton w="100%" h={60} r={8} />
            </SkelCard>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <section class="coaching-philosophy">
    <div class="container">
      <h2 class="text-center mb-lg">教學理念</h2>
      <div class="philosophy-grid">
        <div class="philosophy-card card">
          <h3><Icon name="target" size={24} /> 個人化訓練</h3>
          <p>根據每位學員的程度和目標，量身打造專屬訓練計畫</p>
        </div>
        <div class="philosophy-card card">
          <h3><Icon name="activity" size={24} /> 循序漸進</h3>
          <p>從基礎到進階，系統化的教學方式確保穩定進步</p>
        </div>
        <div class="philosophy-card card">
          <h3><Icon name="dumbbell" size={24} /> 全方位發展</h3>
          <p>技術、體能、心理素質三位一體的完整訓練</p>
        </div>
        <div class="philosophy-card card">
          <h3><Icon name="award" size={24} /> 實戰導向</h3>
          <p>結合實戰經驗，培養比賽所需的技巧與心態</p>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--df-primary), var(--df-primary-dark));
    color: var(--df-white);
    padding: var(--df-space-8) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--df-white);
    font-size: 2.5rem;
    margin-bottom: var(--df-space-4);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--df-accent);
  }

  .coaches-intro {
    padding: var(--df-space-8) 0 var(--df-space-6);
  }

  .intro-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .coaches-list {
    padding-bottom: var(--df-space-8);
  }

  .coaches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--df-space-6);
  }

  .coaching-philosophy {
    background-color: var(--df-bg-light);
    padding: var(--df-space-8) 0;
  }

  .philosophy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--df-space-6);
  }

  .philosophy-card {
    text-align: center;
  }

  .philosophy-card h3 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    color: var(--df-primary);
    margin-bottom: var(--df-space-4);
    font-size: 1.3rem;
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .coaches-grid {
      grid-template-columns: 1fr;
    }

    .philosophy-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
