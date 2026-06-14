<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '海綿池';
  const subtitle = '終極安全保護設施';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=海綿池';
  const description = `
    <p>海綿池填滿數千塊高密度海綿塊，為高難度動作訓練提供最佳保護，是練習新技巧的理想設施。</p>
    <p>定期更換和清潔海綿塊，確保衛生和安全性，讓學員可以放心大膽嘗試各種動作。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '10m × 8m × 2m' },
    { label: '海綿塊數量', value: '5000+ 塊' },
    { label: '清潔頻率', value: '每週' },
    { label: '適用對象', value: '所有技能等級' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=海綿池-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=海綿池-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=海綿池-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=海綿池-4'
  ];

  const relatedItems = [
    { label: '氣墊', href: '/venues/safety/air-cushion' },
    { label: '長跳床', href: '/venues/training/trampoline-tumbling' },
    { label: '競技啦啦隊課程', href: '/courses/cheerleading' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="了解更多" />
