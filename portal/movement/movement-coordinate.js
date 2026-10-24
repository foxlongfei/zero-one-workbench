// ZERO-CORE Movement — common human coordinate engine (browser + Node shared, no DOM, no fs).
// Real body-language input -> canonical anatomical target -> BP representation references.
// Asset mesh/obj ids are NEVER fabricated: they stay null until a real crosswalk is supplied.
export const COORD = {
  task_id: 'COMMON-HUMAN-COORDINATE',
  version: 'v0.3',
  canonical_targets: [
    { id: 'MUSCLE_BICEPS_BRACHII', kind: 'COMPOSITE_MUSCLE', asset_completeness: 'COMPLETE', right_assets: ['BP5558', 'BP5566'] },
    { id: 'JOINT_ELBOW', kind: 'ARTICULATION', asset_completeness: 'COMPLETE', right_assets: ['BP9206', 'BP8464', 'BP8233'] },
    { id: 'REGION_FOREARM', kind: 'ANATOMICAL_REGION', asset_completeness: 'PARTIAL_BONY_SUBSET', right_assets: ['BP8464', 'BP8233'] },
    { id: 'REGION_UPPER_ARM', kind: 'ANATOMICAL_REGION', asset_completeness: 'PARTIAL_BONY_SUBSET', right_assets: ['BP9206', 'BP5558', 'BP5566'] }
  ],
  side_markers: { '左': 'LEFT', '右': 'RIGHT' },
  goal_markers: { '练': 'STRENGTH', '拉伸': 'MOBILITY', '放松': 'RECOVERY', '活动': 'MOBILITY' },
  symptom_markers: ['疼', '痛', '麻', '酸', '肿', '伤', '僵'],
  ambiguous_terms: {
    '胳膊': ['MUSCLE_BICEPS_BRACHII', 'REGION_UPPER_ARM', 'REGION_FOREARM', 'JOINT_ELBOW'],
    '手臂': ['MUSCLE_BICEPS_BRACHII', 'REGION_UPPER_ARM', 'REGION_FOREARM', 'JOINT_ELBOW'],
    '胳膊肘': ['JOINT_ELBOW', 'REGION_UPPER_ARM', 'REGION_FOREARM']
  },
  recognized_out_of_sample: ['肩', '手腕', '手指', '胸', '背', '腰', '腿', '膝', '踝'],
  aliases: {
    '肱二头肌': 'MUSCLE_BICEPS_BRACHII', '二头肌': 'MUSCLE_BICEPS_BRACHII', '二头': 'MUSCLE_BICEPS_BRACHII', 'biceps': 'MUSCLE_BICEPS_BRACHII',
    '肘': 'JOINT_ELBOW', '肘关节': 'JOINT_ELBOW', '胳膊肘': 'JOINT_ELBOW', 'elbow': 'JOINT_ELBOW',
    '前臂': 'REGION_FOREARM', '小臂': 'REGION_FOREARM', 'forearm': 'REGION_FOREARM',
    '上臂': 'REGION_UPPER_ARM', '大臂': 'REGION_UPPER_ARM', 'upper arm': 'REGION_UPPER_ARM'
  }
};
const targets = Object.fromEntries(COORD.canonical_targets.map(x => [x.id, x]));
const goalKeys = Object.keys(COORD.goal_markers).sort((a, b) => b.length - a.length);
export function resolveMovementInput(raw) {
  let text = String(raw ?? '').normalize('NFKC').replace(/\s+/g, '');
  if (COORD.symptom_markers.some(x => text.includes(x))) return { status: 'SAFETY_OR_SYMPTOM', target: null, side: 'UNSPECIFIED', goal: 'UNSPECIFIED', reason: '症状语言优先于训练映射，请先确认是否就医，本工具不做诊断。' };
  let side = 'UNSPECIFIED';
  for (const mark of Object.keys(COORD.side_markers)) { if (text.startsWith(mark)) { side = COORD.side_markers[mark]; text = text.slice(mark.length); break; } }
  let goal = 'UNSPECIFIED';
  for (const mark of goalKeys) { if (text.endsWith(mark)) { goal = COORD.goal_markers[mark]; text = text.slice(0, -mark.length); break; } }
  if (COORD.ambiguous_terms[text]) return { status: 'ASK_DISAMBIGUATION', target: null, side, goal, choices: COORD.ambiguous_terms[text].map(id => ({ id, kind: targets[id].kind })) };
  if (COORD.recognized_out_of_sample.includes(text)) return { status: 'DEFER_OUT_OF_SAMPLE', target: null, side, goal };
  const target = COORD.aliases[text] ?? null;
  if (!target) return { status: 'NO_MATCH', target: null, side, goal };
  const spec = targets[target];
  const assetStatus = side === 'LEFT' ? 'NOT_MAPPED_LEFT' : side === 'RIGHT' ? spec.asset_completeness : 'SIDE_UNSPECIFIED';
  return { status: side === 'LEFT' ? 'RESOLVED_ASSET_PENDING' : 'RESOLVED', target, side, goal, kind: spec.kind, assets: side === 'RIGHT' ? spec.right_assets : [], asset_status: assetStatus };
}
export function decorateMovementReferences(result, crosswalk) {
  const map = crosswalk instanceof Map ? crosswalk : new Map((crosswalk?.mappings ?? []).map(x => [x.bp_representation_id, x]));
  const crosswalkAvailable = map.size > 0;
  const base = { ...result, asset_refs: [], crosswalk_available: crosswalkAvailable };
  if (result?.status !== 'RESOLVED' || result.side !== 'RIGHT' || !targets[result.target]) return base;
  return { ...base, asset_refs: targets[result.target].right_assets.map(bp => { const x = map.get(bp); return { bp_representation_id: bp, mesh_element_id: x?.mesh_element_id ?? null, obj_path: x?.obj_path ?? null }; }) };
}
export function targetLabel(id) { return targets[id]?.label ?? id; }
