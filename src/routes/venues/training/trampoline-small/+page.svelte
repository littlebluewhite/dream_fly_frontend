<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '小跳床';
  const subtitle = '適合初學者和兒童的小型跳床';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=小跳床';
  const description = `
    <p>小跳床專為初學者和兒童設計，尺寸適中，彈性適度，是學習基礎跳床技巧的理想選擇。</p>
    <p>設備周圍配備完善的安全措施，包括厚實的保護墊和防護網，確保訓練過程的安全性。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '2.4m × 1.2m' },
    { label: '承重能力', value: '80kg' },
    { label: '安全標準', value: 'EN 標準認證' },
    { label: '適用對象', value: '4歲以上' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=小跳床-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=小跳床-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=小跳床-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=小跳床-4'
  ];

  const relatedItems = [
    { label: '大跳床', href: '/venues/training/trampoline-large' },
    { label: '長跳床', href: '/venues/training/trampoline-tumbling' },
    { label: '氣墊', href: '/venues/safety/air-cushion' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約使用" />
