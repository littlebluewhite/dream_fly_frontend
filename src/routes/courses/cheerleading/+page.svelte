<script lang="ts">
  import DetailPageTemplate from '$lib/components/DetailPageTemplate.svelte';

  const title = '競技啦啦隊';
  const subtitle = '專業啦啦隊訓練，結合體操、舞蹈和特技動作';
  const heroImage = 'https://placehold.co/1200x600/0066cc/ffffff?text=競技啦啦隊';

  const description = `
    <p>競技啦啦隊課程為7-18歲的學員提供專業的啦啦隊訓練，結合體操、舞蹈和特技動作，培養團隊協作精神和表演能力。</p>
    <p>課程內容包括：基礎體操動作、舞蹈編排、組合技巧、托舉技術、翻騰動作等。我們的教練團隊擁有豐富的競技啦啦隊經驗，將引導學員從基礎到進階，逐步掌握專業技能。</p>
    <p>學員將有機會參加校際比賽和表演活動，展示學習成果。通過系統訓練，不僅能提升運動能力，還能培養自信心和團隊精神。</p>
  `;

  const specs = [
    { label: '年齡範圍', value: '7-18歲' },
    { label: '課程時長', value: '60分鐘' },
    { label: '班級人數', value: '12-15人' },
    { label: '上課頻率', value: '每週2-3次' },
    { label: '收費方式', value: '月費制' },
    { label: '特殊要求', value: '需具備基本體能' }
  ];

  const gallery = [
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-1',
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-2',
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-3',
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-4',
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-5',
    'https://placehold.co/800x600/0066cc/ffffff?text=競技啦啦隊-6'
  ];

  const relatedItems = [
    { label: '幼兒體操', href: '/courses/children' },
    { label: '跑酷', href: '/courses/parkour' },
    { label: '成人體操', href: '/courses/adult' },
    { label: '場館介紹', href: '/venues' }
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
  ctaText="加入啦啦隊"
/>
