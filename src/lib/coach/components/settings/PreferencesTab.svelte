<script lang="ts">
  /* 教學偏好 tab — specialty CoachTags + Switch rows for teaching preferences */
  import { toasts } from '$lib/coach/stores';
  import Card from '$lib/components/ui/Card.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import CoachTag from '$lib/coach/components/CoachTag.svelte';

  // Specialty tags — removable
  let specialties = ['體操', '幼兒教學', '競技培訓', '平衡木', '自由體操'];
  let newSpecialty = '';

  function removeSpecialty(s: string) {
    specialties = specialties.filter((x) => x !== s);
    toasts.notify('info', '已移除專長標籤', s);
  }

  function addSpecialty() {
    const val = newSpecialty.trim();
    if (!val || specialties.includes(val)) return;
    specialties = [...specialties, val];
    newSpecialty = '';
    toasts.notify('success', '已新增專長標籤', val);
  }

  function onAddKey(e: KeyboardEvent) {
    if (e.key === 'Enter') addSpecialty();
  }

  // Teaching preference switches
  let prefOnline = false;
  let prefPrivate = true;
  let prefGroup = true;
  let prefCompetition = true;
  let prefUnder6 = true;
  let prefWeekend = true;

  function savePrefs() {
    toasts.notify('success', '教學偏好已儲存');
  }
</script>

<div style="display:flex;flex-direction:column;gap:24px;padding-top:20px">
  <!-- Specialty tags -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:6px"
    >
      專長標籤
    </div>
    <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-bottom:16px">
      選擇或新增您擅長的教學領域
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      {#each specialties as s (s)}
        <CoachTag tone="primary" removable on:remove={() => removeSpecialty(s)}>{s}</CoachTag>
      {/each}
    </div>
    <!-- Add new tag input row -->
    <div style="display:flex;gap:8px;align-items:center">
      <input
        type="text"
        bind:value={newSpecialty}
        on:keydown={onAddKey}
        placeholder="新增專長標籤…"
        style="flex:1;height:38px;padding:0 12px;font-size:var(--df-text-sm);font-family:var(--df-font-body);color:var(--df-text-dark);border:1.5px solid var(--df-border-strong);border-radius:var(--df-radius-md);outline:none;box-sizing:border-box"
      />
      <Button variant="secondary" size="sm" on:click={addSpecialty}>
        <span style="display:inline-flex;align-items:center;gap:6px">
          <Icon name="plus" size={14} color="var(--df-primary)" />新增
        </span>
      </Button>
    </div>
  </Card>

  <!-- Teaching preferences -->
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:6px"
    >
      教學偏好設定
    </div>
    <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-bottom:8px">
      這些設定將協助系統為您媒合合適的課程
    </div>

    <div style="display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--df-border)">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受線上教學
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            視訊或錄播課程
          </div>
        </div>
        <Switch bind:checked={prefOnline} on:change={() => toasts.notify('info', prefOnline ? '已開啟線上教學' : '已關閉線上教學')} />
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--df-border)">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受私人一對一課程
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            單一學員個別指導
          </div>
        </div>
        <Switch bind:checked={prefPrivate} on:change={() => toasts.notify('info', prefPrivate ? '已開啟私人課程' : '已關閉私人課程')} />
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--df-border)">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受團體課程
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            多人一同上課班級
          </div>
        </div>
        <Switch bind:checked={prefGroup} on:change={() => toasts.notify('info', prefGroup ? '已開啟團體課程' : '已關閉團體課程')} />
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--df-border)">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受競技培訓課程
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            賽事選手專項訓練
          </div>
        </div>
        <Switch bind:checked={prefCompetition} on:change={() => toasts.notify('info', prefCompetition ? '已開啟競技培訓' : '已關閉競技培訓')} />
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--df-border)">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受幼兒（6 歲以下）課程
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            啟蒙班、親子班
          </div>
        </div>
        <Switch bind:checked={prefUnder6} on:change={() => toasts.notify('info', prefUnder6 ? '已開啟幼兒課程' : '已關閉幼兒課程')} />
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0">
        <div>
          <div style="font-size:var(--df-text-base);font-weight:var(--df-weight-medium);color:var(--df-text-dark);font-family:var(--df-font-body)">
            接受週末排課
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            週六、週日課程
          </div>
        </div>
        <Switch bind:checked={prefWeekend} on:change={() => toasts.notify('info', prefWeekend ? '已開啟週末排課' : '已關閉週末排課')} />
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--df-border)">
      <Button variant="primary" size="md" on:click={savePrefs}>
        <span style="display:inline-flex;align-items:center;gap:8px">
          <Icon name="save" size={16} color="#fff" />儲存偏好
        </span>
      </Button>
    </div>
  </Card>
</div>
