const RELEASE = "M5_TRAINING_LOOP_V0.1";
const wish = document.querySelector("#wish");
const wishResult = document.querySelector("#wishResult");
const parsed = document.querySelector("#m5Parsed");
const actions = document.querySelector("#m5Actions");
const session = document.querySelector("#m5Session");
const feedbackPanel = document.querySelector("#m5FeedbackPanel");
const feedbackResult = document.querySelector("#feedbackResult");

let catalog;
let current = null;
let integratedEvidence = null;
let integrationPanel = null;

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function parseMinutes(text, fallback) {
  const match = text.match(/(\d{1,3})\s*分钟/);
  return match ? Math.max(5, Math.min(120, Number(match[1]))) : fallback;
}

function parseInput(text, scenario) {
  const limitationTerms = catalog.safety.patterns.filter((term) => text.includes(term));
  const body = [];
  if (/背|单杠|引体/.test(text)) body.push("背部");
  if (/手臂|二头|肘/.test(text)) body.push("手臂/肘屈肌群");
  if (/腿|下肢|深蹲/.test(text)) body.push("下肢");
  if (/全身/.test(text)) body.push("全身");
  return {
    body: body.length ? body : scenario.defaults.body,
    purpose: /增肌/.test(text) ? "增肌基础训练" : /力量/.test(text) ? "力量" : scenario.defaults.purpose,
    minutes: parseMinutes(text, scenario.defaults.minutes),
    environment: /户外|公园/.test(text) ? "户外" : /在家|室内/.test(text) ? "室内/家中" : scenario.defaults.environment,
    equipment: /单杠|引体/.test(text) ? ["单杠"] : /无器械|徒手|在家/.test(text) ? ["徒手"] : scenario.defaults.equipment,
    limitations: limitationTerms
  };
}

function chooseScenario(text) {
  const ranked = catalog.scenarios.map((scenario) => ({
    scenario,
    score: scenario.match.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);
  return ranked[0].score > 0 ? ranked[0].scenario : catalog.scenarios[1];
}

function renderIntegratedEvidence(scenario) {
  if (!integrationPanel) return;
  if (!integratedEvidence) {
    document.body.dataset.m5Integration = "blocked";
    integrationPanel.innerHTML = "<b>整机证据桥接未就绪。</b><br>M2 人体、M3 真实动作或 M4 OpenSim 产物未能读入；以下训练组织不计整机闭环完成。";
    return;
  }
  const pose = integratedEvidence.m3.checks.realImagePose;
  const verifiedRightElbow = pose.joints.find((joint) => joint.id === "JOINT_RIGHT_ELBOW");
  const liveRightElbowNode = document.querySelector('#jointMap [data-joint-id="JOINT_RIGHT_ELBOW"]');
  const liveRightElbowAngle = Number(liveRightElbowNode?.dataset.angle);
  const hasLivePose = document.body.dataset.m3PoseState === "passed" && Number.isFinite(liveRightElbowAngle);
  const rightElbowAngle = hasLivePose ? liveRightElbowAngle : verifiedRightElbow.angle;
  const landmarkCount = hasLivePose
    ? Number(document.querySelector("#poseResult")?.dataset.landmarkCount || pose.landmarkCount)
    : pose.landmarkCount;
  const state = integratedEvidence.m4.analysis.states.reduce((best, item) =>
    Math.abs(item.angleDeg - rightElbowAngle) < Math.abs(best.angleDeg - rightElbowAngle) ? item : best
  );
  const biceps = state.muscles.find((muscle) => muscle.name === "BIClong");
  document.body.dataset.m5Integration = "linked";
  document.body.dataset.m5PoseSource = hasLivePose ? "current-page-pose" : "verified-evidence-fallback";
  document.body.dataset.m5MappedElbow = String(rightElbowAngle);
  document.body.dataset.m5OpenSimState = String(state.angleDeg);
  integrationPanel.innerHTML =
    "<b>整机真实证据已桥接｜不是独立文本方案</b><br>" +
    "M2 完整人体：" + integratedEvidence.m2.checks.catalog.meshes + " 个网格 / " +
    integratedEvidence.m2.checks.catalog.systems + " 个系统；" +
    "M3 " + (hasLivePose ? "当前页实时动作" : "已验收样本（当前页尚无新动作）") + "：" +
    landmarkCount + " 个关键点，右肘 " + rightElbowAngle + "°；" +
    "M4 OpenSim：" + integratedEvidence.m4.engine.name + " " +
    integratedEvidence.m4.engine.versionAndDate + "，映射最近状态 " + state.angleDeg +
    "°，BIClong 长度 " + biceps.muscleTendonLengthM.toFixed(6) +
    " m / 力臂 " + biceps.elbowMomentArmM.toFixed(6) + " m。<br>" +
    "当前场景：" + scenario.title + "。这些数值用于把人体、动作和生物力学证据带入训练解释，不等同个人诊断或个体化力值。";
}

async function loadIntegratedEvidence() {
  const [m2Response, m3Response, m4Response] = await Promise.all([
    fetch("../docs/v0.1/evidence/m2/public-webgl-verification.json", { cache: "no-store" }),
    fetch("../docs/v0.1/evidence/m3/public-pose-verification.json", { cache: "no-store" }),
    fetch("data/m4-opensim-arm26-results.json", { cache: "no-store" })
  ]);
  if (!m2Response.ok || !m3Response.ok || !m4Response.ok) throw new Error("整机证据产物 HTTP 读取失败");
  const [m2, m3, m4] = await Promise.all([m2Response.json(), m3Response.json(), m4Response.json()]);
  const pose = m3.checks?.realImagePose;
  if (!m2.passed || !pose?.passed || !m4.passed || !Array.isArray(pose.joints) || !Array.isArray(m4.analysis?.states)) {
    throw new Error("M2/M3/M4 真实证据链不完整");
  }
  return { m2, m3, m4 };
}

function renderParsed(model) {
  parsed.innerHTML = `
    <b>已解析输入</b>
    <div class="m5-tags">
      <span>身体：${model.body.join("、")}</span>
      <span>目的：${model.purpose}</span>
      <span>时间：${model.minutes} 分钟</span>
      <span>环境：${model.environment}</span>
      <span>器械：${model.equipment.join("、")}</span>
      <span>限制：${model.limitations.length ? model.limitations.join("、") : "未描述异常信号"}</span>
    </div>`;
}

function renderSafety(text) {
  current = { kind: "safety", input: text };
  document.body.dataset.m5State = "safety-triage";
  wishResult.innerHTML = `<b>安全分流｜不生成推进性训练计划</b><br>${catalog.safety.message}`;
  parsed.innerHTML = `<b>已识别的异常信号：</b>${catalog.safety.patterns.filter((term) => text.includes(term)).join("、")}`;
  actions.innerHTML = `<div class="m5-action"><b>下一步只收集安全信息</b><br>部位 · 起始时间 · 诱发动作 · 是否持续/加重 · 是否伴随呼吸困难或明显无力。</div>`;
  session.textContent = "训练会话未启动；安全分流优先。";
  feedbackPanel.hidden = true;
  feedbackResult.textContent = "安全分流状态不接受普通“轻松/合适/偏吃力”推进。";
}

function renderPlan(text) {
  const scenario = chooseScenario(text);
  const model = parseInput(text, scenario);
  if (model.limitations.length) return renderSafety(text);
  current = { kind: "plan", scenario, model, completed: false, feedback: null };
  document.body.dataset.m5State = "plan-ready";
  document.body.dataset.m5Scenario = scenario.id;
  wishResult.innerHTML = `<b>${scenario.title}</b><br>匹配 ${scenario.actions.length} 个动作；按 ${model.minutes} 分钟组织。先查看示范、解剖/关节和技术提示，再开始会话。`;
  renderParsed(model);
  renderIntegratedEvidence(scenario);
  actions.innerHTML = scenario.actions.map((action, index) => `
    <article class="m5-action" data-m5-action="${action.id}">
      <h3>${index + 1}. ${action.name}</h3>
      <p><b>剂量：</b>${action.dose}</p>
      <p><b>示范：</b>${action.demo}</p>
      <p><b>解剖：</b>${action.anatomy}</p>
      <p><b>关节：</b>${action.joint}</p>
      <p><b>技术：</b>${action.technique}</p>
    </article>`).join("");
  session.innerHTML = `<button class="btn" id="m5CompleteSession" type="button">完成本次训练，进入反馈</button><span class="status">尚未提交本次体验。</span>`;
  feedbackPanel.hidden = true;
  feedbackResult.textContent = "完成本次训练后选择实际反馈，系统才生成下一次调整。";
  document.querySelector("#m5CompleteSession").addEventListener("click", () => {
    current.completed = true;
    document.body.dataset.m5State = "awaiting-feedback";
    session.innerHTML = `<b>本次会话已完成：</b>${scenario.title}｜${model.minutes} 分钟目标。现在请选择实际感受。`;
    feedbackPanel.hidden = false;
  });
}

function submit() {
  const text = wish.value.trim();
  if (!text) {
    wishResult.textContent = "请先告诉我想练的身体部位、目的、时间、环境/器械或限制。";
    return;
  }
  if (includesAny(text, catalog.safety.patterns)) renderSafety(text);
  else renderPlan(text);
}

function applyFeedback(value) {
  if (!current || current.kind !== "plan" || !current.completed) {
    feedbackResult.textContent = "请先生成并完成一次训练会话，再提交反馈。";
    return;
  }
  const rule = catalog.feedbackRules[value];
  current.feedback = { value, ...rule };
  document.body.dataset.m5State = rule.decision === "SAFETY_STOP" ? "safety-stop" : "loop-complete";
  document.body.dataset.m5Decision = rule.decision;
  feedbackResult.innerHTML = `<b>${value} → ${rule.decision}</b><br>${rule.message}<br><span class="status">闭环记录：输入 → ${current.scenario.title} → ${current.scenario.actions.length} 个动作 → 会话完成 → ${value} → 下一次调整。</span>`;
}

async function init() {
  try {
    integrationPanel = document.createElement("div");
    integrationPanel.id = "m5IntegratedEvidence";
    integrationPanel.className = "plan";
    integrationPanel.innerHTML = "<b>正在读取 M2/M3/M4 真实产物…</b>";
    actions.before(integrationPanel);
    const response = await fetch("data/m5-training-scenarios.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = await response.json();
    if (catalog.release !== RELEASE || catalog.scenarios.length < 2) throw new Error("训练场景产物版本不匹配");
    try {
      integratedEvidence = await loadIntegratedEvidence();
      document.body.dataset.m5Integration = "loaded";
      integrationPanel.innerHTML = "<b>整机证据桥接已加载。</b><br>生成场景后显示 M2 完整人体、M3 真实动作和 M4 OpenSim 的同页证据链。";
    } catch (integrationError) {
      document.body.dataset.m5Integration = "blocked";
      integrationPanel.innerHTML = "<b>整机证据桥接阻塞。</b><br>" + integrationError.message + "；训练组织仍可预览，但不计整机闭环完成。";
    }
    document.body.dataset.m5Release = RELEASE;
    document.body.dataset.m5State = "ready";
    document.querySelector("#m5EngineStatus").textContent = `闭环引擎已就绪｜${catalog.scenarios.length} 个完整场景｜安全分流已启用｜整机证据桥接：${integratedEvidence ? "已加载" : "阻塞"}`;
    document.querySelector("#runWish").addEventListener("click", submit);
    wish.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
    document.querySelectorAll(".preset").forEach((button) => button.addEventListener("click", () => {
      wish.value = button.dataset.v;
      submit();
    }));
    document.querySelectorAll(".feedback").forEach((button) => button.addEventListener("click", () => applyFeedback(button.dataset.v)));
  } catch (error) {
    document.body.dataset.m5State = "error";
    document.querySelector("#m5EngineStatus").textContent = `训练闭环加载失败：${error.message}`;
  }
}

init();
