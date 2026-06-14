<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '體操墊';
  const subtitle = '多功能專業體操訓練墊';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=體操墊';
  const description = `
    <p>體操墊是體操訓練的基礎設施，提供安全的訓練表面，適合各種地面動作練習。</p>
    <p>我們配備多種厚度和硬度的體操墊，滿足不同訓練需求，從基礎翻滾到高難度技巧。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '12m × 12m' },
    { label: '厚度', value: '5-20cm 可選' },
    { label: '材質', value: '高密度海綿 + PVC 皮革' },
    { label: '適用對象', value: '所有年齡層' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=體操墊-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=體操墊-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=體操墊-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=體操墊-4'
  ];

  const relatedItems = [
    { label: '組合墊', href: '/venues/training/mat-combination' },
    { label: '大跳床', href: '/venues/training/trampoline-large' },
    { label: '氣墊', href: '/venues/safety/air-cushion' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約使用" />
