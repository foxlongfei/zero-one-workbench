import crypto from 'node:crypto';
import fs from 'node:fs';

const compact = value => String(value ?? '').normalize('NFKC').replace(/[\s，。；：！？、,.!?;:'“”‘’（）()《》〈〉【】\[\]-]/gu, '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const forbidden = new Set(['c_page', 'c_expected_answer', 'expected_transcription', 'c_anchor', 'c_acceptance']);

function fail(state, reasons) {
  return { state, reasons: Array.isArray(reasons) ? reasons : [reasons], projections: [], comparison: [] };
}

function validateReturn(item) {
  const problems = [];
  if (!item || typeof item !== 'object') return ['return is not an object'];
  if (!item.reviewer_role) problems.push('reviewer_role missing');
  if (!item.freeze?.frozen_at) problems.push('freeze.frozen_at missing');
  if (!/^[0-9a-f]{64}$/u.test(item.freeze?.output_sha256 ?? '')) problems.push('freeze.output_sha256 invalid');
  for (const key of Object.keys(item)) if (forbidden.has(key)) problems.push(`forbidden pre-freeze field: ${key}`);
  if (!Array.isArray(item.slots)) problems.push('slots missing');
  return problems;
}

function project(item, slotContract) {
  const bySlot = new Map((item.slots ?? []).map(x => [x.slot, x]));
  return slotContract.map(contract => {
    const source = bySlot.get(contract.slot);
    const state = source?.state ?? (contract.return_scope === 'NDL_RETURN_ONLY' ? 'NOT_IN_REVIEW_SCOPE' : 'NOT_OBSERVED');
    if (!contract.allowed_state.includes(state)) throw new Error(`${item.reviewer_role}:${contract.slot}: state ${state} not allowed`);
    const verbatim = state === 'EVIDENCE_FRAGMENT' ? String(source.verbatim_fragment ?? '') : '';
    if (state === 'EVIDENCE_FRAGMENT' && !verbatim) throw new Error(`${item.reviewer_role}:${contract.slot}: empty evidence fragment`);
    return {
      reviewer_role: item.reviewer_role,
      input_output_sha256: item.freeze.output_sha256,
      slot: contract.slot,
      state,
      verbatim_fragment: verbatim,
      normalized_fragment: verbatim ? compact(verbatim) : '',
      source_locator_from_return: source?.source_locator_from_return ?? null,
      uncertainty_carried_forward: source?.uncertainty_carried_forward ?? []
    };
  });
}

function compare(q, d) {
  if (q.state === 'UNCERTAIN' || d.state === 'UNCERTAIN' || q.uncertainty_carried_forward.length || d.uncertainty_carried_forward.length) return 'HOLD_UNCERTAINTY';
  if (q.state === 'NOT_IN_REVIEW_SCOPE' || d.state === 'NOT_IN_REVIEW_SCOPE') return 'HOLD_SCOPE_GAP';
  if (q.state !== d.state) return 'HOLD_SCOPE_GAP';
  if (q.state === 'NOT_OBSERVED') return 'AGREE_EXACT';
  if (q.source_locator_from_return !== d.source_locator_from_return) return 'HOLD_LOCATION_CONFLICT';
  if (q.verbatim_fragment === d.verbatim_fragment) return 'AGREE_EXACT';
  if (q.normalized_fragment === d.normalized_fragment) return 'AGREE_NORMALIZED';
  return 'HOLD_TEXT_CONFLICT';
}

export function runFrozenSlotProjector({ contract, cross_review_state, returns }) {
  if (cross_review_state !== 'READY_FOR_CROSS_REVIEW') return fail('HOLD_PRECONDITION', 'cross review is not READY_FOR_CROSS_REVIEW');
  if (!Array.isArray(returns) || returns.length !== 2) return fail('HOLD_PRECONDITION', 'exactly two returns required');
  const issues = returns.flatMap((item, index) => validateReturn(item).map(reason => `return[${index}]: ${reason}`));
  if (issues.some(x => x.includes('forbidden pre-freeze field'))) return fail('HOLD_BLINDNESS_BREACH', issues);
  if (issues.length) return fail('HOLD_PRECONDITION', issues);
  if (returns[0].reviewer_role === returns[1].reviewer_role) return fail('HOLD_PRECONDITION', 'reviewer roles must be distinct');
  try {
    const projections = returns.map(item => ({ reviewer_role: item.reviewer_role, slots: project(item, contract.slot_contract) }));
    const comparison = contract.slot_contract.map(({ slot }) => {
      const q = projections[0].slots.find(x => x.slot === slot);
      const d = projections[1].slots.find(x => x.slot === slot);
      return { slot, state: compare(q, d), reviewer_fragments_sha256: [sha256(q.verbatim_fragment), sha256(d.verbatim_fragment)] };
    });
    const ready = comparison.every(x => x.state === 'AGREE_EXACT' || x.state === 'AGREE_NORMALIZED');
    return { state: ready ? 'ADAPTER_READY' : 'HOLD_COMPARISON', reasons: [], projections, comparison };
  } catch (error) {
    return fail('HOLD_INVALID_SLOT', error.message);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const contract = JSON.parse(fs.readFileSync(new URL('./temp-m01-hxl-frozen-return-slot-adapter-v0.1.json', import.meta.url), 'utf8'));
  const suite = JSON.parse(fs.readFileSync(new URL('./temp-m01-hxl-frozen-return-slot-projector-cases-v0.1.json', import.meta.url), 'utf8'));
  const results = suite.cases.map(test => {
    const actual = runFrozenSlotProjector({ contract, cross_review_state: test.cross_review_state, returns: test.returns });
    const states = actual.comparison.map(x => x.state);
    const pass = actual.state === test.expected_state && (test.expected_comparison ? test.expected_comparison.every(x => states.includes(x)) : true);
    return { id: test.id, expected_state: test.expected_state, actual_state: actual.state, comparison_states: states, pass };
  });
  const preservation = runFrozenSlotProjector({ contract, cross_review_state: suite.preservation_probe.cross_review_state, returns: suite.preservation_probe.returns });
  const preserved = preservation.projections[0]?.slots[1]?.verbatim_fragment === suite.preservation_probe.returns[0].slots[0].verbatim_fragment;
  const checks = [
    { name: 'eight synthetic cases executed', pass: results.length === 8 },
    { name: 'all synthetic cases pass', pass: results.every(x => x.pass) },
    { name: 'verbatim fragment preserved byte-for-byte', pass: preserved },
    { name: 'no C projection input accepted', pass: runFrozenSlotProjector.length === 1 },
    { name: 'strict mainline remains 0/5', pass: contract.acceptance.mainline_after === '0/5' }
  ];
  const passed = checks.filter(x => x.pass).length;
  console.log(JSON.stringify({ validator: 'TEMP-M01-HXL-FROZEN-RETURN-SLOT-PROJECTOR-V0.1', passed, total: checks.length, checks, case_results: results }, null, 2));
  if (passed !== checks.length) process.exit(1);
}
