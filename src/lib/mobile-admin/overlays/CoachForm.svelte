<script lang="ts">
  /* 教練 新增 / 編輯 sheet。forms.jsx CoachForm (121)。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('coachForm',{c}) 都是新實例。
   * 儲存 → onSave(rec,isNew)（未提供時退回 store saveCoach），再 onClose()。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { saveCoach } from '$lib/mobile-admin/stores';
  import { F_COLORS, F_COACH_STATUS } from '$lib/mobile-admin/form-options';
  import type { Coach } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let c: Coach | null = null;
  export let onSave: ((rec: Coach, isNew: boolean) => void) | undefined = undefined;

  const isNew = !c;
  let f: Coach = c
    ? { ...c }
    : {
        id: '',
        name: '',
        initial: '',
        title: '',
        color: F_COLORS[0],
        tags: [],
        years: 0,
        students: 0,
        awards: 0,
        classes: 0,
        status: 'online',
        phone: ''
      };

  let tagsText = (f.tags || []).join('、');
  let yearsStr = String(f.years ?? '');
  let studentsStr = String(f.students ?? '');
  let classesStr = String(f.classes ?? '');
  let awardsStr = String(f.awards ?? '');

  $: stLabel = (F_COACH_STATUS.find(([v]) => v === f.status) || ['', '線上'])[1];
  $: valid = !!(f.name || '').trim() && !!(f.title || '').trim();
  $: initial = f.name.trim().charAt(0) || '教';

  function setStatus(label: string) {
    f.status = (F_COACH_STATUS.find(([, l]) => l === label) || ['online'])[0] as Coach['status'];
  }
  function save() {
    const rec: Coach = {
      ...f,
      initial: f.name.trim().charAt(0) || f.initial || '教',
      tags: tagsText
        .split(/[、,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
      years: parseInt(yearsStr, 10) || 0,
      students: parseInt(studentsStr, 10) || 0,
      classes: parseInt(classesStr, 10) || 0,
      awards: parseInt(awardsStr, 10) || 0
    };
    if (onSave) onSave(rec, isNew);
    else saveCoach(rec, isNew);
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增教練' : '編輯教練'}
  sub={isNew ? '建立教練檔案' : f.name + ' 教練'}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <div style="display:flex; align-items:center; gap:13px;">
      <Avatar name={initial} size="lg" color={f.color} />
      <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.5;">頭像以姓氏首字顯示</div>
    </div>

    <div>
      <div style="font-size:13px; font-weight:600; color:var(--df-text-dark); margin-bottom:8px;">代表色 / 頭像底色</div>
      <div style="display:flex; gap:11px;">
        {#each F_COLORS as col (col)}
          <button
            type="button"
            on:click={() => (f.color = col)}
            aria-label={'選擇 ' + col}
            class="df-tapscale"
            style="width:32px; height:32px; border-radius:999px; background:{col};
              border:{f.color === col ? '3px solid var(--df-ink)' : '2px solid #fff'};
              box-shadow:0 0 0 1px var(--df-border); cursor:pointer; flex:none;"
          ></button>
        {/each}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="教練姓名" bind:value={f.name} />
      <Select
        label="目前狀態"
        value={stLabel}
        on:change={(e) => setStatus((e.target as HTMLSelectElement).value)}
        options={F_COACH_STATUS.map(([, l]) => l)}
      />
    </div>
    <Input label="職稱 / 專業" bind:value={f.title} />
    <Input label="專長標籤（以、分隔）" bind:value={tagsText} />
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="年資（年）" bind:value={yearsStr} />
      <Input label="聯絡電話" bind:value={f.phone} />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:13px;">
      <Input label="學員數" bind:value={studentsStr} />
      <Input label="班級數" bind:value={classesStr} />
      <Input label="獲獎數" bind:value={awardsStr} />
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={!valid} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立教練' : '儲存'}
    </Button>
  </svelte:fragment>
</Sheet>
