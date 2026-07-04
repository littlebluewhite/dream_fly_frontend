<script lang="ts">
  import { onMount } from 'svelte';
  import CourseCard from '$lib/components/CourseCard.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { Skeleton, SkelCard, ErrorState } from '$lib/components/ui';
  import { listCourses, listCoaches } from '$lib/public/api';
  import { toCatalogCourse, type CatalogCourse } from '$lib/public/adapters';

  // Courses Page - 課程介紹（seam 接真 API：課程 + 教練列表解出授課教練名稱）

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let courses: CatalogCourse[] = [];

  function load() {
    phase = 'loading';
    Promise.all([listCourses(), listCoaches()])
      .then(([apiCourses, apiCoaches]) => {
        const coachNameById = new Map(apiCoaches.map((co) => [co.id, co.title]));
        courses = apiCourses.map((c) =>
          toCatalogCourse(c, c.coach_id ? coachNameById.get(c.coach_id) : undefined)
        );
        phase = 'ready';
      })
      .catch(() => {
        phase = 'error';
      });
  }
  onMount(load);
</script>

<svelte:head>
  <title>課程介紹 - Dream Fly 體操館</title>
</svelte:head>

<div class="courses-page">
  <section class="page-header">
    <div class="container">
      <h1>課程介紹</h1>
      <p>從初學到進階，完整的訓練課程規劃</p>
    </div>
  </section>

  <section class="courses-intro">
    <div class="container">
      <div class="intro-card card">
        <h2>課程特色</h2>
        <p>
          Dream Fly 提供完整的體操訓練課程，從3歲幼兒到成人，從基礎體操到競技啦啦隊、跑酷訓練。
          所有課程均由專業認證教練授課，採小班制教學，確保每位學員在安全的環境中學習成長。
          我們注重個人進度，並提供定期成果展示與比賽機會。
        </p>
      </div>
    </div>
  </section>

  <section class="courses-list">
    <div class="container">
      {#if phase === 'ready'}
        <div class="courses-grid">
          {#each courses as course (course.id)}
            <CourseCard {course} showCartButton={true} />
          {/each}
        </div>
      {:else if phase === 'error'}
        <div class="card" style="padding:0"><ErrorState onRetry={load} /></div>
      {:else}
        <div class="courses-grid" data-testid="courses-skeleton">
          {#each [0, 1, 2, 3] as i (i)}
            <SkelCard>
              <Skeleton w="60%" h={24} r={6} style="margin-bottom:14px" />
              <Skeleton w="100%" h={80} r={8} style="margin-bottom:14px" />
              <Skeleton w="100%" h={40} r={8} />
            </SkelCard>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <section class="enrollment-info">
    <div class="container">
      <div class="card">
        <h2>報名資訊</h2>
        <div class="info-grid">
          <div class="info-item">
            <h3><Icon name="ticket" size={22} /> 報名方式</h3>
            <p>線上報名、電話報名或現場報名皆可</p>
          </div>
          <div class="info-item">
            <h3><Icon name="users" size={22} /> 班級人數</h3>
            <p>團體班 6-10 人，確保教學品質</p>
          </div>
          <div class="info-item">
            <h3><Icon name="info" size={22} /> 服裝準備</h3>
            <p>請穿著舒適運動服裝，建議赤腳或體操鞋</p>
          </div>
          <div class="info-item">
            <h3><Icon name="credit-card" size={22} /> 優惠方案</h3>
            <p>團報、續報享優惠，詳情請洽櫃台</p>
          </div>
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

  .courses-intro {
    padding: var(--df-space-8) 0 var(--df-space-6);
  }

  .intro-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .courses-list {
    padding-bottom: var(--df-space-8);
  }

  .courses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--df-space-6);
  }

  .enrollment-info {
    background-color: var(--df-bg-light);
    padding: var(--df-space-8) 0;
  }

  .enrollment-info h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-6);
    text-align: center;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--df-space-6);
  }

  .info-item {
    text-align: center;
  }

  .info-item h3 {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--df-space-2);
    color: var(--df-primary);
    margin-bottom: var(--df-space-4);
    font-size: 1.2rem;
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .courses-grid {
      grid-template-columns: 1fr;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
