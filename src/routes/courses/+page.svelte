<script lang="ts">
  import CourseCard from '$lib/components/CourseCard.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { cart } from '$lib/member/stores';
  import { marketingCourseToCartItem } from '$lib/member/data';
  import { toasts } from '$lib/stores/marketingToasts';

  // Courses Page - 課程介紹
  const courses = [
    {
      id: 1,
      name: '幼兒體操',
      level: '幼兒',
      duration: '每週一次，每次60分鐘',
      price: 'NT$ 3,200/月 (4堂)',
      description: '專為3-6歲幼兒設計的體操啟蒙課程，透過遊戲化教學培養基礎動作能力、協調性與柔軟度',
      includes: ['基礎翻滾訓練 - 前滾翻、後滾翻', '平衡感訓練 - 平衡木、單腳站立', '柔軟度開發 - 伸展、劈腿練習', '小跳床入門 - 基礎彈跳技巧', '遊戲化教學 - 寓教於樂的課程設計']
    },
    {
      id: 2,
      name: '競技啦啦隊',
      level: '競技',
      duration: '每週兩次，每次90分鐘',
      price: 'NT$ 4,500/月',
      description: '專業競技啦啦隊訓練課程，培養團隊合作精神與特技技能，定期參加全國性比賽',
      includes: ['特技動作訓練 - 翻騰、金字塔、拋接', '舞蹈編排 - 音樂配合、隊形變化', '團隊配合 - 默契培養、信任建立', '比賽準備 - 全國賽代表隊選拔', '音樂律動 - 節奏感與表現力訓練']
    },
    {
      id: 3,
      name: '成人體操',
      level: '成人',
      duration: '每週一次，每次75分鐘',
      price: 'NT$ 3,600/月 (4堂)',
      description: '專為18歲以上成人設計的體操課程，提升整體體能、柔軟度，同時釋放工作壓力',
      includes: ['基礎體操動作 - 翻滾、倒立、側手翻', '跳床訓練 - 彈跳技巧、空中控制', '核心肌群強化 - 腹肌、背肌訓練', '伸展放鬆 - 全身柔軟度提升', '減壓運動 - 舒緩身心、建立自信']
    },
    {
      id: 4,
      name: '跑酷',
      level: '進階',
      duration: '每週兩次，每次90分鐘',
      price: 'NT$ 4,000/月',
      description: '結合體操與街頭運動的跑酷訓練課程，培養敏捷性、力量與空間感知能力',
      includes: ['基礎翻滾技術 - 安全落地、前後空翻', '跳躍技巧 - 精準跳躍、距離判斷', '攀爬訓練 - 牆面攀爬、翻越障礙', '落地緩衝 - 減震技巧、保護關節', '障礙突破 - 創意路線、流暢動作']
    }
  ];

  function addCourseToCart(course: typeof courses[0]) {
    cart.addItem(marketingCourseToCartItem(course));
    toasts.notify('success', `已將 ${course.name} 加入購物車`);
  }
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
      <div class="courses-grid">
        {#each courses as course (course.id)}
          <CourseCard {course} showCartButton={true} onAddToCart={() => addCourseToCart(course)} />
        {/each}
      </div>
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
