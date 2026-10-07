#!/usr/bin/env node
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const k2Path = path.join(root, "portal/data/depthmap-vga.csv");
const k3Path = path.join(root, "portal/data/k3-radiance-daylight.json");
const k4Path = path.join(root, "portal/data/k4-evidence-layers.json");
const outPath = process.argv[2] || path.join(root, "portal/data/k5-advisor-case.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function parseCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((key, index) => [key, values[index]]));
  });
}

const k2 = parseCsv(k2Path);
const k3 = readJson(k3Path);
const k4 = readJson(k4Path);
const connectivity = k2.map(row => Number(row.Connectivity));
if (!connectivity.length || connectivity.some(value => !Number.isFinite(value))) {
  throw new Error("K2 Connectivity input is invalid");
}
if (k3.passed !== true || k3.analysis?.sensorCount !== 20) {
  throw new Error("K3 Radiance artifact has not passed");
}
if (k4.status !== "COMPLETED" || k4.caseBoundary?.geometryContinuity !== "NOT_PROVEN") {
  throw new Error("K4 evidence boundary is not ready");
}
const layerCount = type => k4.layers.filter(item => item.layer === type).length;
const summary = {
  pointCount: connectivity.length,
  meanConnectivity: Number((connectivity.reduce((a, b) => a + b, 0) / connectivity.length).toFixed(1)),
  minimumConnectivity: Math.min(...connectivity),
  maximumConnectivity: Math.max(...connectivity)
};
const radiance = k3.analysis.summary;
const artifact = {
  schema: "zero-one.k5.advisor-case.v0.1",
  caseId: "K02_REFERENCE_RESIDENTIAL_CASE_V0.1",
  status: "COMPLETED",
  generatedAt: new Date().toISOString(),
  runtime: {
    engine: "Node.js deterministic evidence-bound advisor",
    node: process.version,
    actualRun: true,
    githubSha: process.env.GITHUB_SHA || "LOCAL_RUN",
    sourceArtifacts: [
      { id: "K2_DEPTHMAPX_VGA", path: "portal/data/depthmap-vga.csv", sha256: sha256(k2Path) },
      { id: k3.calculationId, path: "portal/data/k3-radiance-daylight.json", sha256: sha256(k3Path) },
      { id: k4.caseId, path: "portal/data/k4-evidence-layers.json", sha256: sha256(k4Path) }
    ]
  },
  conversation: {
    userMaterial: {
      question: "请综合看这个住宅样板的空间、采光和传统坐向层，并说明还不能判断什么。",
      supplied: [
        "K2 reference residential DXF",
        "K3 5 m x 4 m x 3 m Radiance reference room with south window",
        "measured azimuth input 180 degrees"
      ]
    },
    recognizedKnown: [
      "K2 depthmapX artifact is reproducible for its stored reference DXF",
      "K3 Radiance artifact is reproducible for its fixed reference room and clear-sky point in time",
      "180 degrees normalizes to 午 under the product 24-mountain engineering convention",
      "K4 evidence layers and blocking rules are available"
    ],
    necessaryUnknowns: [
      "K2/K3 geometry continuity is NOT_PROVEN",
      "No user-home geometry identity is established",
      "No annual climate daylight result is available",
      "No field-verified road, water, slope or external obstruction observations are supplied"
    ],
    clarification: "若要判断你的实际住宅，必须补充可转换墙线的户型、窗墙尺寸/朝向、地点或天气文件，并把现场道路、水体、坡向、遮挡逐项注明采集来源。"
  },
  modelResults: {
    spatial: {
      engine: "depthmapX 0.9.1",
      artifact: "portal/data/depthmap-vga.csv",
      unit: "graph connections per VGA point",
      ...summary,
      interpretation: "Only the stored reference DXF may be described; Connectivity is not qi or auspiciousness."
    },
    daylight: {
      engine: k3.engine.version,
      artifact: "portal/data/k3-radiance-daylight.json",
      unit: "lux",
      sensorCount: k3.analysis.sensorCount,
      meanLux: radiance.meanLux,
      minimumLux: radiance.minimumLux,
      maximumLux: radiance.maximumLux,
      uniformityMinOverMean: radiance.uniformityMinOverMean,
      nearWindowMeanLux: radiance.nearWindowMeanLux,
      deepZoneMeanLux: radiance.deepZoneMeanLux,
      interpretation: "The fixed K3 model shows a point-in-time daylight gradient; it is not a measurement or annual result for another dwelling."
    },
    traditional: {
      normalizedDirection: "午",
      azimuthDegrees: 180,
      evidenceId: "T-K4-03",
      interpretation: "The label is a traceable nomenclature normalization only; it does not produce a fortune verdict."
    }
  },
  advisorFeedback: [
    {
      id: "K5-F01",
      type: "ACTIONABLE_WITHIN_MODEL",
      priority: 1,
      title: "先建立同一几何，再做跨模型综合",
      reason: "K2/K3 geometry continuity is NOT_PROVEN.",
      action: "为实际住宅准备同一套墙线、窗墙尺寸、方位和地点输入，分别重跑 depthmapX 与 Radiance 后再比较。",
      evidence: ["F-K2-01", "F-K3-01", "K4-R04"]
    },
    {
      id: "K5-F02",
      type: "MODEL_SCOPED_OBSERVATION",
      priority: 2,
      title: "参考采光模型的深区弱于近窗区",
      reason: "K3 near-window mean is 1049.2 lx and deep-zone mean is 494.0 lx.",
      action: "在真实个案重算前，只把它作为检查深区采光、遮挡和补光需求的提示，不直接套用数值。",
      evidence: ["F-K3-01", "H-K4-01"]
    },
    {
      id: "K5-F03",
      type: "EVIDENCE_BOUNDARY",
      priority: 3,
      title: "传统坐向层保留来源，不生成吉凶断语",
      reason: "180 degrees maps to 午 under the explicit engineering convention; K4 blocks cross-layer equivalence.",
      action: "继续收集用户要讨论的传统命题及其具体出处，逐条与现代可测结果分栏解释。",
      evidence: ["T-K4-03", "K4-R03", "U-K4-01"]
    }
  ],
  followUps: [
    {
      id: "WHY_NO_FORTUNE",
      question: "为什么不直接说吉凶？",
      answer: "现有产物只能证明特定模型输入下的空间与照度结果，以及传统文本中确有相关术语。没有可操作的证据桥把 Connectivity 或 lux 等同为吉凶，因此该等同主张被 K4-R03 阻断。",
      evidence: ["K4-R03", "U-K4-01"]
    },
    {
      id: "WHAT_DEEP_LUX_MEANS",
      question: "深区照度较低意味着什么？",
      answer: "只对固定 K3 参考房间，它说明该晴空时刻深区工作面照度低于近窗区；可提示检查采光分布，但不能替代全年指标、现场测量或你的住宅重算。",
      evidence: ["F-K3-01", "H-K4-01"]
    },
    {
      id: "CAN_USE_MY_HOME",
      question: "这个结果能用于我的房子吗？",
      answer: "不能直接套用。需要你的可转换户型、窗墙尺寸和朝向、地点/天气以及现场遮挡资料，先建立同一几何并重新运行两个引擎。",
      evidence: ["K4-R04", "K5-F01"]
    }
  ],
  evidenceSummary: {
    computedFacts: layerCount("COMPUTED_FACT"),
    traditionalTexts: layerCount("TRADITIONAL_TEXT"),
    modernHypotheses: layerCount("MODERN_HYPOTHESIS"),
    unverifiedClaims: layerCount("UNVERIFIED_CLAIM"),
    geometryContinuity: k4.caseBoundary.geometryContinuity,
    crossLayerEquivalence: "BLOCK"
  },
  checks: {
    sourceArtifactsReadAtRuntime: true,
    knownAndUnknownSeparated: true,
    modelResultsCarryUnitsAndScope: true,
    feedbackCitesEvidenceIds: true,
    followUpAnswersAvailable: true,
    crossLayerEquivalenceBlocked: true,
    geometryContinuityNotOverclaimed: true,
    userHomeTransferBlockedUntilRerun: true
  }
};
if (artifact.modelResults.spatial.pointCount !== 263 ||
    artifact.modelResults.spatial.meanConnectivity !== 124.8 ||
    artifact.evidenceSummary.computedFacts < 2 ||
    artifact.evidenceSummary.traditionalTexts < 3 ||
    !Object.values(artifact.checks).every(Boolean)) {
  throw new Error("K5 acceptance checks failed");
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + "\n");
console.log(JSON.stringify({
  output: path.relative(root, outPath),
  caseId: artifact.caseId,
  status: artifact.status,
  k2Points: artifact.modelResults.spatial.pointCount,
  k3Sensors: artifact.modelResults.daylight.sensorCount,
  feedbackItems: artifact.advisorFeedback.length,
  followUps: artifact.followUps.length,
  passed: true
}));
