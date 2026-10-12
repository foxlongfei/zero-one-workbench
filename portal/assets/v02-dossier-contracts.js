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
      ['training.phaseId', typeof dossier?.training?.phaseId === 'string' && dossier.training.phaseId.startsWith('push-up:') && dossier.definition.dynamics.phases.some(item => item.phaseId === dossier.training.phaseId)],
      ['training.speed', Number.isFinite(dossier?.training?.speed) && dossier.training.speed > 0],
      ['boundaries.noteStorage', dossier?.boundaries?.noteStorage === 'LOCAL_BROWSER_ONLY'],
      ['boundaries.guidance', Boolean(dossier?.boundaries?.guidance)],
    ];
    const missing = checks.filter(([, passed]) => !passed).map(([field]) => field);
    return Object.freeze({status: missing.length ? 'INCOMPLETE' : 'FIELDS_COMPLETE_WITH_BOUNDARIES', passed: checks.length - missing.length, total: checks.length, missing});
  }

  function buildExerciseDossier({record, definition, note, phase, phaseId, phaseName, speed, guidance, exportedAt}) {
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
          keypointSequence: definition?.dynamics?.keypointSequence ? JSON.parse(JSON.stringify(definition.dynamics.keypointSequence)) : null,
          keypointComparison: definition?.dynamics?.keypointComparison ? JSON.parse(JSON.stringify(definition.dynamics.keypointComparison)) : null,
        },
      },
      training: {
        note: String(note || ''),
        phase: Math.round(Number(phase)),
        phaseId: String(phaseId || ''),
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

  function validateStandardKeypointSequence(sequence, phases) {
    const phaseList = Array.isArray(phases) ? phases : [];
    const requiredPoints = ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'];
    if (!sequence || sequence.schema !== 'zero-one.standard-keypoints.v0.1') return '关键点 schema 不匹配';
    if (sequence.coordinateSystem !== 'NORMALIZED_2D_SIDE_VIEW_X_RIGHT_Y_DOWN') return '关键点坐标系不匹配';
    if (!Array.isArray(sequence.frames) || sequence.frames.length !== phaseList.length || phaseList.length !== 5) return '关键点帧必须与五个标准阶段一一对应';
    for (let index = 0; index < phaseList.length; index += 1) {
      const frame = sequence.frames[index];
      if (!frame || frame.frame !== index || frame.phaseId !== phaseList[index].phaseId) return `关键点第 ${index + 1} 帧与标准阶段不一致`;
      const pointNames = frame.points && typeof frame.points === 'object' ? Object.keys(frame.points).sort() : [];
      if (JSON.stringify(pointNames) !== JSON.stringify([...requiredPoints].sort())) return `关键点第 ${index + 1} 帧点位集合不完整`;
      for (const name of requiredPoints) {
        const point = frame.points[name];
        if (!Array.isArray(point) || point.length !== 2 || point.some(value => !Number.isFinite(value) || value < 0 || value > 1)) return `关键点第 ${index + 1} 帧 ${name} 坐标无效`;
      }
    }
    return '';
  }

  function compareStandardKeypointSequences(reference, candidate, phases) {
    const referenceError = validateStandardKeypointSequence(reference, phases);
    if (referenceError) throw new TypeError(`标准序列无效：${referenceError}`);
    const candidateError = validateStandardKeypointSequence(candidate, phases);
    if (candidateError) throw new TypeError(`导入序列无效：${candidateError}`);
    const pointNames = ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'];
    const frames = reference.frames.map((referenceFrame, index) => {
      const candidateFrame = candidate.frames[index];
      const points = Object.fromEntries(pointNames.map(name => {
        const dx = candidateFrame.points[name][0] - referenceFrame.points[name][0];
        const dy = candidateFrame.points[name][1] - referenceFrame.points[name][1];
        return [name, {dx, dy, distance: Math.hypot(dx, dy)}];
      }));
      return {frame: index, phaseId: referenceFrame.phaseId, points};
    });
    const distances = frames.flatMap(frame => Object.values(frame.points).map(point => point.distance));
    const largestDeviation = frames.reduce((largest, frame) => {
      for (const [pointName, point] of Object.entries(frame.points)) {
        if (!largest || point.distance > largest.distance) largest = {frame: frame.frame, phaseId: frame.phaseId, point: pointName, ...point};
      }
      return largest;
    }, null);
    return Object.freeze({
      schema: 'zero-one.keypoint-comparison.v0.1',
      coordinateSystem: reference.coordinateSystem,
      frameCount: frames.length,
      pointCount: distances.length,
      meanDistance: distances.reduce((sum, value) => sum + value, 0) / distances.length,
      maxDistance: Math.max(...distances),
      largestDeviation,
      interpretation: `最大参考偏差位于 ${largestDeviation.phaseId} / ${largestDeviation.point}；应先复核阶段对齐、取景与标点，不据此判断动作质量。`,
      frames,
      boundary: 'NORMALIZED_2D_REFERENCE_COMPARISON_NOT_POSE_RECOGNITION_OR_DIAGNOSIS',
    });
  }

  function validateResidenceFieldRevisions(record) {
    if (record?.fieldRevisions == null) return '';
    if (!Array.isArray(record.fieldRevisions)) return 'fieldRevisions 必须是数组';
    const allowed = new Set(['name', 'place', 'dir', 'floor', 'rooms', 'size', 'needs', 'surround', 'material', 'source', 'confidence']);
    const lastByField = new Map();
    const revisionIds = new Set();
    let previousRevisionId = null;
    for (let index = 0; index < record.fieldRevisions.length; index += 1) {
      const revision = record.fieldRevisions[index];
      if (!revision || revision.caseId !== record.id) return `fieldRevisions[${index}].caseId 与 Residence/Case ID 不一致`;
      if (!revision.revisionId || revisionIds.has(revision.revisionId) || revision.parentRevisionId !== previousRevisionId || Number.isNaN(Date.parse(revision.at || ''))) return `fieldRevisions[${index}] 修订链无效`;
      if (!Array.isArray(revision.changes) || !revision.changes.length) return `fieldRevisions[${index}].changes 不能为空`;
      for (const change of revision.changes) {
        if (!change || !allowed.has(change.field) || typeof change.before !== 'string' || typeof change.after !== 'string' || change.before === change.after) return `fieldRevisions[${index}] 字段变更无效`;
        lastByField.set(change.field, change.after);
      }
      revisionIds.add(revision.revisionId);
      previousRevisionId = revision.revisionId;
    }
    for (const [field, after] of lastByField) {
      if (String(record.fields?.[field] || '') !== after) return `fieldRevisions.${field} 最终状态与住宅字段不一致`;
    }
    return '';
  }

  function validateResidenceEvidenceLedger(record) {
    const allowed = new Set(['name', 'place', 'dir', 'floor', 'rooms', 'size', 'needs', 'surround', 'material']);
    const fields = record?.fields && typeof record.fields === 'object' ? record.fields : {};
    const evidence = record?.evidence && typeof record.evidence === 'object' && !Array.isArray(record.evidence) ? record.evidence : {};
    for (const [key, item] of Object.entries(evidence)) {
      if (!allowed.has(key)) return `evidence.${key} 不是可补证字段`;
      if (!String(fields[key] || '').trim()) return `evidence.${key} 对应字段为空`;
      if (!item || typeof item !== 'object' || String(item.value || '').trim() !== String(fields[key]).trim()) return `evidence.${key}.value 与住宅字段不一致`;
      if (!String(item.source || '').trim() || !String(item.confidence || '').trim() || Number.isNaN(Date.parse(item.capturedAt || ''))) return `evidence.${key} 证据字段不完整`;
    }
    return '';
  }

  function validateResidenceEvidenceRevisions(record) {
    if (record?.evidenceRevisions == null) return '';
    if (!Array.isArray(record.evidenceRevisions)) return 'evidenceRevisions 必须是数组';
    const allowed = new Set(['name', 'place', 'dir', 'floor', 'rooms', 'size', 'needs', 'surround', 'material']);
    const lastByField = new Map();
    for (let index = 0; index < record.evidenceRevisions.length; index += 1) {
      const revision = record.evidenceRevisions[index];
      if (!revision || revision.caseId !== record.id) return `evidenceRevisions[${index}].caseId 与 Residence/Case ID 不一致`;
      if (!allowed.has(revision.field) || !['SAVE', 'UNDO'].includes(revision.action) || Number.isNaN(Date.parse(revision.at || ''))) return `evidenceRevisions[${index}] 修订字段无效`;
      if (revision.action === 'SAVE' && (!revision.after || !revision.after.value || !revision.after.source || !revision.after.confidence || Number.isNaN(Date.parse(revision.after.capturedAt || '')))) return `evidenceRevisions[${index}].after 证据无效`;
      if (revision.action === 'UNDO' && (!revision.before || revision.after !== null)) return `evidenceRevisions[${index}] 撤销证据无效`;
      lastByField.set(revision.field, revision);
    }
    for (const [field, revision] of lastByField) {
      const current = record.evidence?.[field];
      if (revision.action === 'UNDO' && current != null) return `evidenceRevisions.${field} 最终撤销状态与证据账本不一致`;
      if (revision.action === 'SAVE' && JSON.stringify(current || null) !== JSON.stringify(revision.after)) return `evidenceRevisions.${field} 最终保存状态与证据账本不一致`;
    }
    return '';
  }

  function validateResidenceImport(record) {
    if (!record || record.schema !== 'zero-one.residence.v0.2') return 'schema 不匹配';
    if (typeof record.id !== 'string' || !record.id.startsWith('residence')) return 'Residence/Case ID 无效';
    if (!record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) return 'fields 必须是对象';
    if (record.evidence != null && (typeof record.evidence !== 'object' || Array.isArray(record.evidence))) return 'evidence 必须是对象';
    const evidenceError = validateResidenceEvidenceLedger(record);
    if (evidenceError) return evidenceError;
    const evidenceRevisionError = validateResidenceEvidenceRevisions(record);
    if (evidenceRevisionError) return evidenceRevisionError;
    const fieldRevisionError = validateResidenceFieldRevisions(record);
    if (fieldRevisionError) return fieldRevisionError;
    if (record.materialFiles != null && !Array.isArray(record.materialFiles)) return 'materialFiles 必须是数组';
    const materialAssessment = assessResidenceMaterialChain(record);
    if (materialAssessment.errors.length) return materialAssessment.errors[0];
    if (record.materialChain != null && (record.materialChain.status !== materialAssessment.status || record.materialChain.caseId !== materialAssessment.caseId || record.materialChain.materialCount !== materialAssessment.materialCount)) return 'materialChain 与材料清单不一致';
    const clarificationAssessment = assessResidenceClarification(record);
    if (record.clarificationState != null && (record.clarificationState.status !== clarificationAssessment.status || record.clarificationState.knownCount !== clarificationAssessment.knownCount || record.clarificationState.totalFields !== clarificationAssessment.totalFields || record.clarificationState.knownEvidenceRequiredCount !== clarificationAssessment.knownEvidenceRequiredCount || record.clarificationState.evidencedKnownCount !== clarificationAssessment.evidencedKnownCount || record.clarificationState.nextField !== clarificationAssessment.nextField || record.clarificationState.question !== clarificationAssessment.question || JSON.stringify(record.clarificationState.missingFields) !== JSON.stringify(clarificationAssessment.missingFields) || JSON.stringify(record.clarificationState.unsupportedKnownFields) !== JSON.stringify(clarificationAssessment.unsupportedKnownFields))) return 'clarificationState 与住宅字段不一致';
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
    const evidence = record?.evidence && typeof record.evidence === 'object' ? record.evidence : {};
    const missingFields = fieldDefs.map(([key]) => key).filter(key => !String(fields[key] || '').trim());
    const evidenceRequiredFields = fieldDefs.map(([key]) => key).filter(key => !['source', 'confidence'].includes(key) && String(fields[key] || '').trim());
    const supportedKnownFields = evidenceRequiredFields.filter(key => evidence[key] && String(evidence[key].value || '').trim() === String(fields[key] || '').trim() && String(evidence[key].source || '').trim() && String(evidence[key].confidence || '').trim());
    const unsupportedKnownFields = evidenceRequiredFields.filter(key => !supportedKnownFields.includes(key));
    const nextField = missingFields[0] || '';
    const nextLabel = fieldDefs.find(([key]) => key === nextField)?.[1] || '';
    return Object.freeze({
      status: missingFields.length ? 'ACTIVE_CLARIFICATION_REQUIRED' : 'FIELDS_COMPLETE_PENDING_REAL_RESIDENCE_ACCEPTANCE',
      knownCount: fieldDefs.length - missingFields.length,
      totalFields: fieldDefs.length,
      missingFields,
      knownEvidenceRequiredCount: evidenceRequiredFields.length,
      evidencedKnownCount: supportedKnownFields.length,
      unsupportedKnownFields,
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

  const api = Object.freeze({assessExerciseDossier, buildExerciseDossier, validateStandardKeypointSequence, compareStandardKeypointSequences, validateResidenceEvidenceLedger, validateResidenceEvidenceRevisions, validateResidenceFieldRevisions, validateResidenceImport, assessResidenceMaterialChain, assessResidenceClarification, assessResidenceAnalysisChain});
  root.ZeroOneDossierContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'object' ? globalThis : this);
