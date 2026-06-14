<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';

  let formData = {
    name: '',
    email: '',
    phone: '',
    subject: '一般諮詢',
    message: ''
  };

  let formStatus: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  let errorMessage = '';

  const subjects = ['一般諮詢', '課程報名', '場地預約', '教練諮詢', '其他'];

  function validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function validatePhone(phone: string): boolean {
    const re = /^[0-9\-\s\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    errorMessage = '';

    // Validation
    if (!formData.name.trim()) {
      errorMessage = '請輸入您的姓名';
      return;
    }

    if (!validateEmail(formData.email)) {
      errorMessage = '請輸入有效的電子郵件地址';
      return;
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      errorMessage = '請輸入有效的電話號碼';
      return;
    }

    if (!formData.message.trim()) {
      errorMessage = '請輸入訊息內容';
      return;
    }

    formStatus = 'submitting';

    // Simulate form submission
    setTimeout(() => {
      console.log('Form submitted:', formData);
      formStatus = 'success';

      // Reset form after 3 seconds
      setTimeout(() => {
        formData = {
          name: '',
          email: '',
          phone: '',
          subject: '一般諮詢',
          message: ''
        };
        formStatus = 'idle';
      }, 3000);
    }, 1000);
  }
</script>

<form class="contact-form" on:submit={handleSubmit}>
  <div class="form-group">
    <label for="name">姓名 <span class="required">*</span></label>
    <input
      type="text"
      id="name"
      bind:value={formData.name}
      placeholder="請輸入您的姓名"
      required
      disabled={formStatus === 'submitting'}
    />
  </div>

  <div class="form-group">
    <label for="email">電子郵件 <span class="required">*</span></label>
    <input
      type="email"
      id="email"
      bind:value={formData.email}
      placeholder="example@email.com"
      required
      disabled={formStatus === 'submitting'}
    />
  </div>

  <div class="form-group">
    <label for="phone">聯絡電話</label>
    <input
      type="tel"
      id="phone"
      bind:value={formData.phone}
      placeholder="0912-345-678"
      disabled={formStatus === 'submitting'}
    />
  </div>

  <div class="form-group">
    <label for="subject">主旨</label>
    <select
      id="subject"
      bind:value={formData.subject}
      disabled={formStatus === 'submitting'}
    >
      {#each subjects as subject}
        <option value={subject}>{subject}</option>
      {/each}
    </select>
  </div>

  <div class="form-group">
    <label for="message">訊息內容 <span class="required">*</span></label>
    <textarea
      id="message"
      bind:value={formData.message}
      placeholder="請輸入您的問題或需求..."
      rows="6"
      required
      disabled={formStatus === 'submitting'}
    ></textarea>
  </div>

  {#if errorMessage}
    <div class="error-message">
      <Icon name="circle-alert" size={16} color="var(--df-error-strong)" />
      {errorMessage}
    </div>
  {/if}

  {#if formStatus === 'success'}
    <div class="success-message">
      <Icon name="circle-check" size={16} color="var(--df-success-strong)" />
      訊息已送出！我們會盡快與您聯繫。
    </div>
  {/if}

  <button
    type="submit"
    class="btn btn-primary submit-btn"
    disabled={formStatus === 'submitting'}
  >
    {#if formStatus === 'submitting'}
      送出中...
    {:else if formStatus === 'success'}
      <Icon name="check" size={18} color="currentColor" />
      已送出
    {:else}
      送出訊息
    {/if}
  </button>
</form>

<style>
  .contact-form {
    width: 100%;
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  label {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--df-text-dark);
    font-weight: 600;
  }

  .required {
    color: var(--df-error);
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1.5px solid var(--df-border-strong);
    border-radius: var(--df-radius-md);
    font-size: 1rem;
    font-family: inherit;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    background-color: var(--df-surface);
    color: var(--df-text-dark);
  }

  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--df-primary);
    box-shadow: 0 0 0 3px var(--df-primary-bg);
  }

  input:disabled,
  select:disabled,
  textarea:disabled {
    background-color: var(--df-bg-light);
    color: var(--df-text-muted);
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background-color: var(--df-error-bg);
    color: var(--df-error-strong);
    border: 1px solid var(--df-error);
    border-radius: var(--df-radius-md);
    margin-bottom: var(--spacing-md);
    font-size: 0.9rem;
  }

  .success-message {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background-color: var(--df-success-bg);
    color: var(--df-success-strong);
    border: 1px solid var(--df-success);
    border-radius: var(--df-radius-md);
    margin-bottom: var(--spacing-md);
    font-size: 0.9rem;
  }

  .submit-btn {
    width: 100%;
    padding: var(--spacing-md);
    font-size: 1.1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
