<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  let currentDate = new Date();
  let selectedDate: Date | null = null;
  let selectedTimeSlot: string | null = null;

  // Time slots from 6:00 to 23:00 in 2-hour blocks
  const timeSlots = [
    '06:00-08:00',
    '08:00-10:00',
    '10:00-12:00',
    '12:00-14:00',
    '14:00-16:00',
    '16:00-18:00',
    '18:00-20:00',
    '20:00-22:00',
    '21:00-23:00'
  ];

  // Simulated availability (in real app, this would come from API)
  function getAvailability(date: Date, timeSlot: string): 'available' | 'limited' | 'full' {
    const random = Math.random();
    if (random > 0.7) return 'available';
    if (random > 0.3) return 'limited';
    return 'full';
  }

  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  function previousMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  function selectDate(day: number) {
    selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    selectedTimeSlot = null;
  }

  function selectTimeSlot(slot: string) {
    if (!selectedDate) return;
    const availability = getAvailability(selectedDate, slot);
    if (availability === 'full') return;

    selectedTimeSlot = slot;
  }

  function isToday(day: number): boolean {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  }

  function isPastDate(day: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate < today;
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  function handleBooking() {
    if (!selectedDate || !selectedTimeSlot || !browser) return;

    alert(`預約成功！\n日期：${formatDate(selectedDate)}\n時段：${selectedTimeSlot}\n\n請前往聯絡頁面完成預約流程。`);
    goto('/contact');
  }

  $: year = currentDate.getFullYear();
  $: month = currentDate.getMonth();
  $: daysInMonth = getDaysInMonth(year, month);
  $: firstDay = getFirstDayOfMonth(year, month);
  $: monthName = currentDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });

  $: calendarDays = (() => {
    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  })();
</script>

<div class="schedule-calendar card">
  <div class="calendar-header">
    <button class="nav-btn" on:click={previousMonth}>&lt;</button>
    <h2>{monthName}</h2>
    <button class="nav-btn" on:click={nextMonth}>&gt;</button>
  </div>

  <div class="calendar-grid">
    <div class="day-header">日</div>
    <div class="day-header">一</div>
    <div class="day-header">二</div>
    <div class="day-header">三</div>
    <div class="day-header">四</div>
    <div class="day-header">五</div>
    <div class="day-header">六</div>

    {#each calendarDays as day}
      {#if day === null}
        <div class="calendar-day empty"></div>
      {:else}
        <button
          class="calendar-day"
          class:today={isToday(day)}
          class:selected={selectedDate?.getDate() === day}
          class:past={isPastDate(day)}
          disabled={isPastDate(day)}
          on:click={() => selectDate(day)}
        >
          {day}
        </button>
      {/if}
    {/each}
  </div>

  {#if selectedDate}
    <div class="time-slots">
      <h3>可預約時段 - {formatDate(selectedDate)}</h3>
      <div class="slots-grid">
        {#each timeSlots as slot}
          {@const availability = getAvailability(selectedDate, slot)}
          <button
            class="time-slot"
            class:available={availability === 'available'}
            class:limited={availability === 'limited'}
            class:full={availability === 'full'}
            class:selected-slot={selectedTimeSlot === slot}
            disabled={availability === 'full'}
            on:click={() => selectTimeSlot(slot)}
          >
            <span class="slot-time">{slot}</span>
            <span class="slot-status">
              {#if availability === 'available'}
                充足
              {:else if availability === 'limited'}
                有限
              {:else}
                額滿
              {/if}
            </span>
          </button>
        {/each}
      </div>

      {#if selectedTimeSlot}
        <div class="booking-action">
          <button class="btn btn-primary" on:click={handleBooking}>
            確認預約 {selectedTimeSlot}
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <div class="legend">
    <div class="legend-item">
      <span class="legend-color available"></span>
      <span>充足</span>
    </div>
    <div class="legend-item">
      <span class="legend-color limited"></span>
      <span>有限</span>
    </div>
    <div class="legend-item">
      <span class="legend-color full"></span>
      <span>額滿</span>
    </div>
  </div>
</div>

<style>
  .schedule-calendar {
    max-width: 900px;
    margin: 0 auto;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .calendar-header h2 {
    color: var(--df-primary);
    margin: 0;
  }

  .nav-btn {
    background-color: var(--df-primary);
    color: var(--df-white);
    border: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--df-radius-md);
    cursor: pointer;
    font-size: 1.2rem;
    transition: background-color var(--transition-fast);
  }

  .nav-btn:hover {
    background-color: var(--df-primary-dark);
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
    margin-bottom: var(--spacing-lg);
  }

  .day-header {
    text-align: center;
    font-weight: 600;
    color: var(--df-primary);
    padding: var(--spacing-sm);
  }

  .calendar-day {
    aspect-ratio: 1;
    border: 2px solid var(--df-border);
    background-color: var(--df-surface);
    border-radius: var(--df-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-weight: 500;
    color: var(--df-text-dark);
  }

  .calendar-day.empty {
    border: none;
    cursor: default;
  }

  .calendar-day:not(.empty):not(.past):hover {
    border-color: var(--df-primary);
    background-color: var(--df-primary-bg);
  }

  .calendar-day.today {
    border-color: var(--df-accent);
    background-color: var(--df-warning-bg);
  }

  .calendar-day.selected {
    background-color: var(--df-primary);
    color: var(--df-white);
    border-color: var(--df-primary);
  }

  .calendar-day.past {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .time-slots {
    margin-top: var(--spacing-xl);
    padding-top: var(--spacing-lg);
    border-top: 2px solid var(--df-border);
  }

  .time-slots h3 {
    color: var(--df-primary);
    margin-bottom: var(--spacing-md);
  }

  .slots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .time-slot {
    padding: var(--spacing-md);
    border: 2px solid var(--df-border);
    border-radius: var(--df-radius-md);
    background-color: var(--df-surface);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: var(--df-text-dark);
  }

  .time-slot:not(:disabled):hover {
    border-color: var(--df-primary);
    transform: translateY(-2px);
  }

  .time-slot.selected-slot {
    border-color: var(--df-primary);
    background-color: var(--df-primary);
    color: var(--df-white);
  }

  .time-slot.available {
    border-color: var(--df-success);
  }

  .time-slot.available .slot-status {
    color: var(--df-success-strong);
  }

  .time-slot.limited {
    border-color: var(--df-warning);
  }

  .time-slot.limited .slot-status {
    color: var(--df-warning);
  }

  .time-slot.full {
    border-color: var(--df-error);
    opacity: 0.5;
    cursor: not-allowed;
  }

  .time-slot.full .slot-status {
    color: var(--df-error);
  }

  .time-slot.selected-slot .slot-status {
    color: var(--df-white);
  }

  .slot-time {
    font-weight: 600;
    font-size: 1rem;
  }

  .slot-status {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .booking-action {
    text-align: center;
  }

  .booking-action .btn {
    padding: var(--spacing-md) var(--spacing-xl);
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--df-border);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    color: var(--df-text-light);
  }

  .legend-color {
    width: 20px;
    height: 20px;
    border-radius: var(--df-radius-sm);
    border: 2px solid;
  }

  .legend-color.available {
    border-color: var(--df-success);
    background-color: var(--df-success-bg);
  }

  .legend-color.limited {
    border-color: var(--df-warning);
    background-color: var(--df-warning-bg);
  }

  .legend-color.full {
    border-color: var(--df-error);
    background-color: var(--df-error-bg);
  }

  @media (max-width: 767px) {
    .calendar-grid {
      gap: 0.25rem;
    }

    .day-header {
      font-size: 0.9rem;
      padding: 0.5rem 0.25rem;
    }

    .calendar-day {
      font-size: 0.9rem;
    }

    .slots-grid {
      grid-template-columns: 1fr 1fr;
    }

    .legend {
      flex-direction: column;
      gap: var(--spacing-sm);
    }
  }
</style>
