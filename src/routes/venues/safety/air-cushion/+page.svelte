<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '氣墊';
  const subtitle = '專業訓練用充氣安全墊';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=氣墊';
  const description = `
    <p>氣墊是重要的安全保護設施，用於高難度動作訓練時的著陸保護，大幅降低受傷風險。</p>
    <p>我們的氣墊採用軍用級材料製作，提供優異的緩衝性能，讓學員能夠安心練習新動作。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '8m × 6m × 1m' },
    { label: '承重能力', value: '200kg' },
    { label: '充氣時間', value: '3分鐘' },
    { label: '安全標準', value: 'ISO 認證' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=氣墊-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=氣墊-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=氣墊-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=氣墊-4'
  ];

  const relatedItems = [
    { label: '海綿池', href: '/venues/safety/foam-pit' },
    { label: '大跳床', href: '/venues/training/trampoline-large' },
    { label: '體操墊', href: '/venues/training/mat-gymnastics' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="了解更多" />
