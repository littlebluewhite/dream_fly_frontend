<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '組合墊';
  const subtitle = '可自由組合的模組化訓練墊';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=組合墊';
  const description = `
    <p>組合墊採用模組化設計，可根據訓練需求自由組合成不同形狀和高度，提供靈活的訓練方案。</p>
    <p>適合創意訓練、障礙課程設計、跑酷練習等多元化運動項目。</p>
  `;

  const specs = [
    { label: '模組數量', value: '50+ 個不同形狀模組' },
    { label: '材質', value: '高密度泡棉 + 防滑皮革' },
    { label: '組合方式', value: '魔鬼氈連接系統' },
    { label: '適用對象', value: '所有年齡層' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=組合墊-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=組合墊-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=組合墊-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=組合墊-4'
  ];

  const relatedItems = [
    { label: '體操墊', href: '/venues/training/mat-gymnastics' },
    { label: '攀岩場', href: '/venues/supporting/climbing' },
    { label: '跑酷課程', href: '/courses/parkour' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約使用" />
