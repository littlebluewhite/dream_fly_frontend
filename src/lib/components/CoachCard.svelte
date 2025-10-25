<script lang="ts">
  export let coach: {
    id: number;
    name: string;
    title: string;
    specialties: string[];
    experience: string;
    certifications: string[];
  };
</script>

<div class="coach-card card">
  <div class="coach-header">
    <div class="coach-avatar">
      {coach.name.charAt(0)}
    </div>
    <div class="coach-info">
      <h3>{coach.name}</h3>
      <p class="coach-title">{coach.title}</p>
    </div>
  </div>

  <div class="coach-body">
    <div class="coach-section">
      <h4>專長領域</h4>
      <ul class="specialties-list">
        {#each coach.specialties as specialty}
          <li>{specialty}</li>
        {/each}
      </ul>
    </div>

    <div class="coach-section">
      <h4>經歷</h4>
      <p>{coach.experience}</p>
    </div>

    <div class="coach-section">
      <h4>證照</h4>
      <ul class="certifications-list">
        {#each coach.certifications as cert}
          <li>{cert}</li>
        {/each}
      </ul>
    </div>
  </div>
</div>

<style>
  .coach-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .coach-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 2px solid var(--color-accent);
  }

  .coach-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  .coach-info h3 {
    color: var(--color-primary);
    margin-bottom: var(--spacing-xs);
    font-size: 1.5rem;
  }

  .coach-title {
    color: var(--color-accent-dark);
    font-weight: 600;
    margin-bottom: 0;
  }

  .coach-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .coach-section h4 {
    color: var(--color-primary);
    font-size: 1rem;
    margin-bottom: var(--spacing-xs);
  }

  .coach-section p {
    color: var(--color-text-light);
    line-height: 1.6;
  }

  .specialties-list,
  .certifications-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .specialties-list li,
  .certifications-list li {
    padding: var(--spacing-xs);
    padding-left: var(--spacing-md);
    position: relative;
    color: var(--color-text-light);
  }

  .specialties-list li::before {
    content: '▸';
    position: absolute;
    left: 0;
    color: var(--color-primary);
    font-weight: bold;
  }

  .certifications-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--color-accent);
    font-weight: bold;
  }
</style>
