import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import ToastPublic from './ToastPublic.svelte';
import { createToasts } from '$lib/stores/toasts';

// jsdom has no Web Animations API; Svelte 5 css transitions (the fly/fade on
// each toast) call Element.prototype.animate at mount. Stub it so the component
// renders — we only assert DOM structure, not animation playback.
if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      currentTime: 0,
      startTime: 0,
      playState: 'running',
      pending: false,
      onfinish: null,
      oncancel: null,
      finished: Promise.resolve(),
      effect: null,
      addEventListener() {},
      removeEventListener() {}
    }) as unknown as Animation;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastPublic dedup → progress bar restart', () => {
  it('remounts the progress bar when an identical toast is re-fired (dedup bump)', async () => {
    vi.useFakeTimers();
    const toasts = createToasts();
    const { container } = render(ToastPublic, { props: { toasts } });

    toasts.notify('info', '已加入購物車');
    await tick();
    const firstBar = container.querySelector('.toast-progress');
    expect(firstBar).not.toBeNull();

    // Same (tone,title,body) within the window → dedup hit, bump increments.
    toasts.notify('info', '已加入購物車');
    await tick();
    const secondBar = container.querySelector('.toast-progress');

    // Still a single toast (dedup preserved)…
    expect(container.querySelectorAll('.toast')).toHaveLength(1);
    // …but the progress bar is a brand-new node, so its one-shot CSS animation
    // restarts in lock-step with the refreshed timer (the P3 fix).
    expect(secondBar).not.toBe(firstBar);

    vi.runAllTimers();
  });
});
