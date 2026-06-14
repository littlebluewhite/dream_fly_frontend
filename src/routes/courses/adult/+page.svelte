<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '成人體操';
  const subtitle = '為成人設計的體操和健身課程，重拾運動樂趣';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=成人體操';

  const description = `
    <p>成人體操課程專為18歲以上的成年人設計，無論您是否有體操基礎，都可以在這裡找到適合自己的訓練方式。</p>
    <p>課程內容包括：基礎體操動作、柔韌性訓練、力量訓練、核心穩定訓練等。我們提供多種難度等級，從零基礎到進階，確保每位學員都能在自己的水平上獲得進步。</p>
    <p>成人體操不僅是一項運動，更是一種生活方式。通過訓練，您將提升身體素質、改善體態、增強自信，並結識志同道合的朋友。我們的課程氛圍輕鬆愉快，讓您在工作之餘放鬆身心。</p>
  `;

  const specs = [
    { label: '年齡範圍', value: '18歲以上' },
    { label: '課程時長', value: '60分鐘' },
    { label: '班級人數', value: '10-15人' },
    { label: '上課頻率', value: '每週1-3次' },
    { label: '收費方式', value: '月費制或課程包' },
    { label: '特殊要求', value: '無需基礎，歡迎初學者' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-4',
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-5',
    'https://placehold.co/800x600/0066cc/ffffff?text=成人體操-6'
  ];

  const relatedItems = [
    { label: '跑酷', href: '/courses/parkour' },
    { label: '幼兒體操', href: '/courses/children' },
    { label: '競技啦啦隊', href: '/courses/cheerleading' },
    { label: '健身房設施', href: '/venues/supporting/gym' }
  ];
</script>

<DetailPageTemplate
  {title}
  {subtitle}
  {heroImage}
  {description}
  {specs}
  {gallery}
  {relatedItems}
  ctaText="開始您的體操之旅"
/>
