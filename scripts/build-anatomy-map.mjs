#!/usr/bin/env node
// Builds the Movement anatomy mapping: wger muscle names -> BodyParts3D mesh ids.
// The mapping is authored here (not imported from anywhere), reviewed as product content,
// and emitted together with the actual mesh availability from Human Atlas, so the page can
// state a real gap instead of drawing an invented muscle.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const atlas = JSON.parse(fs.readFileSync(path.join(repo, 'portal/anatomy/models/atlas.json'), 'utf8'));
const byId = new Map(atlas.parts.map(p => [p.id, p]));

// wger muscle name -> { terms: BodyParts3D FMA concept terms, zh, roles }
// Role here is the *teaching* role of the muscle in general movement, not a per-rep
// activation measurement. Per-exercise role comes from the wger record (primary/secondary).
// BodyParts3D splits several muscles into named heads/parts and marks side in the name
// ("Right gluteus maximus"), with mirror copies carrying an "M" id suffix. A term may be
// either the muscle name itself or a head/part name; both are matched as a *suffix* after
// the optional side/part words. Explicit different muscles (e.g. "pectoralis minor") are
// excluded rather than tolerated.
const EXCLUDE = /(minor|coracobrachialis|quadratus femoris|hallucis|pollicis|oculi|naris|laryngis|part of (left|right) temporalis)/i;

const MAP = {
  'Pectoralis major': { zh: '胸大肌', terms: ['pectoralis major'] },
  'Anterior deltoid': { zh: '三角肌前束', terms: ['clavicular part of right deltoid', 'clavicular part of left deltoid'] },
  'Posterior deltoid': { zh: '三角肌后束', terms: ['spinal part of right deltoid', 'spinal part of left deltoid'] },
  'Deltoid': { zh: '三角肌', terms: ['deltoid'] },
  'Biceps brachii': { zh: '肱二头肌', terms: ['biceps brachii'] },
  'Brachialis': { zh: '肱肌', terms: ['brachialis'] },
  'Brachioradialis': { zh: '肱桡肌', terms: ['brachioradialis'] },
  'Triceps brachii': { zh: '肱三头肌', terms: ['triceps brachii'] },
  'Latissimus dorsi': { zh: '背阔肌', terms: ['latissimus dorsi'] },
  'Trapezius': { zh: '斜方肌', terms: ['trapezius'] },
  'Rhomboid major': { zh: '菱形肌', terms: ['rhomboid major'] },
  'Serratus anterior': { zh: '前锯肌', terms: ['serratus anterior'] },
  'Rectus abdominis': { zh: '腹直肌', terms: ['rectus abdominis'] },
  'Obliquus externus abdominis': { zh: '腹外斜肌', terms: ['external oblique'] },
  'Erector spinae': { zh: '竖脊肌', terms: ['iliocostalis', 'longissimus', 'spinalis'] },
  'Gluteus maximus': { zh: '臀大肌', terms: ['gluteus maximus'] },
  'Gluteus medius': { zh: '臀中肌', terms: ['gluteus medius'] },
  'Gluteus minimus': { zh: '臀小肌', terms: ['gluteus minimus'] },
  'Quadriceps femoris': { zh: '股四头肌', terms: ['rectus femoris', 'vastus lateralis', 'vastus medialis', 'vastus intermedius'] },
  'Biceps femoris': { zh: '股二头肌', terms: ['biceps femoris'] },
  'Semitendinosus': { zh: '半腱肌', terms: ['semitendinosus'] },
  'Semimembranosus': { zh: '半膜肌', terms: ['semimembranosus'] },
  'Gastrocnemius': { zh: '腓肠肌', terms: ['gastrocnemius'] },
  'Soleus': { zh: '比目鱼肌', terms: ['soleus'] },
  'Tibialis anterior': { zh: '胫骨前肌', terms: ['tibialis anterior'] },
  'Iliopsoas': { zh: '髂腰肌', terms: ['iliacus', 'psoas major', 'psoas minor'] },
  'Adductor magnus': { zh: '大收肌', terms: ['adductor magnus'] },
};

function matches(name, term) {
  if (EXCLUDE.test(name)) return false;
  const n = name.toLowerCase();
  const t = term.toLowerCase();
  return n === t || n.endsWith(' ' + t);
}

// Muscles live under the "muscular" system in this atlas, except the tibialis anterior pair,
// which is tagged "skeletal" although it is a muscle mesh. A few anatomical muscles are
// simply absent from this model; they stay listed as gaps rather than being approximated.
const MUSCULAR_OVERRIDES = new Map([['FJ1439', 'muscular'], ['FJ1439M', 'muscular']]);
const muscular = atlas.parts.filter(p => (MUSCULAR_OVERRIDES.get(p.id) || p.system) === 'muscular');

const out = {
  schema: 'zero-one.movement.anatomy-map.v1',
  builtAt: new Date().toISOString(),
  source: {
    model: 'BodyParts3D 4.0 via ashemag/human-atlas',
    license: 'CC BY 4.0 (BodyParts3D, Database Center for Life Science)',
    note: 'This file maps exercise muscle names to anatomical mesh ids. It is authored by this project; it is not an upstream muscle-activation dataset.',
  },
  roleSemantics: 'ROLE_FROM_EXERCISE_RECORD_NOT_EMG',
  muscles: {},
  gaps: [],
};

for (const [name, def] of Object.entries(MAP)) {
  const ids = [];
  const found = [];
  for (const term of def.terms) {
    for (const part of muscular) {
      if (matches(part.name, term)) {
        ids.push({ id: part.id, name: part.name });
        found.push(term);
      }
    }
  }
  const unique = [...new Map(ids.map(x => [x.id, x])).values()];
  out.muscles[name] = {
    zh: def.zh,
    terms: found.length ? found : def.terms,
    parts: unique,
    status: unique.length ? 'MESH_AVAILABLE' : 'NO_MESH_IN_MODEL',
  };
  if (!unique.length) out.gaps.push({ muscle: name, zh: def.zh, searchedTerms: def.terms });
}

const dir = path.join(repo, 'portal/data/movement');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'anatomy-map.json'), JSON.stringify(out, null, 1) + '\n');

let ok = 0;
for (const [k, v] of Object.entries(out.muscles)) {
  if (v.parts.length) ok++;
  console.log(`${v.parts.length ? 'OK ' : 'GAP'} ${k} (${v.zh}) -> ${v.parts.map(p => p.id).join(', ') || '—'}`);
}
console.log(`mapped ${ok}/${Object.keys(out.muscles).length} muscle names; ${out.gaps.length} explicit gaps`);
