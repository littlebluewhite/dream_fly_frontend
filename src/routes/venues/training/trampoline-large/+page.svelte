<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '大跳床';
  const subtitle = '專業競技級大型跳床，適合進階訓練';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=大跳床';

  const description = `
    <p>我們的大跳床採用國際競技標準規格，提供優質的彈跳體驗。跳床表面採用高強度彈性材料，確保安全性和耐用性。</p>
    <p>大跳床適合進行各種高難度動作訓練，包括翻騰、旋轉等競技動作。周圍配備專業保護墊和安全網，確保訓練安全。</p>
    <p>無論是專業運動員還是業餘愛好者，都能在這裡享受跳床運動的樂趣，提升空中技巧和身體控制能力。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '4.2m × 2.1m' },
    { label: '承重能力', value: '150kg' },
    { label: '安全標準', value: 'EN 標準認證' },
    { label: '適用對象', value: '8歲以上' },
    { label: '維護週期', value: '每月專業檢查' },
    { label: '特殊功能', value: '可調節彈性強度' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=大跳床-全景',
    'https://placehold.co/800x600/0066cc/ffffff?text=大跳床-細節',
    'https://placehold.co/800x600/0066cc/ffffff?text=大跳床-訓練-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=大跳床-訓練-2'
  ];

  const relatedItems = [
    { label: '小跳床', href: '/venues/training/trampoline-small' },
    { label: '長跳床', href: '/venues/training/trampoline-tumbling' },
    { label: '海綿池', href: '/venues/safety/foam-pit' }
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
  ctaText="預約使用"
/>
