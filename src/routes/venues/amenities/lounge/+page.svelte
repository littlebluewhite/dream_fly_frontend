<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '休息區';
  const subtitle = '舒適的休息和社交空間';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=休息區';
  const description = `
    <p>休息區為學員和家長提供舒適的休息空間，配備沙發、茶水、Wi-Fi等設施。</p>
    <p>訓練之餘，您可以在這裡放鬆休息、與其他學員交流，或是家長在等待孩子上課時使用。溫馨的環境讓Dream Fly不僅是訓練場所，更是社交空間。</p>
  `;

  const specs = [
    { label: '面積', value: '80平方米' },
    { label: '座位數', value: '30個' },
    { label: '設施', value: '沙發、茶水、Wi-Fi、充電站' },
    { label: '開放時間', value: '營業時間內全天開放' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=休息區-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=休息區-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=休息區-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=休息區-4'
  ];

  const relatedItems = [
    { label: '小教室', href: '/venues/amenities/classroom' },
    { label: '小型健身房', href: '/venues/supporting/gym' },
    { label: '查看課程', href: '/courses' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約參觀" />
