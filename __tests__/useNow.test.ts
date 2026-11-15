import { act, renderHook } from '@testing-library/react-native';

import { TICK_MS, secondsUntil, useNow } from '@/lib/useNow';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('retry countdown clock', () => {
  // protects=the "Retrying in Ns" banner shows the real remaining time as soon as it appears;
  // fails_when=the clock keeps a stale value from before it was paused (the bug: countdown showed too many seconds after each attempt);
  // no_claim=the status screen's rendering and outbox transitions themselves
  it('reports the current time immediately after becoming active again', async () => {
    const hook = await renderHook(({ active }: { active: boolean }) => useNow(active), {
      initialProps: { active: true },
    });
    // rerender() already wraps act() in RNTL v14; nesting it inside another act() deadlocks with fake timers.
    await hook.rerender({ active: false }); // e.g. the item went in_flight under the old logic
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await hook.rerender({ active: true });

    expect(Math.abs(hook.result.current - Date.now())).toBeLessThan(TICK_MS);
  });

  // protects=while active the clock advances at least every TICK_MS; fails_when=ticks stop or are too coarse to show every second; no_claim=wall-clock accuracy on device
  it('ticks while active', async () => {
    const hook = await renderHook(() => useNow(true));
    const start = hook.result.current;
    await act(async () => {
      jest.advanceTimersByTime(TICK_MS * 4);
    });
    expect(hook.result.current - start).toBeGreaterThanOrEqual(TICK_MS * 4);
  });

  // protects=countdown rounds up and never shows negatives; fails_when="0s" shows while time remains or "-1s" appears; no_claim=display copy
  it('rounds remaining seconds up and clamps at zero', () => {
    expect(secondsUntil(10_000, 8_001)).toBe(2);
    expect(secondsUntil(10_000, 9_999)).toBe(1);
    expect(secondsUntil(10_000, 10_000)).toBe(0);
    expect(secondsUntil(10_000, 12_000)).toBe(0);
  });
});
