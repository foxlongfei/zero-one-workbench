(function exposeDossierContracts(root) {
  'use strict';

  function buildExerciseDossier({record, note, phase, phaseName, speed, guidance, exportedAt}) {
    if (!record || typeof record.exerciseId !== 'string' || !record.exerciseId) {
      throw new TypeError('Exercise record requires a stable exerciseId');
    }
    return {
      schema: 'zero-one.exercise.dossier.v0.2',
      exerciseId: record.exerciseId,
      record: {
        wgerId: record.id,
        name: record.name,
        upstreamName: record.upstreamName,
        author: record.author,
        license: record.license,
        status: record.status,
        media: record.media,
      },
      training: {
        note: String(note || ''),
        phase: Math.round(Number(phase)),
        phaseName: String(phaseName || ''),
        speed: Number(speed),
      },
      boundaries: {
        noteStorage: 'LOCAL_BROWSER_ONLY',
        guidance: String(guidance || ''),
        animation: 'PROJECT_2D_TEACHING_ILLUSTRATION_NOT_VARIANT_KINEMATICS',
      },
      exportedAt: exportedAt || new Date().toISOString(),
    };
  }

  function validateResidenceImport(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return 'schema 不匹配';
    if (typeof record.id !== 'string' || !record.id.startsWith('residence')) return 'Residence/Case ID 无效';
    if (!record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) return 'fields 必须是对象';
    if (record.evidence != null && (typeof record.evidence !== 'object' || Array.isArray(record.evidence))) return 'evidence 必须是对象';
    if (record.materialFiles != null && !Array.isArray(record.materialFiles)) return 'materialFiles 必须是数组';
    if (record.revisions != null && !Array.isArray(record.revisions)) return 'revisions 必须是数组';
    if (record.boundaries != null && (typeof record.boundaries !== 'object' || Array.isArray(record.boundaries))) return 'boundaries 必须是对象';
    if (record.analysisChain != null && (typeof record.analysisChain !== 'object' || Array.isArray(record.analysisChain))) return 'analysisChain 必须是对象或 null';
    return '';
  }

  const api = Object.freeze({buildExerciseDossier, validateResidenceImport});
  root.ZeroOneDossierContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
