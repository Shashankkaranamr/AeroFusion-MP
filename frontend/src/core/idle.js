/**
 * Heavy one-off work (building a 3D world, compiling its shaders) runs AHEAD of time, in order,
 * one job at a time — only when the browser is idle and the reader is not scrolling. A job that
 * the reader has caught up with runs at once (job.now()), so nothing is ever late, only early.
 *
 *   const job = idle.add(async () => { ... });
 *   whenNear(() => job.now());
 */
const QUIET = 400; // ms without a scroll before background work may start

let lastScroll = 0;
window.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
window.addEventListener('wheel', () => { lastScroll = performance.now(); }, { passive: true });
window.addEventListener('touchmove', () => { lastScroll = performance.now(); }, { passive: true });

const queue = [];
let running = false;
let started = false;
const ric = window.requestIdleCallback ?? ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 120));

function pump() {
  if (running || !started) return;
  const job = queue.find((j) => !j.done && !j.running);
  if (!job) return;
  ric(() => {
    if (running) return;
    if (performance.now() - lastScroll < QUIET) {
      setTimeout(pump, QUIET);
      return;
    }
    job.now().finally(pump);
  }, { timeout: 4000 });
}

export const idle = {
  add(fn) {
    const job = {
      done: false,
      running: false,
      promise: null,
      now() {
        if (!job.promise) {
          job.running = true;
          running = true;
          job.promise = Promise.resolve()
            .then(fn)
            .catch((e) => console.error(e))
            .finally(() => {
              job.done = true;
              job.running = false;
              running = false;
            });
        }
        return job.promise;
      },
    };
    queue.push(job);
    pump();
    return job;
  },
  /** Begin background work (after the opening has settled). */
  start() {
    started = true;
    pump();
  },
};
