<script lang="ts">
  /* 發證書 dialog — students 頁「發證書」動作(Task 13；POST /certificates，見
   * integration-contract.md §3.22)。v1 純 metadata，無 PDF/檔案上傳。
   *
   * course_id 選填且與呼叫者權限無關（§3.22：只要學員曾在教練任一課程報名即可核發，
   * 與 body 的 course_id 是否留空無關）——本 dialog 不提供課程選擇：MyStudentResponse
   * （coach/data.ts 的 Student 型別）目前只有攤平後的 cls 字串，沒有結構化的
   * course_id 清單可供下拉選單使用，一律不綁定課程，符合契約「可為 NULL」的正常
   * 狀態，而非退化情形。
   *
   * 重置慣例：check-and-update 須留在同一個 reactive statement 內(CouponCreateDialog
   * 先例)——把 lastOpen 的寫入拆成獨立的 trailing `$:`(如 SecurityTab 的
   * PasswordDialog 那樣)並不可靠：Svelte 依相依關係對 reactive statement 做拓撲排序，
   * 寫入者可能在同一次 flush 中搶先於這裡的讀取者執行，導致偵測不到開關轉換。
   *
   * Dialog 呼叫慣例採 SecurityTab 的 primaryAction/secondaryAction 寫法(coach 目前
   * 唯一既有的 Dialog 使用範例)，而非 admin 的 EditModal/CouponCreateDialog(那是
   * admin 專屬的外層元件，coach 沒有對應版本)。 */
  import { Input, Textarea } from '$lib/components/ui';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { createCertificate, type CreateCertificateBody } from '$lib/coach/api';
  import { toasts } from '$lib/coach/stores';
  import { ApiError } from '$lib/api/client';
  import type { Student } from '$lib/coach/data';

  export let open = false;
  export let student: Student | null = null;
  export let onClose: () => void = () => {};

  /** 本地日期(YYYY-MM-DD)，非 toISOString()——後者取 UTC 日期，在 Asia/Taipei(UTC+8)
   *  的凌晨 00:00–08:00 會早報一天(同 ScheduleCalendar.svelte 的 isoDate 慣例，
   *  避免 UTC 位移)。 */
  const today = (): string => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  let title = '';
  let level = '';
  let issuedOn = '';
  let note = '';
  let submitting = false;

  let lastOpen = false;
  $: {
    if (open && !lastOpen) {
      title = '';
      level = '';
      issuedOn = today();
      note = '';
      submitting = false;
    }
    lastOpen = open;
  }

  /** 後端(dream_fly_backend/src/modules/certificates)的錯誤字串本身就是繁中(403「僅
   *  能發給自己課程的學員」、422 欄位長度)，直接透傳即可，同 leave-requests 頁的
   *  decisionErrorMessage 慣例。 */
  function certificateErrorMessage(e: unknown): string {
    if (e instanceof ApiError) return e.message;
    return '連線發生問題，請稍後再試。';
  }

  async function submit() {
    if (!student || submitting) return;
    submitting = true;
    const body: CreateCertificateBody = {
      user_id: student.user_id,
      title: title.trim(),
      issued_on: issuedOn
    };
    if (level.trim()) body.level = level.trim();
    if (note.trim()) body.note = note.trim();
    try {
      await createCertificate(body);
      toasts.notify('success', '已發放證書', `${student.name} · ${title.trim()}`);
      onClose();
    } catch (e) {
      toasts.notify('error', '發放失敗', certificateErrorMessage(e));
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog
  open={open && !!student}
  title="發證書"
  onClose={onClose}
  primaryAction={{ label: submitting ? '發放中…' : '發放證書', onClick: submit, variant: 'primary' }}
  secondaryAction={{ label: '取消', onClick: onClose, variant: 'secondary' }}
>
  {#if student}
    <div style="display:flex;flex-direction:column;gap:14px;padding-top:8px">
      <p style="margin:0;font-size:13.5px;color:var(--df-text-light)">頒發對象：{student.name}</p>
      <Input label="證書名稱" required bind:value={title} placeholder="例如 競技啦啦隊 進階班 結業證書" />
      <Input label="等級（選填）" bind:value={level} placeholder="例如 結業、優等" />
      <Input label="核發日期" type="date" required bind:value={issuedOn} />
      <Textarea label="備註（選填）" bind:value={note} rows={3} />
    </div>
  {/if}
</Dialog>
