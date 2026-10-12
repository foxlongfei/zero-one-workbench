(function exposeDossierContracts(root) {
  'use strict';

  function assessExerciseDossier(dossier) {
    const checks = [
      ['schema', dossier?.schema === 'zero-one.exercise.dossier.v0.2'],
      ['exerciseId', typeof dossier?.exerciseId === 'string' && dossier.exerciseId.startsWith('exercise:wger:')],
      ['record.wgerId', Number.isInteger(dossier?.record?.wgerId) && dossier.record.wgerId > 0],
      ['record.name', Boolean(dossier?.record?.name)],
      ['record.source', Boolean(dossier?.record?.source)],
      ['record.version', Boolean(dossier?.record?.version)],
      ['record.author', Boolean(dossier?.record?.author)],
      ['record.license', Boolean(dossier?.record?.license)],
      ['record.variantRelation', Boolean(dossier?.record?.variantRelation)],
      ['record.mediaEvidence', Boolean(dossier?.record?.mediaEvidence?.status) && (dossier.record.mediaEvidence.status === 'NO_MEDIA_IN_CURRENT_RECORD' || (Boolean(dossier.record.mediaEvidence.repositoryAsset) && /^[a-f0-9]{64}$/i.test(dossier.record.mediaEvidence.sha256 || '')))],
      ['definition.guidanceScope', Boolean(dossier?.definition?.guidanceScope)],
      ['definition.aliases', Array.isArray(dossier?.definition?.aliases) && dossier.definition.aliases.length > 0],
      ['definition.category', Boolean(dossier?.definition?.category)],
      ['definition.equipment', Boolean(dossier?.definition?.equipment)],
      ['definition.difficulty', Boolean(dossier?.definition?.difficulty)],
      ['definition.steps', Array.isArray(dossier?.definition?.steps) && dossier.definition.steps.length > 0],
      ['definition.variants', Array.isArray(dossier?.definition?.variants) && dossier.definition.variants.length > 0],
      ['definition.sourceVariants', Array.isArray(dossier?.definition?.sourceVariants) && dossier.definition.sourceVariants.length >= 2 && dossier.definition.sourceVariants.every(item => typeof item.exerciseId === 'string' && item.exerciseId.startsWith('exercise:wger:') && Number.isInteger(item.wgerId) && item.wgerId > 0 && item.source && item.license)],
      ['definition.muscles.primary', Array.isArray(dossier?.definition?.muscles?.primary) && dossier.definition.muscles.primary.length > 0],
      ['definition.muscles.secondary', Array.isArray(dossier?.definition?.muscles?.secondary) && dossier.definition.muscles.secondary.length > 0],
      ['definition.muscles.stabilizers', Array.isArray(dossier?.definition?.muscles?.stabilizers) && dossier.definition.muscles.stabilizers.length > 0],
      ['definition.joints', Array.isArray(dossier?.definition?.joints) && dossier.definition.joints.length > 0],
      ['definition.dynamics.controls', Array.isArray(dossier?.definition?.dynamics?.controls) && dossier.definition.dynamics.controls.length >= 4],
      ['definition.dynamics.scope', Boolean(dossier?.definition?.dynamics?.scope)],
      ['definition.dynamics.timeline', Array.isArray(dossier?.definition?.dynamics?.phases) && dossier.definition.dynamics.phases.length === 5 && dossier.definition.dynamics.phases.every((item, index, phases) => typeof item.phaseId === 'string' && item.phaseId.startsWith('push-up:') && Array.isArray(item.range) && item.range.length === 2 && item.range[0] === (index ? phases[index - 1].range[1] + 1 : 0) && item.range[1] >= item.range[0] && item.range[1] <= 100 && Array.isArray(item.jointActions) && item.jointActions.length > 0 && Boolean(item.bodyAlignment)) && dossier.definition.dynamics.phases.at(-1).range[1] === 100],
      ['training.phase', Number.isFinite(dossier?.training?.phase)],
      ['training.speed', Number.isFinite(dossier?.training?.speed) && dossier.training.speed > 0],
      ['boundaries.noteStorage', dossier?.boundaries?.noteStorage === 'LOCAL_BROWSER_ONLY'],
      ['boundaries.guidance', Boolean(dossier?.boundaries?.guidance)],
    ];
    const missing = checks.filter(([, passed]) => !passed).map(([field]) => field);
    return Object.freeze({status: missing.length ? 'INCOMPLETE' : 'FIELDS_COMPLETE_WITH_BOUNDARIES', passed: checks.length - missing.length, total: checks.length, missing});
  }

  function buildExerciseDossier({record, definition, note, phase, phaseName, speed, guidance, exportedAt}) {
    if (!record || typeof record.exerciseId !== 'string' || !record.exerciseId) {
      throw new TypeError('Exercise record requires a stable exerciseId');
    }
    const dossier = {
      schema: 'zero-one.exercise.dossier.v0.2',
      exerciseId: record.exerciseId,
      record: {
        wgerId: record.id,
        name: record.name,
        upstreamName: record.upstreamName,
        source: record.source,
        sourceUrl: record.sourceUrl,
        version: record.version,
        author: record.author,
        license: record.license,
        variantRelation: record.variantRelation,
        mediaEvidence: record.mediaEvidence ? {...record.mediaEvidence} : null,
        status: record.status,
        media: record.media,
      },
      definition: {
        guidanceScope: String(definition?.guidanceScope || ''),
        aliases: Array.isArray(definition?.aliases) ? [...definition.aliases] : [],
        category: String(definition?.category || ''),
        equipment: String(definition?.equipment || ''),
        difficulty: String(definition?.difficulty || ''),
        steps: Array.isArray(definition?.steps) ? [...definition.steps] : [],
        variants: Array.isArray(definition?.variants) ? definition.variants.map(item => ({...item})) : [],
        sourceVariants: Array.isArray(definition?.sourceVariants) ? definition.sourceVariants.map(item => ({...item})) : [],
        muscles: {
          primary: Array.isArray(definition?.muscles?.primary) ? [...definition.muscles.primary] : [],
          secondary: Array.isArray(definition?.muscles?.secondary) ? [...definition.muscles.secondary] : [],
          stabilizers: Array.isArray(definition?.muscles?.stabilizers) ? [...definition.muscles.stabilizers] : [],
        },
        joints: Array.isArray(definition?.joints) ? definition.joints.map(item => ({...item})) : [],
        dynamics: {
          capability: String(definition?.dynamics?.capability || ''),
          scope: String(definition?.dynamics?.scope || ''),
          controls: Array.isArray(definition?.dynamics?.controls) ? [...definition.dynamics.controls] : [],
          phases: Array.isArray(definition?.dynamics?.phases) ? definition.dynamics.phases.map(item => ({...item, range: Array.isArray(item.range) ? [...item.range] : []})) : [],
        },
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
    dossier.completeness = assessExerciseDossier(dossier);
    return dossier;
  }

  function validateResidenceImport(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return 'schema 不匹配';
    if (typeof record.id !== 'string' || !record.id.startsWith('residence')) return 'Residence/Case ID 无效';
    if (!record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) return 'fields 必须是对象';
    if (record.evidence != null && (typeof record.evidence !== 'object' || Array.isArray(record.evidence))) return 'evidence 必须是对象';
    if (record.materialFiles != null && !Array.isArray(record.materialFiles)) return 'materialFiles 必须是数组';
    const materialAssessment = assessResidenceMaterialChain(record);
    if (materialAssessment.errors.length) return materialAssessment.errors[0];
    if (record.materialChain != null && (record.materialChain.status !== materialAssessment.status || record.materialChain.caseId !== materialAssessment.caseId || record.materialChain.materialCount !== materialAssessment.materialCount)) return 'materialChain 与材料清单不一致';
    const clarificationAssessment = assessResidenceClarification(record);
    if (record.clarificationState != null && (record.clarificationState.status !== clarificationAssessment.status || record.clarificationState.knownCount !== clarificationAssessment.knownCount || record.clarificationState.totalFields !== clarificationAssessment.totalFields || record.clarificationState.nextField !== clarificationAssessment.nextField || JSON.stringify(record.clarificationState.missingFields) !== JSON.stringify(clarificationAssessment.missingFields))) return 'clarificationState 与住宅字段不一致';
    if (record.revisions != null && !Array.isArray(record.revisions)) return 'revisions 必须是数组';
    if (record.boundaries != null && (typeof record.boundaries !== 'object' || Array.isArray(record.boundaries))) return 'boundaries 必须是对象';
    if (record.analysisChain != null && (typeof record.analysisChain !== 'object' || Array.isArray(record.analysisChain))) return 'analysisChain 必须是对象或 null';
    if (record.analysisChain && record.analysisChain.caseId !== record.id) return 'analysisChain.caseId 与 Residence/Case ID 不一致';
    if (record.analysisChain?.depthmapX && record.analysisChain.depthmapX.caseId != null && record.analysisChain.depthmapX.caseId !== record.id) return 'depthmapX.caseId 与 Residence/Case ID 不一致';
    if (record.analysisChain?.radiance && record.analysisChain.radiance.caseId != null && record.analysisChain.radiance.caseId !== record.id) return 'radiance.caseId 与 Residence/Case ID 不一致';
    if (record.analysisChain) {
      const depthmapX = record.analysisChain.depthmapX;
      const radiance = record.analysisChain.radiance;
      if (!depthmapX || typeof depthmapX !== 'object') return 'analysisChain 缺少 depthmapX 证据';
      if (!radiance || typeof radiance !== 'object') return 'analysisChain 缺少 Radiance 证据';
      if (!depthmapX.engine || !Number.isInteger(depthmapX.pointCount) || depthmapX.pointCount <= 0 || !/^[a-f0-9]{64}$/i.test(depthmapX.outputSha256 || '')) return 'depthmapX 证据字段无效';
      if (!radiance.engine || !Number.isInteger(radiance.sensorCount) || radiance.sensorCount <= 0 || !/^[a-f0-9]{64}$/i.test(radiance.modelSha256 || '')) return 'Radiance 证据字段无效';
    }
    return '';
  }

  function assessResidenceMaterialChain(record) {
    const files = Array.isArray(record?.materialFiles) ? record.materialFiles : [];
    const errors = [];
    files.forEach((item, index) => {
      if (!item || typeof item !== 'object') errors.push(`materialFiles[${index}] 必须是对象`);
      else if (item.caseId !== record?.id) errors.push(`materialFiles[${index}].caseId 与 Residence/Case ID 不一致`);
      else if (!item.name || !item.source || !item.license || !Number.isInteger(item.bytes) || item.bytes <= 0 || !/^[a-f0-9]{64}$/i.test(item.sha256 || '')) errors.push(`materialFiles[${index}] 证据字段无效`);
    });
    return Object.freeze({
      status: errors.length ? 'INVALID_MATERIAL_CHAIN' : files.length ? 'VALID_SAME_CASE_MATERIAL_CHAIN' : 'NO_MATERIAL_CHAIN',
      errors,
      caseId: String(record?.id || ''),
      materialCount: files.length,
      sha256Count: files.filter(item => /^[a-f0-9]{64}$/i.test(item?.sha256 || '')).length,
    });
  }

  function assessResidenceClarification(record) {
    const fieldDefs = [
      ['name', '住宅名称'], ['place', '所在地区'], ['dir', '朝向'], ['floor', '楼层'],
      ['rooms', '房间与布局'], ['size', '面积与尺度'], ['needs', '居住者需求'],
      ['surround', '周边环境'], ['material', '材料说明'], ['source', '材料来源'], ['confidence', '当前置信度'],
    ];
    const fields = record?.fields && typeof record.fields === 'object' ? record.fields : {};
    const missingFields = fieldDefs.map(([key]) => key).filter(key => !String(fields[key] || '').trim());
    const nextField = missingFields[0] || '';
    const nextLabel = fieldDefs.find(([key]) => key === nextField)?.[1] || '';
    return Object.freeze({
      status: missingFields.length ? 'ACTIVE_CLARIFICATION_REQUIRED' : 'FIELDS_COMPLETE_PENDING_REAL_RESIDENCE_ACCEPTANCE',
      knownCount: fieldDefs.length - missingFields.length,
      totalFields: fieldDefs.length,
      missingFields,
      nextField,
      question: missingFields.length ? `请补充“${nextLabel}”，并说明它来自测量、描述、图纸还是现场观察。` : '材料字段已齐；仍需真实住宅材料验收。',
    });
  }

  function assessResidenceAnalysisChain(record) {
    if (!record?.analysisChain) return Object.freeze({status: 'NO_ANALYSIS_CHAIN', errors: []});
    const validationError = validateResidenceImport(record);
    const errors = validationError ? [validationError] : [];
    return Object.freeze({
      status: errors.length ? 'INVALID_ANALYSIS_CHAIN' : 'VALID_SAME_CASE_ENGINE_CHAIN',
      errors,
      caseId: String(record.id || ''),
      depthmapPointCount: Number(record.analysisChain?.depthmapX?.pointCount || 0),
      radianceSensorCount: Number(record.analysisChain?.radiance?.sensorCount || 0),
    });
  }

  const api = Object.freeze({assessExerciseDossier, buildExerciseDossier, validateResidenceImport, assessResidenceMaterialChain, assessResidenceClarification, assessResidenceAnalysisChain});
  root.ZeroOneDossierContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
