<script lang="ts">
  /* 帳號憑證 tab — certifications list + credential history timeline
   * coach 改為 required prop(元件樹檢查,Task 4):不再自行 import COACH。 */
  import type { Coach } from '$lib/coach/data';
  import Card from '$lib/components/ui/Card.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import CoachTag from '$lib/coach/components/CoachTag.svelte';

  export let coach: Coach;

  // Certifications derived from COACH chips + extras
  const CERTS = [
    { icon: 'award', tone: 'accent' as const, name: '國際體操裁判認證', issuer: 'FIG 國際體操總會', date: '2021-06', expiry: '2025-06', active: false },
    { icon: 'badge-check', tone: 'primary' as const, name: '資深體操教練執照', issuer: '中華民國體操協會', date: '2019-08', expiry: '永久有效', active: true },
    { icon: 'shield-check', tone: 'success' as const, name: '幼兒體能發展指導員', issuer: '教育部體育署', date: '2022-03', expiry: '2026-03', active: true },
    { icon: 'star', tone: 'warning' as const, name: '競技體操培訓師', issuer: '中華民國體操協會', date: '2020-11', expiry: '2024-11', active: false }
  ];

  // Credential history
  const HISTORY = [
    { date: '2023-04', event: '完成進階培訓課程「競技體操選手訓練策略」', icon: 'graduation-cap', tone: 'var(--df-primary)' },
    { date: '2022-03', event: '取得幼兒體能發展指導員認證', icon: 'badge-check', tone: 'var(--df-success)' },
    { date: '2021-06', event: '通過 FIG 國際體操裁判考試', icon: 'award', tone: 'var(--df-accent-dark)' },
    { date: '2020-11', event: '升等競技體操培訓師', icon: 'trending-up', tone: 'var(--df-warning)' },
    { date: '2019-08', event: '加入 Dream Fly 擔任資深體操教練', icon: 'sparkles', tone: 'var(--df-primary)' }
  ];
</script>

<div style="display:flex;flex-direction:column;gap:24px;padding-top:20px">
  <!-- Header chips summary -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:16px"
    >
      現有資格認證
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
      {#each coach.chips as chip}
        <CoachTag tone="primary">{chip}</CoachTag>
      {/each}
    </div>

    <!-- Cert list -->
    <div style="display:flex;flex-direction:column;gap:12px">
      {#each CERTS as cert}
        <div
          style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--df-radius-md);border:1px solid {cert.active ? 'var(--df-border)' : 'var(--df-border-strong)'};background:{cert.active ? '#fff' : 'var(--df-bg-light)'}"
        >
          <div
            style="width:40px;height:40px;border-radius:10px;background:var(--df-primary-bg);display:flex;align-items:center;justify-content:center;flex:none"
          >
            <Icon name={cert.icon} size={20} color="var(--df-primary)" />
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span
                style="font-size:var(--df-text-base);font-weight:var(--df-weight-semibold);color:{cert.active ? 'var(--df-text-dark)' : 'var(--df-text-light)'};font-family:var(--df-font-body)"
              >
                {cert.name}
              </span>
              <CoachTag tone={cert.active ? 'success' : 'neutral'}>
                {cert.active ? '有效' : '已到期'}
              </CoachTag>
            </div>
            <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:3px">
              {cert.issuer} · 取得：{cert.date} · 到期：{cert.expiry}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </Card>

  <!-- Credential history timeline -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:20px"
    >
      資歷時間軸
    </div>
    <div style="position:relative;padding-left:28px">
      <!-- Vertical line -->
      <div
        style="position:absolute;left:11px;top:0;bottom:0;width:2px;background:var(--df-border)"
      ></div>
      {#each HISTORY as item, i}
        <div style="position:relative;margin-bottom:{i < HISTORY.length - 1 ? '24px' : '0'}">
          <!-- Dot -->
          <div
            style="position:absolute;left:-22px;top:2px;width:12px;height:12px;border-radius:50%;background:{item.tone};border:2px solid #fff;box-shadow:0 0 0 2px {item.tone}"
          ></div>
          <div style="display:flex;align-items:flex-start;gap:10px">
            <Icon name={item.icon} size={16} color={item.tone} />
            <div>
              <div
                style="font-size:var(--df-text-base);color:var(--df-text-dark);font-family:var(--df-font-body)"
              >
                {item.event}
              </div>
              <div style="font-size:var(--df-text-xs);color:var(--df-text-light);margin-top:2px">
                {item.date}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </Card>
</div>
