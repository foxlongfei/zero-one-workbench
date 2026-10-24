/**
 * Follow-along runner: drives a session from the clock, decides which phase of which exercise
 * is shown, and turns the person's self-reported "I did one" or the camera rep signal into
 * recorded reps.
 *
 * The runner is intentionally dumb about rendering: it emits events, the page draws them.
 */
import { buildBlocks } from './session.js';

export function createRunner({ exercises, exerciseIds, level = 'steady', onTick, onEvent } = {}) {
  const sequence = exerciseIds.map((id) => {
    const exercise = exercises.find((e) => e.id === id);
    if (!exercise) throw new Error(`未知动作 ${id}`);
    const plan = buildBlocks(exercise, { level });
    return { exercise, plan, blocks: plan.blocks };
  });

  let cursor = { exercise: 0, block: 0 };
  let remaining = 0;
  let running = false;
  let reps = 0;
  let timer = null;
  const done = [];

  const current = () => sequence[cursor.exercise];
  const block = () => current()?.blocks[cursor.block] || null;

  function emit(type, payload = {}) {
    onEvent?.({ type, ...payload });
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        onTick?.(snapshot());
        return;
      }
      advance();
    }, 1000);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function advance() {
    const seq = current();
    const finished = block();
    if (!seq || !finished) return finish();
    if (finished.kind === 'reps') done.push({ exerciseId: seq.exercise.id, reps: finished.logged ?? 0, holdSeconds: 0, sets: 1 });
    if (finished.kind === 'hold') done.push({ exerciseId: seq.exercise.id, reps: 0, holdSeconds: finished.target, sets: 1 });
    cursor.block += 1;
    if (cursor.block >= seq.blocks.length) {
      cursor.exercise += 1;
      cursor.block = 0;
    }
    emit('block-change', snapshot());
    load();
  }

  function load() {
    const seq = current();
    if (!seq) return finish();
    const b = block();
    if (!b) return finish();
    // A work block in reps has no clock: it ends when the target reps are done or the person
    // moves on. Everything else (rest, hold) counts down.
    remaining = b.kind === 'reps' ? 0 : b.target;
    reps = 0;
    emit('block-start', snapshot());
    if (running && remaining > 0) startTimer();
  }

  function snapshot() {
    const seq = current();
    const b = block();
    if (!seq || !b) return { finished: true, done };
    return {
      exercise: seq.exercise,
      block: b,
      remaining,
      reps,
      running,
      total: sequence.length,
      index: cursor.exercise,
      progress: sequenceProgress(),
    };
  }

  function sequenceProgress() {
    const seq = current();
    if (!seq) return 1;
    const before = sequence.slice(0, cursor.exercise).reduce((n, s) => n + s.blocks.length, 0);
    const here = before + cursor.block;
    const all = sequence.reduce((n, s) => n + s.blocks.length, 0);
    return all ? here / all : 0;
  }

  function finish() {
    running = false;
    stopTimer();
    emit('finished', { done });
    onTick?.({ finished: true, done });
  }

  return {
    start() {
      running = true;
      emit('start', snapshot());
      load();
    },
    pause() {
      running = false;
      stopTimer();
      onTick?.(snapshot());
    },
    resume() {
      running = true;
      if (remaining > 0) startTimer();
      onTick?.(snapshot());
    },
    skip() {
      advance();
    },
    /** Camera or tap signal: one completed rep on the current work block. */
    rep() {
      const b = block();
      if (!b || b.kind === 'rest') return;
      reps += 1;
      emit('rep', { reps, target: b.target });
      onTick?.(snapshot());
      if (b.kind === 'reps' && reps >= b.target) advance();
    },
    snapshot,
    stop() {
      running = false;
      stopTimer();
    },
  };
}

/**
 * Turn a live pose (33 landmarks normalized) into the depth signal the rep counter uses.
 * Depth is measured on the joint that actually travels: elbow for pushes, hip height for
 * squats. Returns null when the needed landmarks are missing rather than guessing.
 */
export function depthFromLandmarks(exercise, landmarks) {
  const pick = (i) => landmarks[i];
  const metric = exercise.capacityLoads?.depthMetric || 'elbow';
  if (metric === 'hipHeight') {
    const hip = [pick(23), pick(24)].filter((p) => p && p.visibility > 0.5);
    if (hip.length < 2) return null;
    const y = (hip[0].y + hip[1].y) / 2;
    return { value: y, kind: 'normalized-height' };
  }
  const shoulder = pick(11), elbow = pick(13), wrist = pick(15);
  if (!shoulder || !elbow || !wrist) return null;
  if ([shoulder, elbow, wrist].some((p) => p.visibility < 0.5)) return null;
  const angle = (a, b, c) => {
    const u = [a.x - b.x, a.y - b.y], w = [c.x - b.x, c.y - b.y];
    const dot = u[0] * w[0] + u[1] * w[1];
    const lu = Math.hypot(...u), lw = Math.hypot(...w) || 1;
    return Math.acos(Math.max(-1, Math.min(1, dot / (lu * lw)))) * 180 / Math.PI;
  };
  return { value: angle(shoulder, elbow, wrist), kind: 'elbow-degrees' };
}
