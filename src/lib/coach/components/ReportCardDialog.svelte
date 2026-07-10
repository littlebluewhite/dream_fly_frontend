<script lang="ts">
  /* 寫評語 dialog — students 頁「寫評語」動作(Task 13 續；POST /report-cards，見
   * integration-contract.md §3.22)。成績單掛在「單一 enrolment」上：學員在這位教練
   * 名下只有一堂課時自動帶入該 enrolment（顯示課名即可）；多堂課時由教練選課程
   * （選項值即 enrolment_id，來自 GET /coaches/me/students 的 courses 條目，後端
   * 97668d2 起提供）。
   *
   * 期別/評語為必填（評語在契約上選填，但空評語的成績單無意義且後端不會 422 擋——
   * 必填由前端把關，送出鈕未填前停用，同 LeaveDialog 的 valid 慣例）；評分選填
   * 1–5，預設「不評分」則 body 省略 rating。重複期別後端回 409「此期別已建立過
   * 成績單」——與 403/422 一律直通 ApiError.message（後端訊息本身即繁中）。
   *
   * 重置慣例：check-and-update 留在同一個 reactive statement（CouponCreateDialog
   * 先例，理由見 CertificateDialog 同位置註解）。 */
  import { Input, Textarea, Select } from '$lib/components/ui';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { createReportCard, type CreateReportCardBody } from '$lib/coach/api';
  import { toasts } from '$lib/coach/stores';
  import { apiErrorMessage } from '$lib/api/error-text';
  import type { Student } from '$lib/coach/data';

  export let open = false;
  export let student: Student | null = null;
  export let onClose: () => void = () => {};

  let enrolmentId = '';
  let termLabel = '';
  let comment = '';
  let rating = ''; // '' = 不評分；'1'–'5'
  let submitting = false;

  const RATING_OPTIONS = [
    { value: '', label: '不評分' },
    { value: '1', label: '1 星' },
    { value: '2', label: '2 星' },
    { value: '3', label: '3 星' },
    { value: '4', label: '4 星' },
    { value: '5', label: '5 星' }
  ];

  let lastOpen = false;
  $: {
    if (open && !lastOpen && student) {
      // 單堂課直接帶入該 enrolment；多堂課留空待教練選擇。
      enrolmentId = student.courses.length === 1 ? student.courses[0].enrolment_id : '';
      termLabel = '';
      comment = '';
      rating = '';
      submitting = false;
    }
    lastOpen = open;
  }

  $: valid = !!enrolmentId && termLabel.trim() !== '' && comment.trim() !== '';

  async function submit() {
    if (!student || !valid || submitting) return;
    submitting = true;
    const body: CreateReportCardBody = {
      enrolment_id: enrolmentId,
      term_label: termLabel.trim(),
      comment: comment.trim()
    };
    if (rating) body.rating = Number(rating);
    try {
      await createReportCard(body);
      toasts.notify('success', '已建立成績單', `${student.name} · ${termLabel.trim()}`);
      onClose();
    } catch (e) {
      // 後端(leave/certificates/report-cards 模組)錯誤字串本身即繁中(409「此期別已
      // 建立過成績單」、403「非本課教練」、422 欄位驗證)，直接透傳(apiErrorMessage)，
      // 同 CertificateDialog 慣例。
      toasts.notify('error', '成績單建立失敗', apiErrorMessage(e));
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog
  open={open && !!student}
  title="寫評語"
  onClose={onClose}
  primaryAction={{
    label: submitting ? '送出中…' : '建立成績單',
    onClick: submit,
    variant: 'primary',
    disabled: !valid || submitting
  }}
  secondaryAction={{ label: '取消', onClick: onClose, variant: 'secondary' }}
>
  {#if student}
    <div style="display:flex;flex-direction:column;gap:14px;padding-top:8px">
      <p style="margin:0;font-size:13.5px;color:var(--df-text-light)">評語對象：{student.name}</p>
      {#if student.courses.length > 1}
        <Select
          label="課程"
          required
          placeholder="選擇課程"
          bind:value={enrolmentId}
          options={student.courses.map((c) => ({ value: c.enrolment_id, label: c.course_name }))}
        />
      {:else if student.courses.length === 1}
        <p style="margin:0;font-size:13.5px;color:var(--df-text-light)">課程：{student.courses[0].course_name}</p>
      {/if}
      <Input label="期別" required bind:value={termLabel} placeholder="例如 2026 夏季" />
      <Textarea label="評語" required bind:value={comment} rows={4} placeholder="學員本期的學習表現與建議…" />
      <Select label="評分（選填）" bind:value={rating} options={RATING_OPTIONS} />
    </div>
  {/if}
</Dialog>
