/**
 * Local-first archive: profiles, consent, capacity records.
 *
 * Nothing leaves the browser. The only outbound path is an export file the person chooses to
 * save themselves, and that export carries the consent text it was created under so a restored
 * copy still says what it was for.
 */
const KEY = 'zero-one.movement.v1';

export const CONSENT_VERSION = 1;
export const CONSENT_TEXT = [
  '训练记录保存在这台设备的浏览器里，不会自动上传。',
  '导出文件包含你的训练次数、时长、动作与自评，请自行保管。',
  '照片分析在本地计算，产品默认不保存照片；如选择保存，也只存在本机。',
  '这些记录用于你自己的练习反馈，不做医疗诊断。',
].join('\n');

function emptyState() {
  return {
    version: 1,
    profiles: [],
    activeProfileId: null,
    consent: null,
    records: [],
    settings: { units: 'metric', voice: true },
  };
}

let storage = null;
/** Inject a storage backend (localStorage in the browser, a memory shim in tests). */
export function useStorage(backend) {
  storage = backend;
}

function read() {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

function write(state) {
  if (storage) storage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function state() {
  return read();
}

export function consentGiven() {
  const s = read();
  return Boolean(s.consent && s.consent.version === CONSENT_VERSION && s.consent.acceptedAt);
}

export function giveConsent(now = new Date()) {
  const s = read();
  s.consent = { version: CONSENT_VERSION, acceptedAt: now.toISOString(), text: CONSENT_TEXT };
  return write(s);
}

export function revokeConsent() {
  const s = read();
  s.consent = null;
  return write(s);
}

export function createProfile({ name, ageGroup = 'adult', heightCm = null, bodyweightKg = null, goals = [], environment = 'home', equipment = ['none'] }, now = new Date()) {
  if (!consentGiven()) throw new Error('需要先确认数据使用说明');
  const s = read();
  const profile = {
    id: `p${Date.now().toString(36)}${(s.profiles.length + 1).toString(36)}`,
    name: name?.trim() || '我',
    ageGroup,
    heightCm,
    bodyweightKg,
    goals,
    environment,
    equipment,
    createdAt: now.toISOString(),
  };
  s.profiles.push(profile);
  s.activeProfileId = profile.id;
  return write(s).profiles.at(-1);
}

export function activeProfile() {
  const s = read();
  return s.profiles.find((p) => p.id === s.activeProfileId) || null;
}

export function setActiveProfile(id) {
  const s = read();
  if (s.profiles.some((p) => p.id === id)) s.activeProfileId = id;
  return write(s);
}

export function updateProfile(patch) {
  const s = read();
  const profile = s.profiles.find((p) => p.id === s.activeProfileId);
  if (!profile) return null;
  Object.assign(profile, patch);
  write(s);
  return profile;
}

/**
 * Append a finished session. The record keeps what the person did (reps, holds, duration,
 * reps pace) and the derived points, never the raw pose stream.
 */
export function addRecord({ trackId = null, sessionId = null, exerciseIds = [], reps = 0, holdSeconds = 0, sets = 0, points = 0, durationSeconds = 0, readiness = null, note = '' }, now = new Date()) {
  if (!consentGiven()) throw new Error('需要先确认数据使用说明');
  const profile = activeProfile();
  if (!profile) throw new Error('先建立个人档案');
  const s = read();
  const record = {
    id: `r${now.getTime().toString(36)}`,
    profileId: profile.id,
    at: now.toISOString(),
    trackId,
    sessionId,
    exerciseIds,
    reps,
    holdSeconds,
    sets,
    points,
    durationSeconds,
    readiness,
    note,
  };
  s.records.push(record);
  write(s);
  return record;
}

export function records(profileId = activeProfile()?.id) {
  return read().records.filter((r) => !profileId || r.profileId === profileId);
}

/** Consecutive-day streak over sessions, using the local date of each record. */
export function streak(list) {
  const days = [...new Set(list.map((r) => r.at.slice(0, 10)))].sort();
  if (!days.length) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`);
    const cur = new Date(`${days[i]}T00:00:00Z`);
    const gap = Math.round((cur - prev) / 86400000);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = new Date().toISOString().slice(0, 10);
  const last = days.at(-1);
  const stillLive = Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${last}T00:00:00Z`)) / 86400000) <= 1;
  return stillLive ? run : 0;
}

/** Capacity trend per exercise: best reps and hold over the last 8 weeks. */
export function capacityTrend(list) {
  const byExercise = new Map();
  for (const r of list) {
    for (const id of r.exerciseIds || []) {
      const entry = byExercise.get(id) || { reps: 0, holdSeconds: 0, sessions: 0, lastAt: null };
      entry.reps = Math.max(entry.reps, r.reps);
      entry.holdSeconds = Math.max(entry.holdSeconds, r.holdSeconds);
      entry.sessions += 1;
      entry.lastAt = r.at;
      byExercise.set(id, entry);
    }
  }
  return byExercise;
}

export function exportData(now = new Date()) {
  const s = read();
  return JSON.stringify({
    schema: 'zero-one.movement.archive.v1',
    exportedAt: now.toISOString(),
    consent: s.consent,
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    records: s.records,
  }, null, 2);
}

/**
 * Import a previously exported archive. Defaults to merge (records are keyed by id, so a
 * re-import does not duplicate), and refuses files that carry no consent record.
 */
export function importData(text, { mode = 'merge' } = {}) {
  const incoming = JSON.parse(text);
  if (incoming.schema !== 'zero-one.movement.archive.v1') throw new Error('不是动起来的档案文件');
  const s = mode === 'replace' ? emptyState() : read();
  const ids = new Set(s.records.map((r) => r.id));
  for (const r of incoming.records || []) if (!ids.has(r.id)) s.records.push(r);
  const profileIds = new Set(s.profiles.map((p) => p.id));
  for (const p of incoming.profiles || []) if (!profileIds.has(p.id)) s.profiles.push(p);
  if (mode !== 'replace' && incoming.consent && !consentGiven()) s.consent = incoming.consent;
  if (!s.activeProfileId) s.activeProfileId = incoming.activeProfileId || s.profiles[0]?.id || null;
  write(s);
  return { profiles: s.profiles.length, records: s.records.length };
}

export function clearAll() {
  if (storage) storage.removeItem(KEY);
  return emptyState();
}

/** Browser wiring: localStorage, guarded so private-mode failures degrade to session-only. */
export function browserStorage() {
  try {
    const probe = '__movement_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    };
  }
}
