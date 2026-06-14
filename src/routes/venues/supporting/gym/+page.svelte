<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '小型健身房';
  const subtitle = '配備專業健身器材的訓練空間';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=小型健身房';
  const description = `
    <p>小型健身房配備各類專業健身器材，包括力量訓練設備、有氧運動器材和自由重量區。</p>
    <p>為學員提供輔助訓練空間，幫助提升力量、耐力和整體體能，補充體操和啦啦隊訓練。</p>
  `;

  const specs = [
    { label: '面積', value: '150平方米' },
    { label: '設備數量', value: '20+ 台專業器材' },
    { label: '開放時間', value: '每日 6:00-22:00' },
    { label: '使用對象', value: '會員專屬' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=健身房-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=健身房-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=健身房-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=健身房-4'
  ];

  const relatedItems = [
    { label: '成人體操課程', href: '/courses/adult' },
    { label: '張教練', href: '/coaches/zhang' },
    { label: '韻律教室', href: '/venues/supporting/rhythm-room' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約參觀" />
