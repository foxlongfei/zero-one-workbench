/**
 * Movement library data access: exercise IR, joint/body registry, syllabus.
 *
 * The IR (zero-one.movement.exercise.v1) is the single source of truth shared by the
 * 3D teaching figure, the camera guide, the session engine and the archive. A pose phase
 * stores world-space targets for each end effector plus trunk orientation; the figure
 * solver turns those into joint rotations, so one phase definition drives every view.
 */
const DATA = new URL('../../data/', import.meta.url);

async function readJson(name) {
  const response = await fetch(new URL(name, DATA));
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
  return response.json();
}

let cache;
export function loadLibrary() {
  cache ??= Promise.all([
    readJson('movement-exercises-v1.json'),
    readJson('movement-joints-v1.json'),
    readJson('movement-syllabus-v1.json'),
    readJson('movement-rig-v1.json'),
  ]).then(([exercises, joints, syllabus, rig]) => {
    const byId = new Map(exercises.exercises.map((e) => [e.id, e]));
    return { bundle: exercises, exercises: exercises.exercises, byId, joints, syllabus, rig };
  });
  return cache;
}

export async function exerciseById(id) {
  const { byId } = await loadLibrary();
  return byId.get(id) || null;
}

/** One-line summary used by lists and the home plan. */
export function describe(exercise) {
  return `${exercise.level} · ${exercise.environment.join(' / ')} · ${exercise.sets[0].reps ?? exercise.sets[0].holdSeconds + 's'}`;
}

/** Load a body pack (mesh geometry) once; it is ~10 MB of base64, so keep a module cache. */
let bodyPack;
export function loadBodyPack() {
  bodyPack ??= fetch(new URL('movement-body-pack-v1.json', DATA)).then(async (r) => {
    if (!r.ok) throw new Error(`body pack HTTP ${r.status}`);
    const pack = await r.json();
    for (const part of pack.parts) {
      part.positionBuffer = decode(part.positions, Float32Array);
      part.normalBuffer = decode(part.normals, Float32Array);
      part.indexBuffer = decode(part.indices, Uint32Array);
      part.weightBuffer = part.weights ? Float32Array.from(part.weights) : null;
      delete part.positions;
      delete part.normals;
      delete part.indices;
      delete part.weights;
    }
    return pack;
  });
  return bodyPack;
}

function decode(base64, Type) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Type(bytes.buffer);
}

/** Series (family) views: what else belongs to the same movement pattern. */
export function family(bundle, familyId) {
  return bundle.exercises.filter((e) => e.family === familyId);
}
