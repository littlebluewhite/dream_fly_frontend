<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '攀岩場';
  const subtitle = '專業室內攀岩訓練設施';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=攀岩場';
  const description = `
    <p>室內攀岩場配備多條不同難度的攀岩路線，從初學者到進階玩家都能找到合適的挑戰。</p>
    <p>攀岩訓練能有效提升手臂力量、核心穩定性和問題解決能力，是體操訓練的絕佳輔助項目。</p>
  `;

  const specs = [
    { label: '牆面高度', value: '8米' },
    { label: '路線數量', value: '15條' },
    { label: '難度範圍', value: '5.6 - 5.12' },
    { label: '安全設備', value: '全套保護裝備' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=攀岩場-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=攀岩場-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=攀岩場-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=攀岩場-4'
  ];

  const relatedItems = [
    { label: '跑酷課程', href: '/courses/parkour' },
    { label: '組合墊', href: '/venues/training/mat-combination' },
    { label: '小型健身房', href: '/venues/supporting/gym' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約體驗" />
