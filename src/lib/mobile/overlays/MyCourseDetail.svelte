<script lang="ts">
  /* 我的課程 · 課程詳情 push screen。mine.jsx MyCourseDetail (99) · app.jsx (88)。
   * 課程 hero（出席環）+ 動作（請假 / 補課 / 聯絡）+ 技巧熟練度 + 出席紀錄。 */
  import PushScreen from '$lib/mobile/components/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile/components/HeaderIcon.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import { overlay } from '$lib/mobile/stores';
  import {
    REPORTS,
    SKILLS,
    ATT_HISTORY,
    ATT_STATE,
    LEVEL_TONE,
    type MyCourse,
    type Skill
  } from '$lib/mobile/data';

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  export let onBack: () => void;
  export let course: MyCourse | null = null;

  $: c = course as MyCourse;
  $: report = c ? REPORTS[c.id] : undefined;
  $: skills = (report ? report.skills.slice(0, 4) : SKILLS) as Skill[];
  $: levelTone = (c ? LEVEL_TONE[c.level] || 'primary' : 'primary') as Tone;

  /* 出席環 — mine.jsx AttRing (6)。size 92、stroke 9。 */
  const ringSize = 92;
  const ringR = (ringSize - 12) / 2;
  const ringCirc = 2 * Math.PI * ringR;

  $: metaRows = c
    ? ([
        ['calendar-days', c.schedule],
        ['map-pin', c.room],
        ['user-round', c.coach + ' 教練'],
        ['ticket', '本季尚餘 ' + c.remain + ' 堂']
      ] as [string, string][])
    : [];
</script>

<PushScreen>
  <ScreenHeader {onBack} title="課程詳情">
    <svelte:fragment slot="right">
      {#if c}
        <HeaderIcon
          icon="message-circle"
          label="聯絡教練"
          onClick={() => overlay.sheet('contact', { course: c })}
        />
      {/if}
    </svelte:fragment>
  </ScreenHeader>

  <div class="df-scroll">
    {#if c}
      <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
        <!-- hero -->
        <Card padding={16}>
          <div style="display:flex; align-items:center; gap:13px; margin-bottom:14px;">
            <div
              style="width:54px; height:54px; border-radius:14px; background:{c.color}1A; display:flex;
                align-items:center; justify-content:center; flex:none;"
            ><Icon name={c.icon} size={28} color={c.color} /></div>
            <div style="flex:1; min-width:0;">
              <h2
                style="margin:0; font-family:var(--df-font-heading); font-size:19px; font-weight:800; color:var(--df-ink);"
              >{c.name}</h2>
              <div style="display:flex; align-items:center; gap:6px; margin-top:5px;">
                <Badge tone={levelTone}>{c.level}</Badge>
                <span style="font-size:12.5px; color:var(--df-text-light);">{c.term}</span>
              </div>
            </div>
          </div>
          <div
            style="display:flex; align-items:center; gap:16px; padding:12px 0 0; border-top:1px solid var(--df-border);"
          >
            <div style="position:relative; width:{ringSize}px; height:{ringSize}px; flex:none;">
              <svg width={ringSize} height={ringSize} style="transform:rotate(-90deg);">
                <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} fill="none" stroke="var(--df-border)" stroke-width="9" />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringR}
                  fill="none"
                  stroke="var(--df-primary)"
                  stroke-width="9"
                  stroke-linecap="round"
                  stroke-dasharray={ringCirc}
                  stroke-dashoffset={ringCirc * (1 - c.att / 100)}
                  style="transition:stroke-dashoffset .5s ease;"
                />
              </svg>
              <div
                style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;"
              >
                <span style="font-size:22px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{c.att}%</span>
                <span style="font-size:10.5px; color:var(--df-text-light);">出席率</span>
              </div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:9px; font-size:13px;">
              {#each metaRows as [ic, v]}
                <div style="display:flex; align-items:center; gap:9px; color:var(--df-text-dark);">
                  <Icon name={ic} size={15} color="var(--df-text-muted)" />{v}
                </div>
              {/each}
            </div>
          </div>
        </Card>

        <!-- actions -->
        <div style="display:flex; gap:10px;">
          <button
            on:click={() => overlay.sheet('leave', { course: c })}
            class="df-tapscale"
            style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
              border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer;"
          >
            <div
              style="width:38px; height:38px; border-radius:11px; background:var(--df-warning-bg); display:flex;
                align-items:center; justify-content:center;"
            ><Icon name="calendar-off" size={20} color="var(--df-warning)" /></div>
            <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">請假</span>
          </button>
          <button
            on:click={() => overlay.sheet('makeup', { course: c })}
            class="df-tapscale"
            style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
              border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer;"
          >
            <div
              style="width:38px; height:38px; border-radius:11px; background:var(--df-primary-bg); display:flex;
                align-items:center; justify-content:center;"
            ><Icon name="rotate-cw" size={20} color="var(--df-primary)" /></div>
            <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">預約補課</span>
          </button>
          <button
            on:click={() => overlay.sheet('contact', { course: c })}
            class="df-tapscale"
            style="flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:13px 4px;
              border-radius:13px; border:1px solid var(--df-border); background:#fff; cursor:pointer;"
          >
            <div
              style="width:38px; height:38px; border-radius:11px; background:var(--df-info-bg); display:flex;
                align-items:center; justify-content:center;"
            ><Icon name="message-circle" size={20} color="var(--df-info)" /></div>
            <span style="font-size:12px; font-weight:600; color:var(--df-text-dark);">聯絡教練</span>
          </button>
        </div>

        <!-- skills -->
        <Card padding={16}>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:13px;">
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">技巧熟練度</h3>
            {#if report}
              <button
                on:click={() => overlay.push('report', { course: c })}
                style="border:none; background:none; font-size:12.5px; font-weight:600; color:var(--df-primary);
                  cursor:pointer; display:flex; align-items:center; gap:2px;"
              >完整成績單<Icon name="chevron-right" size={14} /></button>
            {/if}
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            {#each skills as [n, v]}
              <ProgressBar value={v} showLabel label={n} />
            {/each}
          </div>
        </Card>

        <!-- attendance history -->
        <Card padding={16}>
          <h3 style="margin:0 0 12px; font-size:15.5px; font-weight:700; color:var(--df-ink);">出席紀錄</h3>
          <div style="display:flex; flex-direction:column;">
            {#each ATT_HISTORY as a, i}
              {@const [tone, label] = ATT_STATE[a.state]}
              <div
                style="display:flex; align-items:center; gap:12px; padding:10px 0;
                  border-top:{i ? '1px solid var(--df-border)' : 'none'};"
              >
                <Icon name="calendar" size={16} color="var(--df-text-muted)" />
                <span style="flex:1; font-size:13.5px; color:var(--df-text-dark); font-family:var(--df-font-mono);">2026 / {a.date}</span>
                <Badge tone={tone as Tone} dot>{label}</Badge>
              </div>
            {/each}
          </div>
        </Card>
        <div style="height:8px;"></div>
      </div>
    {/if}
  </div>
</PushScreen>
