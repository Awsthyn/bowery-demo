import { useSyncExternalStore } from 'react';

/** Fine enough that a 1 s countdown never skips a number; cheap because it only runs while subscribed. */
export const TICK_MS = 250;

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Refresh on (re)subscribe: React re-reads the snapshot right after subscribing, so a component that
  // was inactive for a while renders the current time immediately instead of a stale one.
  now = Date.now();
  timer ??= setInterval(tick, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const subscribeNever = () => () => undefined;
const getSnapshot = () => now;

/** Whole seconds left until `deadline`, never negative. */
export const secondsUntil = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000));

/** Current time in ms, re-rendering every TICK_MS while `active`. */
export function useNow(active: boolean): number {
  return useSyncExternalStore(active ? subscribe : subscribeNever, getSnapshot);
}
