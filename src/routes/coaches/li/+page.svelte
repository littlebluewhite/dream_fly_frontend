<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '李教練';
  const subtitle = '競技啦啦隊專業教練，曾獲全國冠軍';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=李教練';

  const description = `
    <p>李教練是Dream Fly的競技啦啦隊專業教練，曾是全國競技啦啦隊冠軍隊伍的主力隊員，擁有豐富的比賽和表演經驗。</p>
    <p>教學理念：追求卓越，永不放棄。李教練注重團隊協作和個人技能的平衡發展，通過嚴格而系統的訓練，幫助學員達到最佳競技狀態。</p>
    <p>李教練持有國際啦啦隊教練員證書，擅長編排創新的啦啦隊動作和舞蹈，多次帶領團隊在各類比賽中獲獎。</p>
  `;

  const specs = [
    { label: '專業資格', value: '國際啦啦隊教練員證書' },
    { label: '教學年資', value: '10年' },
    { label: '專長項目', value: '競技啦啦隊、舞蹈編排、特技動作' },
    { label: '教學語言', value: '中文、英文' },
    { label: '特殊認證', value: '全國競技啦啦隊冠軍' },
    { label: '教學特色', value: '嚴謹訓練、創新編排' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-教學-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-教學-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-編排',
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-比賽-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-比賽-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=李教練-團隊'
  ];

  const relatedItems = [
    { label: '王教練', href: '/coaches/wang' },
    { label: '張教練', href: '/coaches/zhang' },
    { label: '陳教練', href: '/coaches/chen' },
    { label: '競技啦啦隊課程', href: '/courses/cheerleading' }
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
  ctaText="預約李教練課程"
/>
