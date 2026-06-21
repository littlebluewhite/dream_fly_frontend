<script lang="ts">
  /* 學員技能評量 sheet（NEW — 設計成與報表/技能風格一致）。
   * SKILLS[student.id] 技能列（MiniBar），分數可 +/- 調整；儲存 → toast + 關閉。
   * onClose 由 OverlayHost 帶入；student 由 overlay.sheet('studentSkills',{student}) 帶入。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { SKILLS, type MemberRow } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let student: MemberRow | null = null;

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const baseFor = (m: MemberRow): [string, number][] =>
    SKILLS[m.id] || [['基本動作', m.att], ['體能', Math.max(60, m.att - 8)]];

  // 本地可編輯副本（不改 SKILLS 來源）
  let scores: [string, number][] = student ? baseFor(student).map(([k, v]) => [k, v]) : [];
  $: avg = scores.length ? Math.round(scores.reduce((a, [, v]) => a + v, 0) / scores.length) : 0;

  const bump = (i: number, d: number) => {
    scores = scores.map((row, j) => (j === i ? [row[0], clamp(row[1] + d)] : row));
  };
  const save = () => {
    if (student) toasts.notify('success', student.name + ' · 技能評量', '已更新本週動作熟練度。');
    onClose();
  };
</script>

<Sheet open {onClose} title="技能評量" sub={student ? student.name + ' · 本週動作熟練度' : ''}>
  {#if student}
    <!-- student header -->
    <div style="display:flex; align-items:center; gap:12px; padding:13px; border-radius:14px; background:var(--df-bg-light); margin-bottom:16px;">
      <Avatar name={student.initial} size="md" color={student.color} />
      <div style="flex:1; min-width:0;">
        <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{student.name}</div>
        <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{student.age} 歲 · {student.course}</div>
      </div>
      <StatusBadgeM s={student.status} />
    </div>

    <!-- overall -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <span style="font-size:13px; color:var(--df-text-light);">整體平均熟練度</span>
      <span style="font-size:22px; font-weight:800; color:var(--df-primary); font-family:var(--df-font-heading);">{avg}%</span>
    </div>

    <!-- editable skill rows -->
    <div style="display:flex; flex-direction:column; gap:16px;">
      {#each scores as [sk, v], i (sk)}
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;">
            <span style="font-size:14px; font-weight:600; color:var(--df-text-dark);">{sk}</span>
            <div style="display:flex; align-items:center; gap:10px;">
              <button
                on:click={() => bump(i, -5)}
                aria-label="降低"
                class="df-tapscale"
                style="width:30px; height:30px; border-radius:8px; border:1.5px solid var(--df-border); background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"
              ><Icon name="minus" size={15} color="var(--df-text-light)" /></button>
              <span style="font-size:15px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading); width:42px; text-align:center;">{v}%</span>
              <button
                on:click={() => bump(i, 5)}
                aria-label="提高"
                class="df-tapscale"
                style="width:30px; height:30px; border-radius:8px; border:1.5px solid var(--df-border); background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"
              ><Icon name="plus" size={15} color="var(--df-primary)" /></button>
            </div>
          </div>
          <MiniBar value={v} tone={v >= 85 ? 'success' : 'primary'} height={8} />
        </div>
      {/each}
    </div>
  {/if}

  <Button slot="footer" variant="primary" fullWidth on:click={save}>
    <span style="display:inline-flex; align-items:center; gap:6px; justify-content:center;"><Icon name="check" size={16} color="#fff" />儲存評量</span>
  </Button>
</Sheet>
