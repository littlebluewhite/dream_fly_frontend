<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '陳教練';
  const subtitle = '跑酷專業教練，極限運動愛好者';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=陳教練';

  const description = `
    <p>陳教練是Dream Fly的跑酷專業教練，從事跑酷運動已有12年，擁有豐富的街頭運動和極限運動經驗。</p>
    <p>教學理念：挑戰極限，超越自我。陳教練鼓勵學員勇於嘗試，同時注重安全訓練，讓每個人都能在自己的節奏下進步。</p>
    <p>陳教練持有國際跑酷教練認證，擅長教授翻越、跳躍、著陸等核心技巧，並能根據不同場地設計創意訓練方案。</p>
  `;

  const specs = [
    { label: '專業資格', value: '國際跑酷教練認證' },
    { label: '教學年資', value: '7年' },
    { label: '專長項目', value: '跑酷、翻越技巧、空間判斷訓練' },
    { label: '教學語言', value: '中文、英文' },
    { label: '特殊認證', value: '極限運動安全指導員' },
    { label: '教學特色', value: '創意訓練、安全第一' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-動作示範',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-教學-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-教學-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-戶外訓練',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-學員指導',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-團體訓練'
  ];

  const relatedItems = [
    { label: '王教練', href: '/coaches/wang' },
    { label: '李教練', href: '/coaches/li' },
    { label: '張教練', href: '/coaches/zhang' },
    { label: '跑酷課程', href: '/courses/parkour' }
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
  ctaText="預約陳教練課程"
/>
