<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '王教練';
  const subtitle = '資深體操教練，專精幼兒體操和基礎訓練';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=王教練';

  const description = `
    <p>王教練擁有超過15年的體操教學經驗，專精於幼兒體操和基礎動作訓練。持有國家級體操教練證書和兒童運動指導員資格。</p>
    <p>教學理念：以愛心和耐心引導孩子，讓每個孩子在快樂中學習，在運動中成長。王教練善於運用遊戲化教學方法，讓課程既有趣又有效。</p>
    <p>王教練曾帶領多位學員參加青少年體操比賽並獲得優異成績，深受家長和學員的喜愛和信賴。</p>
  `;

  const specs = [
    { label: '專業資格', value: '國家級體操教練證書' },
    { label: '教學年資', value: '15年' },
    { label: '專長項目', value: '幼兒體操、基礎動作訓練' },
    { label: '教學語言', value: '中文' },
    { label: '特殊認證', value: '兒童運動指導員' },
    { label: '教學特色', value: '遊戲化教學、耐心細緻' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-教學-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-教學-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-教學-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-訓練-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-訓練-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=王教練-比賽指導'
  ];

  const relatedItems = [
    { label: '李教練', href: '/coaches/li' },
    { label: '張教練', href: '/coaches/zhang' },
    { label: '陳教練', href: '/coaches/chen' },
    { label: '幼兒體操課程', href: '/courses/children' }
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
  ctaText="預約王教練課程"
/>
