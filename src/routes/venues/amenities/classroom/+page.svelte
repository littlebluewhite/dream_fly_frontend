<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '小教室';
  const subtitle = '多功能會議和學習空間';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=小教室';
  const description = `
    <p>小教室是多功能空間，可用於理論課程、家長說明會、教練培訓會議等活動。</p>
    <p>配備投影設備和白板，適合進行運動知識講座、營養指導、傷害預防課程等，幫助學員全面提升運動素養。</p>
  `;

  const specs = [
    { label: '面積', value: '40平方米' },
    { label: '座位數', value: '20個' },
    { label: '設備', value: '投影機、白板、音響' },
    { label: '用途', value: '理論課、會議、講座' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=小教室-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=小教室-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=小教室-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=小教室-4'
  ];

  const relatedItems = [
    { label: '休息區', href: '/venues/amenities/lounge' },
    { label: '查看教練', href: '/coaches' },
    { label: '查看課程', href: '/courses' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約使用" />
