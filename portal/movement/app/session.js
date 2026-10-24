/**
 * Session engine: turn an exercise IR + a person + available equipment into a timed session,
 * count reps from body motion, and derive honest load numbers.
 *
 * Everything here is pure so it runs in tests and in the browser identically.
 */

/** Expand one exercise into concrete work blocks for a level and a time budget. */
export function buildBlocks(exercise, { level = 'steady', minutes = 12, seed = 1 } = {}) {
  const scale = exercise.scaleLevels?.[level] || {};
  const sets = Math.max(1, scale.sets ?? exercise.sets ?? 3);
  const work = scale.reps ?? exercise.reps ?? 8;
  const hold = scale.holdSeconds ?? exercise.seconds ?? null;
  const rest = scale.restSeconds ?? exercise.restSeconds ?? 60;
  const blocks = [];
  for (let i = 0; i < sets; i += 1) {
    blocks.push({
      kind: hold ? 'hold' : 'reps',
      target: hold ?? work,
      label: hold ? `第 ${i + 1} 组 · 保持 ${hold}s` : `第 ${i + 1} 组 · ${work} 次`,
      setIndex: i,
    });
    if (i < sets - 1) blocks.push({ kind: 'rest', target: rest, label: `休息 ${rest}s` });
  }
  const total = blocks.reduce((sum, b) => sum + estimateSeconds(b, exercise), 0);
  return { blocks, totalSeconds: total, budgetSeconds: minutes * 60, seed };
}

export function estimateSeconds(block, exercise) {
  if (block.kind === 'rest' || block.kind === 'hold') return block.target;
  const tempo = exercise.phaseDurations || [1.5, 1.5];
  return Math.round(block.target * (tempo[0] + tempo[1]));
}

/**
 * Rep counter driven by the phase signal (0 = start position, 1 = bottom / top of the range).
 * A rep counts only when the person reaches the bottom threshold and comes back up past the
 * start threshold, which is what makes partial shuffling not count.
 */
export function createRepCounter({ bottom = 0.85, top = 0.25, minIntervalMs = 250 } = {}) {
  let phaseValue = 0;
  let armed = false;
  let reps = 0;
  let lastAt = -Infinity;
  return {
    get reps() {
      return reps;
    },
    get armed() {
      return armed;
    },
    /** Feed a normalized 0..1 depth signal; returns true when a full rep just completed. */
    feed(value, now = Date.now()) {
      phaseValue = value;
      if (!armed && value >= bottom) armed = true;
      else if (armed && value <= top && now - lastAt >= minIntervalMs) {
        armed = false;
        reps += 1;
        lastAt = now;
        return true;
      }
      return false;
    },
    get depth() {
      return phaseValue;
    },
    reset() {
      phaseValue = 0;
      armed = false;
      reps = 0;
      lastAt = -Infinity;
    },
  };
}

/**
 * Rep tempo from two consecutive body poses, so the follow-along cue can say "再快一点" or
 * "慢下来" without reading a clock the person cannot see.
 */
export function tempoAdvice(repDurationsMs) {
  const recent = repDurationsMs.slice(-4);
  if (recent.length < 2) return null;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (avg < 1200) return { key: 'slow-down', text: '节奏偏快，下放时再慢一点，让动作有控制。' };
  if (avg > 5000) return { key: 'keep-moving', text: '节奏偏慢，保持呼吸连续，不要停在下放位置。' };
  return { key: 'steady', text: '节奏稳定，保持。' };
}

/**
 * Load points. One point is one rep of a bodyweight push-up at the person's own bodyweight;
 * everything else is scaled by the movement's effective bodyweight share and range of motion.
 * These are comparison aids inside this product only - not calories, not "burned".
 */
export function loadPoints(exercise, { reps = 0, holdSeconds = 0, bodyweightKg = 70, scale = 1 } = {}) {
  const share = exercise.capacityLoads?.bodyweightShare ?? 0.6;
  const rom = exercise.capacityLoads?.rangeOfMotion ?? 1;
  const perRep = bodyweightKg * share * rom * scale * 0.02;
  const perHoldSecond = bodyweightKg * share * rom * scale * 0.008;
  return Math.round(reps * perRep + holdSeconds * perHoldSecond);
}

/** Volume for the archive: total work reps across a session, separated from holds. */
export function summarizeSession(entries) {
  return entries.reduce((acc, e) => {
    acc.reps += e.reps || 0;
    acc.holdSeconds += e.holdSeconds || 0;
    acc.points += e.points || 0;
    acc.sets += e.sets || 0;
    return acc;
  }, { reps: 0, holdSeconds: 0, points: 0, sets: 0 });
}

/**
 * Pick the next session from a track definition. Progression is deliberately boring and
 * conservative: hold the same step until the person completes the top of the range twice.
 */
export function nextSession(track, history) {
  const week = Math.max(1, track.startWeek ?? 1);
  const done = history.filter((h) => h.trackId === track.id);
  const lastTwo = done.slice(-2);
  const promoted = lastTwo.length === 2 && lastTwo.every((h) => h.completed && h.reps >= (h.target ?? 0));
  const step = Math.min(track.steps?.length ? track.steps.length - 1 : 0, (track.step ?? 0) + (promoted ? 1 : 0));
  const sessions = track.sessionsByStep?.[step] || track.sessions || [];
  const index = done.length % Math.max(1, sessions.length);
  return { week, step, session: sessions[index] || null, promoted };
}

/** Readiness gate: three honest questions, no scoring theatre. */
export function readinessCheck({ sleep, soreness, pain }) {
  const flags = [];
  if (pain === 'sharp') flags.push({ level: 'stop', text: '有尖锐疼痛：今天不做这个动作，必要时就医。本工具不做诊断。' });
  if (pain === 'mild') flags.push({ level: 'caution', text: '有轻微不适：缩小幅度、减少组数，动作中一旦加重就停。' });
  if (soreness >= 4) flags.push({ level: 'caution', text: '酸痛明显：今天以活动度和小幅度为主，不追次数。' });
  if (sleep <= 2) flags.push({ level: 'caution', text: '睡眠不足：把今天当恢复日，目标改成"完成最低量"即可。' });
  const level = flags.some((f) => f.level === 'stop') ? 'stop' : flags.length ? 'caution' : 'ready';
  return { level, flags };
}
