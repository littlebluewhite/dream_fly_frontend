<script lang="ts">
  import CoachCard from '$lib/components/CoachCard.svelte';

  // Coaches Page - 教練介紹
  const coaches = [
    {
      id: 1,
      name: '王教練',
      title: '總教練 / 體操技術指導',
      specialties: ['競技體操訓練', '幼兒體操教學', '跑酷指導'],
      experience: '15年體操教學經驗，曾為國家體操代表隊選手，專精於基礎動作訓練與進階技巧指導',
      certifications: ['體操A級教練證', '兒童體適能指導員', 'Parkour國際教練認證']
    },
    {
      id: 2,
      name: '李教練',
      title: '競技啦啦隊總監',
      specialties: ['競技啦啦隊編排', '特技動作指導', '舞蹈律動'],
      experience: '10年啦啦隊教學經驗，曾多次帶領隊伍獲得全國賽冠軍，擅長團隊訓練與比賽策略',
      certifications: ['競技啦啦隊教練證', '特技安全指導員', '舞蹈編排專業認證']
    },
    {
      id: 3,
      name: '張教練',
      title: '成人體操指導員',
      specialties: ['成人體適能', '柔軟度訓練', '跳床基礎'],
      experience: '8年成人體操教學經驗，特別擅長零基礎學員教學，耐心引導學員突破心理障礙',
      certifications: ['體操B級教練證', '成人體適能指導員', '運動傷害防護員']
    },
    {
      id: 4,
      name: '陳教練',
      title: '幼兒體操專任教練',
      specialties: ['幼兒動作發展', '遊戲化教學', '感覺統合訓練'],
      experience: '6年幼兒體操教學經驗，具備幼兒教育背景，深入了解兒童發展階段與學習需求',
      certifications: ['幼兒體操教練證', '幼兒教育學士學位', '感覺統合訓練師認證']
    }
  ];
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
      <div class="coaches-grid">
        {#each coaches as coach (coach.id)}
          <CoachCard {coach} />
        {/each}
      </div>
    </div>
  </section>

  <section class="coaching-philosophy">
    <div class="container">
      <h2 class="text-center mb-lg">教學理念</h2>
      <div class="philosophy-grid">
        <div class="philosophy-card card">
          <h3>🎯 個人化訓練</h3>
          <p>根據每位學員的程度和目標，量身打造專屬訓練計畫</p>
        </div>
        <div class="philosophy-card card">
          <h3>📈 循序漸進</h3>
          <p>從基礎到進階，系統化的教學方式確保穩定進步</p>
        </div>
        <div class="philosophy-card card">
          <h3>💪 全方位發展</h3>
          <p>技術、體能、心理素質三位一體的完整訓練</p>
        </div>
        <div class="philosophy-card card">
          <h3>🏆 實戰導向</h3>
          <p>結合實戰經驗，培養比賽所需的技巧與心態</p>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .page-header {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    color: var(--color-white);
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .page-header h1 {
    color: var(--color-white);
    font-size: 2.5rem;
    margin-bottom: var(--spacing-sm);
  }

  .page-header p {
    font-size: 1.2rem;
    color: var(--color-accent);
  }

  .coaches-intro {
    padding: var(--spacing-xl) 0 var(--spacing-lg);
  }

  .intro-card h2 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-md);
  }

  .coaches-list {
    padding-bottom: var(--spacing-xl);
  }

  .coaches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-lg);
  }

  .coaching-philosophy {
    background-color: var(--color-bg);
    padding: var(--spacing-xl) 0;
  }

  .philosophy-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
  }

  .philosophy-card {
    text-align: center;
  }

  .philosophy-card h3 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-sm);
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
