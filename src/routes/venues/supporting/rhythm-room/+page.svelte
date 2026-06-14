<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '韻律教室';
  const subtitle = '專業舞蹈和韻律訓練空間';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=韻律教室';
  const description = `
    <p>韻律教室配備專業舞蹈地板、全身鏡和音響設備，提供舞蹈、韻律體操和啦啦隊編排訓練。</p>
    <p>寬敞明亮的空間讓學員能夠自由練習，鏡面牆幫助觀察和改進動作，是提升表現力的理想場所。</p>
  `;

  const specs = [
    { label: '面積', value: '120平方米' },
    { label: '地板類型', value: '專業舞蹈地板（減震）' },
    { label: '設備', value: '全身鏡、音響、把桿' },
    { label: '適用課程', value: '舞蹈、韻律體操、啦啦隊' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=韻律教室-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=韻律教室-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=韻律教室-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=韻律教室-4'
  ];

  const relatedItems = [
    { label: '競技啦啦隊課程', href: '/courses/cheerleading' },
    { label: '李教練', href: '/coaches/li' },
    { label: '小型健身房', href: '/venues/supporting/gym' }
  ];
</script>

<DetailPageTemplate {title} {subtitle} {heroImage} {description} {specs} {gallery} {relatedItems} ctaText="預約參觀" />
