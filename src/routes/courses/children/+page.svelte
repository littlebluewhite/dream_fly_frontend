<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '幼兒體操';
  const subtitle = '專為3-6歲幼兒設計的基礎體操課程';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=幼兒體操';

  const description = `
    <p>幼兒體操課程專為3-6歲的小朋友設計，通過有趣的遊戲和基礎體操動作，幫助孩子建立良好的身體協調性、平衡感和運動習慣。</p>
    <p>我們的課程注重培養孩子對運動的興趣，在專業教練的指導下，讓孩子在安全、愉快的環境中學習翻滾、跳躍、平衡等基本動作。每節課都經過精心設計，確保孩子在玩樂中成長。</p>
    <p>課程特色包括：小班制教學、遊戲化學習、專業安全保護、家長觀摩。我們相信，良好的運動基礎將為孩子的健康成長打下堅實的基礎。</p>
  `;

  const specs = [
    { label: '年齡範圍', value: '3-6歲' },
    { label: '課程時長', value: '45分鐘' },
    { label: '班級人數', value: '8-12人' },
    { label: '上課頻率', value: '每週1-2次' },
    { label: '收費方式', value: '月費制或課程包' },
    { label: '試課優惠', value: '首次免費體驗' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-4',
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-5',
    'https://placehold.co/800x600/0066cc/ffffff?text=幼兒體操-6'
  ];

  const relatedItems = [
    { label: '成人體操', href: '/courses/adult' },
    { label: '跑酷', href: '/courses/parkour' },
    { label: '競技啦啦隊', href: '/courses/cheerleading' },
    { label: '查看教練團隊', href: '/coaches' }
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
  ctaText="立即預約試課"
/>
