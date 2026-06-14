<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '張教練';
  const subtitle = '成人體操和力量訓練專家';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=張教練';

  const description = `
    <p>張教練專精於成人體操和力量訓練，擁有運動科學碩士學位和國家級健身教練資格。在Dream Fly工作已有8年時間。</p>
    <p>教學理念：因材施教，科學訓練。張教練會根據每位學員的身體條件和目標，制定個性化的訓練計劃，確保安全有效地達成目標。</p>
    <p>張教練特別擅長幫助零基礎的成人學員建立運動習慣，通過循序漸進的訓練，讓每個人都能享受運動的樂趣。</p>
  `;

  const specs = [
    { label: '專業資格', value: '國家級健身教練證書' },
    { label: '教學年資', value: '8年' },
    { label: '專長項目', value: '成人體操、力量訓練、功能性訓練' },
    { label: '教學語言', value: '中文、英文' },
    { label: '特殊認證', value: '運動科學碩士' },
    { label: '教學特色', value: '個性化訓練、科學方法' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-教學-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-教學-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-訓練-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-訓練-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-指導',
    'https://placehold.co/800x600/0066cc/ffffff?text=張教練-團體課'
  ];

  const relatedItems = [
    { label: '王教練', href: '/coaches/wang' },
    { label: '李教練', href: '/coaches/li' },
    { label: '陳教練', href: '/coaches/chen' },
    { label: '成人體操課程', href: '/courses/adult' }
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
  ctaText="預約張教練課程"
/>
