<script lang="ts">
  /* 學員發放動作 sheet（前身 StudentSkillsSheet——原「技能評量」為純本地假調整分數
   * 功能，Student 型別(coach/data.ts)真後端只有單一 skill/pct 且皆為 P2 佔位值，
   * 無多技能評量表可編輯，Task 20 起改為桌面 StudentCard 真正提供的兩個動作：
   * 寫評語(POST /report-cards)、發證書(POST /certificates)，integration-
   * contract.md §3.22，Task 13）。mode prop 決定顯示哪一種表單，皆透過
   * $lib/mobile-admin/api 呼叫真後端；成功關閉 sheet，失敗顯示錯誤 toast 且不
   * 關閉(同桌面 CertificateDialog/ReportCardDialog 慣例)。
   * onClose 由 OverlayHost 帶入；student/mode 由 overlay.sheet('studentAction',
   * {student, mode}) 帶入。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { createCertificate, createReportCard } from '$lib/coach/api';
  import { createCertificateForm, createReportCardForm, RATING_OPTIONS } from '$lib/coach/student-forms';
  import { apiErrorMessage } from '$lib/api/error-text';
  // 卡 3：Student 型別改經 $lib/mobile-admin/data 接縫取用（單源仍在 coach/data）。
  import type { Student } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let student: Student | null = null;
  export let mode: 'reportCard' | 'certificate' = 'reportCard';

  // 發證書欄位；寫評語欄位——單堂課直接帶入該 enrolment、多堂課留空待教練選擇(同桌面
  // ReportCardDialog 慣例)。sheet 每次 overlay.sheet() 重掛，故建構時重置一次即可。
  const certForm = createCertificateForm({ createCertificate });
  const { title: certTitle, level: certLevel, issuedOn, note: certNote } = certForm;
  certForm.reset();
  const reportCardForm = createReportCardForm({ createReportCard });
  const { enrolmentId, termLabel, comment, rating } = reportCardForm;
  if (student) reportCardForm.reset(student);

  $: active = mode === 'certificate' ? certForm : reportCardForm;
  $: valid = $active.valid;
  $: submitting = $active.submitting;

  // 後端(certificates/report-cards 模組)的錯誤字串本身就是繁中 → apiErrorMessage
  // 直接透傳，同桌面 CertificateDialog/ReportCardDialog 慣例。
  async function submit() {
    if (!student) return;
    const outcome = mode === 'certificate' ? await certForm.submit(student) : await reportCardForm.submit();
    if (!outcome) return;
    if (outcome.kind === 'certificateIssued') {
      toasts.notify('success', '已發放證書', `${student.name} · ${$certTitle.trim()}`);
      onClose();
    } else if (outcome.kind === 'reportCardCreated') {
      toasts.notify('success', '已建立成績單', `${student.name} · ${$termLabel.trim()}`);
      onClose();
    } else {
      toasts.notify('error', mode === 'certificate' ? '發放失敗' : '成績單建立失敗', apiErrorMessage(outcome.error));
    }
  }
</script>

<Sheet
  open={!!student}
  {onClose}
  title={mode === 'certificate' ? '發證書' : '寫評語'}
  sub={student ? student.name + (mode === 'certificate' ? ' · 核發證書' : ' · 建立成績單') : ''}
>
  {#if student}
    <div style="display:flex; align-items:center; gap:12px; padding:13px; border-radius:14px; background:var(--df-bg-light); margin-bottom:16px;">
      <Avatar name={student.initial} size="md" color={student.color} />
      <div style="flex:1; min-width:0;">
        <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">{student.name}</div>
        <div style="font-size:12px; color:var(--df-text-light); margin-top:1px;">{student.cls}</div>
      </div>
    </div>

    {#if mode === 'certificate'}
      <div style="display:flex; flex-direction:column; gap:14px;">
        <Input label="證書名稱" bind:value={$certTitle} placeholder="例如 競技啦啦隊 進階班 結業證書" />
        <Input label="等級（選填）" bind:value={$certLevel} placeholder="例如 結業、優等" />
        <Input label="核發日期" type="date" bind:value={$issuedOn} />
        <Input label="備註（選填）" bind:value={$certNote} />
      </div>
    {:else}
      <div style="display:flex; flex-direction:column; gap:14px;">
        {#if student.courses.length > 1}
          <Select
            label="課程"
            placeholder="選擇課程"
            bind:value={$enrolmentId}
            options={student.courses.map((c) => ({ value: c.enrolment_id, label: c.course_name }))}
          />
        {:else if student.courses.length === 1}
          <p style="margin:0; font-size:13.5px; color:var(--df-text-light);">課程：{student.courses[0].course_name}</p>
        {/if}
        <Input label="期別" bind:value={$termLabel} placeholder="例如 2026 夏季" />
        <Input label="評語" bind:value={$comment} placeholder="學員本期的學習表現與建議…" />
        <Select label="評分（選填）" bind:value={$rating} options={RATING_OPTIONS} />
      </div>
    {/if}
  {/if}

  <Button slot="footer" variant="primary" fullWidth disabled={!valid || submitting} on:click={submit}>
    <span style="display:inline-flex; align-items:center; gap:6px; justify-content:center;">
      <Icon name="check" size={16} color="#fff" />
      {submitting ? '送出中…' : mode === 'certificate' ? '發放證書' : '建立成績單'}
    </span>
  </Button>
</Sheet>
