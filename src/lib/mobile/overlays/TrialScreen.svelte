<script lang="ts">
  /* 預約免費試上 push screen。trial.jsx TrialScreen (29)。
   * 4 步 stepper：0 課程+年齡 → 1 日期+時段 → 2 聯絡資料 → 3 完成（SuccessBody + 預約單）。
   * 逐步驗證與送出 body 組裝委派給 trialValidation 的 stepValid / buildTrialInquiry（皆已測試）。
   * Task F8：送出改打真 $lib/mobile/api submitTrialInquiry()（POST /contact,
   * inquiry_type='trial'，§3.17）——成功才前進 step 3 + toasts.notify('accent', …)，
   * 失敗停留本步驟並 toasts.notify('error', …)，按鈕於 finally 解除 submitting
   * 鎖定以便重試。
   * Legacy Svelte（無 runes）。 */
  import { tick } from 'svelte';
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Stepper from '$lib/components/ui/Stepper.svelte';
  import NoteBox from '$lib/components/mobile/NoteBox.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import { toasts, profile } from '$lib/mobile/stores';
  import { submitTrialInquiry } from '$lib/mobile/api';
  import { ApiError } from '$lib/api/client';
  import { buildTrialDays, type TrialDay } from './trial-dates';
  import { stepValid, buildTrialInquiry } from './trialValidation';
  import type { IconName } from '$lib/icon-registry';

  export let onBack: () => void;

  type Cat = { key: string; label: string; icon: IconName; age: string };
  const TRIAL_CATS: Cat[] = [
    { key: '幼兒體操', label: '幼兒體操', icon: 'baby', age: '3–5 歲' },
    { key: '兒童基礎', label: '兒童基礎', icon: 'rotate-cw', age: '6–9 歲' },
    { key: '競技啦啦隊', label: '競技啦啦隊', icon: 'sparkles', age: '10–16 歲' },
    { key: '競技體操', label: '競技體操', icon: 'medal', age: '8 歲以上' },
    { key: '成人體操', label: '成人體操', icon: 'dumbbell', age: '16 歲以上' },
    { key: '跑酷', label: '跑酷 Parkour', icon: 'flame', age: '12 歲以上' }
  ];
  const TRIAL_AGES = ['3–5 歲', '6–9 歲', '10–12 歲', '13–16 歲', '16 歲以上'];
  // TRIAL_DAYS 動態產生政策(pad2/addDays/toTrialDay/buildTrialDays)抽至同層
  // trial-dates.ts(零 svelte 依賴純函式，2026-07-22 架構深化 R7)；TRIAL_SLOTS
  // 時段無對應後端端點，仍硬編（見 ADR 0006）。
  const TRIAL_DAYS: TrialDay[] = buildTrialDays();
  type Slot = { id: string; time: string; coach: string; room: string; spots: number };
  const TRIAL_SLOTS: Slot[] = [
    { id: 't1', time: '10:00–11:15', coach: '黃詩涵', room: 'A 訓練館', spots: 3 },
    { id: 't2', time: '14:00–15:15', coach: '陳冠宇', room: 'B 教室', spots: 1 },
    { id: 't3', time: '16:30–17:45', coach: '林雅婷', room: 'A 訓練館', spots: 4 },
    { id: 't4', time: '19:00–20:15', coach: '王思齊', room: 'A 訓練館', spots: 0 }
  ];

  let step = 0;
  let cat = '';
  let age = '';
  let day = '';
  let slot = '';
  let parent = $profile.name || '';
  let phone = $profile.phone || '';
  let student = '';
  let note = '';
  let submitting = false;
  let bodyEl: HTMLDivElement;
  // 前綴年份跟隨當下年度後 2 碼，跨年自動更新，不需每年手動改字面量。
  const ticket = 'TR-' + String(new Date().getFullYear()).slice(-2) + Math.floor(Math.random() * 900 + 100);

  const trInputStyle =
    'flex:1; border:none; background:transparent; outline:none; font-size:15px; color:var(--df-text-dark); font-family:var(--df-font-body); height:100%; min-width:0;';

  $: chosenSlot = TRIAL_SLOTS.find((s) => s.id === slot);
  $: chosenDay = TRIAL_DAYS.find((d) => d.d === day);
  $: catIcon = TRIAL_CATS.find((c) => c.key === cat)?.icon ?? 'graduation-cap';
  $: state = { cat, age, day, slot, parent, phone, student };
  // step 3 預約單的五列 icon meta rows——原模板內聯 each 陣列 hoist 至此並標型別。
  $: ticketRows = [
    ['graduation-cap', '課程類別', cat],
    ['calendar-days', '試上時段', (chosenDay?.full || '') + ' ' + (chosenSlot?.time || '')],
    ['map-pin', '地點', (chosenSlot?.room || '') + ' · Dream Fly 夢飛體操館'],
    ['user-round', '授課教練', (chosenSlot?.coach || '') + ' 教練'],
    ['baby', '學員', student + ' · ' + age]
  ] satisfies [IconName, string, string][];

  async function goStep(n: number) {
    step = n;
    await tick();
    if (bodyEl) bodyEl.scrollTop = 0;
  }
  function next() {
    if (step < 3) goStep(step + 1);
  }
  async function submit() {
    if (!stepValid(2, state) || submitting) return;
    submitting = true;
    try {
      await submitTrialInquiry(buildTrialInquiry(state, note, { days: TRIAL_DAYS, slots: TRIAL_SLOTS }));
      goStep(3);
      toasts.notify('accent', '試上預約已送出', (chosenDay?.full || '') + ' ' + (chosenSlot?.time || ''));
    } catch (err) {
      toasts.notify('error', '送出失敗', err instanceof ApiError ? err.message : '請稍後再試');
    } finally {
      submitting = false;
    }
  }
</script>

<PushScreen>
  <!-- hero header -->
  <div class="m-top-inset" style="flex:none; color:#fff; position:relative; overflow:hidden; background:linear-gradient(140deg, var(--df-primary), var(--df-primary-dark));">
    <div style="position:absolute; top:-40px; right:-30px; width:160px; height:160px; border-radius:50%; background:radial-gradient(circle, rgba(255,215,0,.26), transparent 70%);"></div>
    <div style="position:relative;">
      <div style="padding:0 14px 16px; display:flex; align-items:center; gap:8px;">
        <button
          aria-label="返回"
          on:click={onBack}
          class="df-tapscale"
          style="width:38px; height:38px; border-radius:11px; border:none; background:rgba(255,255,255,0.16);
            display:flex; align-items:center; justify-content:center; cursor:pointer; flex:none;"
        >
          <Icon name="chevron-left" size={22} color="#fff" />
        </button>
        <div style="flex:1;">
          <h2 style="margin:0; font-family:var(--df-font-heading); font-size:19px; font-weight:800;">預約免費試上</h2>
          <div style="font-size:12px; opacity:0.88; margin-top:1px;">15 分鐘評估 + 60 分鐘體驗 · 完全免費</div>
        </div>
      </div>
    </div>
  </div>

  {#if step < 3}
    <div style="flex:none; background:#fff; border-bottom:1px solid var(--df-border); padding:14px 16px;">
      <Stepper steps={['課程', '時段', '資料', '完成']} current={step} />
    </div>
  {/if}

  <div bind:this={bodyEl} class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:18px;">
      {#if step === 0}
        <div>
          <div style="display:flex; align-items:center; gap:9px; margin-bottom:12px;">
            <span style="width:22px; height:22px; border-radius:999px; background:var(--df-primary); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-mono);">1</span>
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">想先體驗哪一類課程？</h3>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            {#each TRIAL_CATS as c (c.key)}
              {@const on = cat === c.key}
              <button
                on:click={() => (cat = c.key)}
                class="df-tapscale"
                style="text-align:left; display:flex; align-items:center; gap:11px; padding:13px 13px; border-radius:14px; cursor:pointer;
                  background:{on ? 'var(--df-primary-bg)' : '#fff'}; border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'};"
              >
                <div style="width:40px; height:40px; border-radius:11px; background:{on ? 'var(--df-primary)' : 'var(--df-primary-bg)'}; display:flex; align-items:center; justify-content:center; flex:none;">
                  <Icon name={c.icon} size={21} color={on ? '#fff' : 'var(--df-primary)'} />
                </div>
                <div style="min-width:0;"><div style="font-size:13.5px; font-weight:700; color:var(--df-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{c.label}</div><div style="font-size:11.5px; color:var(--df-text-light);">{c.age}</div></div>
              </button>
            {/each}
          </div>
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:9px; margin-bottom:12px;">
            <span style="width:22px; height:22px; border-radius:999px; background:var(--df-primary); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-mono);">2</span>
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">學員年齡</h3>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            {#each TRIAL_AGES as a (a)}
              {@const on = age === a}
              <button
                on:click={() => (age = a)}
                class="df-tapscale"
                style="height:38px; padding:0 16px; border-radius:999px; cursor:pointer; font-size:13.5px; font-weight:{on ? 700 : 500};
                  color:{on ? '#fff' : 'var(--df-text-dark)'}; background:{on ? 'var(--df-primary)' : '#fff'}; border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'};"
              >{a}</button>
            {/each}
          </div>
        </div>
        <NoteBox icon="shield-check" tone="var(--df-success)">不確定適合哪一班沒關係，<b style="color:var(--df-text-dark);">到館後教練會先評估</b>孩子的程度與安全門檻，再推薦最合適的班別。</NoteBox>
      {/if}

      {#if step === 1}
        <div>
          <div style="display:flex; align-items:center; gap:9px; margin-bottom:12px;">
            <span style="width:22px; height:22px; border-radius:999px; background:var(--df-primary); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-mono);">1</span>
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">選擇日期</h3>
          </div>
          <div class="df-scroll" style="display:flex; gap:9px; overflow-x:auto; margin:0 -16px; padding:0 16px 4px;">
            {#each TRIAL_DAYS as d (d.d)}
              {@const on = day === d.d}
              <button
                on:click={() => (day = d.d)}
                class="df-tapscale"
                style="flex:none; width:62px; padding:11px 0; border-radius:14px; cursor:pointer; text-align:center;
                  background:{on ? 'var(--df-primary)' : '#fff'}; border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'}; color:{on ? '#fff' : 'var(--df-ink)'};"
              >
                <div style="font-size:11px; opacity:{on ? 0.9 : 0.6};">週{d.w}</div>
                <div style="font-size:16px; font-weight:800; font-family:var(--df-font-mono); margin-top:2px;">{d.d}</div>
              </button>
            {/each}
          </div>
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:9px; margin-bottom:12px;">
            <span style="width:22px; height:22px; border-radius:999px; background:var(--df-primary); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-mono);">2</span>
            <h3 style="margin:0; font-size:15.5px; font-weight:700; color:var(--df-ink);">選擇時段</h3>
          </div>
          {#if !day}
            <div style="font-size:13px; color:var(--df-text-muted); background:var(--df-bg-light); border-radius:12px; padding:16px; text-align:center;">請先選擇上方日期</div>
          {:else}
            <div style="display:flex; flex-direction:column; gap:10px;">
              {#each TRIAL_SLOTS as s (s.id)}
                {@const full = s.spots === 0}
                {@const on = slot === s.id}
                <button
                  disabled={full}
                  on:click={() => (slot = s.id)}
                  class="df-tapscale"
                  style="text-align:left; display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:13px; cursor:{full ? 'not-allowed' : 'pointer'}; width:100%;
                    background:{on ? 'var(--df-primary-bg)' : '#fff'}; border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'}; opacity:{full ? 0.55 : 1};"
                >
                  <div style="width:22px; height:22px; border-radius:50%; border:2px solid {on ? 'var(--df-primary)' : 'var(--df-border-strong)'}; display:flex; align-items:center; justify-content:center; flex:none;">{#if on}<div style="width:11px; height:11px; border-radius:50%; background:var(--df-primary);"></div>{/if}</div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:14.5px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-mono);">{s.time}</div>
                    <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{s.room} · {s.coach} 教練</div>
                  </div>
                  {#if full}<Badge tone="error">已額滿</Badge>{:else}<Badge tone={s.spots <= 1 ? 'warning' : 'success'} dot>剩 {s.spots} 位</Badge>{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if step === 2}
        <!-- summary chip -->
        <div style="display:flex; align-items:center; gap:11px; background:var(--df-primary-bg); border-radius:13px; padding:12px 14px;">
          <div style="width:40px; height:40px; border-radius:11px; background:#fff; display:flex; align-items:center; justify-content:center; flex:none;"><Icon name={catIcon} size={21} color="var(--df-primary)" /></div>
          <div style="flex:1; min-width:0; font-size:13px;">
            <div style="font-weight:700; color:var(--df-ink);">{cat} · 免費試上</div>
            <div style="color:var(--df-text-light); margin-top:2px;">{chosenDay?.full} · {chosenSlot?.time}</div>
          </div>
          <button on:click={() => goStep(1)} style="border:none; background:none; color:var(--df-primary); font-size:12.5px; font-weight:700; cursor:pointer; flex:none;">修改</button>
        </div>

        <label style="display:flex; flex-direction:column; gap:7px;">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">家長姓名<span style="color:var(--df-error); margin-left:3px;">*</span></span>
          <div style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff; border:1.5px solid var(--df-border-strong); border-radius:12px;">
            <Icon name="user-round" size={18} color="var(--df-text-muted)" /><input bind:value={parent} placeholder="請輸入姓名" style={trInputStyle} />
          </div>
        </label>
        <label style="display:flex; flex-direction:column; gap:7px;">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">聯絡手機<span style="color:var(--df-error); margin-left:3px;">*</span></span>
          <div style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff; border:1.5px solid var(--df-border-strong); border-radius:12px;">
            <Icon name="smartphone" size={18} color="var(--df-text-muted)" /><input bind:value={phone} inputmode="tel" placeholder="0912-345-678" style={trInputStyle} />
          </div>
        </label>
        <label style="display:flex; flex-direction:column; gap:7px;">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">學員姓名<span style="color:var(--df-error); margin-left:3px;">*</span></span>
          <div style="display:flex; align-items:center; gap:10px; height:50px; padding:0 14px; background:#fff; border:1.5px solid var(--df-border-strong); border-radius:12px;">
            <Icon name="baby" size={18} color="var(--df-text-muted)" /><input bind:value={student} placeholder="孩子的姓名或暱稱" style={trInputStyle} />
          </div>
        </label>
        <label style="display:flex; flex-direction:column; gap:7px;">
          <span style="font-size:13px; font-weight:600; color:var(--df-text-dark);">備註（選填）</span>
          <textarea bind:value={note} rows={3} maxlength={120} placeholder="例如：孩子曾學過舞蹈、希望加強柔軟度…" style="width:100%; padding:11px 14px; font-size:14px; font-family:var(--df-font-body); color:var(--df-text-dark); background:#fff; border:1.5px solid var(--df-border-strong); border-radius:12px; outline:none; resize:none; line-height:1.6; box-sizing:border-box;"></textarea>
        </label>
        <NoteBox icon="info">送出後櫃台將於 <b style="color:var(--df-text-dark);">1 個工作天內</b> 以簡訊與電話確認時段，名額以正式回覆為準。</NoteBox>
      {/if}

      {#if step === 3}
        <div style="display:flex; flex-direction:column; gap:16px;">
          <SuccessBody icon="calendar-check" title="試上預約已送出！" body="我們已收到你的免費試上申請，櫃台確認後會以簡訊通知最終時段。" />
          <div style="background:#fff; border:1px solid var(--df-border); border-radius:16px; overflow:hidden; box-shadow:var(--df-shadow-card);">
            <div style="background:var(--df-ink); color:#fff; padding:13px 16px; display:flex; align-items:center; gap:9px;">
              <Icon name="ticket" size={18} color="var(--df-accent)" /><span style="font-size:14px; font-weight:700;">免費試上預約單</span><span style="margin-left:auto; font-size:11.5px; opacity:0.7; font-family:var(--df-font-mono);">{ticket}</span>
            </div>
            <div style="padding:4px 16px;">
              {#each ticketRows as [ic, k, v], i (k)}
                <div style="display:flex; align-items:center; gap:11px; padding:12px 0; border-top:{i ? '1px solid var(--df-border)' : 'none'};">
                  <Icon name={ic} size={17} color="var(--df-primary)" />
                  <span style="font-size:13px; color:var(--df-text-light); width:64px; flex:none;">{k}</span>
                  <span style="font-size:13.5px; font-weight:600; color:var(--df-text-dark); text-align:right; flex:1;">{v}</span>
                </div>
              {/each}
            </div>
          </div>
          <NoteBox icon="shirt">請穿著輕便運動服與襪子提前 10 分鐘到館，現場備有飲水與更衣空間。</NoteBox>
        </div>
      {/if}
      <div style="height:8px;"></div>
    </div>
  </div>

  <!-- footer -->
  <div style="flex:none; padding:12px 16px calc(14px + env(safe-area-inset-bottom)); border-top:1px solid var(--df-border); background:#fff; display:flex; gap:10px;">
    {#if step === 3}
      <Button variant="primary" fullWidth on:click={onBack}>
        <span style="display:inline-flex; align-items:center; gap:6px;"><Icon name="check" size={17} color="currentColor" />完成</span>
      </Button>
    {:else}
      {#if step > 0}
        <Button variant="secondary" on:click={() => goStep(step - 1)}>上一步</Button>
      {/if}
      {#if step < 2}
        <Button variant="primary" style="flex:1;" disabled={!stepValid(step, state)} on:click={next}>
          <span style="display:inline-flex; align-items:center; gap:6px;">下一步<Icon name="arrow-right" size={17} color="currentColor" /></span>
        </Button>
      {/if}
      {#if step === 2}
        <Button variant="primary" style="flex:1;" disabled={!stepValid(2, state) || submitting} on:click={submit}>
          <span style="display:inline-flex; align-items:center; gap:6px;">
            <Icon name="calendar-check" size={17} color="currentColor" />{submitting ? '送出中…' : '送出預約'}
          </span>
        </Button>
      {/if}
    {/if}
  </div>
</PushScreen>
