<script lang="ts">
  /* 成績單與證書 push screen。account.jsx ReportScreen (208) · app.jsx (90)。
   * 本季成績單（評等 / 技巧 / 學習表現 / 教練評語）+ 證書 / 獎狀。
   * 無對應 report 時回退 REPORTS.k1。 */
  import PushScreen from '$lib/mobile/components/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile/components/ScreenHeader.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import { REPORTS, MY_COURSES, CERTS, type MyCourse } from '$lib/mobile/data';

  type Tone = 'primary' | 'accent' | 'success' | 'warning';

  export let onBack: () => void;
  export let course: MyCourse | null = null;

  $: c = course ?? MY_COURSES[0];
  $: rep = REPORTS[c.id] || REPORTS.k1;

  let tab: 'report' | 'certs' = 'report';

  const skillTone = (v: number): Tone => (v >= 90 ? 'success' : v >= 80 ? 'primary' : 'warning');
</script>

<PushScreen>
  <ScreenHeader {onBack} title="成績單與證書" sub={`${rep.term} · ${rep.coach} 教練`} />

  <div style="flex:none; display:flex; background:#fff; border-bottom:1px solid var(--df-border); padding:0 14px;">
    {#each [['report', '本季成績單'], ['certs', '證書 / 獎狀']] as [k, l]}
      {@const on = tab === k}
      <button
        on:click={() => (tab = k as 'report' | 'certs')}
        style="flex:1; padding:13px 0; border:none; border-bottom:2.5px solid {on
          ? 'var(--df-primary)'
          : 'transparent'}; background:transparent; color:{on
          ? 'var(--df-primary)'
          : 'var(--df-text-light)'}; font-size:14px; font-weight:{on ? 700 : 500}; cursor:pointer;"
      >{l}</button>
    {/each}
  </div>

  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
      {#if tab === 'report'}
        <Card padding={16}>
          <div style="display:flex; align-items:center; gap:15px;">
            <div
              style="width:72px; height:72px; border-radius:18px; background:var(--df-success-bg); display:flex;
                flex-direction:column; align-items:center; justify-content:center; flex:none;"
            >
              <span style="font-size:30px; font-weight:800; color:var(--df-success); font-family:var(--df-font-heading); line-height:1;">{rep.grade}</span>
              <span style="font-size:10.5px; color:var(--df-success-strong); font-weight:700; margin-top:2px;">{rep.gradeLabel}</span>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:16px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{c.name}</div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-top:4px;">本季綜合評等</div>
            </div>
          </div>
        </Card>

        <Card padding={16}>
          <h3 style="margin:0 0 13px; font-size:15.5px; font-weight:700; color:var(--df-ink);">技巧熟練度</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            {#each rep.skills as [n, v]}
              <ProgressBar value={v} showLabel label={n} tone={skillTone(v)} />
            {/each}
          </div>
        </Card>

        <Card padding={16}>
          <h3 style="margin:0 0 13px; font-size:15.5px; font-weight:700; color:var(--df-ink);">學習表現</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            {#each rep.attrs as [n, v]}
              <div style="background:var(--df-bg-light); border-radius:12px; padding:12px 14px;">
                <div style="font-size:22px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-heading);">{v}%</div>
                <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{n}</div>
              </div>
            {/each}
          </div>
        </Card>

        <Card padding={16}>
          <div style="display:flex; align-items:center; gap:9px; margin-bottom:11px;">
            <Icon name="message-square-quote" size={18} color="var(--df-primary)" />
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">教練評語</h3>
          </div>
          <p style="margin:0; font-size:13.5px; line-height:1.75; color:var(--df-text-dark);">{rep.comment}</p>
          <div
            style="display:flex; align-items:center; gap:9px; margin-top:14px; padding-top:13px; border-top:1px solid var(--df-border);"
          >
            <Avatar name={rep.coach} size="sm" color={c.color} />
            <div>
              <div style="font-size:13.5px; font-weight:700; color:var(--df-ink);">{rep.coach} 教練</div>
              <div style="font-size:11.5px; color:var(--df-text-muted);">{c.name}</div>
            </div>
          </div>
        </Card>
      {:else}
        <div style="display:flex; flex-direction:column; gap:12px;">
          {#each CERTS as ct}
            <div
              style="position:relative; background:#fff; border:1px solid var(--df-border); border-radius:16px;
                padding:16px; box-shadow:var(--df-shadow-card); overflow:hidden;"
            >
              <div
                style="position:absolute; top:-20px; right:-20px; width:90px; height:90px; border-radius:50%; background:{ct.color}14;"
              ></div>
              <div style="display:flex; align-items:center; gap:13px; position:relative;">
                <div
                  style="width:52px; height:52px; border-radius:14px; background:{ct.color}1A; display:flex;
                    align-items:center; justify-content:center; flex:none;"
                ><Icon name={ct.icon} size={27} color={ct.color} /></div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <Badge tone={ct.level === '賽事' ? 'accent' : 'success'} dot>{ct.level}</Badge>
                  </div>
                  <div style="font-size:14.5px; font-weight:700; color:var(--df-ink); line-height:1.4;">{ct.title}</div>
                  <div style="font-size:12px; color:var(--df-text-light); margin-top:4px;">{ct.issuer} · {ct.date}</div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
