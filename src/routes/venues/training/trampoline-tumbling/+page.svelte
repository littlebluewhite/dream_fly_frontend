<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '長跳床';
  const subtitle = '專業翻騰訓練長條跳床';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=長跳床';
  const description = `
    <p>長跳床是專門用於翻騰訓練的專業設備，長條形設計允許連續進行多個翻騰動作。</p>
    <p>適合體操、啦啦隊等需要連續翻騰技巧的項目訓練，幫助學員掌握流暢的串聯動作。</p>
  `;

  const specs = [
    { label: '規格尺寸', value: '12m × 2m' },
    { label: '承重能力', value: '120kg' },
    { label: '安全標準', value: 'FIG 國際體操聯合會認證' },
    { label: '適用對象', value: '10歲以上，具備基礎技巧' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=長跳床-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=長跳床-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=長跳床-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=長跳床-4'
  ];

  const relatedItems = [
    { label: '大跳床', href: '/venues/training/trampoline-large' },
    { label: '體操墊', href: '/venues/training/mat-gymnastics' },
    { label: '海綿池', href: '/venues/safety/foam-pit' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約使用" />
