<script lang="ts">
  /* 學員 編輯 / 新增 sheet。forms.jsx MemberForm (31)。
   * 透過 OverlayHost 掛載：每次 overlay.sheet('memberForm',{m}) 都是新實例，
   * 故直接以 prop 初始化表單狀態（不需 React 的 useEffect-on-open）。
   * 儲存 → onSave(rec,isNew)（未提供時退回 store saveMember），再 onClose()。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { get } from 'svelte/store';
  import { saveMember, coaches as coachesStore, classes as classesStore } from '$lib/mobile-admin/stores';
  import { F_COLORS, F_MEMBER_STATUS } from '$lib/mobile-admin/form-options';
  import { tierOf, CAMPUSES, ENROLL_SOURCES, type MemberRow, type ClassRow, type Coach } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let m: MemberRow | null = null;
  export let onSave: ((rec: MemberRow, isNew: boolean) => void) | undefined = undefined;
  export let coaches: Coach[] = [];
  export let classes: ClassRow[] = [];

  const isNew = !m;
  /* Options fall back to the live stores when the host opens the form without
   * passing them (every current call site does), so the selects are never empty. */
  const initClasses = classes.length ? classes : get(classesStore);
  const initCoaches = coaches.length ? coaches : get(coachesStore);
  /* Seed a COMPLETE MemberRow for new students — MemberSheet renders recent[],
   * pay, campus, emergency contact, etc., so a partial record makes the detail
   * sheet throw / show undefined. Mirrors the shape MEMBERS is built with. */
  let f: MemberRow = m
    ? { ...m }
    : {
        id: '',
        name: '',
        initial: '',
        color: F_COLORS[0],
        course: (initClasses[0] && initClasses[0].name) || '',
        coach: (initCoaches[0] && initCoaches[0].name) || '',
        att: 100,
        status: 'active',
        age: 0,
        parent: '',
        phone: '',
        joined: '2026/06',
        points: 0,
        pay: 'trial',
        remain: 0,
        lastSeen: '—',
        recent: [],
        emName: '',
        emPhone: '',
        campus: CAMPUSES[0],
        source: ENROLL_SOURCES[0],
        birthday: '',
        tier: tierOf(0)[0],
        tierColor: tierOf(0)[1],
        renewDue: '體驗 06/30 到期',
        lineId: ''
      };

  let ageStr = isNew ? '' : String(f.age ?? '');

  $: stLabel = (F_MEMBER_STATUS.find(([v]) => v === f.status) || ['', '在學中'])[1];
  $: valid = !!(f.name || '').trim() && !!f.course && !!f.coach;
  $: initial = f.name.trim().charAt(0) || '學';
  $: classOpts = classes.length ? classes : $classesStore;
  $: coachOpts = coaches.length ? coaches : $coachesStore;

  function setStatus(label: string) {
    f.status = (F_MEMBER_STATUS.find(([, l]) => l === label) || ['active'])[0] as MemberRow['status'];
  }
  function save() {
    const ageNum = parseInt(ageStr, 10);
    const rec: MemberRow = {
      ...f,
      age: Number.isNaN(ageNum) ? f.age : ageNum,
      initial: f.name.trim().charAt(0) || f.initial || '學'
    };
    if (onSave) onSave(rec, isNew);
    else saveMember(rec, isNew);
    onClose();
  }
</script>

<Sheet
  open
  {onClose}
  maxHeight="93%"
  title={isNew ? '新增學員' : '編輯學員資料'}
  sub={isNew ? '建立新的會員報名資料' : '會員編號 ' + f.id}
>
  <div style="display:flex; flex-direction:column; gap:16px;">
    <div style="display:flex; align-items:center; gap:13px;">
      <Avatar name={initial} size="lg" color={f.color} />
      <div style="font-size:12.5px; color:var(--df-text-light); line-height:1.5;">
        頭像以姓氏首字顯示<br />{isNew ? '建立後可隨時編輯' : '入會 ' + f.joined + ' · ' + f.points + ' 點'}
      </div>
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
      <Input label="學員姓名" bind:value={f.name} />
      <Input label="年齡" bind:value={ageStr} />
    </div>
    <Select label="報名課程" bind:value={f.course} options={classOpts.map((c) => c.name)} />
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Select label="授課教練" bind:value={f.coach} options={coachOpts.map((c) => c.name)} />
      <Select
        label="在學狀態"
        value={stLabel}
        on:change={(e) => setStatus((e.target as HTMLSelectElement).value)}
        options={F_MEMBER_STATUS.map(([, l]) => l)}
      />
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:13px;">
      <Input label="家長 / 聯絡人" bind:value={f.parent} />
      <Input label="聯絡電話" bind:value={f.phone} />
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={!valid} style="flex:1;" on:click={save}>
      <Icon name="check" size={16} style="margin-right:6px;" />{isNew ? '建立學員' : '儲存資料'}
    </Button>
  </svelte:fragment>
</Sheet>
