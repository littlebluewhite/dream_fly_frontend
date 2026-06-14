<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '陳教練';
  const subtitle = '幼兒體操專任教練，兒童發展專家';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=陳教練';

  const description = `
    <p>陳教練是Dream Fly的幼兒體操專任教練，擁有6年幼兒體操教學經驗，並具備幼兒教育背景，深入了解兒童發展階段與學習需求。</p>
    <p>教學理念：遊戲化教學、循序漸進、安全啟蒙。陳教練善於將動作練習融入遊戲，讓孩子在快樂中建立自信，並在每個階段循序漸進地成長。</p>
    <p>陳教練專精於幼兒動作發展與感覺統合訓練，能依照孩子的發展階段設計合適的啟蒙課程，為日後的運動能力打下穩固基礎。</p>
  `;

  const specs = [
    { label: '專業資格', value: '幼兒體操教練證' },
    { label: '教學年資', value: '6年' },
    { label: '專長項目', value: '幼兒動作發展、遊戲化教學、感覺統合訓練' },
    { label: '教學語言', value: '中文' },
    { label: '特殊認證', value: '幼兒教育學士學位、感覺統合訓練師認證' },
    { label: '教學特色', value: '遊戲化教學、安全啟蒙' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-動作示範',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-課堂互動',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-遊戲教學',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-感覺統合',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-親子陪伴',
    'https://placehold.co/800x600/0066cc/ffffff?text=陳教練-幼兒體操-成果展現'
  ];

  const relatedItems = [
    { label: '王教練', href: '/coaches/wang' },
    { label: '李教練', href: '/coaches/li' },
    { label: '張教練', href: '/coaches/zhang' },
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
  ctaText="預約陳教練課程"
/>
