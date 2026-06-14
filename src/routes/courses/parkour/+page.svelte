<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '跑酷';
  const subtitle = '城市跑酷訓練，學習翻越、跳躍等街頭運動技巧';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=跑酷';

  const description = `
    <p>跑酷課程為10歲以上的學員提供專業的城市跑酷訓練，學習如何在不同環境中高效、流暢地移動。</p>
    <p>課程內容包括：基礎翻越技巧、跳躍訓練、著陸技術、流暢串聯動作、障礙物適應等。我們的訓練場地配備了多種跑酷設施，模擬真實的城市環境，讓學員在安全的條件下練習。</p>
    <p>跑酷不僅是一項極限運動，更是一種挑戰自我、突破極限的生活態度。通過訓練，您將提升身體協調性、反應速度、空間判斷力，並培養面對困難的勇氣和創造力。</p>
  `;

  const specs = [
    { label: '年齡範圍', value: '10歲以上' },
    { label: '課程時長', value: '60分鐘' },
    { label: '班級人數', value: '8-12人' },
    { label: '上課頻率', value: '每週1-2次' },
    { label: '收費方式', value: '月費制或課程包' },
    { label: '特殊要求', value: '需具備基本體能和身體協調性' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-4',
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-5',
    'https://placehold.co/800x600/0066cc/ffffff?text=跑酷-6'
  ];

  const relatedItems = [
    { label: '成人體操', href: '/courses/adult' },
    { label: '競技啦啦隊', href: '/courses/cheerleading' },
    { label: '幼兒體操', href: '/courses/children' },
    { label: '攀岩場', href: '/venues/supporting/climbing' }
  ];
</script>

<DetailPageTemplate
  {title}
  {subtitle}
  {heroImage}
  {description}
  {specs}
  {gallery}
  {relatedItems}
  ctaText="開始跑酷訓練"
/>
