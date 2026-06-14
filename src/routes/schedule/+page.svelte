<script lang="ts">
  import ScheduleCalendar from '$lib/components/ScheduleCalendar.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  // Schedule Page - 日程表
</script>

<svelte:head>
  <title>日程表 - Dream Fly 體操館</title>
</svelte:head>

<div class="schedule-page">
  <section class="page-header">
    <div class="container">
      <h1>課程日程表</h1>
      <p>查看體操課程時間表，立即預約您的訓練時段</p>
    </div>
  </section>

  <section class="schedule-intro">
    <div class="container">
      <div class="intro-card card">
        <h2>預約說明</h2>
        <div class="instructions-grid">
          <div class="instruction-item">
            <div class="step-number">1</div>
            <div class="step-content">
              <h3>選擇日期</h3>
              <p>在下方日曆選擇您想預約的日期</p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="step-number">2</div>
            <div class="step-content">
              <h3>選擇時段</h3>
              <p>查看該日期的可用時段並選擇</p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="step-number">3</div>
            <div class="step-content">
              <h3>填寫資料</h3>
              <p>填寫預約人資訊與聯絡方式</p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="step-number">4</div>
            <div class="step-content">
              <h3>完成預約</h3>
              <p>確認資訊後完成線上預約</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="schedule-calendar-section">
    <div class="container">
      <ScheduleCalendar />
    </div>
  </section>

  <section class="booking-rules">
    <div class="container">
      <div class="rules-card card">
        <h2>預約規則</h2>
        <div class="rules-grid">
          <div class="rule-item">
            <h3><Icon name="calendar-days" size={22} /> 預約時間</h3>
            <ul>
              <li>可預約 30 天內的時段</li>
              <li>每次預約最少 2 小時</li>
              <li>最多可預約連續 4 小時</li>
            </ul>
          </div>

          <div class="rule-item">
            <h3><Icon name="clock" size={22} /> 取消規則</h3>
            <ul>
              <li>使用前 24 小時可免費取消</li>
              <li>24 小時內取消收取 50% 費用</li>
              <li>未到場不予退款</li>
            </ul>
          </div>

          <div class="rule-item">
            <h3><Icon name="credit-card" size={22} /> 付款方式</h3>
            <ul>
              <li>線上刷卡付款</li>
              <li>使用回數票或會員卡</li>
              <li>現場付款 (須提前告知)</li>
            </ul>
          </div>

          <div class="rule-item">
            <h3><Icon name="info" size={22} /> 注意事項</h3>
            <ul>
              <li>請穿著運動服裝及室內球鞋</li>
              <li>預約時段前 10 分鐘報到</li>
              <li>逾時視同放棄，不予退款</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="court-info">
    <div class="container">
      <h2 class="text-center mb-lg">課程時段資訊</h2>
      <div class="courts-grid">
        <div class="court-card card">
          <h3><Icon name="baby" size={24} /> 幼兒體操班</h3>
          <p><strong>時段：</strong>週二、週四 16:00-17:00</p>
          <p><strong>適合：</strong>3-6歲幼兒</p>
          <p><strong>收費：</strong>NT$ 3,200 / 月 (4堂)</p>
        </div>

        <div class="court-card card">
          <h3><Icon name="sparkles" size={24} /> 競技啦啦隊</h3>
          <p><strong>時段：</strong>週三、週五 18:00-19:30</p>
          <p><strong>適合：</strong>7-18歲青少年</p>
          <p><strong>收費：</strong>NT$ 4,500 / 月 (8堂)</p>
        </div>

        <div class="court-card card">
          <h3><Icon name="dumbbell" size={24} /> 成人體操班</h3>
          <p><strong>時段：</strong>週一、週三 20:00-21:15</p>
          <p><strong>適合：</strong>18歲以上成人</p>
          <p><strong>收費：</strong>NT$ 3,600 / 月 (4堂)</p>
        </div>

        <div class="court-card card">
          <h3><Icon name="footprints" size={24} /> 跑酷訓練班</h3>
          <p><strong>時段：</strong>週六、週日 14:00-15:30</p>
          <p><strong>適合：</strong>12歲以上</p>
          <p><strong>收費：</strong>NT$ 4,000 / 月 (8堂)</p>
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

  .schedule-intro {
    padding: var(--df-space-8) 0 var(--df-space-6);
  }

  .intro-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-6);
    text-align: center;
  }

  .instructions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--df-space-6);
  }

  .instruction-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--df-space-4);
  }

  .step-number {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, var(--df-primary), var(--df-primary-light));
    color: var(--df-white);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
  }

  .step-content h3 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-2);
    font-size: 1.1rem;
  }

  .step-content p {
    color: var(--df-text-light);
    font-size: 0.95rem;
  }

  .schedule-calendar-section {
    padding: var(--df-space-6) 0 var(--df-space-8);
  }

  .booking-rules {
    background-color: var(--df-bg-light);
    padding: var(--df-space-8) 0;
  }

  .rules-card h2 {
    color: var(--df-primary);
    margin-bottom: var(--df-space-6);
    text-align: center;
  }

  .rules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--df-space-6);
  }

  .rule-item h3 {
    display: flex;
    align-items: center;
    gap: var(--df-space-2);
    color: var(--df-primary);
    margin-bottom: var(--df-space-4);
    font-size: 1.2rem;
  }

  .rule-item ul {
    list-style: none;
    padding: 0;
  }

  .rule-item li {
    padding: var(--df-space-2) 0;
    padding-left: var(--df-space-5);
    position: relative;
    color: var(--df-text-dark);
  }

  .rule-item li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: var(--df-accent);
    font-weight: bold;
  }

  .court-info {
    padding: var(--df-space-8) 0;
  }

  .court-info h2 {
    color: var(--df-primary);
  }

  .courts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--df-space-6);
  }

  .court-card h3 {
    display: flex;
    align-items: center;
    gap: var(--df-space-2);
    color: var(--df-primary);
    margin-bottom: var(--df-space-5);
  }

  .court-card p {
    margin-bottom: var(--df-space-4);
  }

  .court-card strong {
    color: var(--df-text-dark);
  }

  @media (max-width: 767px) {
    .page-header h1 {
      font-size: 2rem;
    }

    .instructions-grid {
      grid-template-columns: 1fr;
    }

    .courts-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
